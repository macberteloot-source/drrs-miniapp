// ─────────────────────────────────────────────────────────────
//  BACKEND — bot Telegram + API + base Postgres
//  Fonctionne SANS base (boutique seule) ; avis / crédits /
//  récompenses s'activent dès que DATABASE_URL est présent.
// ─────────────────────────────────────────────────────────────
require("dotenv").config();
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const { Bot, InlineKeyboard } = require("grammy");
const { Pool } = require("pg");
const { PRODUCTS, REWARDS, unitPrice, creditsFor } = require("./products");

const BOT_TOKEN  = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const OWNER_ID   = process.env.OWNER_ID;            // compte admin (modération)
const PORT       = process.env.PORT || 3000;
const DB_URL     = process.env.DATABASE_URL;

process.on("unhandledRejection", (e) => console.error("⚠️  unhandledRejection:", e?.message || e));
process.on("uncaughtException",  (e) => console.error("⚠️  uncaughtException:",  e?.message || e));

// ── Base de données (optionnelle) ───────────────────────────
let pool = null;
if (DB_URL) {
  const ssl = /railway\.internal|localhost|127\.0\.0\.1/.test(DB_URL) ? false : { rejectUnauthorized: false };
  pool = new Pool({ connectionString: DB_URL, ssl });
}
const q = (sql, params) => pool.query(sql, params);

async function initDb() {
  if (!pool) { console.log("ℹ️  Pas de DATABASE_URL — avis/crédits désactivés."); return; }
  await q(`CREATE TABLE IF NOT EXISTS users(
    id BIGINT PRIMARY KEY, first_name TEXT, username TEXT,
    credits INT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ DEFAULT now())`);
  await q(`CREATE TABLE IF NOT EXISTS reviews(
    id SERIAL PRIMARY KEY, product_id TEXT NOT NULL, user_id BIGINT NOT NULL,
    user_name TEXT, rating INT NOT NULL, body TEXT,
    status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT now())`);
  await q(`CREATE TABLE IF NOT EXISTS orders(
    id SERIAL PRIMARY KEY, user_id BIGINT, items JSONB, total INT, credits INT,
    created_at TIMESTAMPTZ DEFAULT now())`);
  await q(`CREATE TABLE IF NOT EXISTS redemptions(
    id SERIAL PRIMARY KEY, user_id BIGINT, reward_id TEXT, reward_title TEXT, cost INT,
    status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT now())`);
  console.log("🗄️  Base prête.");
}
async function upsertUser(u) {
  await q(`INSERT INTO users(id, first_name, username) VALUES($1,$2,$3)
           ON CONFLICT (id) DO UPDATE SET first_name=EXCLUDED.first_name, username=EXCLUDED.username`,
          [u.id, u.first_name || "Client", u.username || null]);
}

// ── Validation de l'initData signé par Telegram ─────────────
function validateInitData(initData) {
  if (!initData || !BOT_TOKEN) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dcs = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const computed = crypto.createHmac("sha256", secret).update(dcs).digest("hex");
  const ok = computed.length === hash.length && crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
  if (!ok) return null;
  const authDate = Number(params.get("auth_date")) || 0;
  if (Math.floor(Date.now() / 1000) - authDate > 86400) return null;
  try { return JSON.parse(params.get("user") || "{}"); } catch { return null; }
}
function authUser(req) { return validateInitData(req.header("X-Telegram-Init-Data")); }

// ── API ─────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => res.send("ok"));
app.get("/api/products", (_req, res) => res.json(PRODUCTS));
app.get("/api/rewards", (_req, res) => res.json(REWARDS));

// Compte + crédits (connexion Telegram implicite)
app.get("/api/me", async (req, res) => {
  const u = authUser(req);
  if (!u?.id) return res.status(401).json({ error: "Identité Telegram invalide" });
  if (!pool) return res.json({ id: u.id, first_name: u.first_name, credits: 0, db: false });
  try {
    await upsertUser(u);
    const row = (await q("SELECT credits FROM users WHERE id=$1", [u.id])).rows[0];
    res.json({ id: u.id, first_name: u.first_name, credits: row ? row.credits : 0, db: true });
  } catch (e) { console.error("me:", e?.message); res.status(500).json({ error: "Erreur compte" }); }
});

// Avis approuvés (d'un produit, ou tous)
app.get("/api/reviews", async (req, res) => {
  if (!pool) return res.json({ average: 0, count: 0, reviews: [] });
  try {
    const pid = req.query.product;
    let rows;
    if (pid) rows = (await q("SELECT product_id,user_name,rating,body,created_at FROM reviews WHERE product_id=$1 AND status='approved' ORDER BY created_at DESC LIMIT 50", [pid])).rows;
    else     rows = (await q("SELECT product_id,user_name,rating,body,created_at FROM reviews WHERE status='approved' ORDER BY created_at DESC LIMIT 60")).rows;
    const count = rows.length;
    const average = count ? rows.reduce((s, r) => s + r.rating, 0) / count : 0;
    res.json({ average, count, reviews: rows });
  } catch (e) { console.error("reviews get:", e?.message); res.status(500).json({ error: "Erreur avis" }); }
});

// Poster un avis (en attente de validation admin)
app.post("/api/reviews", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "Avis indisponibles (base non connectée)" });
  const u = authUser(req);
  if (!u?.id) return res.status(401).json({ error: "Identité Telegram invalide" });
  const p = PRODUCTS.find(x => x.id === req.body.product_id);
  if (!p) return res.status(400).json({ error: "Produit inconnu" });
  const rating = Math.max(1, Math.min(5, parseInt(req.body.rating, 10) || 0));
  if (!rating) return res.status(400).json({ error: "Note manquante" });
  const body = (req.body.body || "").toString().slice(0, 500);
  try {
    await upsertUser(u);
    const ins = (await q("INSERT INTO reviews(product_id,user_id,user_name,rating,body,status) VALUES($1,$2,$3,$4,$5,'pending') RETURNING id",
      [p.id, u.id, u.first_name || "Client", rating, body])).rows[0];
    if (OWNER_ID && bot) {
      const kb = new InlineKeyboard().text("✅ Valider", `rev:approve:${ins.id}`).text("❌ Refuser", `rev:reject:${ins.id}`);
      await bot.api.sendMessage(OWNER_ID, `📝 Nouvel avis (${rating}★) sur « ${p.title} »\n${u.first_name || "Client"} : ${body || "(sans texte)"}`, { reply_markup: kb });
    }
    res.json({ ok: true, status: "pending" });
  } catch (e) { console.error("reviews post:", e?.message); res.status(500).json({ error: "Erreur envoi avis" }); }
});

// Échanger des crédits contre une récompense
app.post("/api/redeem", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "Récompenses indisponibles (base non connectée)" });
  const u = authUser(req);
  if (!u?.id) return res.status(401).json({ error: "Identité Telegram invalide" });
  const rw = REWARDS.find(x => x.id === req.body.reward_id);
  if (!rw) return res.status(400).json({ error: "Récompense inconnue" });
  try {
    await upsertUser(u);
    const upd = (await q("UPDATE users SET credits=credits-$1 WHERE id=$2 AND credits>=$3 RETURNING credits", [rw.cost, u.id, rw.cost])).rows[0];
    if (!upd) return res.status(400).json({ error: "Crédits insuffisants" });
    const red = (await q("INSERT INTO redemptions(user_id,reward_id,reward_title,cost,status) VALUES($1,$2,$3,$4,'pending') RETURNING id",
      [u.id, rw.id, rw.title, rw.cost])).rows[0];
    if (OWNER_ID && bot) {
      const kb = new InlineKeyboard().text("✅ Valider", `red:ok:${red.id}`).text("❌ Refuser", `red:no:${red.id}`);
      await bot.api.sendMessage(OWNER_ID, `🎁 Demande de récompense : « ${rw.title} » (${rw.cost} crédits)\nPar ${u.first_name || "Client"} (@${u.username || "—"})`, { reply_markup: kb });
    }
    try { await bot.api.sendMessage(u.id, `Ta demande « ${rw.title} » est enregistrée 🎁\nEn attente de validation. Il te reste ${upd.credits} crédits.`); } catch (_) {}
    res.json({ ok: true, credits: upd.credits });
  } catch (e) { console.error("redeem:", e?.message); res.status(500).json({ error: "Erreur échange" }); }
});

// Commande : total recalculé + crédits gagnés
app.post("/api/order", async (req, res) => {
  if (!bot) return res.status(503).json({ error: "Bot indisponible" });
  const user = authUser(req);
  if (!user?.id) return res.status(401).json({ error: "Identité Telegram invalide" });
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: "Panier vide" });

  let total = 0;
  const lines = [];
  for (const it of items) {
    const p = PRODUCTS.find(x => x.id === it.id);
    if (!p) continue;
    const qty = Math.max(1, Math.min(p.stock || 99, parseInt(it.qty, 10) || 1));
    const unit = unitPrice(p.price, qty), line = unit * qty;
    total += line;
    const off = unit < p.price ? ` (−${Math.round((1 - unit / p.price) * 100)}%)` : "";
    lines.push(`• ${p.title} × ${qty} — ${unit} €/u${off} = ${line} €`);
  }
  if (!lines.length) return res.status(400).json({ error: "Aucun article valide" });

  let credits_earned = 0, balance = 0;
  try {
    if (pool) {
      await upsertUser(user);
      credits_earned = creditsFor(total);
      const row = (await q("UPDATE users SET credits=credits+$1 WHERE id=$2 RETURNING credits", [credits_earned, user.id])).rows[0];
      balance = row ? row.credits : 0;
      await q("INSERT INTO orders(user_id,items,total,credits) VALUES($1,$2,$3,$4)", [user.id, JSON.stringify(items), total, credits_earned]);
    }
    const bonus = credits_earned ? `\n\n⭐️ Tu gagnes ${credits_earned} crédits (total : ${balance}).` : "";
    await bot.api.sendMessage(user.id, `Merci ${user.first_name} ! J'ai bien reçu :\n\n${lines.join("\n")}\n\nTotal : ${total} €${bonus}\n\nJe reviens vers toi pour le paiement et la livraison.`);
    if (OWNER_ID) await bot.api.sendMessage(OWNER_ID, `🎨 Nouvelle commande\n\n${lines.join("\n")}\n\nTotal : ${total} €\nClient : ${user.first_name} ${user.last_name || ""} (@${user.username || "—"}, id ${user.id})`);
  } catch (e) { console.error("order:", e?.message); return res.status(502).json({ error: "Impossible d'enregistrer la commande" }); }
  res.json({ ok: true, total, credits_earned, credits: balance });
});

app.listen(PORT, () => console.log(`🌐 Mini App servie sur le port ${PORT}`));

// ── Bot Telegram + modération admin ─────────────────────────
let bot = null;
if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN manquant — la boutique s'affiche, mais le bot est désactivé.");
} else {
  bot = new Bot(BOT_TOKEN);
  bot.catch((err) => console.error("⚠️  Erreur bot:", err?.message || err));

  bot.command("start", async (ctx) => {
    const kb = WEBAPP_URL ? new InlineKeyboard().webApp("🎨 Ouvrir la boutique", WEBAPP_URL) : undefined;
    await ctx.reply("Bienvenue chez DR RS 🎨\nParcours les œuvres, commande, et gagne des crédits.", { reply_markup: kb });
  });

  // Modération des AVIS
  bot.callbackQuery(/^rev:(approve|reject):(\d+)$/, async (ctx) => {
    if (String(ctx.from.id) !== String(OWNER_ID)) return ctx.answerCallbackQuery({ text: "Non autorisé" });
    const approve = ctx.match[1] === "approve", id = ctx.match[2];
    try {
      const r = (await q(`UPDATE reviews SET status=$1 WHERE id=$2 AND status='pending' RETURNING user_id,product_id`,
        [approve ? "approved" : "rejected", id])).rows[0];
      await ctx.answerCallbackQuery({ text: approve ? "Avis publié ✅" : "Avis refusé" });
      await ctx.editMessageReplyMarkup();
      if (r && approve) { try { await bot.api.sendMessage(r.user_id, "Ton avis a été publié, merci ! ⭐️"); } catch (_) {} }
    } catch (e) { await ctx.answerCallbackQuery({ text: "Erreur" }); }
  });

  // Modération des RÉCOMPENSES
  bot.callbackQuery(/^red:(ok|no):(\d+)$/, async (ctx) => {
    if (String(ctx.from.id) !== String(OWNER_ID)) return ctx.answerCallbackQuery({ text: "Non autorisé" });
    const ok = ctx.match[1] === "ok", id = ctx.match[2];
    try {
      const red = (await q("SELECT * FROM redemptions WHERE id=$1", [id])).rows[0];
      if (!red || red.status !== "pending") return ctx.answerCallbackQuery({ text: "Déjà traité" });
      if (ok) {
        await q("UPDATE redemptions SET status='done' WHERE id=$1", [id]);
        await ctx.answerCallbackQuery({ text: "Validé ✅" });
        try { await bot.api.sendMessage(red.user_id, `Ta récompense « ${red.reward_title} » est validée 🎁 Je te recontacte pour l'envoi.`); } catch (_) {}
      } else {
        await q("UPDATE redemptions SET status='refused' WHERE id=$1", [id]);
        await q("UPDATE users SET credits=credits+$1 WHERE id=$2", [red.cost, red.user_id]);
        await ctx.answerCallbackQuery({ text: "Refusé, crédits rendus" });
        try { await bot.api.sendMessage(red.user_id, `Ta récompense « ${red.reward_title} » n'a pas pu être validée. Tes ${red.cost} crédits ont été rendus.`); } catch (_) {}
      }
      await ctx.editMessageReplyMarkup();
    } catch (e) { await ctx.answerCallbackQuery({ text: "Erreur" }); }
  });

  if (WEBAPP_URL) {
    bot.api.setChatMenuButton({ menu_button: { type: "web_app", text: "Boutique", web_app: { url: WEBAPP_URL } } })
      .catch((e) => console.error("Menu button:", e?.message || e));
  }
  bot.start({ drop_pending_updates: true, onStart: (i) => console.log(`🤖 Bot @${i.username} démarré`) })
     .catch((e) => console.error("❌ Démarrage bot impossible:", e?.message || e));
}

initDb().catch((e) => console.error("initDb:", e?.message || e));

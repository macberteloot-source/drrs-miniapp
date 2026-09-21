// ─────────────────────────────────────────────────────────────
//  BACKEND  —  bot Telegram + API + service des fichiers statiques
// ─────────────────────────────────────────────────────────────
require("dotenv").config();
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const { Bot, InlineKeyboard } = require("grammy");
const { PRODUCTS, unitPrice, lineTotal } = require("./products");

const BOT_TOKEN  = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const OWNER_ID   = process.env.OWNER_ID;
const PORT       = process.env.PORT || 3000;

process.on("unhandledRejection", (e) => console.error("⚠️  unhandledRejection:", e?.message || e));
process.on("uncaughtException",  (e) => console.error("⚠️  uncaughtException:",  e?.message || e));

// ── Validation de l'initData signé par Telegram ─────────────
function validateInitData(initData) {
  if (!initData || !BOT_TOKEN) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const dataCheckString = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const computed = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  const ok = computed.length === hash.length &&
    crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
  if (!ok) return null;
  const authDate = Number(params.get("auth_date")) || 0;
  if (Math.floor(Date.now() / 1000) - authDate > 86400) return null;
  try { return JSON.parse(params.get("user") || "{}"); } catch { return null; }
}

// ── Serveur web + API ───────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => res.send("ok"));
app.get("/api/products", (_req, res) => res.json(PRODUCTS));

app.post("/api/order", async (req, res) => {
  if (!bot) return res.status(503).json({ error: "Bot indisponible" });
  const user = validateInitData(req.header("X-Telegram-Init-Data"));
  if (!user?.id) return res.status(401).json({ error: "Identité Telegram invalide" });

  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: "Panier vide" });

  // ⚠️ Tout recalculé serveur : quantité plafonnée au stock, paliers appliqués.
  let total = 0;
  const lines = [];
  for (const it of items) {
    const p = PRODUCTS.find(x => x.id === it.id);
    if (!p) continue;
    const qty = Math.max(1, Math.min(p.stock || 99, parseInt(it.qty, 10) || 1));
    const unit = unitPrice(p.price, qty);
    const line = unit * qty;
    total += line;
    const off = unit < p.price ? ` (−${Math.round((1 - unit / p.price) * 100)}%)` : "";
    lines.push(`• ${p.title} × ${qty} — ${unit} €/u${off} = ${line} €`);
  }
  if (!lines.length) return res.status(400).json({ error: "Aucun article valide" });

  try {
    await bot.api.sendMessage(user.id,
      `Merci ${user.first_name} ! J'ai bien reçu :\n\n${lines.join("\n")}\n\nTotal : ${total} €\n\nJe reviens vers toi tout de suite pour le paiement et la livraison.`);
    if (OWNER_ID) {
      await bot.api.sendMessage(OWNER_ID,
        `🎨 Nouvelle commande\n\n${lines.join("\n")}\n\nTotal : ${total} €\n\nClient : ${user.first_name} ${user.last_name || ""} (@${user.username || "sans pseudo"}, id ${user.id})`);
    }
  } catch (e) {
    console.error("Envoi message échoué:", e?.message || e);
    return res.status(502).json({ error: "Impossible d'envoyer la confirmation" });
  }
  res.json({ ok: true, total });
});

app.listen(PORT, () => console.log(`🌐 Mini App servie sur le port ${PORT}`));

// ── Bot Telegram (isolé) ────────────────────────────────────
let bot = null;
if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN manquant — la boutique s'affiche, mais le bot est désactivé.");
} else {
  bot = new Bot(BOT_TOKEN);
  bot.catch((err) => console.error("⚠️  Erreur bot:", err?.message || err));
  bot.command("start", async (ctx) => {
    const kb = WEBAPP_URL ? new InlineKeyboard().webApp("🎨 Ouvrir la boutique", WEBAPP_URL) : undefined;
    await ctx.reply("Bienvenue dans l'atelier 🎨\nParcours les tableaux et commande directement ici.", { reply_markup: kb });
  });
  if (WEBAPP_URL) {
    bot.api.setChatMenuButton({
      menu_button: { type: "web_app", text: "Boutique", web_app: { url: WEBAPP_URL } },
    }).catch((e) => console.error("Menu button:", e?.message || e));
  }
  bot.start({ drop_pending_updates: true, onStart: (i) => console.log(`🤖 Bot @${i.username} démarré`) })
     .catch((e) => console.error("❌ Démarrage bot impossible:", e?.message || e));
}

// ─────────────────────────────────────────────────────────────
//  BACKEND  —  bot Telegram + API + service des fichiers statiques
//  Un seul process fait tout : sert la Mini App, expose le
//  catalogue, reçoit les commandes (avec identité vérifiée).
// ─────────────────────────────────────────────────────────────
require("dotenv").config();
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const { Bot, InlineKeyboard } = require("grammy");
const { PRODUCTS } = require("./products");

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;            // ex. https://mon-atelier.up.railway.app
const OWNER_ID   = process.env.OWNER_ID;              // ton id Telegram (pour recevoir les commandes)
const PORT       = process.env.PORT || 3000;

if (!BOT_TOKEN) { console.error("❌ BOT_TOKEN manquant dans .env"); process.exit(1); }

const bot = new Bot(BOT_TOKEN);

// ── Sécurité : validation de l'initData signé par Telegram ──
// Empêche quiconque de se faire passer pour un utilisateur.
// Algorithme officiel : HMAC-SHA256, clé secrète = HMAC("WebAppData", token).
function validateInitData(initData) {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const computed = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  // comparaison à temps constant
  const ok = computed.length === hash.length &&
    crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
  if (!ok) return null;

  // fraîcheur : on rejette au-delà de 24 h
  const authDate = Number(params.get("auth_date")) || 0;
  if (Math.floor(Date.now() / 1000) - authDate > 86400) return null;

  try { return JSON.parse(params.get("user") || "{}"); } catch { return null; }
}

// ── API ─────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Catalogue (le front lit ceci ; sinon il retombe sur sa copie de secours)
app.get("/api/products", (_req, res) => res.json(PRODUCTS));

// Réception d'une commande
app.post("/api/order", async (req, res) => {
  const user = validateInitData(req.header("X-Telegram-Init-Data"));
  if (!user?.id) return res.status(401).json({ error: "Identité Telegram invalide" });

  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return res.status(400).json({ error: "Panier vide" });

  // ⚠️ On recalcule TOUT à partir du catalogue serveur — jamais le prix du client.
  let total = 0;
  const lines = [];
  for (const it of items) {
    const p = PRODUCTS.find(x => x.id === it.id);
    if (!p) continue;
    const qty = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 1));
    total += p.price * qty;
    lines.push(`• ${p.title} × ${qty} — ${p.price * qty} €`);
  }
  if (!lines.length) return res.status(400).json({ error: "Aucun article valide" });

  const recap = `🎨 Nouvelle commande\n\n${lines.join("\n")}\n\nTotal : ${total} €`;

  // Confirmation à l'acheteur
  await bot.api.sendMessage(user.id,
    `Merci ${user.first_name} ! J'ai bien reçu :\n\n${lines.join("\n")}\n\nTotal : ${total} €\n\nJe reviens vers toi tout de suite pour le paiement et la livraison.`);

  // Notification à l'artiste
  if (OWNER_ID) {
    await bot.api.sendMessage(OWNER_ID,
      `${recap}\n\nClient : ${user.first_name} ${user.last_name || ""} (@${user.username || "sans pseudo"}, id ${user.id})`);
  }

  // ── Option paiement Telegram Stars (biens numériques) ─────
  // Décommente pour facturer automatiquement les articles "digital".
  // Montant en plus petite unité (Stars = XTR, entier).
  //
  // const digital = items.filter(it => PRODUCTS.find(p => p.id===it.id)?.type === "digital");
  // if (digital.length) {
  //   const amount = digital.reduce((s, it) => {
  //     const p = PRODUCTS.find(x => x.id===it.id);
  //     return s + p.price * Math.max(1, parseInt(it.qty,10)||1);
  //   }, 0);
  //   await bot.api.sendInvoice(user.id, "Édition numérique", "Tirage haute définition",
  //     JSON.stringify({ ids: digital.map(d=>d.id) }), "XTR",
  //     [{ label: "Tirage", amount }]);   // provider_token vide pour Stars
  // }

  res.json({ ok: true, total });
});

// ── Comportement du bot ─────────────────────────────────────
bot.command("start", async (ctx) => {
  const kb = WEBAPP_URL
    ? new InlineKeyboard().webApp("🎨 Ouvrir la boutique", WEBAPP_URL)
    : undefined;
  await ctx.reply(
    "Bienvenue dans l'atelier 🎨\nParcours les tableaux et commande directement ici.",
    { reply_markup: kb }
  );
});

// Bouton de menu permanent (le « Open App » à gauche du champ de saisie)
async function setupMenuButton() {
  if (!WEBAPP_URL) return;
  await bot.api.setChatMenuButton({
    menu_button: { type: "web_app", text: "Boutique", web_app: { url: WEBAPP_URL } },
  });
}

// ── Démarrage ───────────────────────────────────────────────
app.listen(PORT, () => console.log(`🌐 Mini App servie sur le port ${PORT}`));
setupMenuButton().catch(() => {});
bot.start({ onStart: (i) => console.log(`🤖 Bot @${i.username} démarré`) });

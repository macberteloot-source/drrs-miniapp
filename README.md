# Boutique de tableaux — Mini App Telegram

Une Mini App Telegram clé en main : un onglet **Boutique** pour vendre tes tableaux,
un onglet **Info**, l'**ajout à l'écran d'accueil** iPhone/Android, et un backend Node
qui reçoit les commandes avec l'identité de l'acheteur **vérifiée cryptographiquement**.

```
tableaux-miniapp/
├── public/
│   ├── index.html      → la Mini App (interface)
│   └── tableaux/       → dépose ici les photos de tes œuvres
├── products.js         → ton catalogue (prix = source de vérité)
├── bot.js              → bot + API + serveur (tout-en-un)
├── package.json
└── .env.example
```

## 1. Créer le bot

1. Ouvre [@BotFather](https://t.me/BotFather) → `/newbot` → note le **token**.
2. Récupère ton id perso via [@userinfobot](https://t.me/userinfobot) (pour recevoir les commandes).

## 2. Configurer

```bash
npm install
cp .env.example .env
```
Remplis `.env` : `BOT_TOKEN`, `OWNER_ID`, et `WEBAPP_URL` (l'URL publique — voir étape 4).

Puis personnalise :
- **`products.js`** : tes tableaux, prix, dimensions. C'est ce fichier qui fait foi côté serveur.
- **`public/tableaux/`** : tes images (`aurore.jpg`, etc.). Sans image, un fond coloré au titre s'affiche.
- Dans `public/index.html`, remplace `ton_username` par ton pseudo Telegram (onglet Info).

## 3. Tester en local (avec ngrok)

Telegram exige du **HTTPS**. En dev, tunnelise ton port :
```bash
npx ngrok http 3000        # copie l'URL https://... dans WEBAPP_URL, relance
npm start
```
Ouvre ton bot → `/start` → « Ouvrir la boutique ».

## 4. Déployer (Railway / Render)

C'est un serveur Node : héberge-le sur **Railway**, **Render** ou **Fly.io** (pas Netlify/Vercel qui sont statiques).

1. Pousse le dossier sur GitHub.
2. Crée un service Node, commande de démarrage `npm start`.
3. Ajoute les variables `BOT_TOKEN`, `OWNER_ID`, `WEBAPP_URL` (l'URL du service).
4. Recolle cette même URL dans BotFather si besoin — le bouton menu se configure tout seul au démarrage.

## 5. Ajout à l'écran d'accueil

Géré nativement (Bot API 8.0+) dans l'onglet **Info** → bouton « Ajouter à l'écran d'accueil ».
L'utilisateur confirme la popup native, l'icône (celle configurée dans BotFather) apparaît sur son écran d'accueil.
C'est un raccourci Telegram : l'app s'ouvre dans Telegram, qui doit rester installé.

## 6. Paiement

Par défaut, la commande est **envoyée par message** : tu confirmes paiement et livraison à la main
(idéal pour des originaux physiques). Pour facturer automatiquement les éditions **numériques**
via **Telegram Stars**, décommente le bloc `sendInvoice` dans `bot.js`.

## Sécurité

- L'`initData` de Telegram est **vérifié** (HMAC-SHA256) côté serveur : impossible d'usurper un client.
- Les totaux sont **recalculés depuis `products.js`** — le prix envoyé par le navigateur n'est jamais cru.

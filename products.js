// ─────────────────────────────────────────────────────────────
//  CATALOGUE DES TABLEAUX  —  source de vérité (côté serveur)
//  C'est CE fichier qui fait foi pour les prix. Ne jamais faire
//  confiance au prix envoyé par le client : le serveur recalcule
//  toujours le total à partir d'ici (voir bot.js /api/order).
//
//  Pour modifier ta boutique : édite ce tableau, dépose les images
//  dans public/tableaux/, redéploie. (Garde public/index.html
//  synchronisé si tu veux que l'aperçu statique reste juste.)
// ─────────────────────────────────────────────────────────────

const PRODUCTS = [
  {
    id: "aurore",
    title: "Aurore Fracturée",
    medium: "Acrylique sur toile",
    dimensions: "80 × 100 cm",
    price: 450,               // en euros
    image: "/tableaux/aurore.jpg",
    accent: "#c2410c",        // couleur de secours si l'image manque
    type: "physical",         // "physical" (livraison) ou "digital" (fichier)
    description: "Pièce unique. Encadrement inclus, expédition sous 5 jours.",
    stock: 1,
  },
  {
    id: "silence",
    title: "Silence Urbain",
    medium: "Techniques mixtes",
    dimensions: "60 × 60 cm",
    price: 320,
    image: "/tableaux/silence.jpg",
    accent: "#334155",
    type: "physical",
    description: "Pièce unique. Toile montée sur châssis, prête à accrocher.",
    stock: 1,
  },
  {
    id: "derive",
    title: "Dérive",
    medium: "Encre et gouache sur papier",
    dimensions: "50 × 70 cm",
    price: 280,
    image: "/tableaux/derive.jpg",
    accent: "#0f766e",
    type: "physical",
    description: "Original signé. Livré roulé dans un tube renforcé.",
    stock: 1,
  },
  {
    id: "memoire",
    title: "Mémoire Vive",
    medium: "Impression giclée numérotée",
    dimensions: "40 × 50 cm",
    price: 120,
    image: "/tableaux/memoire.jpg",
    accent: "#7c3aed",
    type: "digital",         // ex. tirage à télécharger → parfait pour Telegram Stars
    description: "Édition limitée. Fichier haute définition livré après paiement.",
    stock: 25,
  },
];

module.exports = { PRODUCTS };

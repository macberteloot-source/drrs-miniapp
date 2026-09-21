// ─────────────────────────────────────────────────────────────
//  CATALOGUE DES TABLEAUX  —  source de vérité (côté serveur)
//  C'est CE fichier qui fait foi pour les prix. Le serveur
//  recalcule toujours le total ici (paliers dégressifs inclus,
//  voir bot.js).  Édite ce tableau, dépose les images dans
//  public/tableaux/, redéploie.
// ─────────────────────────────────────────────────────────────

const PRODUCTS = [
  {
    id: "aurore", title: "Aurore Fracturée", medium: "Acrylique sur toile",
    dimensions: "80 × 100 cm", price: 450, image: "/tableaux/aurore.jpg", video: "/tableaux/aurore.mp4",
    accent: "#7c3aed", type: "physical", stock: 20,
    description: "Édition de 20 exemplaires signés et numérotés. Encadrement inclus, expédition sous 5 jours.",
  },
  {
    id: "silence", title: "Silence Urbain", medium: "Techniques mixtes",
    dimensions: "60 × 60 cm", price: 320, image: "/tableaux/silence.jpg", video: "/tableaux/silence.mp4",
    accent: "#5b21b6", type: "physical", stock: 20,
    description: "Édition de 20 exemplaires. Toile montée sur châssis, prête à accrocher.",
  },
  {
    id: "derive", title: "Dérive", medium: "Encre et gouache sur papier",
    dimensions: "50 × 70 cm", price: 280, image: "/tableaux/derive.jpg", video: "/tableaux/derive.mp4",
    accent: "#0ea5a0", type: "physical", stock: 20,
    description: "Édition de 20 exemplaires signés. Livrés roulés dans un tube renforcé.",
  },
  {
    id: "memoire", title: "Mémoire Vive", medium: "Impression giclée numérotée",
    dimensions: "40 × 50 cm", price: 120, image: "/tableaux/memoire.jpg", video: "/tableaux/memoire.mp4",
    accent: "#a855f7", type: "digital", stock: 20,
    description: "Édition limitée à 20. Fichier haute définition livré après paiement.",
  },
];

// ── Paliers de prix DÉGRESSIFS (par exemplaire du MÊME tableau) ──
// Modifie librement les pourcentages. Le serveur ET l'interface
// utilisent exactement la même règle.
const PRICE_TIERS = [
  { min: 3, discount: 0.20 }, // 3 exemplaires et + : −20% sur chaque
  { min: 2, discount: 0.10 }, // 2 exemplaires       : −10% sur chaque
];

// Prix unitaire selon la quantité, arrondi à l'euro
function unitPrice(base, qty) {
  const tier = PRICE_TIERS.find(t => qty >= t.min);
  return Math.round(base * (1 - (tier ? tier.discount : 0)));
}
function lineTotal(base, qty) { return unitPrice(base, qty) * qty; }

module.exports = { PRODUCTS, PRICE_TIERS, unitPrice, lineTotal };

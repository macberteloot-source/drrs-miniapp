// ─────────────────────────────────────────────────────────────
//  CATALOGUE + RÉCOMPENSES  —  source de vérité (côté serveur)
//  Plusieurs photos par tableau : ajoute-les dans "gallery" (voir aurore).
// ─────────────────────────────────────────────────────────────

const PRODUCTS = [
  { id:"aurore",  title:"Aurore Fracturée", subtitle:"Acrylique · pièce signée", emoji:"🔥",
    image:"/tableaux/aurore.jpg",  video:"/tableaux/aurore.mp4",  accent:"#7c3aed", stock:20,
    gallery:[],  // photos en plus : ["/tableaux/aurore-2.jpg","/tableaux/aurore-3.jpg"]
    description:"Édition de 20 exemplaires signés et numérotés. Encadrement inclus, expédition sous 5 jours.", price:450 },
  { id:"silence", title:"Silence Urbain",   subtitle:"Techniques mixtes · originale", emoji:"",
    image:"/tableaux/silence.jpg", video:"/tableaux/silence.mp4", accent:"#5b21b6", stock:20,
    description:"Édition de 20 exemplaires. Toile montée sur châssis, prête à accrocher.", price:320 },
  { id:"derive",  title:"Dérive",           subtitle:"Encre & gouache · sur papier", emoji:"",
    image:"/tableaux/derive.jpg",  video:"/tableaux/derive.mp4",  accent:"#0ea5a0", stock:20,
    description:"Édition de 20 exemplaires signés. Livrés roulés dans un tube renforcé.", price:280 },
  { id:"memoire", title:"Mémoire Vive",     subtitle:"Édition giclée · numérotée", emoji:"✦",
    image:"/tableaux/memoire.jpg", video:"/tableaux/memoire.mp4", accent:"#a855f7", stock:20,
    description:"Édition limitée à 20. Fichier haute définition livré après paiement.", price:120 },
];

// Quantités proposées (formats)
const FORMAT_QTYS = [1, 2, 3, 5];

// Paliers de prix dégressifs (par exemplaire du même tableau)
const PRICE_TIERS = [
  { min: 3, discount: 0.20 },
  { min: 2, discount: 0.10 },
];
function unitPrice(base, qty) { const t = PRICE_TIERS.find(t => qty >= t.min); return Math.round(base * (1 - (t ? t.discount : 0))); }
function lineTotal(base, qty) { return unitPrice(base, qty) * qty; }

// ── Fidélité : crédits gagnés par commande ──────────────────
// 1 crédit tous les 10 € dépensés (modifiable).
const CREDITS_PER_EURO = 0.1;
function creditsFor(total) { return Math.floor(total * CREDITS_PER_EURO); }

// ── Récompenses échangeables contre des crédits ─────────────
// Édite librement (id unique, titre, coût en crédits, description).
const REWARDS = [
  { id:"sticker",  title:"Pack de stickers",      cost:30,  description:"Set de stickers de l'atelier DR RS." },
  { id:"tirage",   title:"Tirage A5 signé",       cost:50,  description:"Un petit tirage offert, signé à la main." },
  { id:"remise10", title:"−10 % prochaine œuvre",  cost:80,  description:"Code promo sur ta prochaine commande." },
  { id:"minitoile",title:"Mini toile surprise",   cost:150, description:"Une mini pièce originale, choisie par l'artiste." },
];

module.exports = { PRODUCTS, FORMAT_QTYS, PRICE_TIERS, unitPrice, lineTotal, CREDITS_PER_EURO, creditsFor, REWARDS };

// ─────────────────────────────────────────────────────────────
//  CATALOGUE DES TABLEAUX  —  source de vérité (côté serveur)
//  Les prix sont recalculés ici (paliers dégressifs). Édite ce
//  tableau, dépose images (.jpg) et vidéos (.mp4) dans
//  public/tableaux/, redéploie.
// ─────────────────────────────────────────────────────────────

const PRODUCTS = [
  { id:"aurore",  title:"Aurore Fracturée", subtitle:"Acrylique · pièce signée", emoji:"🔥",
    image:"/tableaux/aurore.jpg",  video:"/tableaux/aurore.mp4",  accent:"#7c3aed", stock:20,
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

// Quantités proposées à l'achat (les « formats »).
const FORMAT_QTYS = [1, 2, 3, 5];

// Paliers de prix DÉGRESSIFS (par exemplaire du MÊME tableau).
const PRICE_TIERS = [
  { min: 3, discount: 0.20 }, // 3 et + : −20% / exemplaire
  { min: 2, discount: 0.10 }, // 2      : −10% / exemplaire
];
function unitPrice(base, qty) {
  const t = PRICE_TIERS.find(t => qty >= t.min);
  return Math.round(base * (1 - (t ? t.discount : 0)));
}
function lineTotal(base, qty) { return unitPrice(base, qty) * qty; }

module.exports = { PRODUCTS, FORMAT_QTYS, PRICE_TIERS, unitPrice, lineTotal };

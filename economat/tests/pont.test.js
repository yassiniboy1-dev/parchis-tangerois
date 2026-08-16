'use strict';
/* Tests du pont Elyx (pont-elyx.html) : agrégation par journée de travail,
   fusion multi-fichiers (le plus récent gagne) et plan d'envoi différentiel.
   Les parseurs CSV/XLSX du pont sont des copies de ceux d'index.html,
   déjà couverts par moteur.test.js — ici on vérifie la logique propre au pont. */
const vm = require('vm'), fs = require('fs'), path = require('path');
const { fakeElFactory } = require('./charge');

let n = 0, ko = 0;
function ok(cond, nom) { n++; if (cond) console.log('  ✓ ' + nom); else { ko++; console.log('  ✗ ' + nom); } }

const EXPOSER = `;globalThis.PONT = {
  num, normN, parseDT, bizDayKey, parseCSV, lireXlsx, lireFichier,
  agregerLignes, lignesTriees, combinerFichiers, planifierEnvois,
};`;

function chargerPont() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'pont-elyx.html'), 'utf8');
  const i = html.lastIndexOf('<script>');
  const j = html.indexOf('</script>', i);
  const fakeEl = fakeElFactory(), els = {};
  const sandbox = {
    console,
    setTimeout: () => ({}), setInterval: () => ({}), clearTimeout: () => {}, clearInterval: () => {},
    TextDecoder, TextEncoder, Blob, Response, DecompressionStream,
    document: { getElementById: (id) => els[id] || (els[id] = fakeEl('div')), createElement: (t) => fakeEl(t), addEventListener() {} },
    window: { addEventListener() {} },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    navigator: {},
  };
  vm.createContext(sandbox);
  vm.runInContext(html.slice(i + 8, j) + EXPOSER, sandbox);
  return sandbox.PONT;
}

const fauxFichier = (nom, contenu, type) => ({
  name: nom, type: type || '', lastModified: 0,
  arrayBuffer: async () => { const b = Buffer.from(contenu, 'utf8'); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); },
});

(async function main() {
  const P = chargerPont();

  console.log('— agrégation par journée —');
  const rows = [
    { 'Date': '15/08/2026', 'Heure': '12:30', 'Désignation': 'CAFE NOIR', 'Quantité': '2' },
    { 'Date': '15/08/2026', 'Heure': '23:45', 'Désignation': 'CAFE NOIR', 'Quantité': '1' },
    { 'Date': '16/08/2026', 'Heure': '01:30', 'Désignation': 'THE MENTHE', 'Quantité': '3' },
    { 'Date': '16/08/2026', 'Heure': '09:00', 'Désignation': 'THE MENTHE', 'Quantité': '4' },
    { 'Date': '', 'Heure': '', 'Désignation': 'SANS DATE', 'Quantité': '9' },
    { 'Date': '16/08/2026', 'Heure': '10:00', 'Désignation': '', 'Quantité': '5' },
  ];
  const a = P.agregerLignes(rows);
  ok(a.lignes === 4 && a.ignorees === 2, 'lignes valides comptées, lignes sans date/produit ignorées');
  ok(a.jours['2026-08-15'] && a.jours['2026-08-15']['CAFE NOIR'] === 3, 'ventes du soir (23h45) rattachées à la journée de travail');
  ok(a.jours['2026-08-15']['THE MENTHE'] === 3, 'ventes de la nuit (1h30) rattachées à la veille (journée 6h → 4h)');
  ok(a.jours['2026-08-16'] && a.jours['2026-08-16']['THE MENTHE'] === 4, 'ventes du matin sur leur propre journée');
  let jete = false;
  try { P.agregerLignes([{ 'Colonne A': '1', 'Colonne B': '2' }]); } catch (e) { jete = /Colonnes non reconnues/.test(String(e.message)); }
  ok(jete, 'colonnes non reconnues → erreur claire avec la liste des colonnes');

  console.log('— fusion multi-fichiers & plan d\'envoi —');
  const l1 = P.lignesTriees({ 'THE': 2, 'CAFE': 1 });
  ok(JSON.stringify(l1) === JSON.stringify([{ n: 'CAFE', q: 1 }, { n: 'THE', q: 2 }]), 'lignesTriees : sérialisation stable, triée par nom');
  const combines = P.combinerFichiers([
    { nom: 'recent.csv', mtime: 2000, jours: { '2026-08-15': { 'CAFE': 9 } } },
    { nom: 'ancien.csv', mtime: 1000, jours: { '2026-08-15': { 'CAFE': 1 }, '2026-08-14': { 'THE': 2 } } },
  ]);
  ok(combines['2026-08-15'].lignes[0].q === 9 && combines['2026-08-15'].src === 'recent.csv', 'même jour dans deux fichiers → le plus récent gagne');
  ok(combines['2026-08-14'].lignes[0].n === 'THE', 'les jours propres à l\'ancien fichier sont conservés');
  const envois = P.planifierEnvois(combines, { '2026-08-14': JSON.stringify(combines['2026-08-14'].lignes) });
  ok(envois.length === 1 && envois[0].day === '2026-08-15', 'plan d\'envoi : seuls les jours modifiés partent');
  ok(P.planifierEnvois(combines, { '2026-08-14': JSON.stringify(combines['2026-08-14'].lignes), '2026-08-15': envois[0].fp }).length === 0, 'après envoi, plus rien à envoyer (empreintes à jour)');
  ok(JSON.stringify(P.lignesTriees({ 'B': 2, 'A': 1 })) === JSON.stringify(P.lignesTriees({ 'A': 1, 'B': 2 })), 'empreinte identique quel que soit l\'ordre des lignes du fichier');

  console.log('— lecture de fichier (CSV Elyx) —');
  const csv = 'Date;Heure;Désignation;Quantité\n15/08/2026;12:30;CAFE NOIR;2\n15/08/2026;13:00;CAFE NOIR;1\n';
  const rows2 = await P.lireFichier(fauxFichier('ventes.csv', csv, 'text/csv'));
  const a2 = P.agregerLignes(rows2);
  ok(a2.jours['2026-08-15'] && a2.jours['2026-08-15']['CAFE NOIR'] === 3, 'CSV Elyx (point-virgule) lu et agrégé de bout en bout');

  console.log(`\n${n - ko}/${n} tests OK${ko ? ' — ' + ko + ' ÉCHEC(S)' : ''}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

'use strict';
/* Tests du moteur d'Économat Pro — exécutés contre economat/index.html
   Usage : node economat/tests/moteur.test.js */
const zlib = require('zlib');
const { chargerContexte } = require('./charge');

let n = 0, ko = 0;
function ok(cond, nom) {
  n++;
  if (cond) { console.log('  ✓ ' + nom); }
  else { ko++; console.error('  ✗ ' + nom); }
}
function proche(a, b, nom, eps) { ok(Math.abs(a - b) <= (eps || 0.0001), nom + ` (${a} ≈ ${b})`); }

const EXPOSER = `;globalThis.API = {
  num, normN, esc, soldAt, fmtD, parseDT, bizDayKey, serialVersDate, estFormatDate,
  rendOf, explode, prodCounts, unitCost, computeForSales, menuEng,
  parseCSV, lireXlsx, demo, etatVierge, chargerEtat, assainirEtat,
  importSales, applyMap, chargerRare, chargerDemo, restaurerJSON, render,
  csvCell, groupByCat, delProduit, delPos,
  levenshtein, suggererAssociation, analyserVeille, veilleAssocier, construireDigest,
  importChoisir, getImportEnAttente: () => importEnAttente,
  confirmer: () => { const cb = confirmCb; fermerModals(); if (cb) cb(); },
  getS: () => S, setS: (x) => { S = x; },
  mkDate: (y, m, d, h, mi) => new Date(y, m, d, h || 0, mi || 0),
};`;
/* faux fichier côté navigateur : text() et arrayBuffer() depuis une chaîne ou un Buffer */
function fauxFichier(nom, contenu, type) {
  const buf = Buffer.isBuffer(contenu) ? contenu : Buffer.from(contenu, 'utf8');
  return {
    name: nom, type: type || '',
    text: async () => buf.toString('utf8'),
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
}

/* ---------- fabrique de fixtures .xlsx (zip minimal) ---------- */
function crc32(buf) {
  let c, table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let i = 0; i < 256; i++) { c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; table[i] = c >>> 0; }
  }
  c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function fabriquerZip(entries, compresser) {
  const locals = [], centrals = [];
  let off = 0;
  for (const [name, contenu] of entries) {
    const data = Buffer.from(contenu, 'utf8');
    const comp = compresser ? zlib.deflateRawSync(data) : data;
    const method = compresser ? 8 : 0;
    const nom = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(method, 8); lh.writeUInt32LE(0, 10); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nom.length, 26); lh.writeUInt16LE(0, 28);
    locals.push(lh, nom, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0, 8);
    ch.writeUInt16LE(method, 10); ch.writeUInt32LE(0, 12); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nom.length, 28); ch.writeUInt16LE(0, 30); ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34); ch.writeUInt16LE(0, 36); ch.writeUInt32LE(0, 38); ch.writeUInt32LE(off, 42);
    centrals.push(ch, nom);
    off += 30 + nom.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(0, 4); eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(off, 16); eocd.writeUInt16LE(0, 20);
  const tout = Buffer.concat([...locals, cd, eocd]);
  return tout.buffer.slice(tout.byteOffset, tout.byteOffset + tout.byteLength);
}
const SERIAL_20260316 = (Date.UTC(2026, 2, 16) - Date.UTC(1899, 11, 30)) / 86400000;
const SERIAL_20260316_1904 = (Date.UTC(2026, 2, 16) - Date.UTC(1904, 0, 1)) / 86400000;
function fixtureXlsx(compresser, d1904) {
  return fabriquerZip([
    ['xl/workbook.xml', `<?xml version="1.0"?><workbook xmlns:r="r">${d1904 ? '<workbookPr date1904="1"/>' : ''}<sheets><sheet name="Ventes" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="worksheets/feuille.xml"/></Relationships>'],
    ['xl/sharedStrings.xml', '<?xml version="1.0"?><sst><si><t>Date</t></si><si><t>Produit</t></si><si><t>Quantité</t></si><si><t>CROISSANT</t></si></sst>'],
    ['xl/styles.xml', '<?xml version="1.0"?><styleSheet><numFmts><numFmt numFmtId="164" formatCode="dd/mm/yyyy hh:mm"/></numFmts><cellXfs count="2"><xf numFmtId="0"/><xf numFmtId="164" applyNumberFormat="1"/></cellXfs></styleSheet>'],
    ['xl/worksheets/feuille.xml', '<?xml version="1.0"?><worksheet><sheetData>' +
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>' +
      `<row r="2"><c r="A2" s="1"><v>${(d1904 ? SERIAL_20260316_1904 : SERIAL_20260316) + 0.9375}</v></c><c r="B2" t="s"><v>3</v></c><c r="C2"><v>3</v></c></row>` +
      '<row r="3"><c r="A3" t="inlineStr"><is><t>17/03/2026</t></is></c><c r="B3" t="str"><v>Café noir</v></c><c r="C3"><v>2</v></c></row>' +
      /* ligne et cellules SANS attribut r (placement séquentiel, légal OOXML) + date ISO t="d" */
      '<row><c t="d" s="1"><v>2026-03-18T09:15:00</v></c><c t="inlineStr"><is><t>THE VERT</t></is></c><c><v>4</v></c></row>' +
      '</sheetData></worksheet>'],
  ], compresser);
}

(async function main() {
  const ctx = chargerContexte({ exposer: EXPOSER });
  const A = ctx.API;

  console.log('— aides —');
  ok(A.num('3,5') === 3.5, 'num accepte la virgule décimale');
  ok(A.num('abc') === 0 && A.num(null) === 0, 'num retombe sur 0');
  ok(A.normN('  Crème  Brûlée ') === 'creme brulee', 'normN retire accents et espaces');
  ok(A.esc('<a b="c">&') === '&lt;a b=&quot;c&quot;&gt;&amp;', 'esc échappe le HTML');
  ok(A.soldAt({}, 'x') === true && A.soldAt({ posIds: ['a'] }, 'b') === false, 'soldAt : vide = partout');
  ok(A.fmtD('2026-03-05') === '05/03/2026', 'fmtD');

  console.log('— dates & journée 6h→4h —');
  let d = A.parseDT('2026-03-05 14:30');
  ok(d && d.getHours() === 14 && d.getMinutes() === 30, 'parseDT AAAA-MM-JJ HH:MM');
  d = A.parseDT('05/03/2026', '22:15');
  ok(d && d.getDate() === 5 && d.getMonth() === 2 && d.getHours() === 22, 'parseDT JJ/MM/AAAA + colonne heure');
  d = A.parseDT('5.3.26');
  ok(d && d.getFullYear() === 2026 && d.getHours() === 12, 'parseDT date seule → midi (reste sur son jour)');
  d = A.parseDT(A.mkDate(2026, 2, 5), '07:45');
  ok(d && d.getHours() === 7 && d.getMinutes() === 45, 'parseDT instance Date + heure');
  ok(A.parseDT('') === null, 'parseDT chaîne vide → null');
  ok(A.parseDT('05/26/2025') === null, 'format US MM/DD rejeté (plus de dates fantômes)');
  ok(A.parseDT('12/31/2025 18:30') === null, 'format US avec heure rejeté');
  ok(A.parseDT('31/04/2025') === null, '31 avril rejeté (jour inexistant)');
  ok(A.parseDT('29/02/2024') !== null && A.parseDT('29/02/2025') === null, '29 février selon année bissextile');
  ok(A.bizDayKey(A.mkDate(2026, 2, 5, 3, 59)) === '2026-03-04', '03h59 → rattaché à la veille');
  ok(A.bizDayKey(A.mkDate(2026, 2, 5, 6, 0)) === '2026-03-05', '06h00 → jour même');
  ok(A.bizDayKey(A.mkDate(2026, 2, 5, 23, 30)) === '2026-03-05', '23h30 → jour même');

  console.log('— moteur de recettes —');
  const dm = A.demo();
  const byId = {}; dm.matieres.forEach((m) => byId[m.id] = m); dm.produits.forEach((p) => byId[p.id] = p);
  const croissant = dm.produits.find((p) => p.name === 'Croissant');
  proche(A.unitCost(byId, croissant.id), 93.6 / 40, 'coût pièce croissant = coût lot / rendement');
  const r1 = A.computeForSales(byId, dm.sales.pos_vue);
  proche(r1.revenue, 1935, 'CA calculé sur les ventes de démo');
  proche(r1.margin, r1.revenue - r1.cost, 'marge = CA − coût');
  ok(r1.foodCost > 0 && r1.foodCost < 100, 'food cost dans une plage plausible');
  /* imbrication : produit fabriqué utilisé comme ingrédient */
  const M = { id: 'm1', kind: 'matiere', name: 'Pâte', unit: 'kg', cost: '10' };
  const F = { id: 'f1', kind: 'produit', name: 'Fond', fabrique: true, rendement: '10', prix: '', recipe: [{ ref: 'm1', qty: '1' }] };
  const B = { id: 'b1', kind: 'produit', name: 'Tarte', fabrique: false, rendement: '1', prix: '30', recipe: [{ ref: 'f1', qty: '2' }] };
  const by2 = { m1: M, f1: F, b1: B };
  proche(A.unitCost(by2, 'b1'), 2, 'recette imbriquée : 2 fonds à 1 MAD pièce');
  const accP = {}; A.prodCounts(by2, 'b1', 5, accP, []);
  proche(accP.f1, 10, 'prodCounts : 5 tartes → 10 fonds à produire');
  const accM = {}; A.explode(by2, 'b1', 5, accM, []);
  proche(accM.m1, 1, 'explode : 10 fonds = 1 kg de pâte');
  const boucle = { a: { id: 'a', kind: 'produit', fabrique: true, rendement: '4', recipe: [{ ref: 'a', qty: '2' }, { ref: 'm1', qty: '1' }] }, m1: M };
  ok(isFinite(A.unitCost(boucle, 'a')), 'garde anti-boucle : coût fini');
  ok(A.rendOf({ fabrique: true, rendement: '0' }) === 1, 'rendement 0 → 1 (pas de division par zéro)');

  console.log('— CSV —');
  let rows = A.parseCSV('Date;Produit;Qté\n2026-03-05;"CAFE; NOIR";2\n2026-03-06;THé;1,5\n');
  ok(rows.length === 2 && rows[0]['Produit'] === 'CAFE; NOIR', 'CSV ; avec champ cité contenant ;');
  ok(A.num(rows[1]['Qté']) === 1.5, 'CSV : quantité à virgule');
  rows = A.parseCSV('a,b\n"x ""y""",2\r\n');
  ok(rows[0].a === 'x "y"', 'CSV , avec guillemets échappés et CRLF');
  rows = A.parseCSV(String.fromCharCode(0xFEFF) + 'Date,Produit\n1,2\n');
  ok(Object.keys(rows[0])[0] === 'Date', 'BOM retiré de la première colonne');
  rows = A.parseCSV('a,,c\n1,2,3\n');
  ok(rows[0]['COL2'] === '2', 'entête vide → COL2');
  ok(A.csvCell('Poivron; rouge') === '"Poivron; rouge"', 'export CSV : champ avec ; cité');
  ok(A.csvCell('dit "top"') === '"dit ""top"""', 'export CSV : guillemets doublés');
  ok(A.csvCell('=SOMME(A1)') === "'=SOMME(A1)", 'export CSV : pas d\'injection de formule');

  console.log('— XLSX —');
  ok(A.estFormatDate('dd/mm/yyyy hh:mm') === true && A.estFormatDate('0.00') === false && A.estFormatDate('"jours" 0.0') === false, 'détection des formats de date');
  const sv = A.serialVersDate(SERIAL_20260316);
  ok(sv.getFullYear() === 2026 && sv.getMonth() === 2 && sv.getDate() === 16 && sv.getHours() === 12, 'série Excel entière → 16/03/2026 midi');
  for (const compresser of [false, true]) {
    const rowsX = await A.lireXlsx(fixtureXlsx(compresser));
    const mode = compresser ? 'deflate' : 'stocké';
    ok(rowsX.length === 3, `xlsx ${mode} : 3 lignes de données`);
    ok(Object.keys(rowsX[0]).includes('Quantité'), `xlsx ${mode} : entête accentuée décodée`);
    ok(rowsX[0]['Produit'] === 'CROISSANT', `xlsx ${mode} : chaîne partagée lue`);
    const dx = rowsX[0]['Date'];
    ok(dx && typeof dx.getFullYear === 'function' && dx.getHours() === 22 && dx.getMinutes() === 30, `xlsx ${mode} : cellule date+heure → 22h30`);
    ok(A.bizDayKey(dx) === '2026-03-16', `xlsx ${mode} : 22h30 rattachée au 16/03`);
    ok(rowsX[1]['Produit'] === 'Café noir' && rowsX[1]['Date'] === '17/03/2026', `xlsx ${mode} : inlineStr et t="str"`);
    ok(rowsX[2]['Produit'] === 'THE VERT' && A.num(rowsX[2]['Quantité']) === 4, `xlsx ${mode} : ligne sans attributs r placée séquentiellement`);
    const di = A.parseDT(rowsX[2]['Date']);
    ok(di && A.bizDayKey(di) === '2026-03-18' && di.getHours() === 9, `xlsx ${mode} : cellule t="d" (date ISO) lue par parseDT`);
  }
  const rows1904 = await A.lireXlsx(fixtureXlsx(false, true));
  ok(A.bizDayKey(rows1904[0]['Date']) === '2026-03-16', 'système de dates 1904 (workbookPr) respecté');
  let msgXls = '';
  const bXls = Buffer.from('d0cf11e0a1b11ae1' + '00'.repeat(500), 'hex');
  try { await A.lireXlsx(bXls.buffer.slice(bXls.byteOffset, bXls.byteOffset + bXls.byteLength)); }
  catch (e) { msgXls = String(e.message || e); }
  ok(msgXls.includes('97-2003'), 'vieux .xls binaire → message clair (pas « fichier invalide »)');

  console.log('— menu engineering —');
  const my = {
    m: { id: 'm', kind: 'matiere', name: 'M', unit: 'kg', cost: '10' },
    p1: { id: 'p1', kind: 'produit', name: 'Star', prix: '50', rendement: '1', recipe: [{ ref: 'm', qty: '0.5' }] },   /* cm 45 */
    p2: { id: 'p2', kind: 'produit', name: 'Cheval', prix: '20', rendement: '1', recipe: [{ ref: 'm', qty: '1.5' }] }, /* cm 5 */
    p3: { id: 'p3', kind: 'produit', name: 'Enigme', prix: '60', rendement: '1', recipe: [{ ref: 'm', qty: '0.5' }] }, /* cm 55 */
    p4: { id: 'p4', kind: 'produit', name: 'Poids', prix: '15', rendement: '1', recipe: [{ ref: 'm', qty: '1' }] },    /* cm 5 */
  };
  const prods = [my.p1, my.p2, my.p3, my.p4];
  const me = A.menuEng(my, { p1: 40, p2: 50, p3: 5, p4: 5 }, prods);
  ok(me.n === 4, 'menuEng : 4 produits classés');
  proche(me.seuilPop, 100 / 4 * 0.7, 'seuil de popularité (règle des 70 %)');
  proche(me.avgCM, (45 * 40 + 5 * 50 + 55 * 5 + 5 * 5) / 100, 'marge moyenne pondérée par les ventes');
  const cls = {}; me.rows.forEach((r) => cls[r.d.id] = r.cl);
  ok(cls.p1 === 'etoile', 'populaire + rentable → étoile');
  ok(cls.p2 === 'cheval', 'populaire + marge faible → cheval de labour');
  ok(cls.p3 === 'enigme', 'rentable + peu vendu → énigme');
  ok(cls.p4 === 'poids', 'peu vendu + marge faible → poids mort');
  ok(me.rows[0].d.id === 'p1', 'classement trié par marge totale décroissante');

  console.log('— import caisse (bout en bout) —');
  ctx.API.setS(Object.assign(A.etatVierge(), { entered: true }));
  const S0 = A.getS();
  S0.produits.push({ id: 'cafe1', kind: 'produit', name: 'Café noir', prix: '12', fabrique: false, rendement: '1', recipe: [] });
  const csv = 'Date;Heure;Désignation;Quantité\n' +
    '16/03/2026;09:12;Café noir;2\n' +
    '16/03/2026;23:50;Café noir;1\n' +
    '17/03/2026;02:30;Café noir;4\n' +   /* nuit → rattachée au 16 */
    '17/03/2026;10:00;MYSTERE;3\n';
  await A.importSales(fauxFichier('ventes.csv', csv, 'text/csv'), 'pos_rare');
  const S1 = A.getS();
  ok(!!S1.salesByDay['2026-03-16'], 'import CSV : journée du 16 créée');
  proche(A.num(S1.salesByDay['2026-03-16']['pos_rare']['cafe1']), 7, '2 + 1 + 4 (02h30 = même journée de travail)');
  ok(!S1.salesByDay['2026-03-17'] || !S1.salesByDay['2026-03-17']['pos_rare'] || !S1.salesByDay['2026-03-17']['pos_rare']['cafe1'], 'rien compté au 17 pour le café');
  ok(Object.keys(S1.pendingRows['pos_rare'] || {}).includes('MYSTERE'), 'produit inconnu mis en attente');
  ok(S1.dateFrom === '2026-03-16' && S1.dateTo === '2026-03-16', 'période calée sur les jours reconnus');
  A.applyMap('pos_rare', 'MYSTERE', 'cafe1');
  const S2 = A.getS();
  proche(A.num(S2.salesByDay['2026-03-17']['pos_rare']['cafe1']), 3, 'association : ventes en attente ajoutées');
  ok(S2.dateTo === '2026-03-17', 'association : la période s\'étend aux nouveaux jours');
  ok(S2.nameMap[A.normN('MYSTERE')] === 'cafe1', 'correspondance mémorisée');
  ok(!(S2.pendingRows['pos_rare'] || {})['MYSTERE'], 'file d\'attente vidée');
  await A.importSales(fauxFichier('ventes.csv', 'Date;Désignation;Qté\n18/03/2026;MYSTERE;5\n', 'text/csv'), 'pos_rare');
  proche(A.num(A.getS().salesByDay['2026-03-18']['pos_rare']['cafe1']), 5, 'ré-import : la correspondance est réutilisée');
  /* encodage Windows-1252 (export Excel FR) : É codé 0xC9 */
  await A.importSales(fauxFichier('ventes.csv', Buffer.from('Date;D\xE9signation;Qt\xE9\n19/03/2026;CAF\xC9 NOIR;6\n', 'latin1'), 'text/csv'), 'pos_rare');
  proche(A.num(A.getS().salesByDay['2026-03-19']['pos_rare']['cafe1']), 6, 'CSV Windows-1252 décodé par repli');
  /* noms hérités d'Object.prototype : jamais « reconnus » à tort */
  await A.importSales(fauxFichier('ventes.csv', 'Date;Désignation;Qté\n20/03/2026;constructor;2\n20/03/2026;__proto__;3\n', 'text/csv'), 'pos_rare');
  const pendus = Object.keys(A.getS().pendingRows['pos_rare'] || {});
  ok(pendus.includes('constructor') && pendus.includes('__proto__'), 'noms « constructor »/« __proto__ » mis en attente, pas absorbés');
  ok(!A.getS().salesByDay['2026-03-20'], 'aucune vente fantôme enregistrée pour ces noms');
  A.applyMap('pos_rare', '__proto__', 'cafe1');
  proche(A.num((A.getS().salesByDay['2026-03-20'] || { pos_rare: {} }).pos_rare.cafe1), 3, 'association d\'un nom « __proto__ » fonctionnelle');
  let gpOk = true;
  try { A.groupByCat([{ id: 'x', cat: '__proto__' }, { id: 'y', cat: 'constructor' }]); } catch (e) { gpOk = false; }
  ok(gpOk, 'groupByCat survit aux catégories homonymes du prototype');
  /* suppression d'un produit : ventes importées et correspondances purgées */
  A.delProduit('cafe1');
  ok(!A.getS().salesByDay['2026-03-16'] || !(A.getS().salesByDay['2026-03-16'].pos_rare || {}).cafe1, 'delProduit purge salesByDay');
  ok(Object.keys(A.getS().nameMap).every((k) => A.getS().nameMap[k] !== 'cafe1'), 'delProduit purge nameMap');

  console.log('— le veilleur —');
  ok(A.levenshtein('cafe noir', 'cafe noir') === 0 && A.levenshtein('cafe', 'cafes') === 1, 'distance de Levenshtein');
  {
    const prods = [
      { id: 'v1', kind: 'produit', name: 'Café noir', prix: '12', rendement: '1', recipe: [] },
      { id: 'v2', kind: 'produit', name: 'Tajine poulet', prix: '65', rendement: '1', recipe: [] },
    ];
    const s1 = A.suggererAssociation('CAFE NOIR', prods);
    ok(s1 && s1.produit.id === 'v1', 'suggestion : accents et casse ignorés');
    const s2 = A.suggererAssociation('TAJINE POULT', prods);
    ok(s2 && s2.produit.id === 'v2', 'suggestion : faute de frappe tolérée');
    ok(A.suggererAssociation('PIZZA 4 FROMAGES', prods) === null, 'pas de suggestion hasardeuse');
  }
  {
    /* fixture : un produit à perte, un FC trop haut, un sans recette */
    const s = A.etatVierge(); s.entered = true; s.objectifFC = 30;
    s.matieres.push({ id: 'vm', kind: 'matiere', name: 'Bœuf', unit: 'kg', cost: '120' });
    s.produits.push(
      { id: 'vp1', kind: 'produit', name: 'Burger perdu', prix: '40', rendement: '1', recipe: [{ ref: 'vm', qty: '0.5' }] },   /* coût 60 > prix 40 */
      { id: 'vp2', kind: 'produit', name: 'Steak limite', prix: '100', rendement: '1', recipe: [{ ref: 'vm', qty: '0.4' }] },  /* FC 48 % */
      { id: 'vp3', kind: 'produit', name: 'Café mystère', prix: '15', rendement: '1', recipe: [] },                            /* sans recette */
    );
    s.sales = { pos_rare: { vp1: '10', vp2: '20', vp3: '30' } };
    A.setS(s);
    const alertes = A.analyserVeille();
    ok(alertes.some((a) => a.niveau === 'grave' && a.titre.includes('à perte')), 'veilleur : vente à perte détectée (grave)');
    ok(alertes.some((a) => a.titre.includes('food cost')), 'veilleur : food cost au-dessus de l\'objectif détecté');
    ok(alertes.some((a) => a.titre.includes('sans coût matière')), 'veilleur : produit vendu sans recette détecté');
    const dig = A.construireDigest();
    ok(dig.global.ca_mad > 0 && Array.isArray(dig.alertes_du_veilleur) && dig.alertes_du_veilleur.length >= 3, 'digest du copilote : chiffres et alertes présents');
    ok(!JSON.stringify(A.getS()).includes('sk-ant'), 'aucune clé API dans l\'état exportable');
  }
  {
    /* association automatique par le veilleur */
    const s = A.etatVierge(); s.entered = true;
    s.produits.push({ id: 'va1', kind: 'produit', name: 'Jus d\'orange', prix: '20', rendement: '1', recipe: [] });
    s.pendingRows = { pos_rare: { 'JUS D ORANGE': [{ day: '2026-03-10', qty: 4 }] } };
    A.setS(s);
    A.veilleAssocier('pos_rare');
    const s2 = A.getS();
    proche(A.num((s2.salesByDay['2026-03-10'] || { pos_rare: {} }).pos_rare.va1), 4, 'veilleur : association automatique appliquée');
    ok(!Object.keys(s2.pendingRows.pos_rare || {}).length, 'veilleur : file d\'attente vidée après association');
  }

  console.log('— anti-double-import —');
  {
    const s = A.etatVierge(); s.entered = true;
    s.produits.push({ id: 'di1', kind: 'produit', name: 'Café noir', prix: '12', fabrique: false, rendement: '1', recipe: [] });
    A.setS(s);
    const csv2 = 'Date;Désignation;Qté\n21/03/2026;Café noir;5\n';
    await A.importSales(fauxFichier('ventes.csv', csv2, 'text/csv'), 'pos_rare');
    proche(A.num(A.getS().salesByDay['2026-03-21'].pos_rare.di1), 5, 'premier import appliqué directement');
    await A.importSales(fauxFichier('ventes.csv', csv2, 'text/csv'), 'pos_rare');
    ok(A.getImportEnAttente() !== null, 'ré-import du même jour → choix demandé, rien d\'appliqué');
    proche(A.num(A.getS().salesByDay['2026-03-21'].pos_rare.di1), 5, 'les quantités n\'ont pas doublé en attendant');
    A.importChoisir('remplacer');
    proche(A.num(A.getS().salesByDay['2026-03-21'].pos_rare.di1), 5, 'remplacer : le jour est écrasé, pas cumulé');
    await A.importSales(fauxFichier('ventes.csv', csv2, 'text/csv'), 'pos_rare');
    A.importChoisir('additionner');
    proche(A.num(A.getS().salesByDay['2026-03-21'].pos_rare.di1), 10, 'additionner : cumul voulu');
    await A.importSales(fauxFichier('ventes.csv', csv2, 'text/csv'), 'pos_rare');
    A.importChoisir(null);
    proche(A.num(A.getS().salesByDay['2026-03-21'].pos_rare.di1), 10, 'annuler : rien n\'est appliqué');
  }

  console.log('— carte Rare (SEED) & état —');
  A.chargerRare();
  const S3 = A.getS();
  ok(S3.matieres.length === 544 && S3.produits.length === 188, 'SEED : 544 matières et 188 produits');
  const by3 = {}; S3.matieres.forEach((m) => by3[m.id] = m); S3.produits.forEach((p) => by3[p.id] = p);
  const r3 = A.computeForSales(by3, S3.sales.pos_rare);
  ok(r3.revenue > 10000 && r3.cost > 0, 'SEED : CA et coût matière calculés');
  const me3 = A.menuEng(by3, S3.sales.pos_rare, S3.produits);
  ok(me3.n > 100, 'SEED : menu engineering classe la carte');
  let rendu = true;
  try { A.render(); } catch (e) { rendu = false; console.error(e); }
  ok(rendu, 'rendu complet de la synthèse sans erreur (DOM factice)');
  await A.restaurerJSON({ name: 's.json', text: async () => JSON.stringify({ v: 4, matieres: [{ id: 'x', kind: 'matiere', name: 'Sel', unit: 'g', cost: '0.01' }], produits: [] }) });
  ok(A.getS().matieres.length === 1 && A.getS().matieres[0].name === 'Sel', 'restauration d\'une sauvegarde JSON');
  await A.restaurerJSON({ name: 'bad.json', text: async () => '{"pas":"bon"}' });
  ok(A.getS().matieres.length === 1, 'sauvegarde invalide refusée sans casser l\'état');
  await A.restaurerJSON({ name: 'nulls.json', text: async () => JSON.stringify({ v: 4, matieres: [null, { id: 'ok1', kind: 'matiere', name: 'Thym', unit: 'g', cost: '0.02' }], produits: [null, 42], pos: [null] }) });
  const Sn = A.getS();
  ok(Sn.matieres.length === 1 && Sn.matieres[0].name === 'Thym' && Sn.produits.length === 0 && Sn.pos.length === 2, 'éléments null/invalides filtrés à la restauration');
  let renduN = true;
  try { A.render(); } catch (e) { renduN = false; }
  ok(renduN, 'l\'app démarre après une sauvegarde contenant des éléments invalides');

  /* persistance via localStorage simulé */
  const store = {};
  const fauxLS = { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const ctx2 = chargerContexte({ exposer: EXPOSER, localStorage: fauxLS });
  ctx2.API.setS(Object.assign(ctx2.API.etatVierge(), { entered: true, period: 'Test', objectifFC: 28 }));
  vm_ecrire(ctx2);
  const ctx3 = chargerContexte({ exposer: EXPOSER + ';globalThis.API2={chargerEtat,getS:()=>S};', localStorage: fauxLS });
  ctx3.API2.chargerEtat();
  ok(ctx3.API2.getS().period === 'Test' && ctx3.API2.getS().objectifFC === 28, 'état relu depuis le stockage local');

  console.log(`\n${n - ko}/${n} tests OK${ko ? ' — ' + ko + ' ÉCHEC(S)' : ''}`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });

function vm_ecrire(ctx) {
  /* force l'écriture immédiate (le debounce des timers est neutralisé dans les tests) */
  const vm2 = require('vm');
  vm2.runInContext('ecrireEtat()', ctx);
}

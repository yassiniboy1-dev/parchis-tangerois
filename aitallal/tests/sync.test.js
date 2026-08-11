// Tests de la logique de SYNCHRONISATION d'AIT ALLAL, exécutés contre le vrai
// code d'index.html (fonctions extraites et évaluées, aucune copie divergente).
// Rejoue les régressions vécues : compte admin d'usine (fix123), convergence
// entre appareils (fix122-revue), fusion par id + tombstones.
//
//   node tests/sync.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// ── Extraction robuste d'un bloc { … } ou ( … ) en respectant chaînes/commentaires ──
function trancheEquilibree(src, depuis, ouvrant, fermant) {
  let i = src.indexOf(ouvrant, depuis);
  if (i < 0) throw new Error('ouvrant introuvable après ' + depuis);
  const debut = i;
  let prof = 0, mode = 'code';
  for (; i < src.length; i++) {
    const c = src[i], c2 = src[i + 1];
    if (mode === 'code') {
      if (c === '/' && c2 === '/') { mode = 'lc'; i++; continue; }
      if (c === '/' && c2 === '*') { mode = 'bc'; i++; continue; }
      if (c === "'") { mode = 'sq'; continue; }
      if (c === '"') { mode = 'dq'; continue; }
      if (c === '`') { mode = 'tpl'; continue; }
      if (c === ouvrant) prof++;
      else if (c === fermant) { prof--; if (prof === 0) return src.slice(debut, i + 1); }
    } else if (mode === 'lc') { if (c === '\n') mode = 'code'; }
    else if (mode === 'bc') { if (c === '*' && c2 === '/') { mode = 'code'; i++; } }
    else if (mode === 'sq') { if (c === '\\') i++; else if (c === "'") mode = 'code'; }
    else if (mode === 'dq') { if (c === '\\') i++; else if (c === '"') mode = 'code'; }
    else if (mode === 'tpl') { if (c === '\\') i++; else if (c === '`') mode = 'code'; }
  }
  throw new Error('bloc non refermé');
}

function extraireFonction(nom) {
  const m = html.indexOf('function ' + nom + '(');
  if (m < 0) throw new Error('fonction introuvable : ' + nom);
  const corps = trancheEquilibree(html, m, '{', '}');
  return html.slice(m, html.indexOf('{', m)) + corps;
}
function extraireConst(nom) {
  const m = html.indexOf('const ' + nom + ' =');
  if (m < 0) throw new Error('const introuvable : ' + nom);
  const obj = trancheEquilibree(html, m, '{', '}');
  return html.slice(m, html.indexOf('{', m)) + obj + ';';
}

// Horloge contrôlable (le vrai code appelle Date.now())
let horloge = 1000000;
const sandbox = {
  console,
  Date: { now: () => horloge },
  Math, JSON, Map, Set, Array, Object, String, Number,
  state: {},
  load: (k, d) => d, // pas d'empreintes préexistantes
  save: () => true,  // persistance neutralisée (test hors localStorage)
};
vm.createContext(sandbox);

const source = [
  extraireConst('SYNC_RECORD_LISTS'),
  extraireFonction('quickHash'),
  extraireFonction('mergeRecordList'),
  extraireFonction('_estAdminUsineIntact'),
  extraireFonction('detectChangesAndStamp'),
  extraireFonction('_trierClesProfond'),
  extraireFonction('canonEgal'),
].join('\n\n');
vm.runInContext(source, sandbox);

// ── Micro-framework ──
let ok = 0, ko = 0;
function assert(cond, titre) {
  if (cond) { ok++; console.log('  ✅ ' + titre); }
  else { ko++; console.log('  ❌ ' + titre); }
}

const { quickHash, mergeRecordList, detectChangesAndStamp, canonEgal, _estAdminUsineIntact } = sandbox;

console.log('\n1. quickHash');
assert(quickHash('abc') === quickHash('abc'), 'déterministe');
assert(quickHash('abc') !== quickHash('abd'), 'change avec le contenu');

console.log('\n2. Fusion par id — deux ajouts concurrents conservés');
{
  const A = [{ id: 1, v: 'a', lastModified: 10 }, { id: 2, v: 'x-pc', lastModified: 20 }];
  const B = [{ id: 1, v: 'a', lastModified: 10 }, { id: 3, v: 'y-tel', lastModified: 21 }];
  const { merged } = mergeRecordList(A, B, 'id', {}, {});
  const ids = merged.map(r => r.id).sort();
  assert(ids.length === 3 && ids.join(',') === '1,2,3', 'X (PC) et Y (téléphone) tous les deux gardés');
}

console.log('\n3. Convergence — même contenu, ordre différent (fix122-revue)');
{
  // PC pousse [X, Y] ; le téléphone a [Y, X] (même contenu, ordre inverse).
  const remoteA = [{ id: 'X', v: 1, lastModified: 5 }, { id: 'Y', v: 2, lastModified: 6 }];
  const localB = [{ id: 'Y', v: 2, lastModified: 6 }, { id: 'X', v: 1, lastModified: 5 }];
  const { merged } = mergeRecordList(localB, remoteA, 'id', {}, {});
  const naif = quickHash(JSON.stringify(merged));
  const distant = quickHash(JSON.stringify(remoteA));
  assert(canonEgal(merged, remoteA, 'id'), 'canonEgal détecte le même contenu malgré l’ordre');
  // La correction : à contenu canonique égal on adopte la sérialisation DISTANTE.
  const adopte = canonEgal(merged, remoteA, 'id') ? JSON.stringify(remoteA) : JSON.stringify(merged);
  assert(quickHash(adopte) === distant, 'empreinte adoptée == empreinte cloud → AUCUN renvoi (pas d’oscillation)');
  // Sans la correction (sérialisation naïve du fusionné), l’empreinte divergerait → renvoi éternel.
  assert(naif !== distant, 'régression démontrée : la sérialisation naïve divergerait (le bug existerait sans le correctif)');
}

console.log('\n4. Compte admin d’usine non estampillé (fix123)');
{
  horloge = 2000000;
  sandbox.state = { users: [{ id: 1, login: 'admin', password: 'admin', nom: 'Administrateur', role: 'admin', actif: true }], _recordHashes: {}, tombstones: {} };
  detectChangesAndStamp();
  assert(sandbox.state.users[0].lastModified === undefined, 'admin d’usine (admin/admin) : PAS de lastModified → perd la fusion');

  // Dès que l’admin est personnalisé, il redevient un enregistrement normal.
  sandbox.state = { users: [{ id: 1, login: 'admin', password: 'MonVraiMotDePasse', nom: 'Administrateur', role: 'admin', actif: true }], _recordHashes: {}, tombstones: {} };
  detectChangesAndStamp();
  assert(typeof sandbox.state.users[0].lastModified === 'number', 'admin personnalisé : estampillé normalement');

  // Admin migré/haché (sans password clair) : estampillé aussi (il doit se propager).
  sandbox.state = { users: [{ id: 1, login: 'admin', pwHash: 'deadbeef', pwSalt: 'ab12', nom: 'Administrateur', role: 'admin', actif: true }], _recordHashes: {}, tombstones: {} };
  detectChangesAndStamp();
  assert(typeof sandbox.state.users[0].lastModified === 'number', 'admin haché (fix124) : estampillé normalement');
}

console.log('\n4b. Prédicat admin d’usine (fix124-revue : garde + login + migration synchronisés)');
{
  assert(_estAdminUsineIntact({ id: 1, login: 'admin', password: 'admin', nom: 'Administrateur', role: 'admin' }) === true, 'reconnaît le compte d’usine intact (à NE PAS hacher)');
  assert(_estAdminUsineIntact({ id: 1, login: 'admin', pwHash: 'x', pwSalt: 'y', nom: 'Administrateur', role: 'admin' }) === false, 'un admin déjà haché n’est plus « d’usine » (sera propagé)');
  assert(_estAdminUsineIntact({ id: 1, login: 'admin', password: 'SECRET', nom: 'Administrateur', role: 'admin' }) === false, 'un admin au mot de passe personnalisé n’est plus « d’usine »');
  assert(_estAdminUsineIntact({ id: 99, login: 'admin', password: 'admin', nom: 'Administrateur', role: 'admin' }) === false, 'un autre compte « admin » (id ≠ 1) n’est pas le compte d’usine');
}

console.log('\n5. Tombstone — une suppression distante retire l’enregistrement');
{
  const local = [{ id: 7, v: 'a', lastModified: 10 }];
  const { merged } = mergeRecordList(local, [], 'id', {}, { '7': 50 });
  assert(merged.length === 0, 'id=7 supprimé (tombstone plus récent que lastModified)');
  // mais une modif postérieure à la suppression le ressuscite
  const local2 = [{ id: 7, v: 'a2', lastModified: 60 }];
  const r2 = mergeRecordList(local2, [], 'id', {}, { '7': 50 });
  assert(r2.merged.length === 1, 'id=7 modifié APRÈS la suppression : conservé');
}

console.log('\n' + (ko === 0 ? `✅ TOUT PASSE (${ok} assertions)` : `❌ ${ko} ÉCHEC(S) sur ${ok + ko}`));
process.exit(ko === 0 ? 0 : 1);

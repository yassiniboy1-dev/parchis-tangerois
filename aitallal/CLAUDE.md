# AIT ALLAL GROUPE — Gestion immobilière (v53-fix122)

App de gestion du projet **EL GHERSA** (Tanger) pour Yassine : stock (286 appartements,
78 magasins), clients, ventes/réservations, paiements Fiscal/N, dépenses, visites, agenda,
alertes, audit, mode commercial « luxe », page de contrôle arabe pour l'associé.
**Un seul fichier `index.html`** (~32 600 lignes, vanilla JS) + `manifest.json` + `sw.js` (PWA),
déployé sur **https://aitallal.netlify.app**, données locales (localStorage) synchronisées via
**Firebase** (projet `ait-allal-groupe`, RTDB europe-west1, auth anonyme, Storage pour
plans PDF et documents).

## Commandes

```bash
bash outils/verifier.sh    # syntaxe JS, versions alignées, gardes observateur, page AR à jour, chiffres EL GHERSA
bash outils/deployer.sh    # vérifie puis fabrique aitallal-netlify-vXX.zip (index.html + manifest.json + sw.js)
python3 make_ar.py         # régénère index-ar.html (page arabe autonome) depuis index.html
```

**Toute modification d'index.html doit finir par : bump de version → `python3 make_ar.py` →
`bash outils/verifier.sh` vert.**

## Montée de version (fixNNN) — checklist stricte

1. `sw.js` : `CACHE_NAME = 'aitallal-v53-fixNNN'` (c'est LUI qui invalide le cache PWA).
2. `index.html` : badge `VERSION : v53-fixNNN` (Paramètres), `version: 'v53-fixNNN'`
   (creerSauvegarde), 2× `appVersion: 'v53-fixNNN'` (uploadToCloud + restaurerSauvegarde).
3. Commentaires de changelog `<!-- v53-fixNNN : … -->` en tête d'index.html (on AJOUTE, on ne
   modifie jamais les anciens).
4. `python3 make_ar.py` (index-ar.html hérite du bump), puis `bash outils/verifier.sh`.
5. Livraison = zip Netlify en glisser-déposer, puis **fermer/rouvrir l'app DEUX fois**.

## Architecture du fichier

`index.html` = CSS (dont bloc « MODE LUXE » ~l.860-3000) → HTML minimal → **5 blocs `<script>`** :
module Firebase (config + `window.FB`), moteur principal (l.~4820 : `ELGHERSA_SEED` géant sur
UNE ligne de 1,5 Mo — ne jamais la lire entière —, `esc()`, `ROLES`, `KEYS`, `state`, `persist()`,
`render()`/`attachEvents()` par `data-action`, écrans, mode commercial `renderLuxe*`, exports
contrats/reçus/brochure, page arabe `renderControleAR`), puis blocs xlsx + cloud
(`CLOUD_SHARED_PATH`, `initCloud`, `uploadToCloud`, `downloadFromCloud`, sauvegardes,
`runCloudDiagnostic`). Le `render();` de démarrage est à la FIN du dernier bloc.

## Conventions impératives

- **Un seul fichier** index.html ; zip Netlify = index.html + manifest.json + sw.js
  (index-ar.html reste HORS zip : fichier autonome donné à l'associé).
- `esc()` sur TOUTE donnée interpolée dans du HTML. Modals/popups custom
  (`showError`/`showToast`/`showConfirm`) — jamais `alert`/`confirm` (sauf fallback historique fix69).
- Câblage : `data-action="…"` + listener dans `attachEvents()` (re-exécuté à chaque `render()`).
  Tout changement d'état passe par `render()`, jamais de manipulation DOM directe.
- Ids sensibles au re-render (fix101) : `#password-input` (+ mécanisme snapshot/restore dans
  `render()`) — ne jamais renommer.
- **Part N (non déclarée) : JAMAIS sur un document imprimé/exporté.** Prix commerciaux
  uniquement via `getPrixIndicatif()`/`formatPrixLuxe()` (« À partir de »).
- Champs numériques des modales : `type="text" inputmode="numeric|decimal"` (bug curseur
  Chromium, fix100/108) — ne pas revenir à `type="number"`.
- UI en français ; arabe écrit directement (pas de `\uXXXX` dans index.html) en îlots
  `<span dir="rtl" lang="ar">`.

## Protocole de synchronisation cloud (CRITIQUE — lire avant toute modif)

- `sync/aitallal-groupe-shared` = `{ _meta, data/{aitallal_*}, backups, backupsIndex, _seedMarkers }`.
  `_meta = { lastUpdate, deviceId, deviceInfo, appVersion, changedKeys }`.
- Sync **différentielle par empreintes** (`quickHash` par clé localStorage, stockées dans
  `aitallal_cloud_hashes`) : on n'envoie que les clés dont le hash diffère.
- **Les empreintes de référence représentent le CONTENU DU CLOUD** (fix122). Après un
  download+merge elles sont calculées sur `remoteData`, pas sur le fusionné local — sinon des
  modifs locales jamais envoyées deviennent invisibles (« rien à envoyer », bug vécu).
- **Anti-écrasement (fix122)** : `uploadToCloud` lit `_meta` distant AVANT d'envoyer ; si
  `lastUpdate > state.cloud.lastSync`, `downloadFromCloud(true)` (merge par id + tombstones)
  d'abord. Sans ça, un appareil resté fermé repousse ses listes périmées par-dessus les modifs
  des autres (vécu : journal d'audit revenu du 14 juillet au 10 juin).
- Merge par id (`SYNC_RECORD_LISTS`), **magasins fusionnés par `ref`** (fix110), suppressions
  propagées par tombstones. Garde anti-perte fix58 : refus de download si le cloud a >30 % de
  records en moins non expliqués par tombstones.
- Rôle observateur : `uploadToCloud` et `maybeAutoBackup` ont un garde `role === 'observateur'`
  → return. Ne jamais les retirer.
- `sw.js` ne doit JAMAIS intercepter les domaines Firebase — la liste contient
  `firebasedatabase.app` et `firebasestorage.app` depuis fix122 (le repli long-polling RTDB
  pouvait être servi depuis le cache).

## Firebase — pièges vécus

- **« Mode test » = règles qui expirent à 30 jours.** C'est la panne du 14 juillet 2026 :
  les règles **Storage** en mode test ont expiré → plans/documents refusés (`storage/unauthorized`)
  sur tous les appareils. Les règles RTDB, elles, avaient été réécrites sans expiration (fix54).
  Règles cibles :
  - RTDB : `{"rules":{"sync":{"aitallal-groupe-shared":{".read":"auth != null",".write":"auth != null"}}}}`
  - Storage : `match /plans/{allPaths=**}` et `match /documents/{allPaths=**}` →
    `allow read, write: if request.auth != null;` (jamais de `request.time <` !)
- Diagnostic intégré : Paramètres → Synchronisation → **« 🩺 Tester la connexion Firebase »**
  (SDK → auth → lecture → écriture test effacée → Storage, avec conseil et lien console).
- La base est accessible en REST pour diagnostiquer depuis l'extérieur : auth anonyme via
  `identitytoolkit…:signUp?key=<apiKey d'index.html>` puis
  `https://ait-allal-groupe-default-rtdb.europe-west1.firebasedatabase.app/sync/aitallal-groupe-shared/_meta.json?auth=<idToken>`.
  `_meta.lastUpdate` = date de la dernière sauvegarde réussie (précieux pour dater une panne).

## Page arabe (index-ar.html)

**GÉNÉRÉE, ne jamais l'éditer à la main** : `python3 make_ar.py`. Connexion auto en
observateur (`الشريك المالك`), lecture seule totale (localStorage, cloud, backups, SW coupés),
RTL + ruban « معاينة عربية ». Le script est tolérant (étapes déjà absorbées → skip) et refuse de
produire une page dangereuse (gardes dures : unicité de `renderControleAR`, écritures bloquées).
Si une ancre meurt après un gros refactor → le script crashe avec le label de l'étape : réaligner
l'ancre, ne pas réinjecter de copie.

## Chiffres de référence EL GHERSA (invariants de `elghersa_import.json`)

286 appartements (65 vendus) · 78 magasins (28 vendus) · 65 clients · 93 ventes ·
186 paiements · CA total 130 008 000 · % avance global 35 % · % fiscal reçu 25 % ·
blocs A B C D G H I. `verifier.sh` les contrôle.

## Reste à faire (chantier Mode Commercial, discuté avec Yassine)

- Feature 4/4 : galerie photos + plans par type (les photos restent à fournir par Yassine).
- Optionnel : montrer dans l'app où vérifier que la synchro cloud est activée (fix120, note).

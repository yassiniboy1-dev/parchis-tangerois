# Économat Pro — La Vue · Rare (v4.0)

Application de gestion du food cost pour les deux adresses de Yassine à Tanger (**La Vue** et **Rare**) :
économat commun, labo pâtisserie, import des ventes de la caisse, menu engineering, fiches techniques.
Successeur « pro » de l'artifact React `economatrarev3.jsx` (claude.ai) — porté en **un seul fichier
`index.html`** (vanilla JS + SVG + CSS), autonome, sans compte ni serveur : tout est en `localStorage`.

## Commandes

```bash
node economat/tests/moteur.test.js   # 67 tests (moteur, dates, CSV, XLSX, menu engineering, import, SEED)
bash economat/outils/deployer.sh     # fabrique economat-netlify.zip à glisser sur Netlify
```

## Conventions impératives (identiques au Parchís — retours de Yassine)

- **Un seul fichier** `index.html`, aucune dépendance externe (les Google Fonts ont des fallbacks).
- **Jamais** `window.confirm` / `alert` / `prompt` (bloqués sur iPhone) → `demanderConfirm` + toasts avec « Annuler ».
- **Accents écrits directement** ; aucune séquence `\uXXXX` (exception : plage regex de diacritiques dans `normN`).
- **UI en français**, mobile-first iPhone (safe-area, tap targets ≥ 36 px, `touch-action:manipulation`).
- Graphiques : **un seul axe par graphique** (jamais de double axe), écarts de 2 px entre segments,
  légende dès 2 séries, `tabular-nums` sur les tableaux.

## Architecture du fichier

CSS (design system « papier d'économat » : papier `#FAF4EA`, encre `#241C16`, safran `#C2570F`,
bleu La Vue `#1F6FB2` — palette des séries validée daltonisme) → HTML (squelette + 2 modals + toasts +
`#print-zone`) → un seul `<script>` :

1. **aides** : `num`, `nf`, `esc` (échappement HTML — obligatoire sur toute donnée utilisateur/importée),
   `normN`, `parseDT`, `bizDayKey` (journée de travail **6 h → 4 h** : la nuit compte pour la veille ;
   une date **sans heure** est posée à midi pour rester sur son jour).
2. **moteur** : `explode` (recettes imbriquées, division par `rendement` des produits fabriqués,
   garde anti-boucle), `unitCost`, `computeForSales`, `prodCounts`, `menuEng` (matrice de
   Kasavana-Smith : seuil de popularité 70 %, marge moyenne pondérée).
3. **parseurs** : `parseCSV` (délimiteur auto `;`/`,`/tab, guillemets, BOM) et `lireXlsx` — lecteur
   **XLSX sans bibliothèque** : zip (central directory) + `DecompressionStream("deflate-raw")` +
   XML par regex (sharedStrings, styles → détection des formats de date, séries Excel → `Date`).
   Safari ≥ 16.4 requis pour le xlsx ; repli : message clair « exporte en CSV ».
4. **état** : objet `S` unique (v4), persisté en `localStorage` (`ecoPro:v1`), `save()` débouncé,
   `assainirEtat()` au chargement (un instantané corrompu ne bloque jamais le démarrage).
   `SEED` = la vraie carte Rare (544 matières, 188 produits, ventes de référence) — ligne géante à ne pas éditer.
5. **interface** : rendu par gabarits (`vueSynthese`, `vueEconomat`, `vueLabo`, `vuePos`, `vueReglages`,
   `vueAccueil`), événements **délégués** sur `#vue` (`data-act` clic, `data-in` saisie, `data-ch` change).
   Pendant la frappe on ne re-rend jamais le bloc contenant le champ actif : mises à jour ciblées
   (`majFoot`, `majConso`, `majEcart`, `majStatsPos`, `majControle`).
6. **graphiques SVG maison** : CA/jour (barres empilées par adresse), food cost/jour (ligne + objectif),
   matrice menu engineering. Largeur adaptée au conteneur (`majLargeurChart`) pour que le texte reste
   lisible sur iPhone. Infobulles au survol **et** au tap ; chaque graphique a son tableau jumeau.
7. **fiches techniques & rapport** : `ficheHTML`, `rapportHTML` → `#print-zone` + `window.print`
   (feuille `@media print`).

## Import caisse

Colonnes reconnues par motifs (`pickCol`) : date, heure (optionnelle), produit/désignation, quantité.
Nom inconnu → file `pendingRows` par adresse ; l'association (une fois) est mémorisée dans `nameMap`
et étend la période. Les quantités importées sont **en lecture seule** (la saisie manuelle ne sert
que sans import).

## Données & sauvegarde

Tout est local. Export/restauration JSON (Réglages), export CSV de la consommation.
`chargerRare()` recharge la carte de référence. Pas de Firebase ici (une seule personne l'utilise) —
si un jour la synchro multi-appareils est demandée, réutiliser le protocole seq/écritures du Parchís.

## Tests

`tests/charge.js` charge le vrai script dans un contexte VM avec DOM factice (timers neutralisés).
`tests/moteur.test.js` : 67 assertions, dont un import CSV de bout en bout et des fixtures **XLSX
générées** (zip stocké et deflate). Toute modification du moteur ou des parseurs doit les faire passer.

## Backlog (à discuter avec Yassine)

1. Déployer sur un site Netlify dédié (ex. `economat-rare.netlify.app`) — zip prêt.
2. Renseigner les recettes des produits sans fiche et vérifier les 110 matières « ⚠ à vérifier ».
3. Module achats/livraisons (stock théorique vs inventaire).
4. Comparaison de deux périodes (mois vs mois).
5. Synchro multi-appareils (Firebase) si l'équipe doit saisir à plusieurs.

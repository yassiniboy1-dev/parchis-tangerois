# Économat Pro — La Vue · Rare (v4.3)

Application de gestion du food cost pour les deux adresses de Yassine à Tanger (**La Vue** et **Rare**) :
économat commun, labo pâtisserie, ventes de la caisse (import manuel **ou liaison Elyx automatique**),
menu engineering, fiches techniques. Successeur « pro » de l'artifact React `economatrarev3.jsx`
(claude.ai) — porté en **un seul fichier `index.html`** (vanilla JS + SVG + CSS), autonome, sans compte :
tout est en `localStorage`. Deux fichiers livrés depuis la v4.2 : `index.html` (l'app) et
`pont-elyx.html` (le pont caisse, page autonome pour le PC de la caisse).

## Commandes

```bash
node economat/tests/moteur.test.js   # 136 tests (moteur, dates, CSV, XLSX, menu engineering, import, veilleur, liaison, navigation, SEED)
node economat/tests/pont.test.js     # 12 tests du pont Elyx (agrégation par journée, fusion, plan d'envoi)
bash economat/outils/deployer.sh     # fabrique economat-netlify.zip (index.html + pont-elyx.html) à glisser sur Netlify
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
5. **interface** (navigation v4.3) : **barre d'onglets fixe en bas** (`#tabs`, `.tabbar`, 5 destinations :
   `synthese | ventes | carte | economat | reglages` — pastille rouge = alertes du veilleur non lues).
   Sous-navigation par segments collants (`.seg`) : Synthèse → `sousSynthese`
   (`chiffres | graphiques | menu | alertes` — le veilleur et le copilote vivent dans « Alertes », un
   bandeau sur « Chiffres » y renvoie) ; Ventes → `posVentes` (une adresse à la fois, pastille = noms de
   caisse à associer) ; Carte → `sousCarte` (une adresse ou `labo`). L'ancienne `vuePos` est scindée :
   ventes/import/à associer dans `vueVentes`, plats/recettes dans `carteAdresseHTML`, le labo est un
   sous-onglet de Carte (`vueLabo`). Handlers de navigation : `snav`/`vseg`/`cseg`/`nav` (+ `remonter()`).
   Rendu par gabarits, événements **délégués** sur `#vue` (`data-act` clic, `data-in` saisie, `data-ch`
   change). Pendant la frappe on ne re-rend jamais le bloc contenant le champ actif : mises à jour
   ciblées (`majFoot`, `majConso`, `majEcart`, `majStatsPos` — gardée par `tab==="ventes"` +
   `posVentesActif()` —, `majControle`). Les toasts s'affichent au-dessus de la barre du bas.
6. **graphiques SVG maison** : CA/jour (barres empilées par adresse), food cost/jour (ligne + objectif),
   matrice menu engineering. Largeur adaptée au conteneur (`majLargeurChart`) pour que le texte reste
   lisible sur iPhone. Infobulles au survol **et** au tap ; chaque graphique a son tableau jumeau.
7. **fiches techniques & rapport** : `ficheHTML`, `rapportHTML` → `#print-zone` + `window.print`
   (feuille `@media print`).
8. **le veilleur** (`analyserVeille`, pur et testable) : alertes en tête de synthèse — ventes à perte,
   food cost > objectif +10 pts, produits vendus sans recette, prix « à vérifier » dans le top conso,
   journées anormales (moyenne + 2σ), trous d'import, écarts labo/économat, produits de caisse en
   attente. Acquittement par alerte (`S.veilleVu`, clés stables re-déclenchées si les données changent).
   Corrections en un clic : `veilleAssocier` (associations automatiques par `suggererAssociation` —
   normalisation + Levenshtein, seuil prudent, annulable) et l'anti-double-import (`importSales` détecte
   les jours déjà importés → modal `modal-import` Remplacer/Additionner/Annuler via `importChoisir`).
9. **copilote Claude** (option) : clé API Anthropic stockée dans `localStorage` `ecoPro:cle-api`
   (**jamais dans `S` ni dans les sauvegardes**, testé). `construireDigest()` fabrique un résumé chiffré
   compact ; `copiloteAnalyser()` appelle `POST /v1/messages` (modèle `claude-opus-5`, en-têtes
   `anthropic-dangerous-direct-browser-access` + repli `server-side-fallback-2026-07-01`,
   `fallbacks:"default"`, gestion de `stop_reason:"refusal"` et des erreurs 401/429/réseau).
   Résultat persisté dans `S.copilote` et rendu par `rendreTexte` (paragraphes/puces/gras, échappé).
10. **liaison caisse Elyx** (`S.liaison`, Réglages) : voir la section dédiée plus bas.

## Import caisse

Colonnes reconnues par motifs (`pickCol`) : date, heure (optionnelle), produit/désignation, quantité.
Nom inconnu → file `pendingRows` par adresse ; l'association (une fois) est mémorisée dans `nameMap`
et étend la période. Les quantités importées sont **en lecture seule** (la saisie manuelle ne sert
que sans import).

## Liaison caisse Elyx (v4.2)

Elyx (back-office de PI Electronique, distribué par Distrilog au Maroc) est **local au PC de caisse**,
sans API cloud — mais ses modules **Exporter/Scheduler** savent déposer des exports programmés (CSV/Excel)
dans un dossier. La liaison passe par Firebase RTDB (projet du Parchís, **parchissi-35156**) :

```
pont-elyx.html (PC caisse, Chrome/Edge)          index.html (iPhone de Yassine)
  surveille le dossier d'export ────► economat/{code}/ventes/{posId}/{jour} ────► synchro app
  (File System Access + IndexedDB)        = {t, src, lignes:[{n,q}]}            (boot, focus, 5 min, bouton)
                                    ◄──── economat/{code}/config = {v, creele, pos} ────
```

- **Code de liaison** = seul secret : 16 caractères aléatoires (`genererCodeLiaison`, alphabet sans
  I/L/O/0/1, ~79 bits), affiché dans Réglages. Même modèle de sécurité que `parties/{CODE}` du Parchís.
- **Côté pont** : parseurs CSV/XLSX **copiés d'`index.html`** (toute correction doit être reportée) ;
  `agregerLignes` (colonnes par motifs, journée 6 h → 4 h), `combinerFichiers` (même jour dans deux
  fichiers → le plus récent gagne), `planifierEnvois` (empreinte par jour, n'envoie que ce qui change,
  cache `pontElyx:envoye:*` en localStorage). Ventes stockées en **tableau** `lignes:[{n,q}]` (jamais en
  clés d'objet : les noms de caisse peuvent contenir `.` `#` `$`, interdits dans les clés Firebase).
  Dossier surveillé via `showDirectoryPicker` + poignée gardée en IndexedDB (bouton « Reprendre la
  surveillance » après rechargement) ; **dépôt manuel** drag-drop en secours (tout navigateur).
- **Côté app** : `synchroniserLiaison` (PUT config + GET ventes), `appliquerVentesLiaison` (pur, testé) —
  chaque jour reçu **remplace** `salesByDay[jour][pos]` (la caisse fait foi), noms inconnus → même file
  `pendingRows`/`nameMap` que l'import manuel (avec `retirerPendingJour` avant ré-application), dédup par
  horodatage dans `S.liaison.vus`, période étendue (jamais réduite). Pas de re-rendu si un champ a le
  focus (`saisieEnCours`). Le veilleur signale une liaison silencieuse > 48 h.
- **Règles Firebase à publier une fois** (console Firebase → Realtime Database → Règles) :
  le fichier complet est dans `outils/regles-firebase.json` (ajoute `economat/$code` en lecture/écriture
  aux règles existantes du Parchís — ne pas retirer le bloc `parties`). Tant qu'elles ne sont pas
  publiées, app et pont affichent « Firebase a refusé l'accès ».

## Données & sauvegarde

Tout est local. Export/restauration JSON (Réglages), export CSV de la consommation.
`chargerRare()` recharge la carte de référence. La sauvegarde JSON inclut `S.liaison` (le code se
retrouve en changeant de téléphone) mais jamais la clé API du copilote. Firebase ne sert qu'à la
liaison caisse — si un jour la synchro multi-appareils est demandée, réutiliser le protocole
seq/écritures du Parchís.

## Tests

`tests/charge.js` charge le vrai script dans un contexte VM avec DOM factice (timers neutralisés,
`fetch` absent → la synchro liaison est inerte en test). `tests/moteur.test.js` : 136 assertions, dont
la navigation v4.3 (chaque onglet et sous-onglet se rend, repli sur la première adresse),
un import CSV de bout en bout, des fixtures **XLSX générées** (zip stocké et deflate) et la liaison
caisse (remplacement par jour, dédup, `__proto__`, veilleur). `tests/pont.test.js` : 12 assertions sur
la logique propre au pont. Toute modification du moteur ou des parseurs doit faire passer les deux.
La vérification en vrai navigateur (Playwright + interception des appels Firebase) vit dans le
scratchpad de session (`verif-liaison.js`), pas dans le dépôt.

## Backlog (à discuter avec Yassine)

1. Déployer sur un site Netlify dédié (ex. `economat-rare.netlify.app`) — zip prêt (app + pont) ;
   le pont sera alors accessible sur `/pont-elyx.html` depuis le PC de la caisse, sans fichier à copier.
2. Publier les règles Firebase (`outils/regles-firebase.json`) — indispensable à la liaison Elyx.
3. Renseigner les recettes des produits sans fiche et vérifier les 110 matières « ⚠ à vérifier ».
4. Module achats/livraisons (stock théorique vs inventaire).
5. Comparaison de deux périodes (mois vs mois).
6. Synchro multi-appareils (Firebase) si l'équipe doit saisir à plusieurs.
7. Notifications app fermée (analyse programmée côté cloud) — la liaison Firebase ouvre la porte.

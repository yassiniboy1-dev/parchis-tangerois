# Parchís Tangérois — البارشيس الطنجاوي (v3.3)

Jeu de Parchís aux règles traditionnelles de **Tanger**, pour Yassine.
Un seul fichier `index.html` (vanilla JS + SVG + CSS), déployé sur **Netlify**, multijoueur en ligne via **Firebase Realtime Database**.

## Commandes

```bash
node tests/moteur.test.js        # 29 tests des règles, exécutés contre index.html
node tests/sim-multijoueur.js    # partie complète simulée entre 2 clients + 2 IA (lancer 3×)
bash outils/deployer.sh          # fabrique parchis-netlify.zip à glisser sur Netlify
node --check <(awk '/<script>$/{f=1;next}/<\/script>/{f=0}f' index.html)   # syntaxe du JS inline
```

**Toute modification du code réseau ou du moteur doit repasser la simulation 3 fois de suite sans échec avant livraison.**

## Connecteurs MCP disponibles

Claude Code peut se connecter directement à ces services (demande-le en langage naturel, ou utilise les commandes ci-dessous) :

- **Netlify** (officiel) — déployer, gérer le site, variables d'env :
  `claude mcp add --transport http netlify https://netlify-mcp.netlify.app/mcp`
- **Firebase** (officiel) — lire/écrire Realtime Database, Auth, Hosting, sans quitter la session :
  `claude mcp add firebase -- npx -y firebase-tools@latest mcp`
  (nécessite d'être connecté au compte Google du projet `parchissi-35156` — `firebase login` si demandé)
- **Nano Banana Pro** (communautaire, s'appuie sur l'API Gemini officielle de Google) — génération d'images pour icône, fond d'accueil, visuels de partage :
  `claude mcp add nano-banana -- npx nano-banana-mcp` avec la variable d'env `GEMINI_API_KEY`
  Yassine a un abonnement **Google AI Pro** : générer la clé sur aistudio.google.com avec ce même compte donne un quota quotidien inclus (pas de facturation Cloud à activer tant qu'il n'est pas dépassé). Demander explicitement le modèle **`gemini-3-pro-image-preview`** (Nano Banana Pro) à la configuration — certains serveurs communautaires pointent par défaut vers la version Flash moins qualitative.

Une fois connecté, Claude Code peut déployer directement sur Netlify et inspecter/modifier les données Firebase en direct — plus besoin de zips manuels. Pour Nano Banana, rester factuel dans les prompts (c'est un modèle Google, pas Anthropic) et vérifier chaque image avant de l'intégrer.

## Conventions impératives (retours utilisateur — ne jamais enfreindre)

- **Un seul fichier** `index.html`. Livraison = zip contenant `index.html` pour Netlify.
- **Jamais** `window.confirm` / `window.alert` / `prompt` (bloqués sur iPhone) → modals custom (`.modal`, `showModal`/`hideModals`).
- **Accents écrits directement** dans le code et l'UI. Aucune séquence `\uXXXX` (seule exception : plages regex de diacritiques). Vérifier : `grep -c '\\\\u0' <script extrait>` doit rendre 0.
- **UI en français**, mobile-first iPhone (safe-area, tap targets ≥ 36px, `touch-action:manipulation`).
- Couleurs des 4 joueurs = **les vives d'origine** (retour v3.3, ne pas les assombrir) :
  bleu `#1f7fd0`, jaune `#f0b400`, vert `#1d8a4a`, rouge `#d3352b` (+ `clair`/`dark` pour les dégradés des pions).
- **Sélection = blanc lumineux**, jamais doré (le doré se confond avec le jaune — retour v3.3).

## Architecture du fichier

`index.html` = CSS (design system) → HTML (écrans) → un seul `<script>` inline :
config Firebase → règles `R` (8 interrupteurs, défauts = règles de Tanger) → `PLAYERS` → géométrie (`TRACK`, `CORGEO`, `HOMEC`, `GOALSPOTS`) → moteur (`stepOnce`, `computeMoves`, `simMove`, `exitMove`, barrages/captures/fautes) → tour de jeu (`doRoll`, `execMove`, `afterMove`, `endOfAction`, `nextPlayer`, `tripleSix`) → rendu SVG (`buildBoard`, `update`, `pawnXY`) → IA → réseau (`NET`, `sync`, `applyEtat`, `traiterPartie`, `rafraichirJeu`, `veillerIA`) → écrans/modals.

### Écrans
`scr-accueil` → `scr-setup` (local) ou `scr-ligne` (prénom + créer/rejoindre code 5 lettres) → `scr-lobby` (partage WhatsApp, sièges, l'hôte lance) → `scr-game`.

## Règles de Tanger (résumé moteur)

- 68 cases, sens anti-horaire. Salidas : bleu 5, jaune 22, vert 39, rouge 56. Entrées corridor : 68/17/34/51. Corridor 7 cases + boire. **71 pas exacts** de la salida à la boire.
- Refuges (cases sombres à étoile) : {5,12,17,22,29,34,39,46,51,56,63,68}. Pas de capture sur refuge (barrage mixte à la place). Capture possible sur T2 {10,27,44,61}.
- **Sortie sur 5 : deux pions** (salida + salida+5). Un seul pion restant → salida seule.
- 6 → rejoue. Trois 6 → dernier pion déplacé rentre (sauf boire). **4 pions dehors → 6 vaut 12.**
- Barrage = 2 pions même case (même couleur partout, mixte sur refuge) : bloque passage **et** arrêt. Sur 6/12 : **ouverture obligatoire** (repli à 6 si 12 impossible).
- **Libre jeu** : l'app ne bloque pas les coups, elle punit après. FAUTE DE CAPTURE / DE SORTIE (off par défaut) / D'OUVERTURE → le pion joué rentre, flash rouge. Priorité capture > sortie > ouverture.
- Capture hors refuge → **+20** (obligatoire si possible, chaînable). Boire sur compte exact → **+10**. Victoire = 4 pions dans la boire.
- 8 interrupteurs dans `R` (modal « Personnaliser les règles ») ; en ligne seul l'hôte les modifie (nœud `regles`).

## Protocole réseau (CRITIQUE — lire avant toute modif)

Base : `parties/{CODE}` = `{v, creele, hote, statut: lobby|jeu|fini, sieges:{pi:{t:h|ia|l, nom, uid}}, regles, etat}`.
`etat` = `{seq, w, pawns, cur, face, val, sixes, phase, bonus, bv, lastMoved, winner, action}`.

- **Autorité** : `amAuth()` = local → true ; en ligne → `isIA(cur) ? isHote : (myPi===cur)`. Seule l'autorité exécute la logique et les timers ; les autres rendent via `applyEtat` (phase `anim` → `spect`).
- **Seq anti-collision** : `sync()` écrit `seq = Math.max(NET.appliedSeq+1, Date.now())` + `w = NET.uid`, et pose `NET.lastW = NET.uid`.
- **applyEtat** accepte si `seq > appliedSeq` **ou** (`seq === appliedSeq` **et** `w !== NET.lastW`) → convergence dernier-écrit-gagne, échos et redites ignorés. **Parser `pawns` AVANT d'engager `appliedSeq`** (un instantané cassé ne doit rien engager).
- **Garde fantôme** : si `NET.on && myPi==null && !isHote` → ne jamais écrire ni agir (entêtes de `sync`, `doRoll`, `execMove`). Un téléphone qui a perdu son siège devient inerte.
- **endOfAction** ne s'exécute que depuis les phases `anim`/`spect` (anti double fin de tour). `planRecup` mémorise le `seq` à la planification et n'agit (2,2 s) que si **rien n'a bougé depuis**.
- `traiterPartie(snap)` (nommée, try/catch) traite chaque instantané : mapping sièges → `applyEtat` → `rafraichirJeu()` (statut, dé, sélection, `veillerIA`) → proposition de reprise de siège aux spectateurs.
- **buildBoard** initialise `G.pawns` si vide (sinon le premier instantané en ligne crashe et l'écran fige — bug historique v3.0).
- Anti-veille iOS : `forcerResync()` (goOnline + `once` → `traiterPartie`) sur `visibilitychange`/`pageshow`/`focus` ; wake lock `garderEcran()` ; badge `#chip-conn` via `.info/connected`.
- Reprise de siège en pleine partie : modal `modal-reprise` (« C'est moi » → update uid) ; l'hôte peut remplacer un absent par l'IA (menu ⋯ → `#menu-sieges`).
- Purge des parties > 48 h à la création.

## Firebase

Projet **parchissi-35156** (europe-west1), config déjà dans `index.html`. Règles RTDB publiées :
```json
{"rules":{".read":false,".write":false,
  "parties":{".read":true,".indexOn":["creele"],"$code":{".write":true}}}}
```

## Design system (v3.2 « table de cèdre et laiton »)

- Typo : **Marcellus** (titres, or dégradé) + **Manrope** (UI), import Google Fonts, fallbacks Georgia/système.
- Laiton `#c9a24b` (clair `#ecd28c`, sombre `#8a6524`) ; feutre émeraude `#0e2b21`/`#1a4d3a` ; encre `#2b2318` ; ivoire `#f4ecd9`.
- Plateau SVG : tapis `feltG`, panneaux ivoire bordés couleur joueur (4px) + étoile filigrane, refuges sombres à **étoile dorée**, corridors en dégradé `cg{pi}`, **khatam** doré au centre, pions émaillés (`pg{pi}` + reflet + filtre `ombre`).
- Cadre bois : noyer strié + **double filet de laiton** en box-shadow inset sur `#frame`.
- Le dé est en CSS (`#die`, pips en grille 3×3, map `PIPMAP`).
- Fond **zellige procédural** (SVG data URI dans `body::before`, quasi ton sur ton) + vignette radiale.
- **Favicon + apple-touch-icon en data URI** (PNG 64/180 px, dérivés de `visuels/icone.png`).
- Transitions : fondu d'écran (`ecrIn`), entrée des modals (`boxIn`), focus laiton sur `.champ` — désactivées sous `prefers-reduced-motion`.

## Tests

- `tests/charge.js` : charge le vrai script d'`index.html` dans un contexte VM avec DOM factice.
- `tests/moteur.test.js` : 29 assertions règles (topologie 71 pas, barrages, captures/refuges, sortie double, 6→12, obligations et replis, corridor, interrupteurs).
- `tests/sim-multijoueur.js` : 2 vrais clients (VM) + faux Firebase partagé, partie aléatoire complète, **reprise de siège testée à l'action 12**, assertion de convergence d'état à chaque étape, journal des écritures `etat` en cas d'échec. Temps compressé ÷12. Plafond : 1500 pas de boucle (600 faisait échouer ~1 partie sur 10, légitimement longue).

## Backlog (propositions à discuter avec Yassine)

1. Sons discrets + retour haptique (dé, capture, boire, faute).
2. Manifest PWA (« Ajouter à l'écran d'accueil ») — l'icône est faite (`visuels/icone.png`, favicon/apple-touch déjà inlinés) ; reste le manifest, qui demandera un fichier à côté d'`index.html` dans le zip.
3. Écran de fin enrichi : classement, captures, fautes, durée.
4. Historique des coups repliable pendant la partie.
5. Réactions rapides entre joueurs (👏 😂 😱) synchronisées via `action`.
6. ~~Fond d'accueil zellige subtil~~ — fait (SVG procédural dans `body::before`).

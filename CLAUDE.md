# Parchís Tangérois — البارشيس الطنجاوي (v3.6)

Jeu de Parchís aux règles traditionnelles de **Tanger**, pour Yassine.
Un seul fichier `index.html` (vanilla JS + SVG + CSS), déployé sur **Netlify**, multijoueur en ligne via **Firebase Realtime Database**.

## Commandes

```bash
node tests/moteur.test.js        # 32 tests des règles, exécutés contre index.html
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
- **Exception : la sortie mange.** En sortant de la maison, tout pion adverse posé sur la salida est mangé — même un barrage adverse de deux (les 2 rentrent, +20 chacun, joués en deux coups). Seul un barrage À SOI sur la salida bloque la 1re bille. La 2e bille (salida+5) suit les règles normales : un adverse seul est mangé, un barrage adverse la bloque (elle reste à la maison).
- **Sortie sur 5 : deux pions** (salida + salida+5). Un seul pion restant → salida seule.
- 6 → rejoue. Trois 6 → dernier pion déplacé rentre (**corridor et boire protégés**). **4 pions dehors → 6 vaut 12.**
- Barrage = 2 pions même case (même couleur partout, mixte sur refuge) : bloque passage **et** arrêt. Sur 6/12 : **ouverture obligatoire** (repli à 6 si 12 impossible) — **vaut aussi pour un barrage mixte** : sur un 6 il faut retirer son pion du refuge partagé. Pas de faute si aucune ouverture n'est réellement possible.
- **Libre jeu** : l'app ne bloque pas les coups, elle punit après. FAUTE DE CAPTURE / DE SORTIE (off par défaut) / D'OUVERTURE → le pion joué rentre, flash rouge, **et le tour est perdu** (pas de relance après un 6 fautif, bonus restants perdus). Priorité capture > sortie > ouverture.
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

## Netlify (production)

Site : **https://parchis-tangerois.netlify.app** — site id `0a34951c-7618-48a4-8671-74b11e42a50e`, compte de Yassine.
Déploiement sans MCP : `NETLIFY_AUTH_TOKEN=xxx bash outils/deployer-api.sh` (jeton jamais dans le dépôt).
**PIÈGE VÉCU : ne jamais déployer le zip via l'API** (`Content-Type: application/zip`) — Netlify sert alors la page en `text/plain` et l'iPhone affiche le code source. Utiliser la méthode digest (manifest JSON + PUT du fichier), ce que fait `deployer-api.sh`, qui vérifie aussi le `content-type` servi à la fin. Le zip de `deployer.sh` reste valable pour le glisser-déposer manuel sur app.netlify.com.
Autre piège : les nouveaux sites des comptes gratuits naissent protégés (`sso: true` → 401 « Login Redirect ») ; rendre public via `PATCH /api/v1/sites/{id}` avec `{"sso_login":false}`.

## Firebase

Projet **parchissi-35156** (europe-west1), config déjà dans `index.html`. Règles RTDB publiées :
```json
{"rules":{".read":false,".write":false,
  "parties":{".read":true,".indexOn":["creele"],"$code":{".write":true}}}}
```

## Design system (v3.5 « étoile de Tanger », thème clair)

- Style casual game lumineux (référence donnée par Yassine : Parchisi Star), identité tangéroise conservée (khatam, arabe). **Ne pas revenir au thème sombre.**
- Accueil façon lobby de jeu : chip profil (prénom `pt_nom`, modal `modal-profil`), chip version, logo épais crème à ombre chaude (Manrope 800), **deux cartes de mode illustrées** (Nano Banana Pro, WebP inlinés, classes `.carte-mode .cm-local/.cm-ligne`), bouton d'aide violet.
- Typo : **Marcellus** (titres, or dégradé) + **Manrope** (UI), Google Fonts, fallbacks Georgia/système.
- Palette : violet `#5d2a63` / prune `#451d4e` (fond damassé WebP inliné, généré Nano Banana Pro), ambre `#ffc531` (boutons « juteux », épaisseur `#c07d0e`), crème `#fffaf0` (modals, texte sombre `#3a2a12`), ivoire.
- Plateau SVG clair : tapis blanc cassé (`feltG`), cases blanches à liseré gris, refuges gris `#b9b3a6` à étoile blanche, numéros encre (`.cellnum.sur`), panneaux maison **pleine couleur** (`hg{pi}`, alvéoles ombrées cerclées de blanc), corridors bonbon (`cg{pi}` clair→vif), khatam en filigrane blanc + moyeu doré.
- Cadre : chêne clair (WebP inliné) + filets crème en box-shadow inset — tout dans le bloc CSS final « habillage image » ; la première règle `#frame` ne garde que la géométrie.
- Le dé est en CSS (`#die`, pips en grille 3×3, map `PIPMAP`), **flottant sur le cadre** : il glisse vers le coin du joueur courant (positionné dans `drawBanner` via `HOMEC`/`CTR`), cerclé de la couleur du joueur (`--dc`).
- Pions sculptés en SVG (socle, corps galbé, tête brillante, liseré blanc) — dessinés dans `buildBoard`.
- Modals façon jeu : titre en pastille ambrée, boutons `.btn.violet` / `.btn.danger` à épaisseur, icônes émoji.
- Favicon + apple-touch-icon en data URI (dérivés de `visuels/icone.png`).
- Transitions : fondu d'écran (`ecrIn`), entrée des modals (`boxIn`) — désactivées sous `prefers-reduced-motion`.
- Bandeau de diagnostic (script séparé en tête de fichier) : affiche erreurs JS et ressources bloquées, transparent aux touches (croix cliquable seule).
- Tap targets ≥ 36 px partout (`.switch::before` étendu, `.seg button` et `.btn.mini` rembourrés).
- Sources des images et prompts : `visuels/` (`fond-violet.png`, `texture-chene.png`, + anciens fonds sombres v3.4 conservés pour mémoire).

## Tests

- `tests/charge.js` : charge le vrai script d'`index.html` dans un contexte VM avec DOM factice.
- `tests/moteur.test.js` : 32 assertions règles (topologie 71 pas, barrages, captures/refuges, sortie double, sortie qui mange la salida, barrage mixte à ouvrir, 6→12, obligations et replis, corridor, interrupteurs).
- `tests/sim-multijoueur.js` : 2 vrais clients (VM) + faux Firebase partagé, partie aléatoire complète, **reprise de siège testée à l'action 12**, assertion de convergence d'état à chaque étape, journal des écritures `etat` en cas d'échec. Temps compressé ÷12. Plafond : 1500 pas de boucle (600 faisait échouer ~1 partie sur 10, légitimement longue).

## Backlog (propositions à discuter avec Yassine)

1. Sons discrets + retour haptique (dé, capture, boire, faute).
2. Manifest PWA (« Ajouter à l'écran d'accueil ») — l'icône est faite (`visuels/icone.png`, favicon/apple-touch déjà inlinés) ; reste le manifest, qui demandera un fichier à côté d'`index.html` dans le zip.
3. Écran de fin enrichi : classement, captures, fautes, durée.
4. Historique des coups repliable pendant la partie.
5. Réactions rapides entre joueurs (👏 😂 😱) synchronisées via `action`.
6. ~~Fond d'accueil zellige subtil~~ — fait (SVG procédural dans `body::before`).

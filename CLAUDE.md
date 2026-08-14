# Parchís Tangérois — البارشيس الطنجاوي (v3.7) + Mafia (v2.2)

Deux jeux pour Yassine, chacun en **un seul fichier** `index.html` (vanilla JS + CSS), déployés sur **Netlify**, multijoueur via **Firebase Realtime Database** (même projet pour les deux) :

- **Parchís** (`index.html`) — règles traditionnelles de Tanger, voir plus bas.
- **Mafia** (`mafia/index.html`) — jeu de salon multi-téléphones (tueur/médecin/détective/civils), voir la section « Mafia » en fin de fichier. Yassine a prévu de **remplacer le Parchís par le Mafia sur le site Netlify existant**.

## Commandes

```bash
node tests/moteur.test.js        # 42 tests des règles Parchís, exécutés contre index.html
node tests/sim-multijoueur.js    # partie Parchís simulée entre 2 clients + 2 IA (lancer 3×)
node tests/mafia.test.js         # 66 tests des règles Mafia, exécutés contre mafia/index.html
node tests/sim-mafia.js          # partie Mafia complète, 5 clients VM + reprise de téléphone (lancer 3×)
bash outils/deployer.sh          # fabrique parchis-netlify.zip à glisser sur Netlify
bash outils/deployer-mafia.sh    # fabrique mafia-netlify.zip à glisser sur Netlify
node --check <(awk '/<script>$/{f=1;next}/<\/script>/{f=0}f' index.html)   # syntaxe du JS inline
```

**Toute modification du code réseau ou du moteur (des deux jeux) doit repasser la simulation concernée 3 fois de suite sans échec avant livraison.**

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

## Modes de jeu (v3.7)

`R.mode` = `classique` | `equipes` | `rapide` — choisi dans le setup local ou par l'hôte au lobby (seg `#mode-local`/`#mode-ligne`, synchro live via `regles.mode`, préservé par le reset des règles).

- **Équipes (2 vs 2)** : diagonales fixes Bleu+Vert contre Jaune+Rouge (`partenaire=(pi+2)%4`). Jamais de capture entre partenaires, barrage d'équipe valable partout, la sortie épargne le partenaire (`memeEquipe` dans `simMove`/`canLand`/`exitMove`/`threat`). Victoire quand LES DEUX ont fini ; un joueur fini continue de lancer et joue les pions de son partenaire : **tout le tour joue les pions de `actif()`** (computeTurnMoves/execMove/afterMove/markSelectable/onPawnTap…). Se joue à 4 obligatoirement.
- **Rapide (2 dés)** : `G.desRestants` (synchro `etat.des`, chaîne "a,b"), chaque dé joué séparément, dé actif en tête de file, toucher le 2e dé (`#die2`) échange l'ordre. Pas de rejouer sur 6 ni de triple 6 ; obligations et fautes calculées par dé actif ; sortie sur un dé de 5 normale. Un dé injouable est perdu.
- **1 contre 1 / sièges vides** : siège `x` (« — ») dans le setup local ; en ligne, interrupteur hôte « Sièges vides → IA » (`NET.iaFill`, forcé en équipes) — désactivé, les sièges libres deviennent `t:'x'`. `nextPlayer` saute les sièges `x`, leurs pions sont masqués (`update`), minimum 2 joueurs actifs.

## Règles de Tanger (résumé moteur)

- 68 cases, sens anti-horaire. Salidas : bleu 5, jaune 22, vert 39, rouge 56. Entrées corridor : 68/17/34/51. Corridor 7 cases + boire. **71 pas exacts** de la salida à la boire.
- Refuges (cases sombres à étoile) : {5,12,17,22,29,34,39,46,51,56,63,68}. Pas de capture sur refuge (barrage mixte à la place). Capture possible sur T2 {10,27,44,61}.
- **Exception : la sortie mange.** En sortant de la maison, tout pion adverse posé sur la salida est mangé — même un barrage adverse de deux (les 2 rentrent, +20 chacun, joués en deux coups). Seul un barrage À SOI sur la salida bloque la 1re bille. La 2e bille (salida+5) suit les règles normales : un adverse seul est mangé, un barrage adverse la bloque (elle reste à la maison).
- **Sortie sur 5 : deux pions** (salida + salida+5). Un seul pion restant → salida seule.
- 6 → rejoue. Trois 6 → dernier pion déplacé rentre (**corridor et boire protégés**). **4 pions dehors → 6 vaut 12.**
- Barrage = 2 pions même case (même couleur partout, mixte sur refuge) : bloque passage **et** arrêt. Sur 6/12 : **ouverture obligatoire** (repli à 6 si 12 impossible) — **vaut aussi pour un barrage mixte** : sur un 6 il faut retirer son pion du refuge partagé. Pas de faute si aucune ouverture n'est réellement possible.
- **Libre jeu** : l'app ne bloque pas les coups, elle punit après. FAUTE DE CAPTURE / DE SORTIE (off par défaut) / D'OUVERTURE → le pion joué rentre, flash rouge, **et le tour est perdu** (pas de relance après un 6 fautif, bonus restants perdus). **Priorités (`fauteDuCoup`)** : sur un 6/12 l'ouverture passe avant tout ; sinon capture (n'importe laquelle, mais **au plein du dé** — si un 12 mange, le repli à 6 est fautif) > sortie.
- Capture hors refuge → **+20** (obligatoire si possible, chaînable). Boire sur compte exact → **+10**. Victoire = 4 pions dans la boire.
- 8 interrupteurs dans `R` (modal « Personnaliser les règles ») ; en ligne seul l'hôte les modifie (nœud `regles`).

## Protocole réseau (CRITIQUE — lire avant toute modif)

Base : `parties/{CODE}` = `{v, creele, hote, statut: lobby|jeu|fini, sieges:{pi:{t:h|ia|l|x, nom, uid}}, regles, etat}`.
`etat` = `{seq, w, pawns, cur, face, val, sixes, phase, bonus, bv, lastMoved, winner, des, action}`.

- **Autorité** : `amAuth()` = local → true ; en ligne → `isIA(cur) ? isHote : (myPi===cur)`. Seule l'autorité exécute la logique et les timers ; les autres rendent via `applyEtat` (phase `anim` → `spect`).
- **Seq anti-collision** : `sync()` écrit `seq = Math.max(NET.appliedSeq+1, Date.now())` + `w = NET.uid`, et pose `NET.lastW = NET.uid`.
- **applyEtat** accepte si `seq > appliedSeq` **ou** (`seq === appliedSeq` **et** `w !== NET.lastW`) → convergence dernier-écrit-gagne, échos et redites ignorés. **Parser `pawns` AVANT d'engager `appliedSeq`** (un instantané cassé ne doit rien engager).
- **Garde fantôme** : si `NET.on && myPi==null && !isHote` → ne jamais écrire ni agir (entêtes de `sync`, `doRoll`, `execMove`). Un téléphone qui a perdu son siège devient inerte.
- **endOfAction** ne s'exécute que depuis les phases `anim`/`spect` (anti double fin de tour). `planRecup` mémorise le `seq` à la planification et n'agit (2,2 s) que si **rien n'a bougé depuis**.
- `traiterPartie(snap)` (nommée, try/catch) traite chaque instantané : mapping sièges → `applyEtat` → `rafraichirJeu()` (statut, dé, sélection, `veillerIA`) → proposition de reprise de siège aux spectateurs.
- **buildBoard** initialise `G.pawns` si vide (sinon le premier instantané en ligne crashe et l'écran fige — bug historique v3.0).
- Anti-veille iOS : `forcerResync()` (goOnline + `once` → `traiterPartie`) sur `visibilitychange`/`pageshow`/`focus` ; wake lock `garderEcran()` ; badge `#chip-conn` via `.info/connected`.
- Reprise de siège en pleine partie : modal `modal-reprise` (« C'est moi » → update uid ; sièges `l` proposés aussi : « S'asseoir » → set h/nom/uid). Toute LIBÉRATION de siège (`prendreSiege`, `quitterLigne`) passe par une transaction qui vérifie `uid===NET.uid` — un onglet périmé ne peut plus libérer le siège d'autrui ni un siège en pleine partie (bug vécu : l'hôte fantôme après lancement). L'hôte doit être assis pour lancer. L'hôte peut remplacer un absent par l'IA (menu ⋯ → `#menu-sieges`).
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
- `tests/moteur.test.js` : 42 assertions (dont mode équipes) règles (topologie 71 pas, barrages, captures/refuges, sortie double, sortie qui mange la salida, barrage mixte à ouvrir, priorités ouverture/capture/repli via `fauteDuCoup`, 6→12, obligations et replis, corridor, interrupteurs).
- `tests/sim-multijoueur.js` : 2 vrais clients (VM) + faux Firebase partagé, partie aléatoire complète, **reprise de siège testée à l'action 12**, assertion de convergence d'état à chaque étape, journal des écritures `etat` en cas d'échec. Temps compressé ÷12. Plafond : 1500 pas de boucle (600 faisait échouer ~1 partie sur 10, légitimement longue).

## Backlog (propositions à discuter avec Yassine)

1. Sons discrets + retour haptique (dé, capture, boire, faute).
2. Manifest PWA (« Ajouter à l'écran d'accueil ») — l'icône est faite (`visuels/icone.png`, favicon/apple-touch déjà inlinés) ; reste le manifest, qui demandera un fichier à côté d'`index.html` dans le zip.
3. Écran de fin enrichi : classement, captures, fautes, durée.
4. Historique des coups repliable pendant la partie.
5. Réactions rapides entre joueurs (👏 😂 😱) synchronisées via `action`.
6. ~~Fond d'accueil zellige subtil~~ — fait (SVG procédural dans `body::before`).

---

# Mafia — مافيا (v2.2, `mafia/index.html` + PWA)

Jeu de salon multi-téléphones (type Loup-Garou) : **tout le monde dans la même pièce**, chacun son téléphone, débats à voix haute. 4 à 12 joueurs, en ligne uniquement (pas de mode local). Choix validés avec Yassine le 14/08/2026.

**Bots 🤖 (v1.8, pour tester seul ou compléter une table)** : bouton hôte « Ajouter un bot » au lobby (`joueurs/botN` avec `bot:1`, noms `NOMS_BOTS`). L'hôte joue leurs gestes (`jouerBots` dans `veillerHote` : feuilles actes/votes/prets à leur uid, un tirage par bot et par phase — garde `NET.faits`, délai 0,4-1,3 s, `choixBotNuit`/`choixBotVote` purs et testés). Les bots ne sont jamais proposés à la reprise ni marqués 📴. Un humain + 3 bots = partie de test complète.

## Règles (résumé moteur)

- Rôles : **tueur(s) 🔪** (1, ou 2 à partir de 6 joueurs — réglage hôte), **médecin 💉**, **détective 🔍** (activables), le reste **civils 🌿**.
- **Nuit simultanée** : pas de narrateur ni de téléphone central. TOUS les vivants font un geste sur un écran identique (les civils un geste factice « intuition ») — impossible de deviner un rôle en apercevant l'écran du voisin (exigence forte de Yassine). La nuit se résout quand tous ont confirmé.
- Deux tueurs se connaissent (carte de rôle) ; en désaccord sur la cible, l'hôte tranche au hasard entre leurs deux choix (`choisirCibleTueurs`).
- Médecin : peut se protéger lui-même, mais **jamais la même personne deux nuits de suite** (répétition = protection sans effet, `resoudreNuit(lastProt)` ; le client refuse le geste avec un toast, pas de case grisée qui trahirait l'écran).
- Détective : réponse « TUEUR / INNOCENT » uniquement, livrée dans le **rapport de la nuit** (carte à maintien du doigt, présente chez tout le monde avec un texte selon le rôle → écrans identiques au jour aussi).
- La nuit, impossible de se désigner soi-même (refus par toast, pas de case grisée) — **sauf le médecin** (auto-protection). Évite le « suicide » du tueur découvert par la sim.
- Jour : annonce de l'aube (mort / « le médecin a sauvé une vie » / rien), débats oraux, puis **vote secret** sur téléphone (pas pour soi). Égalité → personne n'est éliminé. Dépouillement public (compte par cible, pas qui a voté quoi).
- Révélation du rôle des morts : interrupteur hôte (défaut : révéler).
- **v2.0 « professionnelle »** : cinématiques plein écran au changement de phase (`#cine`, `cinema()`/`cinePhase`, 5 ambiances, coupées sous `prefers-reduced-motion`, jamais au rechargement) ; avatars emoji par joueur (`AVATARS`, `joueurs/{uid}/av`, modal `modal-avatar` en touchant sa ligne au lobby, bots = 🤖, propagé dans `etat.joueurs[].av`) ; minuteur de débats optionnel (`RG.minuteur` 0/120/300 s, seg hôte, horodatage synchronisé `etat.finDebat` posé à la résolution de nuit, compte à rebours local `majMinuteur`, alerte sans passage automatique) ; écran de fin enrichi (`etat.hist` rempli par les résolutions — `{t:'n'|'v',n,mort/elim,sauve}` —, déroulé + **intuitions nocturnes des civils** via `intuitionsCivils(joueurs,actes,m)` pur et testé, confettis village) ; dépouillement animé ; vibrations Android (`vibrer`).
- Victoire : village si plus aucun tueur ; tueurs si `tueurs ≥ autres vivants`.
- Les morts voient les phases publiques (+ leur propre carte), jamais les infos secrètes des autres.

## Discrétion (conventions impératives du jeu)

- Thème **très sombre** (« noir tangérois »), textes tamisés — jamais de gros rôle en clair à l'écran.
- **Visuels (v1.4)** : fond d'accueil assombri par dégradé (`#scr-accueil`, var `--fond-accueil`), illustrations des cartes de rôles dans `ART` (visibles seulement carte tenue), favicon/apple-touch PNG. Page totale ~255 Ko.
- **Code de partie choisi par l'hôte (v1.3)** : champ optionnel à la création (`in-code-perso`, `codeValide` = 3–8 lettres/chiffres A-Z0-9). Code pris et actif → erreur ; partie périmée (>48 h) au même code → écrasée ; champ vide → `codeAleatoire()`. Rejoindre accepte 3–8 caractères.
- **Bilingue français/arabe (v1.2)** : choix PAR TÉLÉPHONE (`mf_lang`, jamais synchronisé), bascule à l'accueil et dans le menu ⋯. Dictionnaire `I18N` + `t(clé,{vars})` ; statique via `data-i18n`/`data-i18n-html`/`data-i18n-ph` (appliquerLangue), dynamique via `t()`. Arabe = `dir=rtl` sur `<html>` (les champs code restent `ltr`). Le test de parité des clés FR/AR casse si une traduction manque.
- Toute info secrète passe par `.secret` + `bindSecret` : visible **seulement en maintenant le doigt**, se recache au relâchement.
- Écrans identiques pour tous pendant nuit / vote / rapport (seule la petite consigne change).
- Sélection = **blanc lumineux** (`.cel.sel`), conventions communes : pas de `confirm/alert`, accents directs, UI française, tap ≥ 36 px, safe-area.

## Protocole réseau (différent du Parchís — lire avant modif)

Même base RTDB, même nœud : `parties/{CODE}` avec **`jeu:'mafia'`** (les règles Firebase publiées couvrent déjà ce nœud, rien à changer ; chaque jeu refuse les codes de l'autre). Purge 48 h partagée.

`parties/{CODE}` = `{v, jeu:'mafia', creele, hote, statut:lobby|jeu|fini, joueurs:{uid:{nom,ts}}, regles:{tueurs,medecin,detective,reveler}, etat, actes, votes, prets}`.

- **Seul l'hôte écrit `etat`** = `{seq, w, m (manche), ph:roles|nuit|jour|vote|crep|fin, nuit, joueurs:[{uid,nom,role,vif,mort}], prot, res, gagnant}`. `seq = max(appliedSeq+1, Date.now())`, échos ignorés (`seq>=appliedSeq` accepté car rendu idempotent — nécessaire à la reprise de téléphone qui écrit `etat/joueurs/i/uid` sans toucher `seq`).
- **Les joueurs n'écrivent que des feuilles à leur uid** : `actes/m{M}n{N}/{uid}=cibleIdx`, `votes/m{M}j{N}/{uid}`, `prets/m{M}roles/{uid}` — clés par manche+nuit, aucune collision d'écriture possible.
- `veillerHote()` (idempotent, garde `NET.faits`) fait avancer la partie quand tous les vivants ont agi ; filet `planVeille` (2,2 s) si un instantané se perd. `normaliserEtat` parse AVANT d'engager `appliedSeq`.
- Garde fantôme : sans place (`G.myIdx==null`), un téléphone n'écrit jamais. Reprise de téléphone en pleine partie : modal « C'est moi » → `etat/joueurs/i/uid=NET.uid` (l'ancien téléphone devient spectateur), ré-ouvrable à tout moment (menu ⋯ / écran d'attente), re-proposée automatiquement si la place se perd (`NET.reprisePropose` réarmé tant qu'on a une place). **Reprendre le siège de l'HÔTE transfère aussi l'arbitrage** (`hote=NET.uid` — bug critique trouvé en revue : sans ça, plus personne ne résout).
- **Anti-blocage (v1.1, bug vécu : nuit figée à 3/4)** : l'écran d'attente liste les retardataires (« On attend : X »), l'hôte a un bouton **« Continuer sans les absents »** (`forcerSuite` → résolution avec les gestes réellement reçus, garde `NET.faits`), `veillerHote()` passe AVANT `render()` (un pépin d'affichage ne bloque jamais l'arbitrage), et le code de partie est pré-rempli à l'accueil (`mf_code`).
- L'hôte qui quitte le **lobby** ferme le salon (`ref.remove()`) ; en partie, son téléphone reste l'arbitre (il doit rester connecté, ou un autre téléphone reprend son siège). Résolution de nuit **déterministe** (graine manche/nuit) : deux arbitres concurrents (deux onglets hôte, cas iOS) écriraient le même résultat. Courses résiduelles assumées (fenêtre d'un aller-retour réseau) : une reprise peut être écrasée par un `set` complet d'`etat` de l'hôte → le modal se re-propose tout seul.
- Les morts ne reçoivent JAMAIS d'info secrète : un détective assassiné la nuit de son enquête n'emporte pas son résultat (`rapportHTML`). Dépouillement : filtrer `res.tally` (coercition tableau RTDB → lignes fantômes sinon). `showEcran` ferme les modals au vrai changement d'écran (un « Quitter ? » du lobby ne survit pas au lancement).
- Anti-veille iOS : `forcerResync` sur visibilitychange/pageshow/focus, wake lock, badge `#chip-conn` — comme le Parchís. `mf_uid` propre au jeu, prénom partagé via `pt_nom`.
- **Reconnexion automatique (v1.5, bug vécu : iOS recharge la page → retour à l'accueil = « éjection » ressentie)** : `autoRejoindre()` au chargement — si `mf_code` + `mf_actif==='1'` et partie encore là ET que j'en suis **membre** (lobby : `joueurs/{uid}` ; jeu/fini : `joueurs` OU `etat.joueurs` — un code réutilisé par un autre groupe ne happe jamais le téléphone, revue v1.5), `rejoindreRef` direct. `rejoindreRef` fait `off()` de l'ancien écouteur (course clic/auto : jamais deux parties écoutées, revue v1.5). `mf_actif` passe à 0 UNIQUEMENT au départ volontaire (`quitterLigne`) ou partie disparue. Personne n'est JAMAIS supprimé sur déconnexion (pas de délai de grâce : le joueur est dans la pièce) — l'hôte a « Continuer sans les absents ».
- **Présence (v1.5)** : `presences/{uid}=1` + `onDisconnect().remove()` (guard `typeof` pour le faux Firebase), UNE écriture par connexion (`NET.presenceFaite`, réarmée par `majConn(false)`) — sans cette garde le faux Firebase des tests part en boucle infinie (vécu). Badge 📴 (`estHorsLigne`/`decorNom`, textContent only) au lobby, listes et « On attend » — SEULEMENT pour un uid déjà vu dans `presences` (`NET.presVus`) : un vieux client qui n'écrit pas sa présence n'est jamais marqué à tort (revue v1.5). Écriture gardée par l'appartenance (garde fantôme), appelée depuis `traiterPartie` après calcul de `myIdx`. Purgée avec la partie (48 h).
- **PWA (v1.5)** : `mafia/manifest.json` (standalone, portrait), `mafia/sw.js` **réseau-d'abord** (cache de secours hors ligne seulement — jamais de vieille version servie en ligne ; repli page d'accueil réservé aux navigations, `cache.put` sous `e.waitUntil`), icônes 192/512, balises `apple-mobile-web-app-*`. ⚠️ En PWA installée, iOS isole le localStorage de Safari → nouvel uid → passer par « C'est moi ». Livraison = 5 fichiers (index.html, manifest.json, sw.js, icon-192/512.png) — les deux scripts `deployer-mafia*` les gèrent.
- ⚠️ La base est en lecture publique : les rôles sont lisibles par qui ouvre la console réseau. Assumé (jeu de famille) — ne pas prétendre à du secret cryptographique.

## Tests Mafia

- `tests/charge-mafia.js` : extraction du script de `mafia/index.html` en VM (réutilise le DOM factice de `charge.js`).
- `tests/mafia.test.js` : 66 assertions (intuitions v2.0, bots, narrateur — parité/déterminisme —, code choisi par l'hôte, langues FR/AR — parité des clés —, composition/validation des rôles, victoires, cible des tueurs, résolution de nuit — y compris gestes partiels après forçage —, protection non répétable, dépouillement/égalités/votes partiels, votes de morts ignorés).
- `tests/sim-mafia.js` : 5 vrais clients VM + faux Firebase partagé, partie aléatoire complète, **reprise de téléphone testée au premier jour** (l'ancien client devient fantôme) **et nuit 1 forcée sans le geste d'un retardataire** (bouton hôte) **et reprise du téléphone de l'hôte avec transfert d'arbitrage**, convergence vérifiée à chaque étape, temps ÷12, plafond 600 pas.

## Déploiement

- **Miroir GitHub Pages (v1.8)** : https://yassiniboy1-dev.github.io/parchis-tangerois/ — branche `gh-pages` (orpheline, 5 fichiers + `.nojekyll`), rafraîchie par `bash outils/deployer-pages.sh` (worktree temporaire). Pages s'est activé tout seul à la création de la branche. Aucune limite de déploiement, gratuit. Même Firebase que Netlify → les codes de partie marchent sur les deux adresses.
- Sans jeton : `bash outils/deployer-mafia.sh` → `mafia-netlify.zip` à glisser sur app.netlify.com.
- Avec jeton : `NETLIFY_AUTH_TOKEN=xxx bash outils/deployer-mafia-api.sh` (méthode digest, vérifie le content-type servi — jeton jamais dans le dépôt).
- **Fait le 14/08/2026** : le Mafia remplace le Parchís sur https://parchis-tangerois.netlify.app (choix de Yassine). L'ancien Parchís reste restaurable via l'historique des déploiements Netlify.

## Backlog Mafia (à discuter avec Yassine)

1. ~~Illustrations Nano Banana Pro~~ — fait (v1.4) : fond d'accueil, icône, 4 cartes de rôles (`gemini-3-pro-image`, sources dans `visuels/mafia-*.png`, prompts dans `visuels/README.md`, inlinés en WebP ~80 Ko). La clé Gemini reste hors dépôt.
2. ~~Sons discrets~~ — fait (v1.6) : Web Audio synthétisé (`SONS`, `jouerSon`, `sonsPhase` — un son par CHANGEMENT de phase, jamais au rechargement), bascule 🔊/🔇 dans le menu ⋯ (`mf_sons` par téléphone), contexte audio réveillé au premier geste (`reveilAudio`, exigence iOS). Repli synthétisé seulement quand le son n'existe pas dans `SFX` : les **sons Suno** de Yassine (liens de partage `suno.com/s/...` collés dans le chat → mp3 téléchargeable depuis la page ; pas d'API Suno) sont découpés (ffmpeg, mono 48 kb/s) dans `sons/*.mp3` puis inlinés par `python3 outils/inliner-sons.py` (bloc `/*__SFX__*/`, pré-décodés au premier geste). Sons en place (v2.2) : `nuit` (Suno de Yassine) + les 8 autres générés par **ElevenLabs Sound Effects** (`/v1/sound-generation`, prompts cinématiques, ne consomme pas le quota voix ; détail dans `sons/README.md`). Les Kenney CC0, jugés médiocres à l'écoute par Yassine, sont remplacés. Plus AUCUN repli synthétisé utilisé en pratique (le code de repli reste).
3. ~~Narration~~ — fait (v1.7) : récits d'ambiance bilingues (`NARR`, 2-3 variantes par événement, tirage DÉTERMINISTE graine manche/nuit → même phrase sur tous les téléphones, affichés en `.narratif` dans les annonces) + **narrateur vocal optionnel** (`VOIX`, bascule 🗣️ menu ⋯, `mf_voix` par téléphone, coupé par défaut — conseil : l'activer sur UN téléphone posé au milieu). **v2.1 : voix pré-enregistrées ElevenLabs** (44 mp3 dans `mafia/voix/{fr|ar}_{clé}_{idx}.mp3`, voix Daniel, générées par un script en session avec la clé restreinte de Yassine — clé jamais dans le dépôt ; `n_mort`/`n_elim` = adaptations SANS prénom ; `narrerVoix` joue le fichier de la MÊME variante que le texte affiché, repli speechSynthesis fr-FR/ar-SA). Les 3 scripts de déploiement embarquent `voix/`. `narrerPhase` suit les changements de phase comme `sonsPhase` (jamais au rechargement).
4. Minuteur de débats optionnel.
4. Rôles bonus (à valider) : sorcière, maire…
5. Stats de fin enrichies (intuitions des civils révélées pour rire).

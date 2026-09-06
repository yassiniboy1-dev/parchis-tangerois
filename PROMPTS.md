# Recréer « Mafia — مافيا » depuis zéro : tous les prompts

Guide pour rebâtir le jeu avec Claude Code (ou un autre assistant IA), dans
l'ordre où tout a été construit la première fois. Chaque bloc se copie-colle
tel quel. Les 🔑 indiquent le moment où donner un outil (clé API, lien…).

> **Raccourci** : si le dépôt existe encore, le plus efficace n'est pas de
> re-prompter — c'est de donner `CLAUDE.md` (et le code) à une nouvelle
> session : tout le savoir y est déjà distillé.

---

## 1. Le prompt fondateur

```
Je veux créer un jeu qui s'appelle Mafia (type Loup-Garou) : un tueur, un
médecin, un détective et des civils. Jeu collectif à plusieurs téléphones,
tout le monde dans la même pièce, chacun son téléphone, débats à voix haute.

Contraintes techniques :
- Un seul fichier index.html (vanilla JS + CSS), hébergé gratuitement
  (Netlify ou GitHub Pages), multijoueur via Firebase Realtime Database
  (base gratuite, parties purgées après 48 h — je ne veux rien payer).
- UI en français, mobile-first iPhone (safe-area, tap targets ≥ 36 px),
  jamais window.confirm/alert/prompt (bloqués sur iPhone) → modals custom.
- Tests automatiques : moteur de règles testé en VM Node contre le vrai
  fichier HTML, plus une simulation multi-clients complète (faux Firebase
  partagé) qui doit passer 3 fois de suite avant toute livraison.

Questionne-moi question par question pour fixer les règles avant de coder.
```

Réponses à donner quand l'assistant questionne (nos choix validés) :

- **Même pièce**, pas de téléphone central : chacun suit sur son écran, en silence.
- **4 à 12 joueurs**, réglage libre par l'hôte : 1 ou 2 tueurs (2 dès 6 joueurs),
  médecin et détective activables. L'hôte **joue comme les autres** ; son
  téléphone arbitre en arrière-plan sans lui montrer de secrets.
- **Nuit simultanée** : tous les vivants font un geste sur un écran identique
  (les civils un geste factice « intuition ») — impossible de deviner un rôle
  en apercevant l'écran du voisin. Interdiction de se désigner soi-même,
  sauf le médecin (auto-protection).
- **Médecin** : jamais la même personne deux nuits de suite.
- **Détective** : réponse « TUEUR / INNOCENT » seulement, dans un rapport
  privé à maintien du doigt (présent chez tout le monde avec un texte selon
  le rôle → écrans identiques aussi le jour).
- **Vote secret** sur téléphone (pas pour soi), égalité → personne ne meurt,
  dépouillement public (compte par cible, jamais qui a voté quoi).
- **Révélation du rôle des morts** : interrupteur hôte (défaut : révéler).
  Les morts ne reçoivent JAMAIS d'info secrète.
- **Victoire** : village si plus aucun tueur ; tueurs si tueurs ≥ autres vivants.
- **Discrétion maximale** : thème très sombre « noir tangérois », carte de
  rôle visible seulement en MAINTENANT le doigt, sélection = blanc lumineux.
- Nom : **Mafia**, ambiance film noir à Tanger (médina, lanternes, brume).

## 2. L'anti-blocage (à demander dès le premier test à plusieurs)

```
Problème vécu : la partie se fige à « 3/4 gestes accomplis » quand un
téléphone perd son geste (page rechargée, réseau). Je veux :
- que l'écran d'attente liste QUI on attend (« On attend : X ») ;
- un bouton hôte « Continuer sans les absents » qui résout la phase avec
  les gestes réellement reçus ;
- « Reprendre ma place » accessible à tout moment pour un téléphone qui a
  changé ou perdu son identité — et si c'est le téléphone de l'HÔTE qui est
  repris, l'arbitrage doit suivre, sinon plus personne ne résout ;
- fais relire le protocole réseau par une revue adversariale avant de livrer.
```

## 3. Bilingue et détails d'accueil

```
Je ne veux pas dépasser les quotas gratuits (Firebase/Netlify) — vérifie et
rassure-moi. Et je veux un choix de langue PAR téléphone : français / arabe
(dictionnaire complet, arabe en écriture droite-à-gauche, un test qui casse
si une traduction manque). Je veux aussi que l'hôte puisse choisir son code
de partie (3-8 lettres/chiffres, ex. FAMILLE), code aléatoire sinon.
```

## 4. Visuels — Nano Banana Pro 🔑 (clé Gemini `AQ.…` ou `AIza…`, créée sur aistudio.google.com)

```
Génère les visuels du jeu avec le modèle gemini-3-pro-image, vérifie chaque
image avant de l'intégrer, compresse en WebP et inline-les dans le fichier.
Style commun à TOUS les prompts d'images :
"1950s film noir illustration of Tangier, Morocco. Painterly, cinematic,
very dark moody palette: deep indigo, near-black shadows, warm amber lantern
light as the only accent. No text, no letters, no watermark."
```

Les 6 images (format entre parenthèses) :

1. **Fond d'accueil** (9:16) — « Vertical phone wallpaper. Atmospheric night
   scene in the old Tangier medina: a narrow whitewashed alley with worn blue
   doors, a wrought-iron lantern casting a small warm pool of light, thin sea
   fog, and far away the tiny silhouette of a man in a fedora and long coat
   walking away. Composition mostly dark and empty in the middle so interface
   text stays readable on top. » + style commun
2. **Icône** (1:1) — « Square app icon. Close-up silhouette of a mysterious
   man in a black fedora seen from the front, face completely hidden in
   shadow, behind him a Tangier horseshoe archway and one warm lantern glow.
   Bold, simple, readable at small size. » + style commun
3. **Carte tueur** (3:2) — silhouette au feutre, couteau accrochant un fil de
   lumière ambrée, visage caché, ruelle sombre.
4. **Carte médecin** (3:2) — médecin années 50, trousse en cuir, pressé vers
   une porte éclairée, stéthoscope.
5. **Carte détective** (3:2) — trench-coat sous une lanterne, loupe sur des
   traces de pas, fumée sortant de l'ombre.
6. **Carte civils** (3:2) — petit café de la médina la nuit, thé à la menthe,
   dominos, silhouettes tranquilles sous une lampe ambrée.

## 5. Fiabilité mobile + PWA

```
Problème vécu : dès qu'un joueur verrouille l'écran ou que iOS recharge la
page, il retombe sur l'accueil — vécu comme une éjection. Je veux :
- reconnexion automatique au chargement (identité + code en localStorage,
  retour direct dans la partie SI on en est membre — un code réutilisé par
  un autre groupe ne doit jamais nous happer) ; personne n'est jamais
  supprimé sur déconnexion (le joueur est dans la pièce) ;
- badge 📴 sur les joueurs dont le téléphone a décroché (présence Firebase
  onDisconnect, sans faux positifs pour les vieux clients) ;
- PWA installable : manifest standalone, service worker RÉSEAU-D'ABORD
  (jamais servir une vieille version en ligne), icônes 192/512 ;
- fais repasser la revue adversariale sur ces changements.
```

## 6. Sons 🔑 (Suno : liens de partage `suno.com/s/...` — ou clé ElevenLabs `sk_…`)

```
Ajoute des sons discrets : un par CHANGEMENT de phase (jamais au
rechargement), bascule 🔊/🔇 par téléphone, contexte audio réveillé au
premier geste (iOS). D'abord en synthèse Web Audio (zéro fichier), puis
remplace par de vrais sons quand je te les donne.
```

Sons ElevenLabs (endpoint `/v1/sound-generation`, ne consomme pas le quota
voix) — prompts exacts et durées :

| Son | Prompt | Durée |
|---|---|---|
| mort | deep cinematic funeral bell toll with dark reverb, single ominous strike | 2,5 s |
| aube | gentle warm morning bell chime in an old medina, soft and hopeful, short | 2 s |
| sauve | soft hopeful harp glissando rising, a life saved, magical and short | 2 s |
| vote | single piece of paper sliding into a wooden ballot box, subtle and quiet | 1,5 s |
| vjoie | short triumphant arabic oud victory phrase with warm strings, celebration | 3 s |
| vsombre | short sinister dark cello sting, low and ominous, the villains have won | 3 s |
| egalite | two hesitant soft wooden knocks on a table, neutral and quiet | 1,5 s |
| roles | single playing card flipped softly on a felt table | 1 s |

Suno (pour le vent de la nuit, qui reste le meilleur) : « soft night wind in
a narrow medina alley, distant owl, very quiet, fades out » — Loop, 60 BPM,
D minor. Traitement : mono 44,1 kHz, 48 kb/s, crête à −3 dB, fondu de sortie.

## 7. Narration 🔑 (clé ElevenLabs `sk_…`, restreinte à la synthèse suffit)

```
Fais raconter tout le jeu par un narrateur :
- récits d'ambiance bilingues FR/AR, 2-3 variantes par événement (mort à
  l'aube, médecin sauveur « Bien joué, docteur ! », vote, égalité,
  victoires…), tirage DÉTERMINISTE (graine manche/nuit) pour que tous les
  téléphones racontent la même histoire ;
- voix pré-enregistrée avec ElevenLabs (voix Daniel, modèle
  eleven_multilingual_v2, stability 0.55 / similarity 0.75 / style 0.35,
  sortie mp3_22050_32) : un mp3 par variante et par langue, les annonces
  avec prénom en version SANS prénom (le nom s'affiche à l'écran) ;
- lecture par élément <audio> playsinline (joue même iPhone en silencieux,
  marche en PWA), repli Web Audio puis synthèse du téléphone ;
- bascule 🗣️ par téléphone, proposée automatiquement à l'hôte au premier
  salon, avec retour audible immédiat à l'activation. Conseil affiché :
  activer sur UN téléphone posé au milieu de la table.
```

## 8. Bots et test en solo

```
Ajoute des bots 🤖 : bouton hôte « Ajouter un bot » au lobby, ils regardent
leur rôle, font leur geste de nuit et votent (mêmes règles que les humains,
avec un petit délai naturel), joués par le téléphone de l'hôte. Jamais
proposés à la reprise, jamais marqués hors ligne. Un humain + 3 bots doit
suffire pour tester toutes les phases en solo.
```

## 9. La grande mise à jour « professionnelle »

```
Fais une mise à jour majeure pour que ce soit un jeu professionnel :
- cinématiques plein écran au changement de phase (voile de nuit, aube
  dorée, annonce de mort théâtrale, victoires) synchronisées avec sons et
  narrateur, respect de « réduire les animations » ;
- avatars emoji choisis par chaque joueur au lobby ;
- minuteur de débats optionnel (hôte : ∞ / 2 min / 5 min), compte à rebours
  synchronisé, alerte sans passage automatique ;
- écran de fin enrichi : déroulé complet nuit par nuit, rôles révélés,
  intuitions nocturnes des civils dévoilées pour rire, confettis village ;
- dépouillement animé, vibrations, numéro de version VISIBLE sur l'accueil,
- réglages ⚙️ accessibles depuis l'accueil et le salon, pas juste en partie.
```

## 10. Hébergement de secours

```
Mets aussi le jeu en miroir gratuit sur GitHub Pages (branche gh-pages,
mêmes fichiers, même Firebase → les codes marchent sur les deux adresses),
avec un script pour rafraîchir le miroir en une commande.
```

---

## Les pièges appris (à souffler à l'assistant si besoin)

- **Netlify gratuit a des crédits mensuels de déploiement** : regrouper les
  mises à jour ; le miroir GitHub Pages n'a pas cette limite.
- **iOS recharge les pages en veille** → reconnexion auto obligatoire, et
  identité en localStorage (la PWA installée a un localStorage SÉPARÉ de
  Safari → prévoir « C'est moi »).
- **L'interrupteur silencieux de l'iPhone coupe le Web Audio** mais pas les
  éléments <audio> → la voix doit passer par un élément audio.
- **La synthèse vocale d'Apple ne marche pas en PWA installée** → voix
  pré-enregistrées, synthèse seulement en repli.
- **Deux onglets hôte** peuvent arbitrer en même temps → résolutions
  DÉTERMINISTES (graine) pour qu'ils écrivent le même résultat.
- Toujours : simulation multi-clients 3× avant livraison, et une **revue
  adversariale** du protocole après chaque gros changement (elle a trouvé
  les vrais bugs : arbitrage non transféré, écouteurs Firebase en double).

## Clés et outils à fournir (jamais dans le code ni le dépôt)

| Outil | Sert à | Où l'obtenir |
|---|---|---|
| Clé Gemini (`AQ.…`/`AIza…`) | images Nano Banana Pro | aistudio.google.com |
| Liens Suno (`suno.com/s/...`) | sons d'ambiance | abonnement Suno, outil Sounds |
| Clé ElevenLabs (`sk_…`) | voix du narrateur + bruitages | elevenlabs.io (gratuit) |
| Jeton Netlify (`nfp_…`) | déploiement direct | app.netlify.com → User settings |

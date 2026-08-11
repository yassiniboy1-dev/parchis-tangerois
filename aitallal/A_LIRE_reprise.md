# AIT ALLAL GROUPE — Reprise de la conversation

Ce dossier contient **tout** pour continuer dans une nouvelle page.

## Version actuelle : v53-fix121

## Contenu du zip
- `app/index.html` — l'application complète (version fix121, à jour)
- `app/manifest.json`, `app/sw.js` — fichiers PWA (sw.js en fix121)
- `app/index-ar.html` — la page de contrôle arabe en fichier SÉPARÉ (observation hors-ligne)
- `app/elghersa_import.json` — les vraies données EL GHERSA (pour vérifier les calculs)
- `make_ar.py` — le script qui fabrique la page arabe séparée à partir de index.html
  ⚠️ OBSOLÈTE depuis fix120 : plusieurs ancrages ne correspondent plus (le rôle Observateur et
  `renderControleAR` sont maintenant DANS index.html). `index-ar.html` a été mis à jour À LA MAIN
  pour fix121. À réparer proprement si on veut réutiliser le script (voir note plus bas).
- `aitallal-netlify-v53-fix121.zip` — **LE ZIP À DÉPLOYER SUR NETLIFY** (index.html + manifest.json + sw.js)

## À déployer
Déploie `aitallal-netlify-v53-fix121.zip` sur Netlify, puis ferme/rouvre l'app DEUX fois
(pour que le cache du service worker se mette à jour). Les données ne sont pas réinitialisées.

---

## CE QU'ON A FAIT EN DERNIER (fix121) — page arabe en TABLEAUX

Sur la page de contrôle arabe (observateur), chaque bloc d'appartements et la liste des magasins
s'affichent désormais en **tableau** (au lieu d'une liste), pour une lecture plus facile.
- Appartements : colonnes **الطابق (étage) · الشقة (n°) · المساحة (surface) · الحالة (statut)**,
  triées par étage puis numéro (les étages se regroupent visuellement).
- Magasins : colonnes **المحل (n°) · الموقع (RDC/Mezzanine) · المساحة · الحالة**.
- En-têtes de colonnes, lignes zébrées, badges de statut conservés (متوفر / مباع / محجوز).
- Supprime le « · · » disgracieux qui venait du champ `type` vide sur les 286 appartements.
- Modifié dans `renderControleAR()` (helpers `buildTable` + `aptRow`/`magRow`), dans index.html
  ET dans index-ar.html (édition manuelle, car make_ar.py est obsolète — voir ci-dessous).
- **Nom de l'acheteur** sous chaque bien VENDU : ligne « المشتري : <nom> » (nom en latin, ex.
  KAROUN MOHAMMED). Rattachement vente→client par `ref` ; les biens disponibles n'affichent rien.
  Le nom est sur une ligne pleine sous la ligne du bien (les noms sont longs) — pas en colonne.
- **Bouton « Se déconnecter »** sur la page observateur (« تسجيل الخروج · Se déconnecter »).
  Correction d'un bug : l'observateur n'avait aucun moyen de se déconnecter. Sa branche dans
  `render()` fait un `return` avant `attachEvents()`, donc le bouton ET le popup de confirmation
  sont câblés à part via `attachObservateurEvents()`. (Ne concerne que index.html / l'app ;
  index-ar.html est l'affichage arabe autonome en connexion auto, sans déconnexion par nature.)
- **Connexion par mot de passe seul** : l'écran de connexion ne demande plus le login, juste
  le mot de passe (`doLogin` cherche l'utilisateur par mot de passe). ⚠️ Sécurité importante :
  le mot de passe doit être **unique** par compte — c'est vérifié à la création ET à la
  modification d'un utilisateur (message d'erreur si doublon). Le champ « Login » reste présent
  dans la gestion des comptes comme libellé interne (il sert d'identifiant lisible et à la
  détection du compte admin par défaut), mais il n'est plus utilisé pour se connecter.
  ⚠️ Si deux comptes existants partagent déjà le même mot de passe, changez-en un (sinon la
  connexion avec ce mot de passe ouvrira toujours le premier compte trouvé).
- **Types (Catalogue)** : ajout de « Nb de chambres » et « Nb de salles de bain » dans les
  Caractéristiques communes de la création/modification d'un type. Comme orientation/façades/vue,
  ces valeurs sont propagées à tous les appartements du type (`apt.chambres` / `apt.sdb`).
  Un champ laissé vide ne modifie pas la valeur existante de l'appartement.
- **Mode Commercial — Plan du bâtiment (1/4)** : nouvelle vue « Plan & disponibilités »
  (`renderLuxePlanBatiment`). On choisit un bloc, le bâtiment s'affiche étage par étage (du plus
  haut au plus bas), chaque appartement = une case colorée (vert = Disponible, doré = Réservé,
  gris = Vendu) avec N° + surface ; un clic ouvre la fiche du bien. N'utilise que les données
  existantes. Accès depuis la page d'accueil du mode commercial.
  ⏳ Chantier Mode Commercial demandé : 4 features, faites une par une. Reste à faire :
  (3) brochure PDF élégante, (4) galerie photos + plans par type.
- **Mode Commercial — Simulateur de paiement (2/4)** : bouton « 🧮 Simuler un paiement » sur la
  fiche d'un bien (`renderLuxeSimulateur`). Prix indicatif (via `getPrixIndicatif`) + choix de
  l'apport (0–50 %) et de la durée (12–84 mois) → calcule apport, montant à financer, mensualité
  et un aperçu d'échéancier daté. Estimation indicative, sans engagement (mention « ne constitue
  pas une offre de crédit »). Aucune écriture en base. Si le bien n'a pas de prix, message clair.
- **Mode Commercial — Élévation design (CSS pur)** : sur le hero, ajout d'un grain photographique
  subtil, d'un fin cadre doré en retrait, d'une vignette renforcée, et d'une entrée orchestrée en
  cascade (ornement → titre → sous-titre → slogan → prix → boutons). La fiche d'un bien révèle
  son titre à l'ouverture ; la liste des résidences fait apparaître ses cartes en décalé (opacité
  seule, le survol reste intact). Respecte `prefers-reduced-motion`. Aucune modif de mise en page
  ni de JS — uniquement un bloc CSS ajouté après le media-query du hero, dans les deux fichiers.
- Le reste de la page (taux d'avance, % fiscal, compteurs vendu/libre/réservé) est inchangé.

### make_ar.py — à réparer un jour (optionnel)
Le script plante sur le `index.html` actuel : depuis fix120, le rôle Observateur, `renderControleAR`
et le garde anti-écriture de `uploadToCloud` sont DÉJÀ dans index.html, donc les ancrages des étapes
6, 7b et 8 ne matchent plus. Pour cette version, `index-ar.html` a donc été modifié directement
(même changement de tableau). Si on veut refaire fonctionner le script : rendre ces étapes
idempotentes (ne rien injecter si déjà présent) et re-synchroniser sa copie de `renderControleAR`.

---

## CE QU'ON A FAIT EN DERNIER (fix120) — accès lecture seule pour l'associé

Objectif : un associé propriétaire, arabophone, qui se connecte avec un mot de passe et
voit DIRECTEMENT une page de contrôle simple, sans rien pouvoir modifier, sans réglages.

Réalisé et intégré dans l'app (index.html) :
- **Nouveau rôle « Observateur (lecture seule) »** dans la liste des rôles (ROLES).
  Il a tous les droits "voir", aucun droit modifier/créer/supprimer/gérer.
- **Page de contrôle en arabe** = fonction `renderControleAR()`. Elle affiche :
  - % d'avance global (encaissé / CA total) = **35%**
  - % du **fiscal** reçu (fiscal encaissé / fiscal vendu) = **25%**
  - 3 chiffres : vendu **93** · libre **271** · réservé **0**
  - sections **dépliables** : "الشقق حسب البلوك" (chaque bloc s'ouvre sur ses appartements
    avec statut), et "المحلات" (les magasins). Numéros, "Bloc A" et surfaces restent en latin.
- **À la connexion**, si le rôle = observateur → l'app affiche UNIQUEMENT cette page
  (édité dans `render()`, juste après le bloc login : `else if (state.user.role === 'observateur')`).
- **Sécurité (vérifiée par tests)** : ce rôle ne peut RIEN écrire —
  `uploadToCloud` et `maybeAutoBackup` ont un garde `if (... role === 'observateur') return;`.
  Sa session n'est PAS mémorisée (le render observateur sort avant persist), donc tester
  ce compte n'écrase pas la session admin.

### Comment l'utiliser (à faire par l'admin après déploiement)
Paramètres → Utilisateurs → Ajouter → rôle « Observateur (lecture seule) » → login + mot de passe.
Donner ce login/mot de passe à l'associé. Il se connecte → il voit la page de contrôle, rien d'autre.

### Mise à jour des chiffres (réponse à la dernière question)
La page lit les mêmes données que l'app. Sur l'appareil de l'associé, l'app TÉLÉCHARGE
les données du cloud au démarrage (`downloadFromCloud` appelé dans `initCloud`/`handleElghersaSeedSync`).
Donc à jour, MAIS :
- la synchro cloud doit être ACTIVÉE (Paramètres → cloud) ;
- la synchro temps réel est désactivée (cycles ~30 min) → léger décalage possible, pas figé ;
- l'associé a besoin d'internet à l'ouverture.
À TESTER une fois sur le vrai Firebase (jamais testable ici) : faire une modif, attendre
quelques minutes, ouvrir le compte observateur sur un autre appareil et vérifier que le chiffre a bougé.

### Reste à faire / proposé (optionnel)
- Traduire l'écran de LOGIN en arabe (actuellement en français : login + mot de passe + bouton).
- Montrer où vérifier que la synchro cloud est activée dans les Paramètres.

---

## Chiffres de référence EL GHERSA (vérifiés sur elghersa_import.json)
- Appartements : 286 (vendus 65, libres 221) ; Magasins : 78 (vendus 28, libres 50) ; Parkings : 0
- Total vendus 93 · libres 271 · réservés 0
- CA total 130 008 000 · CA fiscal 113 265 500 · CA N 16 299 500
- Encaissé total 45 121 700 · encaissé fiscal 28 822 200 · encaissé N 16 299 500
- % avance global 35% · % fiscal reçu 25%
- 7 blocs : A, B, C, D, G, H, I (les blocs E et F n'existent pas encore dans les données)

## Historique court des versions précédentes
- fix114 : panneau "Santé des données" (diagnostic lecture seule)
- fix115 : sauvegardes cloud automatiques horodatées (chemin Firebase séparé)
- fix116 : sauvegarde déclenchée seulement au changement (Firebase gratuit)
- fix117 : "% payé" dans le tableau de bord (par bien/bloc/catégorie)
- fix118 : écran "Types d'appartements" (chambres + type par bloc/numéro)
- fix119 : ajout "salle de bain" (sdb) à l'écran des types
- fix120 : rôle Observateur + page de contrôle arabe à la connexion
- fix121 : … + Mode Commercial : plan du bâtiment (1/4) + simulateur (2/4) + élévation design du hero (CETTE VERSION)

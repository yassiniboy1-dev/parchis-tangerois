# Visuels générés — AIT ALLAL

- `hero-elghersa.webp` (1600px, ~159 Ko) : visuel d'accueil du Mode Commercial et
  couverture de repli de la brochure. **Illustration générée par IA (Nano Banana Pro /
  gemini-3-pro-image, 11/08/2026)** — ambiance « résidence tangéroise au crépuscule »,
  palette bordeaux/cuivre/crème du mode luxe. Ce n'est PAS une photo du vrai projet :
  ne l'utiliser que comme visuel d'ambiance (les documents portent déjà la mention
  « non contractuel »). Déployé sur https://aitallal.netlify.app/visuels/hero-elghersa.webp ;
  servi en repli automatique quand Paramètres → heroImageUrl est vide (fix122).
- `hero-elghersa-source.jpg` : original 2752×1536 sorti du modèle (source, hors zip).

Prompt (anglais) : luxury real estate marketing visual, wide cinematic shot at golden
dusk, modern Moroccan residential complex on a hillside in Tangier, cream stone, zellige
friezes, arched balconies, Mediterranean garden, palm and olive trees, distant sea,
burgundy sky, copper and gold light. No text, no people.

## Icônes de menu (fix122)

14 pastilles (fond marine #0a1f3d→#16335c, pictogramme filaire or #d4af37) générées avec
`gemini-3-pro-image` (11/08/2026), recadrées automatiquement sur la pastille, inlinées en
data URI WebP 96px (~16 Ko au total) dans `const ICONES_MENU` d'index.html (helper
`iconeMenu()`, repli sur l'ancien picto SVG). Clés : home, building, users, star, calendar,
calendar-check, file-sign, receipt, wallet, truck, user-cog, trash, settings, commercial.
Prompt type : « Flat modern app icon in a rounded square badge, deep navy gradient
background, refined thin-line gold pictogram of <sujet>, centered, luxury real estate
management app icon set style, no text ».

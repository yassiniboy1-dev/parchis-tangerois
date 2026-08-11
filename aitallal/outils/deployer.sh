#!/usr/bin/env bash
# Fabrique le zip à déployer sur Netlify (glisser-déposer sur app.netlify.com).
# Le nom du zip reprend la version du CACHE_NAME de sw.js.
# Usage : bash outils/deployer.sh   (depuis le dossier aitallal/)
set -eu
cd "$(dirname "$0")/.."

VERSION=$(grep -o "aitallal-v53-fix[0-9]*" sw.js | head -1 | sed 's/aitallal-//')
[ -n "$VERSION" ] || { echo "version introuvable dans sw.js"; exit 1; }

bash outils/verifier.sh

ZIP="aitallal-netlify-$VERSION.zip"
rm -f aitallal-netlify-*.zip
zip -j "$ZIP" index.html manifest.json sw.js
echo
echo "→ $ZIP prêt."
echo "  Déployer : app.netlify.com → site aitallal → Deploys → glisser le zip."
echo "  Puis fermer/rouvrir l'app DEUX fois (mise à jour du cache du service worker)."
echo "  index-ar.html n'est PAS dans le zip (page hors-ligne autonome de l'associé)."

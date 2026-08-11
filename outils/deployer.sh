#!/bin/bash
# Fabrique le zip Netlify : index.html + manifest PWA + icônes (chemins conservés)
cd "$(dirname "$0")/.." || exit 1
rm -f parchis-netlify.zip
zip parchis-netlify.zip index.html manifest.webmanifest icons/icone-192.png icons/icone-512.png \
  && echo "OK → glisse parchis-netlify.zip sur app.netlify.com (Deploys)"

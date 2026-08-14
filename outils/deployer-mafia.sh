#!/bin/bash
# Fabrique le zip Netlify du jeu Mafia (index.html + fichiers PWA)
cd "$(dirname "$0")/.." || exit 1
rm -f mafia-netlify.zip
zip -j mafia-netlify.zip mafia/index.html mafia/manifest.json mafia/sw.js mafia/icon-192.png mafia/icon-512.png \
  && echo "OK → glisse mafia-netlify.zip sur app.netlify.com (Deploys)"

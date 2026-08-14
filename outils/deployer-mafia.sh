#!/bin/bash
# Fabrique le zip Netlify du jeu Mafia (index.html + PWA + voix du narrateur)
cd "$(dirname "$0")/../mafia" || exit 1
rm -f ../mafia-netlify.zip
zip -r ../mafia-netlify.zip index.html manifest.json sw.js icon-192.png icon-512.png voix \
  && echo "OK → glisse mafia-netlify.zip sur app.netlify.com (Deploys)"

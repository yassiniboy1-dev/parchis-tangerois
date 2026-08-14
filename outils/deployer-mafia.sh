#!/bin/bash
# Fabrique le zip Netlify du jeu Mafia à partir de mafia/index.html
cd "$(dirname "$0")/.." || exit 1
rm -f mafia-netlify.zip
zip -j mafia-netlify.zip mafia/index.html && echo "OK → glisse mafia-netlify.zip sur app.netlify.com (Deploys)"

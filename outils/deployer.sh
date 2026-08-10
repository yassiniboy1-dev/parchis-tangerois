#!/bin/bash
# Fabrique le zip Netlify à partir d'index.html
cd "$(dirname "$0")/.." || exit 1
rm -f parchis-netlify.zip
zip -j parchis-netlify.zip index.html && echo "OK → glisse parchis-netlify.zip sur app.netlify.com (Deploys)"

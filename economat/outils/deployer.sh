#!/bin/bash
# Fabrique le zip Netlify à partir d'economat/index.html + pont-elyx.html (liaison caisse Elyx)
cd "$(dirname "$0")/.." || exit 1
rm -f economat-netlify.zip
zip -j economat-netlify.zip index.html pont-elyx.html && echo "OK → glisse economat-netlify.zip sur app.netlify.com (Deploys) — nouveau site conseillé, séparé du Parchís. Le pont sera servi sur /pont-elyx.html"

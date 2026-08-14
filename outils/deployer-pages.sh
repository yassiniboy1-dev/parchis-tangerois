#!/bin/bash
# Rafraîchit le miroir GitHub Pages (branche gh-pages) avec mafia/ actuel.
# URL du miroir : https://yassiniboy1-dev.github.io/parchis-tangerois/
set -e
cd "$(dirname "$0")/.." || exit 1
WT=$(mktemp -d)
git worktree add "$WT" gh-pages
cp mafia/index.html mafia/manifest.json mafia/sw.js mafia/icon-192.png mafia/icon-512.png "$WT/"
touch "$WT/.nojekyll"
git -C "$WT" add -A
if git -C "$WT" diff --cached --quiet; then
  echo "miroir déjà à jour"
else
  git -C "$WT" commit -m "Miroir GitHub Pages : mise à jour du jeu Mafia"
  git -C "$WT" push origin gh-pages
  echo "miroir poussé — Pages se republie tout seul en ~1 min"
fi
cd "$(git rev-parse --show-toplevel)"
git worktree remove --force "$WT"

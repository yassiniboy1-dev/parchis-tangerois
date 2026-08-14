#!/bin/bash
# Déploie mafia/index.html sur Netlify via l'API (méthode digest — PAS le zip).
# Le déploiement zip par l'API sert la page en text/plain (code source affiché) ;
# la méthode digest sert bien text/html. Usage :
#   NETLIFY_AUTH_TOKEN=xxx bash outils/deployer-mafia-api.sh
set -e
cd "$(dirname "$0")/.." || exit 1
: "${NETLIFY_AUTH_TOKEN:?jeton requis : NETLIFY_AUTH_TOKEN=xxx bash outils/deployer-mafia-api.sh}"
SITE_ID="${NETLIFY_SITE_ID:-0a34951c-7618-48a4-8671-74b11e42a50e}"
URL="${NETLIFY_URL:-https://parchis-tangerois.netlify.app}"
FICHIER=mafia/index.html
API="https://api.netlify.com/api/v1"
CURL=(curl -sS -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN")
[ -f /root/.ccr/ca-bundle.crt ] && CURL+=(--cacert /root/.ccr/ca-bundle.crt)

SHA=$(sha1sum "$FICHIER" | cut -d' ' -f1)
DEP=$("${CURL[@]}" -X POST "$API/sites/$SITE_ID/deploys" \
  -H "Content-Type: application/json" \
  -d "{\"files\":{\"/index.html\":\"$SHA\"}}")
ID=$(printf '%s' "$DEP" | sed -n 's/.*"id":"\([a-f0-9]*\)".*/\1/p' | head -1)
[ -n "$ID" ] || { echo "échec création du déploiement : $DEP" >&2; exit 1; }

if printf '%s' "$DEP" | grep -q "\"$SHA\""; then
  "${CURL[@]}" -X PUT "$API/deploys/$ID/files/index.html" \
    -H "Content-Type: application/octet-stream" \
    --data-binary @"$FICHIER" > /dev/null
fi

for i in 1 2 3 4 5 6 7 8; do
  ETAT=$("${CURL[@]}" "$API/deploys/$ID" | sed -n 's/.*"state":"\([a-z]*\)".*/\1/p' | head -1)
  [ "$ETAT" = "ready" ] && break
  sleep 3
done
echo "déploiement $ID : ${ETAT:-inconnu}"
TYPE=$("${CURL[@]}" -I "$URL" | tr -d '\r' | sed -n 's/^content-type: //Ip' | head -1)
echo "content-type servi : $TYPE"
case "$TYPE" in text/html*) echo "OK → $URL";; *) echo "ATTENTION : content-type inattendu" >&2; exit 1;; esac

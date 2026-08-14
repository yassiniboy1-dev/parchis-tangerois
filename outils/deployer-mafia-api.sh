#!/bin/bash
# Déploie le Mafia (index.html + fichiers PWA) sur Netlify via l'API (méthode digest — PAS le zip).
# Le déploiement zip par l'API sert la page en text/plain (code source affiché) ;
# la méthode digest sert bien text/html. Usage :
#   NETLIFY_AUTH_TOKEN=xxx bash outils/deployer-mafia-api.sh
set -e
cd "$(dirname "$0")/.." || exit 1
: "${NETLIFY_AUTH_TOKEN:?jeton requis : NETLIFY_AUTH_TOKEN=xxx bash outils/deployer-mafia-api.sh}"
SITE_ID="${NETLIFY_SITE_ID:-0a34951c-7618-48a4-8671-74b11e42a50e}"
URL="${NETLIFY_URL:-https://parchis-tangerois.netlify.app}"
API="https://api.netlify.com/api/v1"
CURL=(curl -sS -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN")
[ -f /root/.ccr/ca-bundle.crt ] && CURL+=(--cacert /root/.ccr/ca-bundle.crt)

# chemin servi → fichier local
declare -A FICHIERS=(
  ["/index.html"]="mafia/index.html"
  ["/manifest.json"]="mafia/manifest.json"
  ["/sw.js"]="mafia/sw.js"
  ["/icon-192.png"]="mafia/icon-192.png"
  ["/icon-512.png"]="mafia/icon-512.png"
)

JSON='{"files":{'
SEP=''
for chemin in "${!FICHIERS[@]}"; do
  SHA=$(sha1sum "${FICHIERS[$chemin]}" | cut -d' ' -f1)
  JSON+="$SEP\"$chemin\":\"$SHA\""
  SEP=','
done
JSON+='}}'

DEP=$("${CURL[@]}" -X POST "$API/sites/$SITE_ID/deploys" -H "Content-Type: application/json" -d "$JSON")
ID=$(printf '%s' "$DEP" | sed -n 's/.*"id":"\([a-f0-9]*\)".*/\1/p' | head -1)
[ -n "$ID" ] || { echo "échec création du déploiement : $DEP" >&2; exit 1; }

# téléverser chaque fichier dont le sha est demandé (liste "required")
for chemin in "${!FICHIERS[@]}"; do
  SHA=$(sha1sum "${FICHIERS[$chemin]}" | cut -d' ' -f1)
  if printf '%s' "$DEP" | grep -q "\"$SHA\""; then
    "${CURL[@]}" --fail -X PUT "$API/deploys/$ID/files$chemin" \
      -H "Content-Type: application/octet-stream" \
      --data-binary @"${FICHIERS[$chemin]}" > /dev/null \
      || { echo "échec d'envoi : $chemin" >&2; exit 1; }
    echo "envoyé : $chemin"
  fi
done

for i in 1 2 3 4 5 6 7 8; do
  ETAT=$("${CURL[@]}" "$API/deploys/$ID" | sed -n 's/.*"state":"\([a-z]*\)".*/\1/p' | head -1)
  [ "$ETAT" = "ready" ] && break
  sleep 3
done
echo "déploiement $ID : ${ETAT:-inconnu}"
[ "$ETAT" = "ready" ] || { echo "déploiement jamais publié (état : ${ETAT:-inconnu})" >&2; exit 1; }
TYPE=$("${CURL[@]}" -I "$URL" | tr -d '\r' | sed -n 's/^content-type: //Ip' | head -1)
echo "content-type servi : $TYPE"
case "$TYPE" in text/html*) echo "OK → $URL";; *) echo "ATTENTION : content-type inattendu" >&2; exit 1;; esac

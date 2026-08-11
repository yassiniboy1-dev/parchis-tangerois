#!/bin/bash
# Déploie le site sur Netlify via l'API (méthode digest — PAS le zip).
# Le déploiement zip par l'API sert la page en text/plain (code source affiché) ;
# la méthode digest sert bien text/html. Usage :
#   NETLIFY_AUTH_TOKEN=xxx bash outils/deployer-api.sh
set -e
cd "$(dirname "$0")/.." || exit 1
: "${NETLIFY_AUTH_TOKEN:?jeton requis : NETLIFY_AUTH_TOKEN=xxx bash outils/deployer-api.sh}"
SITE_ID="${NETLIFY_SITE_ID:-0a34951c-7618-48a4-8671-74b11e42a50e}"
API="https://api.netlify.com/api/v1"
CURL=(curl -sS -H "Authorization: Bearer $NETLIFY_AUTH_TOKEN")
[ -f /root/.ccr/ca-bundle.crt ] && CURL+=(--cacert /root/.ccr/ca-bundle.crt)

FICHIERS=(index.html manifest.webmanifest icons/icone-192.png icons/icone-512.png)

JSON='{"files":{'
for f in "${FICHIERS[@]}"; do
  [ -f "$f" ] || { echo "fichier manquant : $f" >&2; exit 1; }
  SHA=$(sha1sum "$f" | cut -d' ' -f1)
  JSON="$JSON\"/$f\":\"$SHA\","
done
JSON="${JSON%,}}}"

DEP=$("${CURL[@]}" -X POST "$API/sites/$SITE_ID/deploys" \
  -H "Content-Type: application/json" \
  -d "$JSON")
ID=$(printf '%s' "$DEP" | sed -n 's/.*"id":"\([a-f0-9]*\)".*/\1/p' | head -1)
[ -n "$ID" ] || { echo "échec création du déploiement : $DEP" >&2; exit 1; }

# Netlify liste dans "required" les sha1 qu'il n'a pas encore : on n'envoie que ceux-là
for f in "${FICHIERS[@]}"; do
  SHA=$(sha1sum "$f" | cut -d' ' -f1)
  if printf '%s' "$DEP" | grep -q "\"$SHA\""; then
    "${CURL[@]}" -X PUT "$API/deploys/$ID/files/$f" \
      -H "Content-Type: application/octet-stream" \
      --data-binary "@$f" > /dev/null
    echo "envoyé : $f"
  fi
done

for i in 1 2 3 4 5 6 7 8; do
  ETAT=$("${CURL[@]}" "$API/deploys/$ID" | sed -n 's/.*"state":"\([a-z]*\)".*/\1/p' | head -1)
  [ "$ETAT" = "ready" ] && break
  sleep 3
done
echo "déploiement $ID : ${ETAT:-inconnu}"
TYPE=$("${CURL[@]}" -I "https://parchis-tangerois.netlify.app" | tr -d '\r' | sed -n 's/^content-type: //Ip' | head -1)
echo "content-type servi : $TYPE"
case "$TYPE" in text/html*) : ;; *) echo "ATTENTION : content-type inattendu" >&2; exit 1;; esac
CODEM=$("${CURL[@]}" -o /dev/null -w '%{http_code}' "https://parchis-tangerois.netlify.app/manifest.webmanifest")
echo "manifest.webmanifest : HTTP $CODEM"
case "$CODEM" in 200) echo "OK → https://parchis-tangerois.netlify.app";; *) echo "ATTENTION : manifest non servi" >&2; exit 1;; esac

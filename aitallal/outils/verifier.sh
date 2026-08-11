#!/usr/bin/env bash
# Vérification complète de l'app AIT ALLAL avant livraison.
# Usage : bash outils/verifier.sh   (depuis le dossier aitallal/)
set -u
cd "$(dirname "$0")/.."
ECHECS=0
ko() { echo "❌ $1"; ECHECS=$((ECHECS+1)); }
ok() { echo "✅ $1"; }

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

# ── 1. Syntaxe JS des deux fichiers (blocs <script> réels extraits) ──────────
for F in index.html index-ar.html; do
  mkdir -p "$TMP/js_$F"
  python3 outils/extraire_scripts.py "$F" "$TMP/js_$F" > /dev/null
  ERRS=0
  for B in "$TMP/js_$F"/*.js "$TMP/js_$F"/*.mjs; do
    [ -e "$B" ] || continue
    node --check "$B" > /dev/null 2>&1 || { echo "   erreur de syntaxe : $B"; ERRS=$((ERRS+1)); }
  done
  [ "$ERRS" -eq 0 ] && ok "syntaxe JS de $F (tous les blocs)" || ko "syntaxe JS de $F ($ERRS bloc(s) en erreur)"
done

# ── 2. Cohérence des versions ────────────────────────────────────────────────
V_SW=$(grep -o "aitallal-v53-fix[0-9]*" sw.js | head -1 | sed 's/aitallal-//')
V_BADGE=$(grep -o "VERSION : v53-fix[0-9]*" index.html | head -1 | sed 's/VERSION : //')
V_META=$(grep -o "appVersion: 'v53-fix[0-9]*'" index.html | sort -u | tr -d "'" | sed 's/appVersion: //' | head -1)
N_META=$(grep -o "appVersion: 'v53-fix[0-9]*'" index.html | sort -u | wc -l)
V_BK=$(grep -o "version: 'v53-fix[0-9]*'" index.html | sort -u | tr -d "'" | sed 's/version: //' | head -1)
if [ "$V_SW" = "$V_BADGE" ] && [ "$V_SW" = "$V_META" ] && [ "$V_SW" = "$V_BK" ] && [ "$N_META" -eq 1 ]; then
  ok "versions alignées partout : $V_SW (cache SW, badge Paramètres, _meta, backups)"
else
  ko "versions incohérentes — SW:$V_SW badge:$V_BADGE _meta:$V_META($N_META variante(s)) backups:$V_BK"
fi

# ── 3. Gardes du rôle observateur dans index.html ────────────────────────────
grep -q "role === 'observateur') return false; // v53-fix120" index.html \
  && ok "garde observateur d'uploadToCloud présent" || ko "garde observateur d'uploadToCloud ABSENT"
grep -q "role === 'observateur') return; // v53-fix120" index.html \
  && ok "garde observateur de maybeAutoBackup présent" || ko "garde observateur de maybeAutoBackup ABSENT"

# ── 4. Sécurité de la page arabe générée ─────────────────────────────────────
for MARQUEUR in \
  'return false; /* AR preview: lecture seule, aucune ecriture cloud */' \
  'return true; /* AR preview: lecture seule, aucune ecriture localStorage */' \
  'if (false /* AR preview: service worker desactive */' \
  '<html lang="ar" dir="rtl">' \
  'AR preview: connexion automatique en lecture seule'; do
  grep -qF "$MARQUEUR" index-ar.html && ok "index-ar : $(echo "$MARQUEUR" | cut -c1-52)…" \
    || ko "index-ar : marqueur manquant → $MARQUEUR"
done
N_CTRL=$(grep -c "function renderControleAR() {" index-ar.html)
[ "$N_CTRL" -eq 1 ] && ok "renderControleAR unique dans index-ar" || ko "renderControleAR en $N_CTRL exemplaire(s) dans index-ar"

# ── 5. index-ar.html à jour (régénération identique) ─────────────────────────
python3 make_ar.py index.html "$TMP/index-ar.regen.html" > /dev/null 2>&1
if diff -q "$TMP/index-ar.regen.html" index-ar.html > /dev/null 2>&1; then
  ok "index-ar.html = sortie exacte de make_ar.py (page arabe à jour)"
else
  ko "index-ar.html DIFFÈRE de la régénération — relancer : python3 make_ar.py"
fi

# ── 6. Chiffres de référence EL GHERSA (A_LIRE_reprise.md) ───────────────────
python3 - <<'PYEOF'
import json, io, sys
d = json.load(io.open('elghersa_import.json', encoding='utf-8'))
attendu = {'stock': 286, 'magasins': 78, 'clients': 65, 'ventes': 93, 'paiements': 186}
ecarts = [f"{k}: {len(d[k])} (attendu {v})" for k, v in attendu.items() if len(d.get(k, [])) != v]
vendus = sum(1 for x in d['stock'] if x.get('statut') == 'Vendu') + sum(1 for x in d['magasins'] if x.get('statut') == 'Vendu')
if vendus != 93:
    ecarts.append(f"vendus: {vendus} (attendu 93)")
ca = sum(v.get('montantTotal') or 0 for v in d['ventes'])
if round(ca) != 130008000:
    ecarts.append(f"CA total: {round(ca)} (attendu 130 008 000)")
if ecarts:
    print("❌ chiffres de référence EL GHERSA :", "; ".join(ecarts))
    sys.exit(1)
print("✅ chiffres de référence EL GHERSA (286 apparts, 78 magasins, 93 vendus, CA 130 008 000)")
PYEOF
[ $? -ne 0 ] && ECHECS=$((ECHECS+1))

# ── 7. Interdits historiques ─────────────────────────────────────────────────
N_ALERT=$(grep -cE "window\.alert\(|window\.confirm\(" index.html)
[ "$N_ALERT" -le 1 ] && ok "pas de window.alert/confirm ajoutés (fallback onclick fix69 toléré)" \
  || ko "window.alert/confirm en excès ($N_ALERT occurrences)"

echo
if [ "$ECHECS" -eq 0 ]; then
  echo "════ TOUT EST VERT — prêt à livrer ════"
else
  echo "════ $ECHECS ÉCHEC(S) — ne pas livrer ════"
  exit 1
fi

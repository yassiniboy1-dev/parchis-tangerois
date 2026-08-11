# -*- coding: utf-8 -*-
import io

SRC = "/home/claude/app/index.html"
DST = "/home/claude/app/index-ar.html"

text = io.open(SRC, encoding="utf-8").read()

def repl_once(s, old, new, label):
    c = s.count(old)
    assert c == 1, "[%s] count=%d (attendu 1)" % (label, c)
    return s.replace(old, new, 1)

def repl_first(s, old, new, label):
    # Le vrai tag du document est la 1re occurrence ; les autres sont dans des
    # templates JS qui generent des documents exportes (contrats/recus) -> intacts.
    c = s.count(old)
    assert c >= 1, "[%s] introuvable" % label
    return s.replace(old, new, 1)

def repl_all(s, old, new, label):
    # Chaine identique presente a plusieurs endroits (ex: boite de reservation
    # copiee dans plusieurs cartes) -> meme traduction partout.
    c = s.count(old)
    assert c >= 1, "[%s] introuvable" % label
    return s.replace(old, new)

# ---- 1. <html> RTL + lang (document uniquement, pas les templates d'export) ----
text = repl_first(text, '<html lang="fr">', '<html lang="ar" dir="rtl">', "html-rtl")

# ---- 2. titre + style (ruban + petits ajustements RTL) ----
old_title = "<title>Ait Allal Groupe \u2014 Gestion</title>"
style_block = (
    "\n<style id=\"ar-preview\">\n"
    "  #ar-preview-ribbon{position:fixed;left:8px;bottom:8px;z-index:99999;"
    "background:rgba(15,23,42,.88);color:#fff;font:600 11px/1 system-ui,-apple-system,sans-serif;"
    "padding:7px 11px;border-radius:9px;pointer-events:none;letter-spacing:.3px;direction:rtl;"
    "box-shadow:0 4px 14px rgba(0,0,0,.25);}\n"
    "  /* AR preview: version simplifiee (controle) -> masquer les outils de gestion */\n"
    "  .palace-tool-card{display:none !important;}\n"
    "  .catalogue-search-btn{display:none !important;}\n"
    "  summary{list-style:none;cursor:pointer;}\n"
    "  summary::-webkit-details-marker{display:none;}\n"
    "</style>"
)
new_title = "<title>\u0645\u062c\u0645\u0648\u0639\u0629 \u0622\u064a\u062a \u0639\u0644\u0627\u0644 \u2014 \u0645\u0639\u0627\u064a\u0646\u0629 \u0639\u0631\u0628\u064a\u0629</title>" + style_block
text = repl_once(text, old_title, new_title, "title")

# ---- 3. ruban juste apres <body> (document uniquement) ----
ribbon = '<body>\n<div id="ar-preview-ribbon">\u0645\u0639\u0627\u064a\u0646\u0629 \u0639\u0631\u0628\u064a\u0629 \u2014 \u0644\u0644\u0645\u0634\u0627\u0647\u062f\u0629 \u0641\u0642\u0637</div>'
text = repl_first(text, "<body>", ribbon, "body-ribbon")

# ---- 4. desactiver le service worker (copie autonome, pas de conflit de cache) ----
text = repl_once(text,
    "if ('serviceWorker' in navigator) {",
    "if (false /* AR preview: service worker desactive */ && 'serviceWorker' in navigator) {",
    "sw-off")

# ---- 5. desactiver le cloud (observation: aucune ecriture sur les donnees partagees) ----
text = repl_once(text,
    "function initCloud() {\n  if (!window.FB || !window.FB.ready) {",
    "function initCloud() {\n  return; /* AR preview: cloud desactive \u2014 aucune ecriture sur les donnees partagees */\n  if (!window.FB || !window.FB.ready) {",
    "cloud-off")

# ---- 6. role LECTURE SEULE (observateur) : uniquement les droits "voir" ----
observateur = (
    "      voir_audit: true,\n    }\n  },\n"
    "  observateur: {\n"
    "    label: '\u0645\u064f\u0631\u0627\u0642\u0628 \u2014 \u0642\u0631\u0627\u0621\u0629 \u0641\u0642\u0637', icon: 'shield', color: 'comptable',\n"
    "    perms: {\n"
    "      voir_prix: true, voir_finances: true, voir_clients: true,\n"
    "      modifier_clients: false, voir_ventes: true, creer_vente: false, reserver: false,\n"
    "      voir_paiements: true, creer_paiement: false, generer_contrat: false,\n"
    "      modifier_stock: false, importer_excel: false, gerer_utilisateurs: false,\n"
    "      sauvegarder: false, supprimer: false, supprimer_clients: false, voir_parkings: true, modifier_parkings: false,\n"
    "      voir_visites: false, gerer_visites: false,\n"
    "      voir_depenses: false, gerer_depenses: false, voir_fournisseurs: false, gerer_fournisseurs: false,\n"
    "      voir_agenda: false, gerer_rappels: false,\n"
    "      voir_audit: false,\n"
    "    }\n  }\n};"
)
text = repl_once(text, "      voir_audit: true,\n    }\n  }\n};", observateur, "role-observateur")

# ---- 7. CONNEXION AUTOMATIQUE en lecture seule (aucun ecran de login en francais) ----
autologin = (
    "function render() {\n"
    "  /* AR preview: connexion automatique en lecture seule (associe-proprietaire) */\n"
    "  state.user = { id: 9990, login: 'associe', "
    "nom: '\u0627\u0644\u0634\u0631\u064a\u0643 \u0627\u0644\u0645\u0627\u0644\u0643', role: 'observateur' }; /* AR: toujours observateur, on ignore toute session enregistree */\n"
    "  if (state.cloud) { state.cloud.enabled = false; state.cloud.autoSyncEnabled = false; }\n"
    "  if (state.user && state.user.role === 'observateur') {\n"
    "    const _r = document.getElementById('root');\n"
    "    if (_r) _r.innerHTML = renderControleAR();\n"
    "    try { document.body.classList.remove('sidebar-fixed'); } catch (e) {}\n"
    "    return;\n"
    "  }\n"
    "  // v53-fix50"
)
text = repl_once(text, "function render() {\n  // v53-fix50", autologin, "auto-login")

# ---- 7b. ECRAN UNIQUE DE CONTROLE (arabe, lecture seule) pour l'observateur ----
render_controle = """
function renderControleAR() {
  const num = x => Number(x) || 0;
  const fmt = n => Math.round(num(n)).toLocaleString('fr-FR');
  const stock = state.stock || [], magasins = state.magasins || [], parkings = state.parkings || [];
  const ventes = state.ventes || [], paiements = state.paiements || [];
  const cnt = arr => ({
    t: arr.length,
    v: arr.filter(x => x.statut === 'Vendu').length,
    r: arr.filter(x => x.statut === 'Réservé').length,
    d: arr.filter(x => x.statut === 'Disponible').length
  });
  const A = cnt(stock), M = cnt(magasins), P = cnt(parkings);
  const totV = A.v + M.v + P.v, totR = A.r + M.r + P.r, totD = A.d + M.d + P.d;
  const ca = ventes.reduce((s, v) => s + num(v.montantTotal), 0);
  const enc = paiements.reduce((s, p) => s + num(p.montant), 0);
  const pct = ca > 0 ? Math.round(enc / ca * 100) : 0;
  const caF = ventes.reduce((s, v) => s + num(v.montantFiscal), 0);
  const encF = paiements.reduce((s, p) => s + num(p.montantFiscal), 0);
  const pctF = caF > 0 ? Math.round(encF / caF * 100) : 0;
  const statAr = st => st === 'Vendu' ? 'مباع' : (st === 'Réservé' ? 'محجوز' : 'متوفر');
  const statCol = st => st === 'Vendu' ? '#0a7d4d' : (st === 'Réservé' ? '#64748b' : '#b8860b');
  const itemRow = (titre, it) => `
      <div style="display:flex;align-items:center;gap:8px;padding:9px 14px;border-top:1px solid #f4f1e8;">
        <div style="flex:1;font-size:13px;color:#0a1f3d;">${titre}<span style="color:#9aa3b2;"> · ${it.type || ''} · ${it.surface || '?'} m²</span></div>
        <span style="font-size:11px;font-weight:700;color:${statCol(it.statut)};background:${statCol(it.statut)}1a;padding:3px 9px;border-radius:10px;">${statAr(it.statut)}</span>
      </div>`;
  const parBloc = {};
  stock.forEach(s => { (parBloc[s.bloc || '?'] = parBloc[s.bloc || '?'] || []).push(s); });
  const blocs = Object.keys(parBloc).sort();
  const blocBox = b => {
    const items = parBloc[b].slice().sort((x, y) => (num(x.etage) - num(y.etage)) || String(x.num || '').localeCompare(String(y.num || '')));
    const v = items.filter(x => x.statut === 'Vendu').length;
    const d = items.filter(x => x.statut === 'Disponible').length;
    return `
      <details style="background:#fff;border:1px solid #ece7d8;border-radius:14px;margin-bottom:10px;overflow:hidden;">
        <summary style="display:flex;align-items:center;gap:10px;padding:14px 16px;cursor:pointer;">
          <span style="flex:1;font-weight:800;color:#0a1f3d;font-size:16px;">Bloc ${b}</span>
          <span style="font-size:12px;color:#0a7d4d;font-weight:700;">مباع ${v}</span>
          <span style="font-size:12px;color:#b8860b;font-weight:700;">متوفر ${d}</span>
          <span style="color:#cbd5e1;font-size:13px;">▾</span>
        </summary>
        <div>${items.map(a => itemRow('شقة ' + (a.num || a.ref || ''), a)).join('')}</div>
      </details>`;
  };
  const magItems = magasins.slice().sort((x, y) => String(x.ref || '').localeCompare(String(y.ref || '')));
  const magBox = `
      <details style="background:#fff;border:1px solid #ece7d8;border-radius:14px;margin-bottom:10px;overflow:hidden;">
        <summary style="display:flex;align-items:center;gap:10px;padding:14px 16px;cursor:pointer;">
          <span style="flex:1;font-weight:800;color:#0a1f3d;font-size:16px;">المحلات</span>
          <span style="font-size:12px;color:#0a7d4d;font-weight:700;">مباع ${M.v}</span>
          <span style="font-size:12px;color:#b8860b;font-weight:700;">متوفر ${M.d}</span>
          <span style="color:#cbd5e1;font-size:13px;">▾</span>
        </summary>
        <div>${magItems.map(m => itemRow('محل ' + (m.num || m.ref || ''), m)).join('')}</div>
      </details>`;
  const secTitre = (t, c) => `<div style="display:flex;align-items:center;gap:8px;margin:18px 4px 12px;"><div style="flex:1;font-size:15px;font-weight:800;color:#0a1f3d;">${t}</div><div style="font-size:12px;color:#64748b;">مباع ${c.v} · متوفر ${c.d} · من ${c.t}</div></div>`;
  return `
  <div style="max-width:560px;margin:0 auto;padding:20px 16px 70px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;direction:rtl;">
    <div style="text-align:center;margin-bottom:18px;">
      <div style="font-size:27px;font-weight:900;color:#0a1f3d;letter-spacing:0.5px;">الغرسة</div>
      <div style="font-size:14px;color:#64748b;margin-top:2px;">مجموعة آيت علال \u2014 لوحة المتابعة</div>
      <div style="display:inline-block;margin-top:8px;font-size:11px;font-weight:700;color:#fff;background:#0a1f3d;padding:4px 12px;border-radius:20px;">للمشاهدة فقط</div>
    </div>
    <div style="background:linear-gradient(135deg,#0a1f3d,#16335c);border-radius:18px;padding:22px 20px;color:#fff;margin-bottom:18px;box-shadow:0 10px 30px rgba(10,31,61,0.22);">
      <div style="font-size:14px;opacity:0.85;">نسبة التقدّم في التحصيل</div>
      <div style="font-size:48px;font-weight:900;line-height:1.05;margin:4px 0;">${pct}%</div>
      <div style="height:12px;background:rgba(255,255,255,0.18);border-radius:8px;overflow:hidden;margin:12px 0;"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#d4af37,#f0d472);border-radius:8px;"></div></div>
      <div style="font-size:13px;opacity:0.92;">المُحصّل <strong>${fmt(enc)}</strong> درهم \u2014 من أصل <strong>${fmt(ca)}</strong> درهم</div>
    </div>
    <div style="background:#fff;border:1px solid #e9dcae;border-radius:16px;padding:16px 18px;margin-bottom:18px;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
        <div style="font-size:14px;font-weight:700;color:#0a1f3d;">الجزء المُصرّح به المُحصّل (Fiscal)</div>
        <div style="font-size:30px;font-weight:900;color:#b8860b;">${pctF}%</div>
      </div>
      <div style="height:10px;background:#f1eee3;border-radius:7px;overflow:hidden;margin:10px 0;"><div style="height:100%;width:${pctF}%;background:linear-gradient(90deg,#b8860b,#e3c558);border-radius:7px;"></div></div>
      <div style="font-size:12.5px;color:#64748b;">المُحصّل <strong style="color:#0a1f3d;">${fmt(encF)}</strong> درهم — من أصل <strong style="color:#0a1f3d;">${fmt(caF)}</strong> درهم</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:22px;">
      <div style="background:#fff;border:1px solid #ece7d8;border-radius:14px;padding:18px 8px;text-align:center;"><div style="font-size:32px;font-weight:900;color:#0a7d4d;">${totV}</div><div style="font-size:13px;color:#0a7d4d;font-weight:700;">مباع</div></div>
      <div style="background:#fff;border:1px solid #ece7d8;border-radius:14px;padding:18px 8px;text-align:center;"><div style="font-size:32px;font-weight:900;color:#b8860b;">${totD}</div><div style="font-size:13px;color:#b8860b;font-weight:700;">متوفر</div></div>
      <div style="background:#fff;border:1px solid #ece7d8;border-radius:14px;padding:18px 8px;text-align:center;"><div style="font-size:32px;font-weight:900;color:#64748b;">${totR}</div><div style="font-size:13px;color:#64748b;font-weight:700;">محجوز</div></div>
    </div>
    ${secTitre('الشقق — حسب البلوك', A)}
    <div style="font-size:11px;color:#94a3b8;margin:0 4px 10px;">اضغط على بلوك لعرض شققه</div>
    ${blocs.map(blocBox).join('')}
    ${secTitre('المحلات', M)}
    ${magBox}
    ${P.t > 0 ? secTitre('المواقف', P) : ''}
    <div style="text-align:center;font-size:11px;color:#94a3b8;margin-top:18px;line-height:1.6;">الأرقام مأخوذة من بيانات المشروع \u2014 للاطلاع والمراقبة فقط</div>
  </div>`;
}
"""
text = repl_once(text, "function render() {", render_controle.strip() + "\n\n" + "function render() {", "inject-controle")

# ---- 8. BLOCAGE DUR de toute ecriture cloud (defense en profondeur) ----
text = repl_once(text,
    "async function uploadToCloud(silent = false, forceFullUpload = false) {\n  if (!cloudConnected || !window.FB) {",
    "async function uploadToCloud(silent = false, forceFullUpload = false) {\n  return false; /* AR preview: lecture seule, aucune ecriture cloud */\n  if (!cloudConnected || !window.FB) {",
    "upload-off")

# ---- 9. SILENCE TOTALE du cloud (plus de toast/log/banniere de sync) ----
text = repl_once(text,
    "function scheduleCloudUpload() {\n  if (!state.cloud || !state.cloud.enabled || !state.cloud.autoSyncEnabled) return;",
    "function scheduleCloudUpload() {\n  return; /* AR preview: aucune synchro cloud */\n  if (!state.cloud || !state.cloud.enabled || !state.cloud.autoSyncEnabled) return;",
    "sched-upload-off")
text = repl_once(text,
    "function scheduleRetryUpload() {\n  if (_retryUploadTimer) clearTimeout(_retryUploadTimer);",
    "function scheduleRetryUpload() {\n  return; /* AR preview: pas de retry cloud */\n  if (_retryUploadTimer) clearTimeout(_retryUploadTimer);",
    "sched-retry-off")

# ---- 9b. AUCUNE ECRITURE localStorage (protege la session admin + les donnees partagees) ----
text = repl_once(text,
    "function save(k, v) {\n  // v53-fix108",
    "function save(k, v) {\n  return true; /* AR preview: lecture seule, aucune ecriture localStorage */\n  // v53-fix108",
    "save-off")

# ---- 10. ECRAN BLOC -> ETAGES (renderStockEtages) : traduction directe ----
#         (chiffres et "Bloc X" restent en latin)
text = repl_once(text, '<div class="eyebrow">R\u00e9sidence</div>',
                       '<div class="eyebrow">إقامة</div>', "etages-eyebrow")
text = repl_once(text,
    "<strong>${biens.length}</strong> appartement${biens.length > 1 ? 's' : ''} \u00b7 <strong>${sortedEtages.length}</strong> \u00e9tage${sortedEtages.length > 1 ? 's' : ''}",
    "<strong>${biens.length}</strong> شقة \u00b7 <strong>${sortedEtages.length}</strong> طابق",
    "etages-subtitle")
text = repl_once(text, '<div class="palace-tool-title">Retrait</div>',
                       '<div class="palace-tool-title">ريترا</div>', "card-retrait")
text = repl_once(text, '<div class="palace-tool-title">Plan</div>',
                       '<div class="palace-tool-title">المخطط</div>', "card-plan")
text = repl_once(text,
    "const etageLabel = e === 0 ? 'Rez-de-chauss\u00e9e' : `${e}${e === 1 ? 'er' : 'e'} \u00e9tage`;",
    "const etageLabel = e === 0 ? 'الطابق الأرضي' : `الطابق ${e}`;",
    "etage-label")
text = repl_once(text, "${s.total} appartement${s.total > 1 ? 's' : ''}",
                       "${s.total} شقة", "etage-subtitle")
text = repl_once(text, "rgba(16,185,129,0.08);\">${s.dispo} libre${s.dispo > 1 ? 's' : ''}",
                       "rgba(16,185,129,0.08);\">${s.dispo} متوفرة", "pill-dispo")
text = repl_once(text, "rgba(245,158,11,0.08);\">${s.reserve} r\u00e9serv\u00e9${s.reserve > 1 ? 's' : ''}",
                       "rgba(245,158,11,0.08);\">${s.reserve} محجوزة", "pill-reserve")
text = repl_once(text, "rgba(100,116,139,0.08);\">${s.vendu} vendu${s.vendu > 1 ? 's' : ''}",
                       "rgba(100,116,139,0.08);\">${s.vendu} مباعة", "pill-vendu")

# ---- 11. ECRAN ETAGE -> LISTE DES APPARTEMENTS (renderStockAppartements) ----
text = repl_once(text,
    "const etageLabel = etage == 0 ? 'Rez-de-chauss\u00e9e' : `${etage}${etage == 1 ? 'er' : 'e'} \u00e9tage`;",
    "const etageLabel = etage == 0 ? 'الطابق الأرضي' : `الطابق ${etage}`;",
    "appt-etage-label")
text = repl_all(text,
    "<strong>${biens.length}</strong> / ${allBiens.length} appartement${allBiens.length > 1 ? 's' : ''}",
    "<strong>${biens.length}</strong> / ${allBiens.length} شقة",
    "appt-subtitle")
text = repl_once(text, "Aucun appartement \u00e0 cet \u00e9tage", "لا توجد شقق في هذا الطابق", "appt-empty-h")
text = repl_once(text, "Modifiez les filtres pour \u00e9largir la recherche.", "لا توجد عناصر للعرض.", "appt-empty-s")

# ---- 12. Panneau filtres/tri masque pour l'observateur (version simple) ----
text = repl_once(text,
    "function renderFilterPanel() {\n  const f = state.stockFilters;",
    "function renderFilterPanel() {\n  if (state.user && state.user.role === 'observateur') return ''; /* AR preview: liste simple */\n  const f = state.stockFilters;",
    "filter-panel-off")

# ---- 13. Carte d'un appartement (renderAppartCard) ----
text = repl_once(text, '<div class="appt-title">Appartement ${b.num}</div>',
                       '<div class="appt-title">شقة ${b.num}</div>', "appt-title")
text = repl_all(text, "${b.chambres} ch.", "${b.chambres} غرفة", "appt-ch")
text = repl_once(text, "${b.sdb} sdb", "${b.sdb} حمام", "appt-sdb")
text = repl_once(text, "Terrasse ${b.terrasse} m\u00b2", "سطح ${b.terrasse} m\u00b2", "appt-terrasse")
text = repl_once(text, "Vue ${esc(b.vue)}", "إطلالة ${esc(b.vue)}", "appt-vue")

# ---- 14. Boite de reservation (visible sur un appartement reserve) ----
text = repl_all(text, "'R\u00e9servation expir\u00e9e' : 'R\u00e9serv\u00e9 pour'",
                      "'حجز منتهٍ' : 'محجوز لـ'", "resa-labels")
text = repl_all(text, "Expire aujourd'hui", "ينتهي اليوم", "resa-aujourdhui")
text = repl_all(text, "Expire dans ${jours} jour${jours > 1 ? 's' : ''}",
                      "ينتهي خلال ${jours} يوم", "resa-dans")
text = repl_all(text, "jusqu'au ${new Date(reservation.expireLe).toLocaleDateString('fr-FR')}",
                      "حتى ${new Date(reservation.expireLe).toLocaleDateString('fr-FR')}", "resa-jusqu")

# =======================================================================
# Dictionnaires de traduction (texte d'affichage UNIQUEMENT, delimite par
# du balisage -> jamais a l'interieur d'un nom de fonction camelCase).
# =======================================================================

# Phrases multi-mots ou delimitees par des guillemets : remplacement direct
# (les espaces garantissent qu'on ne touche aucun identifiant JS).
phrases = [
    # --- passe large (toute l'app) : libelles multi-mots (les espaces protegent les identifiants) ---
    ("Adresse compl\u00e8te", "العنوان الكامل"),
    ("Salles de bain", "الحمامات"),
    ("Surface totale", "المساحة الإجمالية"),
    ("Surface vendue", "المساحة المباعة"),
    ("Mode Commercial", "وضع العرض التجاري"),
    ("Acc\u00e8s refus\u00e9", "تم رفض الوصول"),
    ("Vous n'avez pas acc\u00e8s \u00e0 cette page", "ليس لديك حق الوصول إلى هذه الصفحة"),
    ("Contrat sign\u00e9", "العقد موقّع"),
    ("Promotion immobili\u00e8re", "الترويج العقاري"),
    ("Type introuvable", "النوع غير موجود"),
    ("Bien introuvable", "العقار غير موجود"),
    ("\u00c0 d\u00e9finir", "يُحدّد لاحقًا"),
    ("\u00c0 partir de", "ابتداءً من"),
    ("Cr\u00e9er un type", "إنشاء نوع"),
    ("Modifier les appartements", "تعديل الشقق"),
    ("Supprimer le mod\u00e8le", "حذف النموذج"),
    ("Aucun appartement dans ce bloc", "لا توجد شقق في هذا البلوك"),
    ("Pi\u00e8ce d'identit\u00e9", "بطاقة الهوية"),
    ("Mot de passe", "كلمة المرور"),
    ("Votre login", "اسم الدخول"),
    ("Le projet", "المشروع"),
    ("Nos r\u00e9sidences", "إقاماتنا"),
    ("Vente (MAD)", "البيع (MAD)"),
    ("CA Fiscal", "المعاملات الضريبية"),
    ("Chambres min", "الحد الأدنى للغرف"),
    ("Pr\u00e9nom *", "الاسم *"),
    ("Nom *", "اللقب *"),
    ("Date *", "التاريخ *"),
    ("Niveau *", "المستوى *"),
    ("Choisir le client *", "اختر العميل *"),
    ("\ud83d\udda8\ufe0f Imprimer", "\ud83d\udda8\ufe0f طباعة"),
    ("\u2715 Quitter", "\u2715 خروج"),
    # paragraphe d'intro de l'ecran des types
    ("Les appartements de <strong>m\u00eame n\u00b0 dans le m\u00eame bloc</strong> (\u00e9tages 1 \u00e0 7) partagent le m\u00eame type. Renseigne le nombre de chambres, de salles de bain et le libell\u00e9 (F2, F3\u2026) <strong>une seule fois par type</strong> : la valeur sera appliqu\u00e9e \u00e0 tous les appartements de ce type. Les champs laiss\u00e9s vides ne sont pas modifi\u00e9s. Les surfaces restent propres \u00e0 chaque appartement.",
     "\u0627\u0644\u0634\u0642\u0642 \u0627\u0644\u062a\u064a \u062a\u062d\u0645\u0644 <strong>\u0646\u0641\u0633 \u0627\u0644\u0631\u0642\u0645 \u0641\u064a \u0646\u0641\u0633 \u0627\u0644\u0628\u0644\u0648\u0643</strong> (\u0627\u0644\u0637\u0648\u0627\u0628\u0642 1 \u0625\u0644\u0649 7) \u0644\u0647\u0627 \u0646\u0641\u0633 \u0627\u0644\u0646\u0648\u0639. \u0623\u062f\u062e\u0644 \u0639\u062f\u062f \u0627\u0644\u063a\u0631\u0641 \u0648\u0627\u0644\u062d\u0645\u0627\u0645\u0627\u062a \u0648\u0627\u0644\u062a\u0633\u0645\u064a\u0629 (F2\u060c F3\u2026) <strong>\u0645\u0631\u0629 \u0648\u0627\u062d\u062f\u0629 \u0644\u0643\u0644 \u0646\u0648\u0639</strong>: \u0633\u062a\u064f\u0637\u0628\u0651\u0642 \u0627\u0644\u0642\u064a\u0645\u0629 \u0639\u0644\u0649 \u062c\u0645\u064a\u0639 \u0634\u0642\u0642 \u0647\u0630\u0627 \u0627\u0644\u0646\u0648\u0639. \u0627\u0644\u062e\u0627\u0646\u0627\u062a \u0627\u0644\u0641\u0627\u0631\u063a\u0629 \u0644\u0627 \u062a\u062a\u063a\u064a\u0631. \u062a\u0628\u0642\u0649 \u0627\u0644\u0645\u0633\u0627\u062d\u0627\u062a \u062e\u0627\u0635\u0629 \u0628\u0643\u0644 \u0634\u0642\u0629."),
    # note retrait (deux morceaux statiques autour de ${nbRetrait})
    (" appartements du retrait ", " \u0634\u0642\u0642 \u0627\u0644\u0631\u064a\u062a\u0631\u0627 "),
    (" ont des plans uniques : configure leurs chambres et salles de bain individuellement dans la fiche de chaque appartement.",
     " \u0644\u0647\u0627 \u062a\u0635\u0627\u0645\u064a\u0645 \u0641\u0631\u064a\u062f\u0629: \u0639\u062f\u0651\u0644 \u063a\u0631\u0641\u0647\u0627 \u0648\u062d\u0645\u0627\u0645\u0627\u062a\u0647\u0627 \u0628\u0634\u0643\u0644 \u0641\u0631\u062f\u064a \u0641\u064a \u0628\u0637\u0627\u0642\u0629 \u0643\u0644 \u0634\u0642\u0629."),
    ("\u2139\ufe0f Les ", "\u2139\ufe0f "),
    ("Aucun appartement \u00e0 configurer.", "\u0644\u0627 \u062a\u0648\u062c\u062f \u0634\u0642\u0642 \u0644\u0644\u0625\u0639\u062f\u0627\u062f."),
    # ecran des types : boutons / titres / placeholders
    ("Configurer les types (chambres, F2/F3\u2026)", "\u0625\u0639\u062f\u0627\u062f \u0627\u0644\u0623\u0646\u0648\u0627\u0639 (\u063a\u0631\u0641\u060c \u062d\u0645\u0627\u0645\u0627\u062a\u060c F2/F3\u2026)"),
    ("Enregistrer tous les types", "\u062d\u0641\u0638 \u0643\u0644 \u0627\u0644\u0623\u0646\u0648\u0627\u0639"),
    ("Types d'appartements", "\u0623\u0646\u0648\u0627\u0639 \u0627\u0644\u0634\u0642\u0642"),
    ("Retour aux appartements", "\u0627\u0644\u0631\u062c\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u0634\u0642\u0642"),
    ("Retour au Catalogue", "\u0627\u0644\u0631\u062c\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u0643\u062a\u0627\u0644\u0648\u062c"),
    ("Retour au Stock", "\u0627\u0644\u0631\u062c\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u0645\u062e\u0632\u0648\u0646"),
    ("Retour \u00e0 l'accueil", "\u0627\u0644\u0631\u062c\u0648\u0639 \u0625\u0644\u0649 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629"),
    ("'mixte'", "'\u0645\u062e\u062a\u0644\u0641'"),
    ("'ex 2'", "'\u0645\u062b\u0627\u0644 2'"),
    ("'ex 1'", "'\u0645\u062b\u0627\u0644 1'"),
    ("'ex F3'", "'\u0645\u062b\u0627\u0644 F3'"),
    # cartes accueil (dashboard)
    ("Espaces principaux", "\u0627\u0644\u0623\u0642\u0633\u0627\u0645 \u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629"),
    ("Immeubles & biens", "\u0627\u0644\u0639\u0645\u0627\u0631\u0627\u062a \u0648\u0627\u0644\u0645\u0645\u062a\u0644\u0643\u0627\u062a"),
    ("Catalogue immobilier", "\u0627\u0644\u0643\u062a\u0627\u0644\u0648\u062c \u0627\u0644\u0639\u0642\u0627\u0631\u064a"),
    ("Clients & prospects", "\u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u0648\u0627\u0644\u0645\u0647\u062a\u0645\u0648\u0646"),
    ("G\u00e9rez vos relations", "\u0623\u062f\u0650\u0631 \u0639\u0644\u0627\u0642\u0627\u062a\u0643"),
    ("Ventes & r\u00e9servations", "\u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a \u0648\u0627\u0644\u062d\u062c\u0648\u0632\u0627\u062a"),
    ("Suivi des dossiers", "\u0645\u062a\u0627\u0628\u0639\u0629 \u0627\u0644\u0645\u0644\u0641\u0627\u062a"),
    ("Encaissements & re\u00e7us", "\u0627\u0644\u0645\u0642\u0628\u0648\u0636\u0627\u062a \u0648\u0627\u0644\u0625\u064a\u0635\u0627\u0644\u0627\u062a"),
    ("Suivi des paiements clients", "\u0645\u062a\u0627\u0628\u0639\u0629 \u0645\u062f\u0641\u0648\u0639\u0627\u062a \u0627\u0644\u0639\u0645\u0644\u0627\u0621"),
    ("Visites & rendez-vous", "\u0627\u0644\u0632\u064a\u0627\u0631\u0627\u062a \u0648\u0627\u0644\u0645\u0648\u0627\u0639\u064a\u062f"),
    ("Planning commercial", "\u0627\u0644\u062a\u062e\u0637\u064a\u0637 \u0627\u0644\u062a\u062c\u0627\u0631\u064a"),
    ("Agenda centralis\u00e9", "\u0623\u062c\u0646\u062f\u0629 \u0645\u0648\u062d\u062f\u0629"),
    ("Tous vos rendez-vous & \u00e9ch\u00e9ances", "\u0643\u0644 \u0645\u0648\u0627\u0639\u064a\u062f\u0643 \u0648\u0627\u0633\u062a\u062d\u0642\u0627\u0642\u0627\u062a\u0643"),
    ("Centre d'alertes", "\u0645\u0631\u0643\u0632 \u0627\u0644\u062a\u0646\u0628\u064a\u0647\u0627\u062a"),
    ("D\u00e9penses & marge", "\u0627\u0644\u0645\u0635\u0627\u0631\u064a\u0641 \u0648\u0627\u0644\u0647\u0627\u0645\u0634"),
    ("D\u00e9caissements & rentabilit\u00e9", "\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a \u0648\u0627\u0644\u0645\u0631\u062f\u0648\u062f\u064a\u0629"),
    # cartes catalogue
    ("Espaces \u00e0 vivre", "\u0641\u0636\u0627\u0621\u0627\u062a \u0644\u0644\u0639\u064a\u0634"),
    ("Places s\u00e9curis\u00e9es", "\u0623\u0645\u0627\u0643\u0646 \u0622\u0645\u0646\u0629"),
    ("Locaux commerciaux", "\u0645\u062d\u0644\u0627\u062a \u062a\u062c\u0627\u0631\u064a\u0629"),
    ("Statistiques par bloc", "\u0625\u062d\u0635\u0627\u0626\u064a\u0627\u062a \u062d\u0633\u0628 \u0627\u0644\u0628\u0644\u0648\u0643"),
    ("Choisissez un bloc", "\u0627\u062e\u062a\u0631 \u0628\u0644\u0648\u0643"),
    ("Tableau de bord", "\u0644\u0648\u062d\u0629 \u0627\u0644\u0642\u064a\u0627\u062f\u0629"),
    # divers labels frequents (multi-mots)
    ("En attente", "\u0641\u064a \u0627\u0644\u0627\u0646\u062a\u0638\u0627\u0631"),
    ("Recherche avanc\u00e9e \u2014 surface, \u00e9tage, orientation\u2026", "\u0628\u062d\u062b \u0645\u062a\u0642\u062f\u0645 \u2014 \u0627\u0644\u0645\u0633\u0627\u062d\u0629\u060c \u0627\u0644\u0637\u0627\u0628\u0642\u060c \u0627\u0644\u0627\u062a\u062c\u0627\u0647\u2026"),
    ("Total encaiss\u00e9", "\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0642\u0628\u0648\u0636\u0627\u062a"),
    ("Prix total", "\u0627\u0644\u062b\u0645\u0646 \u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a"),
    ("% pay\u00e9", "% \u0627\u0644\u0645\u0624\u062f\u0649"),
]

# Mots simples : uniquement entre balises  >Mot<  (le '<' final empeche tout
# faux positif sur un prefixe + protege les identifiants).
words = [
    # --- passe large : mots simples entre balises >Mot< ---
    ("Facultatif", "اختياري"),
    ("facultatif", "اختياري"),
    ("Client", "العميل"),
    ("Adresse", "العنوان"),
    ("Caract\u00e9ristiques", "الخصائص"),
    ("Terrasses", "الأسطح"),
    ("Encaiss\u00e9", "المحصّل"),
    ("Cat\u00e9gorie", "الفئة"),
    ("Email", "البريد الإلكتروني"),
    ("R\u00e9f", "مرجع"),
    ("Exposition", "التعرّض"),
    ("Vue", "الإطلالة"),
    ("Tous", "الكل"),
    ("Types", "الأنواع"),
    ("Trier", "ترتيب"),
    ("Notifications", "الإشعارات"),
    ("Aper\u00e7u", "نظرة عامة"),
    ("Niveau", "المستوى"),
    ("Appartements", "\u0627\u0644\u0634\u0642\u0642"),
    ("Parkings", "\u0627\u0644\u0645\u0648\u0627\u0642\u0641"),
    ("Magasins", "\u0627\u0644\u0645\u062d\u0644\u0627\u062a"),
    ("Clients", "\u0627\u0644\u0639\u0645\u0644\u0627\u0621"),
    ("Ventes", "\u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a"),
    ("Paiements", "\u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0627\u062a"),
    ("Visites", "\u0627\u0644\u0632\u064a\u0627\u0631\u0627\u062a"),
    ("Agenda", "\u0627\u0644\u0623\u062c\u0646\u062f\u0629"),
    ("D\u00e9penses", "\u0627\u0644\u0645\u0635\u0627\u0631\u064a\u0641"),
    ("Catalogue", "\u0627\u0644\u0643\u062a\u0627\u0644\u0648\u062c"),
    ("Accueil", "\u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629"),
    ("Utilisateurs", "\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u0648\u0646"),
    ("Param\u00e8tres", "\u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a"),
    ("Type", "\u0627\u0644\u0646\u0648\u0639"),
    ("Chambres", "\u063a\u0631\u0641"),
    ("SdB", "\u062d\u0645\u0627\u0645\u0627\u062a"),
    ("Surface", "\u0627\u0644\u0645\u0633\u0627\u062d\u0629"),
    ("Prix", "\u0627\u0644\u062b\u0645\u0646"),
    ("\u00c9tage", "\u0627\u0644\u0637\u0627\u0628\u0642"),
    ("Orientation", "\u0627\u0644\u0627\u062a\u062c\u0627\u0647"),
    ("Statut", "\u0627\u0644\u062d\u0627\u0644\u0629"),
    ("Date", "\u0627\u0644\u062a\u0627\u0631\u064a\u062e"),
    ("Montant", "\u0627\u0644\u0645\u0628\u0644\u063a"),
    ("Total", "\u0627\u0644\u0645\u062c\u0645\u0648\u0639"),
    ("R\u00e9f\u00e9rence", "\u0627\u0644\u0645\u0631\u062c\u0639"),
    ("T\u00e9l\u00e9phone", "\u0627\u0644\u0647\u0627\u062a\u0641"),
    ("Notes", "\u0645\u0644\u0627\u062d\u0638\u0627\u062a"),
    ("Description", "\u0627\u0644\u0648\u0635\u0641"),
    ("Nom", "\u0627\u0644\u0627\u0633\u0645"),
    ("Tranche", "\u0627\u0644\u0642\u0633\u0637"),
    ("Balcon", "\u0627\u0644\u0634\u0631\u0641\u0629"),
    ("Terrasse", "\u0627\u0644\u0633\u0637\u062d"),
    ("Disponible", "\u0645\u062a\u0648\u0641\u0631"),
    ("Disponibles", "\u0645\u062a\u0648\u0641\u0631\u0629"),
    ("R\u00e9serv\u00e9", "\u0645\u062d\u062c\u0648\u0632"),
    ("R\u00e9serv\u00e9s", "\u0645\u062d\u062c\u0648\u0632\u0629"),
    ("Vendu", "\u0645\u064f\u0628\u0627\u0639"),
    ("Vendus", "\u0645\u064f\u0628\u0627\u0639\u0629"),
]

# 'Bloc ' juste apres une balise -> 'بلوك ' (garde la lettre du bloc : Bloc A)
# Attributs visibles : placeholder / title / aria-label="texte"
# (NB : on garde "Bloc A" en latin -> aucune translitteration de "Bloc")
attrs = [
    ("Rechercher par nom, pr\u00e9nom, CIN ou t\u00e9l\u00e9phone...", "ابحث بالاسم أو اللقب أو رقم الهوية أو الهاتف..."),
    ("Rechercher (r\u00e9f, type)...", "بحث (مرجع، نوع)..."),
    ("Rechercher...", "بحث..."),
    ("Rechercher", "بحث"),
]

# Boutons : Mot</button>
buttons = [
    ("Enregistrer", "\u062d\u0641\u0638"),
    ("Annuler", "\u0625\u0644\u063a\u0627\u0621"),
    ("Ajouter", "\u0625\u0636\u0627\u0641\u0629"),
    ("Modifier", "\u062a\u0639\u062f\u064a\u0644"),
    ("Supprimer", "\u062d\u0630\u0641"),
    ("Fermer", "\u0625\u063a\u0644\u0627\u0642"),
    ("Confirmer", "\u062a\u0623\u0643\u064a\u062f"),
    ("Imprimer", "طباعة"),
    ("Retirer", "إزالة"),
    ("R\u00e9initialiser les filtres", "إعادة ضبط عوامل التصفية"),
]

# Navigation (tableau des pages) : label: 'Mot'
nav = [
    ("Accueil", "\u0627\u0644\u0631\u0626\u064a\u0633\u064a\u0629"),
    ("Catalogue", "\u0627\u0644\u0643\u062a\u0627\u0644\u0648\u062c"),
    ("Clients", "\u0627\u0644\u0639\u0645\u0644\u0627\u0621"),
    ("Visites", "\u0627\u0644\u0632\u064a\u0627\u0631\u0627\u062a"),
    ("Agenda", "\u0627\u0644\u0623\u062c\u0646\u062f\u0629"),
    ("Ventes", "\u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a"),
    ("Paiements", "\u0627\u0644\u0645\u062f\u0641\u0648\u0639\u0627\u062a"),
    ("D\u00e9penses", "\u0627\u0644\u0645\u0635\u0627\u0631\u064a\u0641"),
    ("Utilisateurs", "\u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u0648\u0646"),
    ("Param\u00e8tres", "\u0627\u0644\u0625\u0639\u062f\u0627\u062f\u0627\u062a"),
]

phrases.sort(key=lambda kv: -len(kv[0]))

lines = text.split("\n")
hits = {"phrases": 0, "words": 0, "buttons": 0, "nav": 0, "attrs": 0}
for i, line in enumerate(lines):
    if len(line) > 1500:   # protege les longues lignes base64 (images)
        continue
    for fr, ar in phrases:
        if fr in line:
            line = line.replace(fr, ar); hits["phrases"] += 1
    for w, ar in words:
        k = ">" + w + "<"
        if k in line:
            line = line.replace(k, ">" + ar + "<"); hits["words"] += 1
    for fr, ar in attrs:
        for at in ("placeholder", "title", "aria-label"):
            k = at + '="' + fr + '"'
            if k in line:
                line = line.replace(k, at + '="' + ar + '"'); hits["attrs"] += 1
    for w, ar in buttons:
        k = w + "</button>"
        if k in line:
            line = line.replace(k, ar + "</button>"); hits["buttons"] += 1
    for w, ar in nav:
        k = "label: '" + w + "'"
        if k in line:
            line = line.replace(k, "label: '" + ar + "'"); hits["nav"] += 1
    lines[i] = line

text = "\n".join(lines)
io.open(DST, "w", encoding="utf-8").write(text)

print("Ecrit:", DST)
print("Remplacements:", hits)
# garde-fous : aucun identifiant casse
import re
for ident in ["renderClients", "renderVentes", "renderStockBlocs",
              "renderTypesAppartements", "getBlocsCategorie", "calculerStatsCategorie",
              "uploadToCloud", "initCloud"]:
    print("  %s present: %d" % (ident, text.count(ident)))
print("  initCloud early-return:", "return; /* AR preview" in text)
print("  SW off:", "if (false /* AR preview" in text)
print("  RTL html:", '<html lang="ar" dir="rtl">' in text)
print("  role observateur:", "observateur: {" in text)
print("  auto-login:", "connexion automatique en lecture seule" in text)
print("  upload bloque:", "lecture seule, aucune ecriture cloud" in text)

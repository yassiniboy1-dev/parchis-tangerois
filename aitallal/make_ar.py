# -*- coding: utf-8 -*-
"""
make_ar.py — génère index-ar.html (page de contrôle arabe autonome de l'associé)
à partir d'index.html. RÉPARÉ en v53-fix122 :
  - ancres réalignées sur fix121+ (le rôle observateur, renderControleAR et le
    garde d'uploadToCloud sont DANS index.html depuis fix120 → plus d'injection,
    on adapte l'existant ; un doublon de renderControleAR est impossible) ;
  - étapes de neutralisation tolérantes (si déjà fait → skip au lieu de crash) ;
  - SRC/DST relatifs au script (surchargeable : make_ar.py [src] [dst]).
Usage : python3 make_ar.py          (depuis le dossier aitallal/)
La page générée : connexion auto en observateur arabe, AUCUNE écriture
(localStorage, cloud, backups), service worker désactivé.
"""
import io, os, sys

BASE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(BASE, "index.html")
DST = sys.argv[2] if len(sys.argv) > 2 else os.path.join(BASE, "index-ar.html")

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


def repl_or_skip(s, old, new, label, deja=None):
    # Etape de NEUTRALISATION : si la transformation (ou son marqueur) est deja
    # presente, on skippe au lieu de crasher — survit aux futures absorptions
    # dans index.html et aux doubles executions.
    marker = deja if deja else new
    if marker in s:
        print("[%s] deja present -> skip" % label)
        return s
    return repl_once(s, old, new, label)

def supprimer_bloc(s, debut, fin, label, fin_inclus=False):
    # Suppression tolerante d'un bloc [debut, fin) ; absent -> skip avec trace.
    if debut not in s:
        print("[%s] bloc absent -> skip" % label)
        return s
    i = s.index(debut)
    j = s.index(fin, i)
    if fin_inclus:
        j += len(fin)
    return s[:i] + s[j:]

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
text = repl_or_skip(text,
    "if ('serviceWorker' in navigator) {",
    "if (false /* AR preview: service worker desactive */ && 'serviceWorker' in navigator) {",
    "sw-off", deja="if (false /* AR preview")

# ---- 5. desactiver le cloud (observation: aucune ecriture sur les donnees partagees) ----
text = repl_or_skip(text,
    "function initCloud() {\n  if (!window.FB || !window.FB.ready) {",
    "function initCloud() {\n  return; /* AR preview: cloud desactive \u2014 aucune ecriture sur les donnees partagees */\n  if (!window.FB || !window.FB.ready) {",
    "cloud-off")

# ---- 6. role LECTURE SEULE (observateur) : uniquement les droits "voir" ----
text = repl_or_skip(text,
    "label: 'Observateur (lecture seule)', icon: 'shield', color: 'comptable',",
    "label: '\u0645\u064f\u0631\u0627\u0642\u0628 \u2014 \u0642\u0631\u0627\u0621\u0629 \u0641\u0642\u0637', icon: 'shield', color: 'comptable',",
    "role-label")
text = repl_or_skip(text,
    "      voir_visites: true, gerer_visites: false,\n      voir_depenses: true, gerer_depenses: false, voir_fournisseurs: true, gerer_fournisseurs: false,\n      voir_agenda: true, gerer_rappels: false,",
    "      voir_visites: false, gerer_visites: false,\n      voir_depenses: false, gerer_depenses: false, voir_fournisseurs: false, gerer_fournisseurs: false,\n      voir_agenda: false, gerer_rappels: false,",
    "role-perms")

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
text = repl_or_skip(text, "function render() {\n  // v53-fix50", autologin, "auto-login", deja="/* AR preview: connexion automatique en lecture seule")

# ---- 7b. renderControleAR est DEJA dans index.html (fix120+) : on ADAPTE l'existant,
#          aucune injection (un doublon ecraserait la version a jour — regression vecue).
# 7b-1 : le <style> inline du return part dans le <style id="ar-preview"> du head
text = repl_once(text,
    "return `<style>summary{list-style:none;cursor:pointer;}summary::-webkit-details-marker{display:none;}</style>",
    "return `",
    "controle-style-prefix")
# 7b-2 : supprimer le bouton "Se deconnecter" (la page AR est en connexion auto, sans logout)
text = supprimer_bloc(text, '      <div style="margin-top:12px;">\n        <button data-action="logout"', '      </div>\n', "logout-btn-off", fin_inclus=True)
# 7b-3 : supprimer attachObservateurEvents() + son commentaire (plus de logout a cabler)
text = supprimer_bloc(text, "// v53-fix121 : l'observateur ne passe pas par attachEvents()", "function render() {", "attach-observateur-off")
# 7b-4 : supprimer la branche observateur de render() (l'auto-login court-circuite avant)
text = supprimer_bloc(text, "  } else if (state.user.role === 'observateur') {", "  } else {", "render-branche-observateur-off")

# ---- 8. BLOCAGE DUR de toute ecriture cloud (defense en profondeur) ----
text = repl_or_skip(text,
    "  if (state.user && state.user.role === 'observateur') return false; // v53-fix120 : lecture seule, aucune ecriture cloud\n",
    "  return false; /* AR preview: lecture seule, aucune ecriture cloud */\n",
    "upload-off")
if "  if (state.user && state.user.role === 'observateur') return; // v53-fix120 : lecture seule\n" in text:
    text = text.replace("  if (state.user && state.user.role === 'observateur') return; // v53-fix120 : lecture seule\n", "", 1)
else:
    print("[backup-guard-off] garde absente -> skip")

# ---- 9. SILENCE TOTALE du cloud (plus de toast/log/banniere de sync) ----
text = repl_or_skip(text,
    "function scheduleCloudUpload() {\n  if (!state.cloud || !state.cloud.enabled || !state.cloud.autoSyncEnabled) return;",
    "function scheduleCloudUpload() {\n  return; /* AR preview: aucune synchro cloud */\n  if (!state.cloud || !state.cloud.enabled || !state.cloud.autoSyncEnabled) return;",
    "sched-upload-off", deja="/* AR preview: aucune synchro cloud */")
text = repl_or_skip(text,
    "function scheduleRetryUpload() {\n  if (_retryUploadTimer) clearTimeout(_retryUploadTimer);",
    "function scheduleRetryUpload() {\n  return; /* AR preview: pas de retry cloud */\n  if (_retryUploadTimer) clearTimeout(_retryUploadTimer);",
    "sched-retry-off", deja="/* AR preview: pas de retry cloud */")

# ---- 9b. AUCUNE ECRITURE localStorage (protege la session admin + les donnees partagees) ----
text = repl_or_skip(text,
    "function save(k, v) {\n  // v53-fix108",
    "function save(k, v) {\n  return true; /* AR preview: lecture seule, aucune ecriture localStorage */\n  // v53-fix108",
    "save-off", deja="/* AR preview: lecture seule, aucune ecriture localStorage */")

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
text = repl_or_skip(text,
    "function renderFilterPanel() {\n  const f = state.stockFilters;",
    "function renderFilterPanel() {\n  if (state.user && state.user.role === 'observateur') return ''; /* AR preview: liste simple */\n  const f = state.stockFilters;",
    "filter-panel-off", deja="/* AR preview: liste simple */")

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

# GARDES DURES : le script s'arrete si la page generee n'est pas sure
assert text.count("function renderControleAR() {") == 1, "renderControleAR doit rester UNIQUE (doublon = regression fix120)"
assert "return false; /* AR preview: lecture seule, aucune ecriture cloud */" in text, "uploadToCloud doit etre bloque en dur"
assert "return true; /* AR preview: lecture seule, aucune ecriture localStorage */" in text, "save() doit etre bloque"
assert '<html lang="ar" dir="rtl">' in text, "document RTL manquant"
assert "connexion automatique en lecture seule" in text, "auto-login observateur manquant"
print("Toutes les gardes finales passent.")

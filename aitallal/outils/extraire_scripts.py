# -*- coding: utf-8 -*-
"""
Extrait les blocs <script> inline top-level d'un fichier HTML monofichier.
Les </script> à l'intérieur des templates JS sont échappés <\/script>, donc un
scan littéral est fiable — mais des balises <script> OUVRANTES apparaissent
aussi DANS ces templates : on ignore tout match qui commence avant la fin du
bloc précédent (elles appartiennent à son contenu).
Usage : python3 extraire_scripts.py <fichier.html> <dossier_sortie>
"""
import io
import re
import sys

src = sys.argv[1]
out = sys.argv[2]
text = io.open(src, encoding="utf-8").read()

blocks = []
fin_precedente = 0
for m in re.finditer(r'<script([^>]*)>', text):
    if m.start() < fin_precedente:
        continue  # balise ouvrante à l'intérieur d'un template du bloc précédent
    attrs = m.group(1)
    if 'src=' in attrs:
        fin_precedente = m.end()
        continue  # script externe, rien à extraire
    end = text.find('</script>', m.end())
    if end == -1:
        break
    fin_precedente = end + len('</script>')
    body = text[m.end():end]
    line = text.count('\n', 0, m.end()) + 1
    kind = 'module' if 'module' in attrs else 'classic'
    blocks.append((line, kind, body))

for i, (line, kind, body) in enumerate(blocks):
    ext = 'mjs' if kind == 'module' else 'js'
    fn = "%s/bloc%02d_l%d.%s" % (out, i, line, ext)
    io.open(fn, 'w', encoding='utf-8').write(body)
    print(fn, len(body.splitlines()), "lignes")

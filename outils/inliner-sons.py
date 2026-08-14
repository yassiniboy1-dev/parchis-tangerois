#!/usr/bin/env python3
# Inline les sons de sons/*.mp3 dans mafia/index.html (bloc SFX).
# Noms de fichiers attendus = noms de sons du jeu :
#   nuit, aube, mort, sauve, vote, egalite, roles, vjoie, vsombre
# Relancer après chaque ajout/remplacement dans sons/.
import base64, glob, os, re

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(REPO, 'mafia', 'index.html')
VALIDES = {'nuit','aube','mort','sauve','vote','egalite','roles','vjoie','vsombre'}

entrees = []
total = 0
for chemin in sorted(glob.glob(os.path.join(REPO, 'sons', '*.mp3'))):
    nom = os.path.splitext(os.path.basename(chemin))[0]
    if nom not in VALIDES:
        print('ignoré (nom inconnu) :', nom)
        continue
    donnees = open(chemin, 'rb').read()
    total += len(donnees)
    entrees.append('%s:"data:audio/mpeg;base64,%s"' % (nom, base64.b64encode(donnees).decode()))
    print('inline :', nom, len(donnees)//1024, 'Ko')

bloc = 'const SFX={' + ','.join(entrees) + '};/*__SFX__*/'
h = open(HTML, encoding='utf-8').read()
h2, n = re.subn(r'const SFX=\{.*?\};/\*__SFX__\*/', lambda _m: bloc, h, count=1, flags=re.S)
assert n == 1, 'marqueur SFX introuvable'
open(HTML, 'w', encoding='utf-8').write(h2)
print('total sons :', total//1024, 'Ko — index.html :', len(h2)//1024, 'Ko')

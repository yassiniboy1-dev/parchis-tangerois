# Sons du Mafia

Un fichier absent d'ici garde son repli synthétisé (Web Audio) dans le jeu.
Réintégration après tout changement : `python3 outils/inliner-sons.py`
(traitement : ffmpeg, mono 44,1 kHz, 48 kb/s, crête normalisée à −3 dB).
Noms valides : `nuit, aube, mort, sauve, vote, egalite, roles, vjoie, vsombre`.

## Sources (toutes gratuites)

- `nuit.mp3` — **Suno** (abonnement de Yassine, outil Sounds) : « Soft night wind
  in a narrow medina alley, distant owl » — 10,5 s → 4,5 s, fondu 1,5 s.
  Lien de partage d'origine : https://suno.com/s/0iAy3EMppgAlywsM
- `mort, aube, sauve, vote, vjoie, vsombre, egalite, roles` — **ElevenLabs
  Sound Effects** (v2.2, compte de Yassine, endpoint `/v1/sound-generation`,
  prompts cinématiques « cloche funèbre / carillon de médina / glissando de
  harpe / bulletin dans l'urne / oud triomphal / violoncelle sinistre /
  deux coups hésitants / carte retournée sur feutre »), normalisés à −3 dB.
  Les sons Kenney CC0 de la v1.x (jugés médiocres à l'écoute) sont remplacés.

/* ===== TESTS MOTEUR ===== */
function reset(){ G.pawns=PLAYERS.map(()=>[{z:'h'},{z:'h'},{z:'h'},{z:'h'}]); }
let ok=0,ko=0;
function TT(nom,cond){ if(cond){ok++;} else {ko++; console.log('ÉCHEC:',nom);} }

// 1. Topologie : 71 pas exacts de la salida à la boire, pour chaque couleur
for(let pi=0;pi<4;pi++){
  let pos={z:'t',sq:PLAYERS[pi].salida}, n=0;
  while(pos && pos.z!=='g'){ pos=stepOnce(pos,pi); n++; if(n>200)break; }
  TT('parcours complet '+PLAYERS[pi].key+' = 71 pas', n===71 && pos && pos.z==='g');
}
// 2. Les autres couleurs traversent l'entrée d'autrui sans bifurquer
reset();
G.pawns[0][0]={z:'t',sq:16}; // bleu juste avant l'entrée jaune (17)
let r=simMove(0,0,3);
TT('bleu traverse la case 17 (entrée jaune)', r && r.dest.z==='t' && r.dest.sq===19);
// 3. Entrée corridor propre : bleu sur 66, +4 => corridor s2
reset(); G.pawns[0][0]={z:'t',sq:66};
r=simMove(0,0,4);
TT('bleu 66 +4 => corridor s2', r && r.dest.z==='c' && r.dest.s===2);
// 4. Compte exact pour la boire : c5 +3 => boire ; c5 +4 => impossible
reset(); G.pawns[0][0]={z:'c',s:5};
TT('c5 +3 => boire', (r=simMove(0,0,3)) && r.dest.z==='g');
TT('c5 +4 => refusé (dépassement)', simMove(0,0,4)===null);
// 5. Barrage bloque le passage ET l'arrêt
reset(); G.pawns[0][0]={z:'t',sq:1};
G.pawns[1][0]={z:'t',sq:3}; G.pawns[1][1]={z:'t',sq:3};
TT('barrage: passage bloqué', simMove(0,0,4)===null);
TT('barrage: arrêt bloqué', simMove(0,0,2)===null);
TT('barrage: coup court autorisé', (r=simMove(0,0,1)) && r.dest.sq===2);
// 6. Capture hors refuge, pas sur refuge
reset(); G.pawns[0][0]={z:'t',sq:8}; G.pawns[1][0]={z:'t',sq:11};
TT('capture case 11 (non refuge)', (r=simMove(0,0,3)) && r.cap && r.cap.pi===1);
reset(); G.pawns[0][0]={z:'t',sq:8}; G.pawns[1][0]={z:'t',sq:12};
TT('refuge 12: barrage mixte, pas de capture', (r=simMove(0,0,4)) && !r.cap && r.barr);
// 7. Sortie double : 2 pions => salida + salida+5
reset();
let ex=exitMove(0);
TT('sortie double bleu: 2 placements (5 et 10)', ex && ex.pl.length===2 && ex.pl[0].sq===5 && ex.pl[1].sq===10);
// 8. Sortie : la sortie mange sur T2 ET sur la salida (le refuge ne protège pas contre une sortie)
reset(); G.pawns[1][0]={z:'t',sq:10}; G.pawns[2][0]={z:'t',sq:5};
ex=exitMove(0);
TT('sortie: mange sur T2 et sur la salida', ex && ex.pl.length===2 && ex.pl[0].caps.length===1 && ex.pl[0].caps[0].pi===2 && ex.pl[1].cap && ex.pl[1].cap.pi===1);
// 9. Barrage ADVERSE sur la salida => nettoyé : les 2 mangés, 2 pions sortent
reset(); G.pawns[1][0]={z:'t',sq:5}; G.pawns[1][1]={z:'t',sq:5};
ex=exitMove(0);
TT('barrage adverse sur salida => 2 mangés, 2 sorties', ex && ex.pl.length===2 && ex.pl[0].sq===5 && ex.pl[0].caps.length===2 && ex.pl[1].sq===10);
// 9b. Barrage À SOI sur la salida => seule la 2e bille sort (T2)
reset(); G.pawns[0][0]={z:'t',sq:5}; G.pawns[0][1]={z:'t',sq:5};
ex=exitMove(0);
TT('mon barrage sur salida => un seul sort (T2)', ex && ex.pl.length===1 && ex.pl[0].sq===10);
// 9c. Barrage adverse sur T2 => la 2e bille reste à la maison (règles normales sur salida+5)
reset(); G.pawns[1][0]={z:'t',sq:10}; G.pawns[1][1]={z:'t',sq:10};
ex=exitMove(0);
TT('barrage adverse sur T2 => un seul sort (salida)', ex && ex.pl.length===1 && ex.pl[0].sq===5);
// 10. Un seul pion en maison => sortie sur salida uniquement
reset(); G.pawns[0][0]={z:'t',sq:30}; G.pawns[0][1]={z:'t',sq:31}; G.pawns[0][2]={z:'t',sq:32};
ex=exitMove(0);
TT('1 pion en maison => 1 placement sur salida', ex && ex.pl.length===1 && ex.pl[0].sq===5);
// 11. 6 => 12 si tout dehors + obligation d'ouverture
reset();
G.cur=0; G.face=6;
G.pawns[0]=[{z:'t',sq:1},{z:'t',sq:1},{z:'t',sq:30},{z:'g'}];
computeTurnMoves();
TT('6 vaut 12 quand tout est dehors', G.val===12);
TT('ouverture obligatoire détectée', G.obligOuv.size>=1);
let mOuv=G.moves.find(m=>G.obligOuv.has(m.id));
TT('coup d\u2019ouverture = pion du barrage', mOuv && (mOuv.pj===0||mOuv.pj===1));
// 12. Repli 12 => 6 quand le 12 est bloqué pour le barrage
reset(); G.cur=0; G.face=6;
G.pawns[0]=[{z:'t',sq:1},{z:'t',sq:1},{z:'t',sq:30},{z:'g'}];
G.pawns[1][0]={z:'t',sq:13}; G.pawns[1][1]={z:'t',sq:13}; // barrage jaune en 13 bloque le 12 (1->13)
computeTurnMoves();
let ouv6=G.moves.filter(m=>G.obligOuv.has(m.id));
TT('repli ouverture à 6', ouv6.length>=1 && ouv6.every(m=>m.v===6));
// 12b. Barrage mixte sur refuge : ouverture aussi obligatoire sur un 6
reset(); G.cur=0; G.face=6;
G.pawns[0]=[{z:'t',sq:12},{z:'t',sq:30},{z:'h'},{z:'h'}];
G.pawns[1][0]={z:'t',sq:12};
computeTurnMoves();
let mMix=G.moves.find(m=>G.obligOuv.has(m.id));
TT('barrage mixte => ouverture obligatoire', G.obligOuv.size>=1 && mMix && mMix.pj===0);
// 13. Corridor : barrage propre bloque ses propres pions
reset(); G.pawns[0][0]={z:'c',s:2}; G.pawns[0][1]={z:'c',s:4}; G.pawns[0][2]={z:'c',s:4};
TT('barrage en corridor bloque', simMove(0,0,3)===null);
// 14. Priorité capture détectée dans les obligations
reset(); G.cur=0; G.face=3;
G.pawns[0][0]={z:'t',sq:8}; G.pawns[1][0]={z:'t',sq:11}; G.pawns[0][1]={z:'t',sq:20};
computeTurnMoves();
TT('obligation de capture détectée', G.obligCap.size===1);
console.log('\nRésultat tests moteur:', ok+' OK, '+ko+' KO');
/* ===== TESTS RÈGLES PERSONNALISÉES ===== */
// R.sortieDouble OFF => un 5 sort un seul pion
reset(); R.sortieDouble=false;
let ex2=exitMove(0);
TT('sortieDouble OFF => 1 seul placement', ex2 && ex2.pl.length===1 && ex2.pl[0].sq===5);
R.sortieDouble=true;
// R.sortieObligatoire ON => obligation détectée sur un 5
reset(); R.sortieObligatoire=true;
G.cur=0; G.face=5; G.pawns[0][0]={z:'t',sq:30};
computeTurnMoves();
TT('sortieObligatoire ON => oblig détectée', G.obligSortie.size===1);
R.sortieObligatoire=false;
reset(); G.cur=0; G.face=5; G.pawns[0][0]={z:'t',sq:30};
computeTurnMoves();
TT('sortieObligatoire OFF => pas d oblig', G.obligSortie.size===0);
// R.sixVaut12 OFF => 6 reste 6 même tout dehors
reset(); R.sixVaut12=false;
G.cur=0; G.face=6;
G.pawns[0]=[{z:'t',sq:1},{z:'t',sq:20},{z:'t',sq:30},{z:'g'}];
computeTurnMoves();
TT('sixVaut12 OFF => val=6', G.val===6);
R.sixVaut12=true;
// R.fauteCapture OFF => pas d obligation de capture
reset(); R.fauteCapture=false;
G.cur=0; G.face=3;
G.pawns[0][0]={z:'t',sq:8}; G.pawns[1][0]={z:'t',sq:11};
computeTurnMoves();
TT('fauteCapture OFF => obligCap vide', G.obligCap.size===0);
R.fauteCapture=true;
// R.ouvertureObligatoire OFF => pas d obligation ni de repli
reset(); R.ouvertureObligatoire=false;
G.cur=0; G.face=6;
G.pawns[0]=[{z:'t',sq:1},{z:'t',sq:1},{z:'t',sq:30},{z:'g'}];
G.pawns[1][0]={z:'t',sq:13}; G.pawns[1][1]={z:'t',sq:13};
computeTurnMoves();
TT('ouverture OFF => obligOuv vide, pas de coups à 6', G.obligOuv.size===0 && !G.moves.some(m=>m.v===6));
R.ouvertureObligatoire=true;
console.log('Résultat total (moteur + règles perso):', ok+' OK, '+ko+' KO'); process.exit(ko?1:0);

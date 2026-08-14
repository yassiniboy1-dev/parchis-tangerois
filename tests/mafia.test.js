'use strict';
/* Tests des règles du jeu Mafia — exécutés contre mafia/index.html */
const {chargerContexte,EXPOSER}=require('./charge-mafia.js');

let n=0,ok=0;
function T(nom,cond){
  n++;
  if(cond){ ok++; console.log('  ✔',nom); }
  else console.log('  ✘ ÉCHEC:',nom);
}
const ctx=chargerContexte({exposer:EXPOSER});
const X=ctx.__X;

/* joueurs factices : rôles + vif */
function js(roles,morts){
  morts=morts||[];
  return roles.map((r,i)=>({uid:'u'+i,nom:'J'+i,role:r,vif:morts.includes(i)?0:1,mort:''}));
}

console.log('— composition des rôles —');
{
  const r=X.composerRoles(7,{tueurs:2,medecin:true,detective:true});
  T('7 joueurs / 2 tueurs : longueur 7',r.length===7);
  T('7 joueurs : 2 tueurs',r.filter(x=>x==='tueur').length===2);
  T('7 joueurs : 1 médecin, 1 détective',r.filter(x=>x==='medecin').length===1&&r.filter(x=>x==='detective').length===1);
  T('7 joueurs : 3 civils',r.filter(x=>x==='civil').length===3);
}
{
  const r=X.composerRoles(4,{tueurs:1,medecin:true,detective:true});
  T('4 joueurs : exactement 1 civil',r.filter(x=>x==='civil').length===1);
}
{
  const r=X.composerRoles(6,{tueurs:1,medecin:false,detective:false});
  T('sans médecin ni détective : 5 civils',r.filter(x=>x==='civil').length===5&&!r.includes('medecin')&&!r.includes('detective'));
}
{
  const a=X.composerRoles(8,{tueurs:1,medecin:true,detective:true},()=>0.01);
  const b=X.composerRoles(8,{tueurs:1,medecin:true,detective:true},()=>0.99);
  T('le mélange dépend du générateur aléatoire',JSON.stringify(a)!==JSON.stringify(b));
}

console.log('— validation de la composition —');
T('3 joueurs refusés',X.validerComposition(3,{tueurs:1})!==null);
T('13 joueurs refusés',X.validerComposition(13,{tueurs:1})!==null);
T('2 tueurs à 5 refusés',X.validerComposition(5,{tueurs:2})!==null);
T('2 tueurs à 6 acceptés',X.validerComposition(6,{tueurs:2})===null);
T('4 joueurs / 1 tueur acceptés',X.validerComposition(4,{tueurs:1,medecin:true,detective:true})===null);

console.log('— conditions de victoire —');
T('tous tueurs morts → village',X.verifierVictoire(js(['tueur','civil','civil'],[0]))==='village');
T('1 tueur vs 1 civil → tueurs',X.verifierVictoire(js(['tueur','civil','civil'],[1]))==='tueurs');
T('1 tueur vs 2 civils → partie continue',X.verifierVictoire(js(['tueur','civil','civil']))===null);
T('2 tueurs vs 2 civils → tueurs',X.verifierVictoire(js(['tueur','tueur','civil','civil']))==='tueurs');
T('médecin+détective comptent comme village',X.verifierVictoire(js(['tueur','medecin','detective']))===null);

console.log('— cible des tueurs —');
{
  const j=js(['tueur','civil','civil','civil']);
  T('tueur seul : sa cible',X.choisirCibleTueurs(j,{u0:2})===2);
  T('aucun geste → pas de victime',X.choisirCibleTueurs(j,{})===-1);
}
{
  const j=js(['tueur','tueur','civil','civil','civil','civil']);
  T('2 tueurs d\'accord : cible commune',X.choisirCibleTueurs(j,{u0:3,u1:3})===3);
  const c=X.choisirCibleTueurs(j,{u0:2,u1:4},()=>0);
  T('2 tueurs en désaccord : l\'une des deux cibles',c===2);
  const c2=X.choisirCibleTueurs(j,{u0:2,u1:4},()=>0.9);
  T('désaccord, autre tirage : l\'autre cible',c2===4);
}
{
  const j=js(['tueur','tueur','civil','civil','civil','civil'],[0]);
  T('le geste d\'un tueur mort est ignoré',X.choisirCibleTueurs(j,{u0:2,u1:3})===3);
}

console.log('— résolution de la nuit —');
{
  const j=js(['tueur','medecin','detective','civil','civil']);
  const r=X.resoudreNuit(j,{u0:3,u1:4,u2:0},-1);
  T('victime non protégée → morte',r.mort===3&&r.sauve===0);
  T('protection enregistrée pour la nuit suivante',r.prot===4);
  T('inspection du tueur → « tueur »',r.insp&&r.insp.c===0&&r.insp.r==='tueur');
}
{
  const j=js(['tueur','medecin','detective','civil','civil']);
  const r=X.resoudreNuit(j,{u0:3,u1:3,u2:4},-1);
  T('victime protégée → sauvée',r.mort===-1&&r.sauve===1);
  T('inspection d\'un civil → « innocent »',r.insp&&r.insp.r==='innocent');
}
{
  const j=js(['tueur','medecin','detective','civil','civil']);
  const r=X.resoudreNuit(j,{u0:3,u1:3,u2:4},3);
  T('protéger 2 nuits de suite la même personne est sans effet',r.mort===3&&r.sauve===0&&r.prot===-1);
}
{
  const j=js(['tueur','medecin','detective','civil','civil'],[1]);
  const r=X.resoudreNuit(j,{u0:3,u1:3,u2:4},-1);
  T('médecin mort : plus de protection',r.mort===3&&r.prot===-1);
}
{
  const j=js(['tueur','civil','civil']);
  const r=X.resoudreNuit(j,{u0:1},-1);
  T('sans détective : pas d\'inspection',r.insp===null);
}
{
  const j=js(['tueur','medecin','detective','civil','civil']);
  const r=X.resoudreNuit(j,{},-1);
  T('nuit sans aucun geste (absents forcés) : personne ne meurt',
    r.mort===-1&&r.sauve===0&&r.prot===-1&&r.insp===null);
}

console.log('— dépouillement du vote —');
{
  const j=js(['tueur','civil','civil','civil','civil']);
  const r=X.depouillerVote(j,{u0:1,u1:0,u2:0,u3:0,u4:1});
  T('majorité 3 voix contre 2 → éliminé',r.elimine===0);
  T('décompte exact',r.tally[0]===3&&r.tally[1]===2);
}
{
  const j=js(['tueur','civil','civil','civil']);
  const r=X.depouillerVote(j,{u0:1,u1:0,u2:0,u3:1});
  T('égalité → personne n\'est éliminé',r.elimine===-1);
}
{
  const j=js(['tueur','civil','civil','civil'],[3]);
  const r=X.depouillerVote(j,{u0:1,u1:0,u2:0,u3:0});
  T('le vote d\'un mort est ignoré',r.elimine===0&&r.tally[0]===2);
}
{
  const j=js(['tueur','civil','civil','civil'],[1]);
  const r=X.depouillerVote(j,{u0:1,u2:0,u3:0});
  T('un vote visant un mort est ignoré',r.elimine===0&&!r.tally[1]);
}
{
  const j=js(['tueur','civil','civil','civil','civil']);
  const r=X.depouillerVote(j,{u1:0,u2:0});
  T('vote partiel (absents forcés) : majorité des votes reçus',r.elimine===0&&r.tally[0]===2);
}

console.log('— victoire par élimination nocturne —');
{
  const j=js(['tueur','civil','civil']);
  const r=X.resoudreNuit(j,{u0:1},-1);
  j[r.mort].vif=0;
  T('1 tueur, 1 survivant : les tueurs gagnent',X.verifierVictoire(j)==='tueurs');
}

console.log('— code de partie choisi par l\'hôte —');
T('FAMILLE accepté',X.codeValide('FAMILLE'));
T('TGR2026 accepté (chiffres permis)',X.codeValide('TGR2026'));
T('AB refusé (trop court)',!X.codeValide('AB'));
T('NEUFLETTRES refusé (trop long)',!X.codeValide('NEUFLETTRES'));
T('accents et espaces refusés',!X.codeValide('CAFÉ')&&!X.codeValide('AB CD'));
T('le code aléatoire reste valide',X.codeValide(X.codeAleatoire()));

console.log('— langues (français / arabe) —');
{
  const fr=Object.keys(X.I18N.fr).sort(), ar=Object.keys(X.I18N.ar).sort();
  const manqAr=fr.filter(k=>!X.I18N.ar[k]), manqFr=ar.filter(k=>!X.I18N.fr[k]);
  T('toutes les clés françaises existent en arabe'+(manqAr.length?' (manque: '+manqAr.join(',')+')':''),manqAr.length===0);
  T('aucune clé arabe orpheline'+(manqFr.length?' ('+manqFr.join(',')+')':''),manqFr.length===0);
  T('langue par défaut : français',X.getLangue()==='fr');
  T('interpolation {n}/{t}',X.t('cpt_vote',{n:3,t:7})==='3/7 ont voté');
  X.setLangue('ar');
  T('bascule arabe : phase de nuit traduite',X.t('ph_nuit',{n:2}).indexOf('الليلة')>=0);
  T('composition en arabe',X.compoTexte(7,{tueurs:2,medecin:true,detective:true}).indexOf('قاتلان')>=0);
  X.setLangue('fr');
  T('retour au français',X.t('ph_vote')==='🗳️ Vote');
}

console.log('— réglages par défaut —');
T('défauts : 1 tueur, médecin, détective, révélation',
  X.RG.tueurs===1&&X.RG.medecin===true&&X.RG.detective===true&&X.RG.reveler===true);
T('texte de composition',X.compoTexte(7,{tueurs:2,medecin:true,detective:true}).indexOf('3 civils')>=0);

console.log('');
console.log(ok+'/'+n+' tests réussis');
process.exit(ok===n?0:1);

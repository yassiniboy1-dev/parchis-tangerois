'use strict';
/* Simulation Mafia : 5 clients VM (A hôte + B,C,D,E) sur un faux Firebase partagé.
   Partie complète aléatoire, reprise de téléphone testée au premier jour,
   assertion de convergence d'état à chaque étape. */
const vm=require('vm');
const {extraireScript}=require('./charge-mafia.js');

/* ---------- faux Firebase (magasin partagé) ---------- */
const store={root:{},subs:[]};
const parts=p=>p.split('/').filter(Boolean);
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function getAt(pp){let n=store.root;for(const k of pp){if(n==null||typeof n!=='object')return undefined;n=n[k];}return n;}
function setAt(pp,val){
  if(!pp.length){store.root=val==null?{}:clone(val);return;}
  let n=store.root;
  for(let i=0;i<pp.length-1;i++){if(typeof n[pp[i]]!=='object'||n[pp[i]]==null)n[pp[i]]={};n=n[pp[i]];}
  const k=pp[pp.length-1];
  if(val==null)delete n[k];else n[k]=clone(val);
}
function snapFor(path){
  const v=clone(getAt(parts(path)));
  return {val:()=>v,exists:()=>v!=null,forEach(f){if(v&&typeof v==='object'){for(const k of Object.keys(v))f({key:k,ref:makeRef(path+'/'+k),val:()=>v[k]});}}};
}
function deliver(s){setTimeout(()=>{if(!s.off)try{s.cb(snapFor(s.path));}catch(e){console.log('ERREUR listener',s.path,e.message);}},2+Math.random()*8);}
function notifyAll(){for(const s of store.subs)if(!s.off)deliver(s);}
function makeRef(path){
  return {
    child(p){return makeRef(path+'/'+p);},
    on(t,cb){const s={path,cb,off:false};store.subs.push(s);deliver(s);return cb;},
    off(){store.subs.forEach(s=>{if(s.path===path)s.off=true;});},
    once(t,cb,ecb){setTimeout(()=>{try{cb(snapFor(path));}catch(e){}},2);},
    set(v,cb){setAt(parts(path),v);notifyAll();if(cb)setTimeout(()=>cb(null),1);},
    update(o){for(const k of Object.keys(o))setAt(parts(path+'/'+k),o[k]);notifyAll();},
    remove(){setAt(parts(path),null);notifyAll();},
    transaction(fn,cb){
      const cur=getAt(parts(path));
      const r=fn(cur===undefined?null:clone(cur));
      if(r===undefined){if(cb)setTimeout(()=>cb(null,false),1);}
      else{setAt(parts(path),r);notifyAll();if(cb)setTimeout(()=>cb(null,true),1);}
    },
    orderByChild(){return{endAt(){return{limitToFirst(){return{once(t,cb){setTimeout(()=>cb({forEach(){}}),1);}};}};}};},
  };
}
const journal=[];
function makeFirebase(tag){
  function tRef(path){
    const r=makeRef(path);
    const oset=r.set.bind(r);
    r.set=(v,cb)=>{ if(path.endsWith('/etat')&&v) journal.push([tag,v.seq,'ph='+v.ph,'nuit='+v.nuit]); oset(v,cb); };
    r.child=p=>tRef(path+'/'+p);
    return r;
  }
  return {apps:[],initializeApp(){this.apps.push(1);},database(){return{ref:tRef,goOnline(){}};}};
}

/* ---------- DOM factice ---------- */
function fakeElFactory(){
  function fakeEl(){
    const el={
      children:[],style:{},value:'',textContent:'',className:'',disabled:false,dataset:{},parentNode:null,
      classList:{_s:new Set(),
        add(...a){a.forEach(x=>el.classList._s.add(x));},
        remove(...a){a.forEach(x=>el.classList._s.delete(x));},
        toggle(c,f){if(f===undefined)f=!el.classList._s.has(c);f?el.classList._s.add(c):el.classList._s.delete(c);return f;},
        contains(c){return el.classList._s.has(c);}},
      addEventListener(){},setAttribute(){},
      appendChild(c){el.children.push(c);c.parentNode=el;return c;},
      removeChild(c){const i=el.children.indexOf(c);if(i>=0)el.children.splice(i,1);c.parentNode=null;},
      get firstChild(){return el.children[0]||null;},
      querySelectorAll(){return[];},querySelector(){return null;},
    };
    Object.defineProperty(el,'innerHTML',{get(){return'';},set(){el.children.length=0;}});
    return el;
  }
  return fakeEl;
}
function makeCtx(uid){
  const fakeEl=fakeElFactory(), els={};
  const sandbox={
    console,URLSearchParams,
    setTimeout:(f,ms)=>setTimeout(f,Math.max(1,(ms||0)/12)),
    setInterval:(f,ms)=>setInterval(f,Math.max(1,(ms||0)/12)),
    clearTimeout,clearInterval,
    document:{
      getElementById:id=>els[id]||(els[id]=fakeEl()),
      querySelectorAll:()=>[],querySelector:()=>null,
      createElement:()=>fakeEl(),createElementNS:()=>fakeEl(),
      addEventListener(){},hidden:false,visibilityState:'visible',
    },
    window:{open(){},addEventListener(){}},
    navigator:{},
    location:{search:'',origin:'https://t',pathname:'/'},
    firebase:makeFirebase(uid),
  };
  vm.createContext(sandbox);
  let code=extraireScript();
  code=code.replace('}catch(e){ /* un instantané cassé ne doit jamais figer le client */ }',
    '}catch(e){ console.log("TP-ERR:",e&&e.message); }');
  const src=code+'\n;globalThis.__X={G,NET,RG,rejoindreRef,lancerPartie,pretRole,confirmerNuit,confirmerVote,passerAuVote,tomberNuit,reprendrePlace,forcerSuite,initFirebase};';
  vm.runInContext(src,sandbox);
  sandbox.__X.NET.uid=uid;
  sandbox.__X.initFirebase();
  return sandbox;
}

const dodo=ms=>new Promise(r=>setTimeout(r,ms));
function coeur(C){
  const g=C.__X.G;
  if(!g.etat) return 'vide';
  return JSON.stringify({ph:g.etat.ph,n:g.etat.nuit,m:g.etat.m,g:g.etat.gagnant,
    j:g.etat.joueurs.map(j=>[j.uid,j.role,j.vif]),seq:C.__X.NET.appliedSeq});
}
async function settle(clients,ms){
  const debut=Date.now();
  let dernier='',dernierMvt=Date.now();
  while(Date.now()-debut<ms){
    await dodo(30);
    const c0=coeur(clients[0]);
    if(c0!==dernier){dernier=c0;dernierMvt=Date.now();}
    if(c0!=='vide'&&clients.every(C=>coeur(C)===c0))return true;
    if(Date.now()-dernierMvt>4000)return false;
  }
  return false;
}
const hasard=a=>a[Math.floor(Math.random()*a.length)];

async function principal(){
  setAt(['.info','connected'],true);
  setAt(['parties','TEST'],{v:1,jeu:'mafia',creele:Date.now(),hote:'uidA',statut:'lobby',
    joueurs:{uidA:{nom:'Aziz',ts:1},uidB:{nom:'Badr',ts:2},uidC:{nom:'Chafik',ts:3},
             uidD:{nom:'Driss',ts:4},uidE:{nom:'Emna',ts:5}},
    regles:{tueurs:1,medecin:true,detective:true,reveler:true}});
  const A=makeCtx('uidA'),B=makeCtx('uidB'),C=makeCtx('uidC'),D=makeCtx('uidD'),E=makeCtx('uidE');
  let clients=[A,B,C,D,E];
  clients.forEach(X=>X.__X.rejoindreRef('TEST'));
  await dodo(250);
  if(!A.__X.NET.isHote){console.log('ÉCHEC: A pas hôte');process.exit(1);}
  A.__X.lancerPartie();
  await dodo(400);
  const e0=A.__X.G.etat;
  if(!e0||e0.ph!=='roles'){console.log('ÉCHEC: lancement raté, ph=',e0&&e0.ph);process.exit(1);}
  const roles=e0.joueurs.map(j=>j.role);
  if(roles.filter(r=>r==='tueur').length!==1||roles.filter(r=>r==='medecin').length!==1||
     roles.filter(r=>r==='detective').length!==1||roles.filter(r=>r==='civil').length!==2){
    console.log('ÉCHEC: composition des rôles fausse:',roles);process.exit(1);
  }
  console.log('rôles distribués:',e0.joueurs.map(j=>j.nom+'='+j.role).join(', '));

  let actions=0,repris=false,hoteRepris=false,force=false,sauvetages=0,egalites=0,resVu='';
  for(let step=0;step<600;step++){
    const ok=await settle(clients,9000);
    if(!ok){
      console.log('ÉCHEC: pas de convergence / blocage à l\'action',actions);
      clients.forEach((X,i)=>console.log(' client',i,coeur(X)));
      console.log('10 dernières écritures etat:');journal.slice(-10).forEach(j=>console.log('  ',j.join(' | ')));
      process.exit(1);
    }
    const g0=clients[0].__X.G,e=g0.etat;
    const rk=e.res?(e.res.t+e.m+'-'+e.nuit):'';
    if(rk&&rk!==resVu){
      resVu=rk;
      if(e.res.t==='nuit'&&e.res.sauve)sauvetages++;
      if(e.res.t==='vote'&&e.res.elimine===-1)egalites++;
    }
    if(e.ph==='fin'){
      if(e.gagnant!=='tueurs'&&e.gagnant!=='village'){console.log('ÉCHEC: gagnant invalide',e.gagnant);process.exit(1);}
      if(!force){console.log('ÉCHEC: le forçage de nuit n\'a pas été testé');process.exit(1);}
      if(!repris){console.log('ÉCHEC: la reprise de téléphone n\'a pas été testée');process.exit(1);}
      if(!hoteRepris){console.log('ÉCHEC: la reprise du téléphone de l\'hôte n\'a pas été testée');process.exit(1);}
      const refC=coeur(clients[0]);
      const converge=clients.every(X=>coeur(X)===refC);
      console.log('PARTIE TERMINÉE — gagnant:',e.gagnant,'| nuits:',e.nuit,'| actions:',actions,
        '| sauvetages:',sauvetages,'| reprise testée:',repris,'| forçage testé:',force);
      console.log(converge?'SIM OK — synchro parfaite de bout en bout':'ÉCHEC final: divergence');
      process.exit(converge?0:1);
    }
    /* forçage : à la nuit 1, Badr (uidB) ne fait jamais son geste — quand les
       4 autres ont agi, l'hôte utilise « Continuer sans les absents » */
    if(!force&&e.m===1&&e.ph==='nuit'&&e.nuit===1){
      const ac=clients[0].__X.G.actes['m1n1']||{};
      const manq=e.joueurs.filter(j=>j.vif&&typeof ac[j.uid]!=='number');
      if(manq.length===1&&manq[0].uid==='uidB'){
        A.__X.forcerSuite();
        force=true;actions++;
        await dodo(200);
        if((A.__X.G.etat||{}).ph==='nuit'){console.log('ÉCHEC: forçage sans effet');process.exit(1);}
        console.log('… nuit 1 forcée sans le geste de Badr (bouton hôte) OK');
        continue;
      }
    }
    /* reprise : au premier jour, C « change de téléphone » */
    if(!repris&&e.ph==='jour'){
      repris=true;
      const C2=makeCtx('uidC2');
      C2.__X.rejoindreRef('TEST');
      await dodo(300);
      if(C2.__X.G.myIdx!=null){console.log('ÉCHEC: C2 ne devrait pas avoir de place');process.exit(1);}
      const idx=C2.__X.G.etat.joueurs.findIndex(j=>j.uid==='uidC');
      C2.__X.reprendrePlace(idx);
      await dodo(300);
      if(C2.__X.G.myIdx!==idx){console.log('ÉCHEC: reprise ratée, myIdx=',C2.__X.G.myIdx);process.exit(1);}
      if(C.__X.G.myIdx!=null){console.log('ÉCHEC: l\'ancien téléphone garde une place');process.exit(1);}
      console.log('… reprise de téléphone OK au jour',e.nuit,'— C2 remplace C (C devient fantôme)');
      clients=[clients[0],B,C2,D,E]; /* C reste connecté en spectateur fantôme */
      continue;
    }
    /* reprise du téléphone de l'HÔTE (bug critique trouvé en revue) : après
       la reprise de C, A « change de téléphone » — l'arbitrage doit suivre */
    if(repris&&!hoteRepris&&e.ph==='jour'){
      hoteRepris=true;
      const A2=makeCtx('uidA2');
      A2.__X.rejoindreRef('TEST');
      await dodo(300);
      const idxA=A2.__X.G.etat.joueurs.findIndex(j=>j.uid==='uidA');
      A2.__X.reprendrePlace(idxA);
      await dodo(300);
      if(A2.__X.G.myIdx!==idxA){console.log('ÉCHEC: reprise du siège de l\'hôte ratée, myIdx=',A2.__X.G.myIdx);process.exit(1);}
      if(!A2.__X.NET.isHote){console.log('ÉCHEC: l\'arbitrage n\'a pas suivi le téléphone de l\'hôte');process.exit(1);}
      if(clients[0].__X.NET.isHote){console.log('ÉCHEC: l\'ancien téléphone de l\'hôte arbitre encore');process.exit(1);}
      console.log('… reprise du téléphone de l\'HÔTE OK au jour',e.nuit,'— l\'arbitrage passe à A2');
      clients=[A2].concat(clients.slice(1)); /* A reste connecté en fantôme */
      continue;
    }
    /* jouer */
    let agi=false;
    for(const X of clients){
      const g=X.__X.G,ne=g.etat;
      if(!ne||g.myIdx==null)continue;
      const moi=ne.joueurs[g.myIdx];
      if(ne.ph==='roles'){
        const pr=(g.prets['m'+ne.m+'roles']||{});
        if(!pr[X.__X.NET.uid]){X.__X.pretRole();agi=true;actions++;break;}
      }else if(ne.ph==='nuit'&&moi.vif){
        if(!force&&ne.m===1&&ne.nuit===1&&X.__X.NET.uid==='uidB')continue; /* Badr traîne */
        const ac=(g.actes['m'+ne.m+'n'+ne.nuit]||{});
        if(typeof ac[X.__X.NET.uid]!=='number'){
          let cibles=ne.joueurs.map((j,i)=>j.vif?i:-1).filter(i=>i>=0);
          if(moi.role==='medecin')cibles=cibles.filter(i=>i!==ne.prot);
          else cibles=cibles.filter(i=>i!==g.myIdx); /* soi-même : médecin seulement */
          X.__X.confirmerNuit(hasard(cibles));agi=true;actions++;break;
        }
      }else if(ne.ph==='vote'&&moi.vif){
        const vo=(g.votes['m'+ne.m+'j'+ne.nuit]||{});
        if(typeof vo[X.__X.NET.uid]!=='number'){
          const cibles=ne.joueurs.map((j,i)=>(j.vif&&i!==g.myIdx)?i:-1).filter(i=>i>=0);
          X.__X.confirmerVote(hasard(cibles));agi=true;actions++;break;
        }
      }else if(ne.ph==='jour'&&X.__X.NET.isHote){
        X.__X.passerAuVote();agi=true;actions++;break;
      }else if(ne.ph==='crep'&&X.__X.NET.isHote){
        X.__X.tomberNuit();agi=true;actions++;break;
      }
    }
    if(!agi)await dodo(80);
  }
  console.log('ÉCHEC: partie trop longue sans fin (actions:',actions,')');
  process.exit(1);
}
principal().catch(e=>{console.log('ÉCHEC exception:',e);process.exit(1);});

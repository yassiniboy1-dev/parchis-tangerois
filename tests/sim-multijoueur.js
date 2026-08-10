'use strict';
/* Simulation multijoueur : 2 clients (A hôte, B invité) + 2 IA, faux Firebase partagé */
const vm=require('vm'), fs=require('fs'), path=require('path');

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
function makeFirebase(tag){
  function tRef(path){
    const r=makeRef(path);
    const oset=r.set.bind(r);
    r.set=(v,cb)=>{ if(path.endsWith('/etat')&&v) journal.push([tag,v.seq,'cur='+v.cur,(v.action||{}).t||'-']); oset(v,cb); };
    r.child=p=>tRef(path+'/'+p);
    return r;
  }
  return {apps:[],initializeApp(){this.apps.push(1);},database(){return{ref:tRef,goOnline(){}};}};
}
const journal=[];

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
  let code=require('./charge.js').extraireScript();
  code=code.replace('}catch(e){ /* un instantané cassé ne doit jamais figer le client */ }','}catch(e){ console.log("TP-ERR:",e&&e.message,e&&e.stack&&e.stack.split("\\n")[1]); }');
  const src=code+
    '\n;globalThis.__X={G,NET,R,doRoll,execMove,rejoindreRef,lancerEnLigne,quitterLigne,initFirebase};';
  vm.runInContext(src,sandbox);
  sandbox.__X.NET.uid=uid;
  sandbox.__X.initFirebase();
  return sandbox;
}

const dodo=ms=>new Promise(r=>setTimeout(r,ms));
function coeur(C){
  const g=C.__X.G;
  return JSON.stringify({p:g.pawns,cur:g.cur,w:g.winner,seq:C.__X.NET.appliedSeq});
}
function stable(C){const ph=C.__X.G.phase;return ph==='roll'||ph==='move'||ph==='bonus'||ph==='over';}

async function settle(clients,ms){
  const debut=Date.now();
  let dernierSeq=-1,dernierMvt=Date.now();
  while(Date.now()-debut<ms){
    await dodo(40);
    const seqs=clients.map(C=>C.__X.NET.appliedSeq);
    if(seqs[0]!==dernierSeq){dernierSeq=seqs[0];dernierMvt=Date.now();}
    const memeSeq=seqs.every(s=>s===seqs[0]);
    if(memeSeq&&clients.every(stable))return true;
    if(Date.now()-dernierMvt>5000)return false; // plus rien ne bouge
  }
  return false;
}

async function principal(){
  /* graine : partie en lobby, A (hôte) et B humains, 2 IA */
  setAt(['.info','connected'],true);
  setAt(['parties','TEST'],{v:3,creele:Date.now(),hote:'uidA',statut:'lobby',
    sieges:{0:{t:'h',nom:'Aziz',uid:'uidA'},1:{t:'h',nom:'Badr',uid:'uidB'},2:{t:'ia'},3:{t:'ia'}}});
  const A=makeCtx('uidA'),B=makeCtx('uidB');
  A.__X.rejoindreRef('TEST');B.__X.rejoindreRef('TEST');
  await dodo(250);
  if(!A.__X.NET.isHote){console.log('ÉCHEC: A pas hôte');process.exit(1);}
  A.__X.lancerEnLigne();
  await dodo(600);
  console.log('magasin statut:',getAt(['parties','TEST','statut']),'| etat seq:',(getAt(['parties','TEST','etat'])||{}).seq);

  let clients=[A,B],actions=0,fautes=0,captures=0,repris=false,B2=null;
  for(let step=0;step<1500;step++){
    const ok=await settle(clients,9000);
    if(!ok){
      console.log('ÉCHEC: pas de convergence / blocage à l\'action',actions);
      clients.forEach((C,i)=>console.log(' client',i,'phase',C.__X.G.phase,'cur',C.__X.G.cur,'seq',C.__X.NET.appliedSeq,'myPi',C.__X.NET.myPi));
      process.exit(1);
    }
    const refC=coeur(clients[0]);
    for(const C of clients){
      if(coeur(C)!==refC){
        console.log('ÉCHEC: divergence d\'état à l\'action',actions);
        console.log('A:',coeur(clients[0]));console.log('X:',coeur(C));
        console.log('20 dernières écritures etat:');journal.slice(-20).forEach(j=>console.log('  ',j.join(' | ')));
        process.exit(1);
      }
    }
    const g0=clients[0].__X.G;
    if(g0.winner!=null){
      console.log('PARTIE TERMINÉE — vainqueur:',g0.winner,'| actions:',actions,'| fautes:',fautes,'| captures:',captures,'| reprise testée:',repris);
      const converge=clients.every(C=>coeur(C)===refC);
      console.log(converge?'SIM OK — synchro parfaite de bout en bout':'ÉCHEC final');
      process.exit(converge?0:1);
    }
    /* test de reprise : vers l'action 12, B "change de téléphone" */
    if(!repris&&actions>=12){
      repris=true;
      B2=makeCtx('uidB2');
      B2.__X.rejoindreRef('TEST');
      await dodo(300);
      if(B2.__X.NET.myPi!=null){console.log('ÉCHEC: B2 ne devrait pas avoir de siège');process.exit(1);}
      /* B2 reprend le siège 1 (comme via le modal «C\'est moi») */
      makeRef('parties/TEST/sieges/1').update({uid:'uidB2'});
      await dodo(300);
      if(B2.__X.NET.myPi!==1){console.log('ÉCHEC: reprise de siège ratée, myPi=',B2.__X.NET.myPi);process.exit(1);}
      console.log('… reprise de siège OK à l\'action',actions,'— B2 remplace B');
      clients=[A,B2]; /* B reste connecté en spectateur fantôme */
      continue;
    }
    /* jouer */
    let agi=false;
    for(const C of clients){
      const g=C.__X.G,n=C.__X.NET;
      const peut=n.myPi===g.cur&&g.seats[g.cur]==='h';
      if(peut&&g.phase==='roll'){C.__X.doRoll();agi=true;actions++;break;}
      if(peut&&(g.phase==='move'||g.phase==='bonus')&&g.moves.length){
        const mv=g.moves[Math.floor(Math.random()*g.moves.length)];
        if(mv.cap)captures++;
        const oblig=(g.obligCap.size&&!mv.cap)||((!g.obligCap.size)&&g.obligSortie.size&&mv.kind!=='exit')||((!g.obligCap.size)&&(!g.obligSortie.size)&&g.obligOuv.size&&!g.obligOuv.has(mv.id));
        if(oblig)fautes++;
        C.__X.execMove(mv);agi=true;actions++;break;
      }
    }
    if(!agi)await dodo(120); /* tours IA : laisser tourner */
  }
  console.log('ÉCHEC: partie trop longue sans vainqueur (actions:',actions,')');
  process.exit(1);
}
principal().catch(e=>{console.log('ÉCHEC exception:',e);process.exit(1);});

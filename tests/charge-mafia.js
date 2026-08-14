'use strict';
/* Charge le vrai code du jeu Mafia (extrait de ../mafia/index.html) dans un contexte VM */
const vm=require('vm'), fs=require('fs'), path=require('path');
const {fakeElFactory}=require('./charge.js');

function extraireScript(){
  const html=fs.readFileSync(path.join(__dirname,'..','mafia','index.html'),'utf8');
  const i=html.lastIndexOf('<script>');
  const j=html.indexOf('</script>',i);
  return html.slice(i+8,j);
}
function chargerContexte(options){
  options=options||{};
  const fakeEl=fakeElFactory(), els={};
  const sandbox={
    console,URLSearchParams,process,
    setTimeout:options.setTimeout||((f,ms)=>setTimeout(f,ms)),
    setInterval:options.setInterval||((f,ms)=>setInterval(f,ms)),
    clearTimeout,clearInterval,
    document:{
      getElementById:id=>els[id]||(els[id]=fakeEl('div')),
      querySelectorAll:()=>[],querySelector:()=>null,
      createElement:t=>fakeEl(t),createElementNS:(ns,t)=>fakeEl(t),
      addEventListener(){},hidden:false,visibilityState:'visible',
    },
    window:{open(){},addEventListener(){}},
    navigator:{},
    location:{search:'',origin:'https://t',pathname:'/'},
    firebase:options.firebase,
  };
  vm.createContext(sandbox);
  vm.runInContext(extraireScript()+(options.exposer||''),sandbox);
  sandbox.__els=els;
  return sandbox;
}
const EXPOSER='\n;globalThis.__X={G,NET,RG,composerRoles,validerComposition,verifierVictoire,'+
  'choisirCibleTueurs,resoudreNuit,depouillerVote,compoTexte,'+
  'rejoindreRef,lancerPartie,pretRole,confirmerNuit,confirmerVote,'+
  'passerAuVote,tomberNuit,rejouer,reprendrePlace,quitterLigne,initFirebase,'+
  'I18N,t,setLangue,getLangue:()=>LANGUE,codeValide,codeAleatoire,NARR,narratifPour,'+
  'choixBotNuit,choixBotVote};';
module.exports={chargerContexte,extraireScript,EXPOSER};

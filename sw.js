'use strict';
/* Service worker minimaliste du Mafia — RÉSEAU D'ABORD.
   En ligne : toujours la version fraîche de Netlify (jamais de vieux jeu servi).
   Hors ligne : la dernière version mise en cache est servie en secours
   (le repli sur la page d'accueil est réservé aux navigations). */
const CACHE='mafia-v1';

self.addEventListener('install',e=>{ self.skipWaiting(); });
self.addEventListener('activate',e=>{
  e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  let u;
  try{ u=new URL(e.request.url); }catch(err){ return; }
  if(u.origin!==self.location.origin) return; /* Firebase, polices… : réseau direct */
  e.respondWith((async()=>{
    try{
      const rep=await fetch(e.request);
      if(rep&&rep.ok){
        const copie=rep.clone();
        e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copie)).catch(()=>{}));
      }
      return rep;
    }catch(err){
      const r=await caches.match(e.request,{ignoreSearch:true});
      if(r) return r;
      if(e.request.mode==='navigate'){
        const p=await caches.match('./',{ignoreSearch:true});
        if(p) return p;
      }
      throw err;
    }
  })());
});

'use strict';
/* Tests du moteur de regles de Tanger, executes contre ../index.html (le vrai fichier livre) */
const vm=require('vm'), fs=require('fs'), path=require('path');
const {chargerContexte}=require('./charge.js');
const ctx=chargerContexte();
const corps=fs.readFileSync(path.join(__dirname,'moteur.corps.js'),'utf8');
vm.runInContext(corps,ctx);

#!/usr/bin/env node
/* =========================================================
   TESTES DO SISTEMA — rode com:  node testes/rodar.js
   Carrega app.js e pdf-etiquetas.js num navegador de mentira (só o
   suficiente para o código não estourar) e confere as regras que já
   deram problema na loja: ids, junção entre aparelhos, baixa de estoque
   dos pedidos do site, fuso horário, código de barras, senha, envio
   condicional à nuvem.
   ========================================================= */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

/* ---------- navegador de mentira ---------- */
function elemento(){
  return {
    style:{}, dataset:{}, innerHTML:'', textContent:'', value:'', className:'', title:'',
    classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    appendChild(){}, remove(){}, addEventListener(){}, focus(){}, click(){}, select(){},
    setAttribute(){}, removeAttribute(){}, scrollIntoView(){},
    querySelector(){ return null; }, querySelectorAll(){ return []; }, closest(){ return null; }
  };
}
const memoria = {};
globalThis.localStorage = {
  getItem: k => (k in memoria ? memoria[k] : null),
  setItem: (k, v) => { memoria[k] = String(v); },
  removeItem: k => { delete memoria[k]; },
  key: i => Object.keys(memoria)[i], get length(){ return Object.keys(memoria).length; }
};
Object.defineProperty(globalThis.localStorage, 'keys', { value: () => Object.keys(memoria) });
const origKeys = Object.keys;
Object.keys = o => (o === globalThis.localStorage ? origKeys(memoria) : origKeys(o));
globalThis.sessionStorage = { getItem(){ return null; }, setItem(){}, removeItem(){} };
globalThis.window = globalThis;
globalThis.addEventListener = ()=>{};
globalThis.removeEventListener = ()=>{};
globalThis.dispatchEvent = ()=>true;
globalThis.document = {
  addEventListener(){}, getElementById(){ return null; }, createElement(){ return elemento(); },
  querySelector(){ return null; }, querySelectorAll(){ return []; }, body: elemento(),
  activeElement: null, hidden: false
};
globalThis.navigator = { onLine: true };
globalThis.location = { hash: '', reload(){} };
globalThis.alert = () => {}; globalThis.confirm = () => true; globalThis.prompt = () => null;
globalThis.indexedDB = undefined;
globalThis.Blob = globalThis.Blob || class { constructor(parts){ this.parts = parts; this.size = parts.reduce((a,p)=>a+(p.length||p.byteLength||0),0); } };
globalThis.URL = globalThis.URL || {}; URL.createObjectURL = () => 'blob:x'; URL.revokeObjectURL = () => {};
let chamadasFetch = [];
let respostaFetch = async () => { throw new Error('sem rede (teste)'); };
globalThis.fetch = async (url, opts) => { chamadasFetch.push({ url, opts: opts||{} }); return respostaFetch(url, opts||{}); };

const raiz = path.join(__dirname, '..');
vm.runInThisContext(fs.readFileSync(path.join(raiz, 'pdf-etiquetas.js'), 'utf8'), { filename: 'pdf-etiquetas.js' });
vm.runInThisContext(fs.readFileSync(path.join(raiz, 'app.js'), 'utf8'), { filename: 'app.js' });

/* Os nomes do app.js ficam no escopo léxico global; para os testes
   enxergarem, eles também rodam por runInThisContext. */
globalThis.assert = assert;
globalThis.chamadasFetch = () => chamadasFetch;
globalThis.limparFetch = () => { chamadasFetch = []; };
globalThis.definirFetch = fn => { respostaFetch = fn; };
globalThis.resposta = (status, corpo) => ({ ok: status >= 200 && status < 300, status,
  json: async () => corpo, text: async () => JSON.stringify(corpo) });
globalThis.backupDaLoja = () => JSON.parse(fs.readFileSync(path.join(raiz, 'dados-da-loja', 'estilo-fashion-backup-LIMPO.json'), 'utf8'));

const casos = fs.readFileSync(path.join(__dirname, 'casos.js'), 'utf8');
vm.runInThisContext(casos, { filename: 'casos.js' });

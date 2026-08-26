/* =========================================================
   Skin Care — núcleo compartilhado
   Consultoria de skin care: venda → área da cliente → anamnese
   HTML/CSS/JS puro. Estado em localStorage + Supabase (JSON).
   ========================================================= */

const SUPABASE_URL   = "https://sjuvryprgbkrbzkvnnhw.supabase.co";
const SUPABASE_KEY   = "sb_publishable_8uMMZINGFWPcXmwQGevnBQ_ksULyUau";
const SUPABASE_TABLE = "loja_roupas_db";
const SUPABASE_ROW   = "skincare";           // linha própria, separada do sistema da loja
const LS_KEY         = "skincareDB";
const SESSION_KEY    = "skincareSession";    // sessão da cliente
const ADMIN_KEY      = "skincareAdmin";      // sessão da consultora
const DRAFT_KEY      = "skincareAnamneseDraft";

/* ---------------------- utilidades ---------------------- */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function money(v){ return (Number(v) || 0).toLocaleString('pt-BR', { style:'currency', currency:'BRL' }); }
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function onlyDigits(s){ return String(s || '').replace(/\D/g, ''); }
function normEmail(s){ return String(s || '').trim().toLowerCase(); }
function fmtDate(iso){
  if(!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
}
function fmtDateShort(iso){ return iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'; }

/* Código de acesso da cliente: fácil de ditar no WhatsApp */
function gerarCodigo(){
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0, 1
  let s = '';
  for(let i = 0; i < 6; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return 'SKIN-' + s;
}

function toast(msg, tipo = 'ok'){
  let box = $('#toastBox');
  if(!box){
    box = document.createElement('div');
    box.id = 'toastBox';
    box.className = 'toast-box';
    document.body.appendChild(box);
  }
  const t = document.createElement('div');
  t.className = 'toast toast-' + tipo;
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3200);
}

/* ---------------------- estado base ---------------------- */
const PLANOS_PADRAO = [
  {
    id: 'essencial',
    nome: 'Essencial',
    preco: 197,
    resumo: 'Para quem quer começar do jeito certo, sem gastar à toa.',
    itens: [
      'Anamnese completa de pele (quiz guiado)',
      'Análise do seu perfil e das suas queixas',
      'Protocolo personalizado em PDF (manhã e noite)',
      'Indicação de produtos em 3 faixas de preço',
      '7 dias de suporte no WhatsApp'
    ]
  },
  {
    id: 'completa',
    nome: 'Completa',
    preco: 347,
    destaque: true,
    resumo: 'A escolha da maioria: protocolo + encontro comigo para tirar tudo a limpo.',
    itens: [
      'Tudo do plano Essencial',
      'Videochamada de 40 min comigo',
      'Cronograma de ativos semana a semana',
      'Ajuste do protocolo depois do encontro',
      '30 dias de suporte no WhatsApp'
    ]
  },
  {
    id: 'acompanhamento',
    nome: 'Acompanhamento 90 dias',
    preco: 597,
    resumo: 'Para pele com queixa persistente: acne, melasma, textura, sensibilidade.',
    itens: [
      'Tudo do plano Completa',
      '3 encontros (1 por mês)',
      'Reavaliação por fotos a cada 30 dias',
      'Troca e progressão de ativos com segurança',
      '90 dias de suporte no WhatsApp'
    ]
  }
];

const SETTINGS_PADRAO = {
  marca:      'Duda Skin Care',
  consultora: 'Duda',
  headline:   'Uma rotina de skin care feita para a sua pele — não para a pele da internet.',
  sub:        'Anamnese completa, protocolo personalizado e acompanhamento de verdade. Chega de comprar produto por indicação de vídeo.',
  whatsapp:   '',                 // ex.: 5511999999999
  instagram:  '',
  pix:        '',                 // chave PIX
  pixNome:    '',                 // nome do titular da chave
  email:      '',
  adminPass:  'duda123',
  planos:     PLANOS_PADRAO
};

function dbVazio(){
  return { settings: structuredClone(SETTINGS_PADRAO), orders: [], anamneses: [] };
}

let DB = dbVazio();
let cloudOk = false;

function normalizarDB(raw){
  const base = dbVazio();
  if(!raw || typeof raw !== 'object') return base;
  base.settings = Object.assign(base.settings, raw.settings || {});
  if(!Array.isArray(base.settings.planos) || !base.settings.planos.length){
    base.settings.planos = structuredClone(PLANOS_PADRAO);
  }
  base.orders    = Array.isArray(raw.orders) ? raw.orders : [];
  base.anamneses = Array.isArray(raw.anamneses) ? raw.anamneses : [];
  return base;
}

function loadLocal(){
  try{ return normalizarDB(JSON.parse(localStorage.getItem(LS_KEY) || 'null')); }
  catch(e){ return dbVazio(); }
}
function saveLocal(){
  try{ localStorage.setItem(LS_KEY, JSON.stringify(DB)); }
  catch(e){ /* cota cheia: segue só com a nuvem */ }
}

/* Rede lenta não pode travar a tela: toda chamada tem prazo. */
const TIMEOUT_REDE = 8000;
async function fetchComPrazo(url, opts = {}){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_REDE);
  try{ return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally{ clearTimeout(t); }
}

async function cloudPull(){
  const res = await fetchComPrazo(
    `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?id=eq.${SUPABASE_ROW}&select=data`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  if(!res.ok) throw new Error('pull ' + res.status);
  const rows = await res.json();
  return rows && rows[0] ? rows[0].data : null;
}

async function cloudPush(){
  const res = await fetchComPrazo(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify({ id: SUPABASE_ROW, data: DB, updated_at: new Date().toISOString() })
  });
  if(!res.ok) throw new Error('push ' + res.status);
}

/* Junta o que veio da nuvem com o que só existe neste aparelho.
   A nuvem manda no conteúdo de cada registro; registros locais que a nuvem
   ainda não conhece (criados sem internet) são preservados. */
function mesclarListas(remota, local){
  const saida = [...remota];
  const ids = new Set(remota.map(r => r.id));
  local.forEach(item => { if(!ids.has(item.id)) saida.push(item); });
  return saida;
}
function mesclarDB(remoto, local){
  const base = normalizarDB(remoto);
  base.orders    = mesclarListas(base.orders,    local.orders    || []);
  base.anamneses = mesclarListas(base.anamneses, local.anamneses || []);
  return base;
}

/* Carrega a nuvem; se falhar, cai para o localStorage sem quebrar a página. */
async function initDB(){
  DB = loadLocal();
  try{
    const remoto = await cloudPull();
    if(remoto){ DB = mesclarDB(remoto, DB); saveLocal(); }
    cloudOk = true;
  }catch(e){
    cloudOk = false;
    console.warn('Sem sincronização com a nuvem, usando dados locais.', e);
  }
  return DB;
}

/* Salva local na hora e tenta a nuvem. Devolve true se a nuvem aceitou. */
async function salvar(){
  saveLocal();
  try{ await cloudPush(); cloudOk = true; return true; }
  catch(e){ cloudOk = false; console.warn('Falha ao gravar na nuvem.', e); return false; }
}

/* Gravação segura de um registro novo: relê a nuvem antes para não
   sobrescrever pedidos/anamneses criados em outro dispositivo. */
async function salvarComMerge(aplicar){
  try{
    const remoto = await cloudPull();
    if(remoto) DB = mesclarDB(remoto, DB);
    cloudOk = true;
  }catch(e){ cloudOk = false; }
  aplicar(DB);
  return await salvar();
}

/* ---------------------- consultas ---------------------- */
function planoPorId(id){
  return (DB.settings.planos || []).find(p => p.id === id) || null;
}
function pedidoPorCodigo(codigo){
  const c = String(codigo || '').trim().toUpperCase();
  return DB.orders.find(o => String(o.codigo).toUpperCase() === c) || null;
}
function anamnesePorPedido(orderId){
  return DB.anamneses.find(a => a.orderId === orderId) || null;
}
function statusLabel(s){
  return { pendente:'Aguardando pagamento', pago:'Pagamento confirmado', concluido:'Consultoria entregue', cancelado:'Cancelado' }[s] || s;
}

/* ---------------------- sessão da cliente ---------------------- */
function setSession(order){
  sessionStorageSafe(SESSION_KEY, JSON.stringify({ codigo: order.codigo, email: order.email }));
}
function getSession(){
  try{ return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }catch(e){ return null; }
}
function clearSession(){ localStorage.removeItem(SESSION_KEY); }
function sessionStorageSafe(k, v){ try{ localStorage.setItem(k, v); }catch(e){} }

/* Pedido da sessão atual, já revalidado contra o DB carregado. */
function pedidoDaSessao(){
  const s = getSession();
  if(!s) return null;
  const o = pedidoPorCodigo(s.codigo);
  if(!o) return null;
  if(normEmail(o.email) !== normEmail(s.email)) return null;
  return o;
}

/* ---------------------- WhatsApp ---------------------- */
function linkWhats(texto){
  const num = onlyDigits(DB.settings.whatsapp);
  const msg = encodeURIComponent(texto || '');
  return num ? `https://wa.me/${num}?text=${msg}` : `https://wa.me/?text=${msg}`;
}

/* ---------------------- cabeçalho / rodapé ---------------------- */
function montarHeader(ativo){
  const el = $('#siteHeader');
  if(!el) return;
  const s = DB.settings;
  el.innerHTML = `
    <a class="logo" href="index.html">
      <img src="marca/simbolo.svg" alt="">
      <span>${esc(s.marca || 'Skin Care')}</span>
    </a>
    <nav class="nav">
      <a href="index.html#planos" class="${ativo === 'planos' ? 'on' : ''}">Planos</a>
      <a href="index.html#como" class="${ativo === 'como' ? 'on' : ''}">Como funciona</a>
      <a href="index.html#duvidas">Dúvidas</a>
      <a href="area.html" class="nav-cta ${ativo === 'area' ? 'on' : ''}">Área da cliente</a>
    </nav>`;
}

function montarFooter(){
  const el = $('#siteFooter');
  if(!el) return;
  const s = DB.settings;
  const redes = [];
  if(s.instagram) redes.push(`<a href="https://instagram.com/${esc(String(s.instagram).replace('@',''))}" target="_blank" rel="noopener">@${esc(String(s.instagram).replace('@',''))}</a>`);
  if(onlyDigits(s.whatsapp)) redes.push(`<a href="${linkWhats('Oi! Vim pelo site 💛')}" target="_blank" rel="noopener">WhatsApp</a>`);
  if(s.email) redes.push(`<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>`);
  el.innerHTML = `
    <div class="foot-in">
      <div>
        <strong>${esc(s.marca || 'Skin Care')}</strong>
        <p class="tiny">Consultoria de skin care personalizada. Conteúdo educativo — não substitui consulta médica dermatológica.</p>
      </div>
      <div class="foot-links">${redes.join('')}</div>
    </div>
    <div class="foot-bottom tiny">© ${new Date().getFullYear()} ${esc(s.marca || '')} — todos os direitos reservados · <a href="admin.html">Acesso da consultora</a></div>`;
}

/* =========================================================
   Dani Minuto — núcleo compartilhado
   Consultoria de skin care: venda → área da cliente → anamnese
   HTML/CSS/JS puro. Estado em localStorage + Supabase (JSON).
   ========================================================= */

const SUPABASE_URL   = "https://sjuvryprgbkrbzkvnnhw.supabase.co";
const SUPABASE_KEY   = "sb_publishable_8uMMZINGFWPcXmwQGevnBQ_ksULyUau";
const SUPABASE_TABLE = "loja_roupas_db";
const SUPABASE_ROW   = "dani_minuto";        // linha própria, separada do sistema da loja
const LS_KEY         = "daniMinutoDB";
const SESSION_KEY    = "daniMinutoSessao";   // sessão da cliente
const ADMIN_KEY      = "daniMinutoAdmin";    // sessão da Dani
const DRAFT_KEY      = "daniMinutoRascunho";

/* Só esconde o que vai ser revelado se o JS realmente carregou. Sem isso,
   uma falha de script deixaria a página em branco. */
document.documentElement.classList.add('js');

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
  return 'DM-' + s;
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
    nome: 'Protocolo Essencial',
    preco: 197,
    resumo: 'Para quem quer começar do jeito certo, sem gastar à toa.',
    itens: [
      'Anamnese completa de pele (quiz guiado)',
      'Leitura do seu perfil e das suas queixas',
      'Protocolo personalizado em PDF (manhã e noite)',
      'Indicação de ativos e produtos em 3 faixas de preço',
      '7 dias de suporte no WhatsApp'
    ]
  },
  {
    id: 'completa',
    nome: 'Protocolo Completo',
    preco: 347,
    destaque: true,
    resumo: 'Protocolo mais encontro comigo, para tirar tudo a limpo.',
    itens: [
      'Tudo do Protocolo Essencial',
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
      'Tudo do Protocolo Completo',
      '3 encontros (1 por mês)',
      'Reavaliação por fotos a cada 30 dias',
      'Troca e progressão de ativos com segurança',
      '90 dias de suporte no WhatsApp'
    ]
  }
];

const SETTINGS_PADRAO = {
  marca:      'Dani Minuto',
  consultora: 'Dani',
  assinatura: 'A ponte entre os mundos',
  frase:      'A ciência que sente. A cura que pensa.',
  headline:   'Sua pele cuidada com ciência — e olhada por inteiro.',
  sub:        'Consultoria de skin care com anamnese completa: um protocolo feito para a sua pele, a sua rotina e o seu momento. Nada de fórmula pronta.',
  whatsapp:   '',                 // ex.: 5511999999999
  instagram:  '',
  pix:        '',                 // chave PIX
  pixNome:    '',                 // nome do titular da chave
  email:      '',
  adminPass:  'dani123',
  planos:     PLANOS_PADRAO
};

function dbVazio(){
  // `removidos` guarda os ids do que foi excluído de propósito. Sem isso, um
  // registro apagado num aparelho voltaria ao sincronizar com outro.
  return { settings: structuredClone(SETTINGS_PADRAO), orders: [], anamneses: [], removidos: [] };
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
  base.removidos = Array.isArray(raw.removidos) ? raw.removidos : [];
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
  base.removidos = [...new Set([...(base.removidos || []), ...(local.removidos || [])])];
  const apagado = new Set(base.removidos);
  base.orders    = mesclarListas(base.orders,    local.orders    || []).filter(o => !apagado.has(o.id));
  base.anamneses = mesclarListas(base.anamneses, local.anamneses || []).filter(a => !apagado.has(a.id));
  return base;
}

/* Exclui de vez uma anamnese: some da lista e o pedido volta a poder ser respondido. */
function excluirAnamnese(db, anamneseId){
  const a = db.anamneses.find(x => x.id === anamneseId);
  if(!a) return false;
  db.anamneses = db.anamneses.filter(x => x.id !== anamneseId);
  const pedido = db.orders.find(o => o.id === a.orderId);
  if(pedido) pedido.anamneseId = null;
  db.removidos.push(anamneseId);
  return true;
}

/* Exclui um pedido e, junto, a anamnese que pertencia a ele. */
function excluirPedido(db, orderId){
  const o = db.orders.find(x => x.id === orderId);
  if(!o) return false;
  db.anamneses.filter(a => a.orderId === orderId).forEach(a => db.removidos.push(a.id));
  db.anamneses = db.anamneses.filter(a => a.orderId !== orderId);
  db.orders = db.orders.filter(x => x.id !== orderId);
  db.removidos.push(orderId);
  return true;
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

  // durante o quiz o menu só distrai: fica a marca e o caminho de volta
  if(ativo === 'foco'){
    el.classList.add('header-foco');
    el.innerHTML = `
      <a class="logo" href="index.html">
        <img src="marca/simbolo.svg" alt="">
        <span>${esc(s.marca || 'Dani Minuto')}</span>
      </a>
      <a class="voltar-area" href="area.html">Minha área</a>`;
    return;
  }

  el.innerHTML = `
    <a class="logo" href="index.html">
      <img src="marca/simbolo.svg" alt="">
      <span>${esc(s.marca || 'Dani Minuto')}</span>
    </a>
    <nav class="nav">
      <a href="index.html#planos" class="${ativo === 'planos' ? 'on' : ''}">Planos</a>
      <a href="index.html#como" class="${ativo === 'como' ? 'on' : ''}">Como funciona</a>
      <a href="index.html#duvidas">Dúvidas</a>
      <a href="area.html" class="nav-cta ${ativo === 'area' ? 'on' : ''}">Área da cliente</a>
    </nav>`;
}

/* Revela elementos conforme entram na tela. Quem pediu menos movimento
   recebe tudo já visível — a página nunca depende da animação para ler. */
function ativarRevelacao(){
  const alvos = $$('[data-revelar]');
  if(!alvos.length) return;
  const parado = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(parado || !('IntersectionObserver' in window)){
    alvos.forEach(el => el.classList.add('visivel'));
    return;
  }
  const obs = new IntersectionObserver((entradas) => {
    entradas.forEach(e => {
      if(!e.isIntersecting) return;
      e.target.classList.add('visivel');
      obs.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: .12 });
  alvos.forEach(el => obs.observe(el));
}

/* O cabeçalho ganha sombra quando a página sai do topo. */
function ativarCabecalhoDinamico(){
  const el = $('#siteHeader');
  if(!el) return;
  const marcar = () => el.classList.toggle('rolado', window.scrollY > 12);
  marcar();
  addEventListener('scroll', marcar, { passive: true });
}

function montarFooter(){
  const el = $('#siteFooter');
  if(!el) return;
  const s = DB.settings;
  const redes = [];
  if(s.instagram) redes.push(`<a href="https://instagram.com/${esc(String(s.instagram).replace('@',''))}" target="_blank" rel="noopener">@${esc(String(s.instagram).replace('@',''))}</a>`);
  if(onlyDigits(s.whatsapp)) redes.push(`<a href="${linkWhats('Oi! Vim pelo site.')}" target="_blank" rel="noopener">WhatsApp</a>`);
  if(s.email) redes.push(`<a href="mailto:${esc(s.email)}">${esc(s.email)}</a>`);
  el.innerHTML = `
    <div class="foot-in">
      <div>
        <strong>${esc(s.marca || 'Dani Minuto')}</strong>
        <p class="tiny">${esc(s.assinatura || 'A ponte entre os mundos')} · consultoria de skin care personalizada.<br>
        Conteúdo educativo — não substitui consulta, diagnóstico ou prescrição médica.</p>
      </div>
      <div class="foot-links">${redes.join('')}</div>
    </div>
    <div class="foot-bottom tiny">© ${new Date().getFullYear()} ${esc(s.marca || '')} — todos os direitos reservados · <a href="admin.html">Acesso da Dani</a></div>`;
}

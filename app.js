/* =========================================================
   ESTILO & CIA — Sistema (ERP / PDV)
   Puro HTML/CSS/JS. Estado em localStorage sincronizado
   com Supabase (estado inteiro num JSON).
   ========================================================= */

/* ---------- Supabase ---------- */
/* Versão do app. Aparece no rodapé do menu lateral e deve bater com o
   ?v= das tags <script>/<link> do index.html — serve para confirmar num
   piscar de olhos se o navegador está rodando o código mais recente ou
   uma cópia antiga em cache. Ao mudar, atualize os dois lugares. */
const APP_VERSION = "19";

const SUPABASE_URL = "https://sjuvryprgbkrbzkvnnhw.supabase.co";
const SUPABASE_KEY = "sb_publishable_8uMMZINGFWPcXmwQGevnBQ_ksULyUau";
const SUPABASE_TABLE = "loja_roupas_db";
const STORAGE_KEY = "estiloCiaDB";
const LOCAL_TS_KEY = "estiloCiaDB_ts";
const SESSION_KEY = "estiloCiaSession";

let DB = null;
let SESSION = null;
let currentRoute = "pdv"; // quem abre o sistema na loja quer vender
let pushTimer = null;

/* ---------- Util ---------- */
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function money(v){ return (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function todayISO(){ return new Date().toISOString(); }
function dateBR(iso){ if(!iso) return '-'; const d=new Date(iso); return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); }
function monthKey(d=new Date()){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
function monthLabel(mk){ const [y,m]=mk.split('-'); const names=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']; return names[Number(m)-1]+'/'+y; }
function escapeHtml(s){ return String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
/* A aparência do aviso vive no style.css (#toast). Antes ele era desenhado
   aqui com estilo embutido e só ficava transparente ao sumir: continuava
   por cima da tela roubando o toque. No celular ele cobria justamente as
   formas de pagamento e o Finalizar venda. Agora só recebe toque enquanto
   for clicável, e some de vez. */
function escondeToast(t){
  t.classList.add('sumindo');
  t.classList.remove('clicavel');
  t.onclick = null;
}
function toast(msg, type='ok', onClick){
  let t = document.getElementById('toast');
  if(!t){ t=document.createElement('div'); t.id='toast'; document.body.appendChild(t); }
  t.style.background = type==='error' ? '#B33A3A' : (type==='warn' ? '#C1874F' : '#4C8B5C');
  t.textContent = msg;
  t.classList.remove('sumindo');
  t.classList.toggle('clicavel', !!onClick);
  t.onclick = onClick ? ()=>{ escondeToast(t); onClick(); } : null;
  clearTimeout(t._h);
  t._h = setTimeout(()=>escondeToast(t), onClick?4000:2200);
}

/* ---------- DB default schema ---------- */
function defaultDB(){
  return {
    storeName: "Estilo Fashion",
    config: {
      minStock: 5,
      whatsapp: "",
      pixKey: "",
      address: "",
      heroPhrase: "Moda que realça quem você é ✨"
    },
    users: [
      { id: uid(), user:'admin', pass:'1234', role:'admin', name:'Administrador' }
    ],
    products: [],
    customers: [],
    sales: [],
    cashRegister: { open:false, openedAt:null, openingAmount:0, movements:[], closedHistory:[] },
    finance: { entries:[] },
    storeSetup: { items:[] },
    monthlyExpenses: {
      categories: ["Aluguel","Água","Luz","Internet","Telefone","Manutenção","Salários e encargos","Contador","Segurança/Alarme","Embalagens","Marketing","IPTU","Taxas de maquininha","Limpeza","Outros"],
      records: [],
      /* Despesas que se repetem todo mês (aluguel, luz, internet…).
         Cadastradas uma vez e lançadas no mês com um clique, em vez de
         digitar as mesmas linhas de novo a cada 30 dias. */
      fixed: []
    },
    barcodeSeq: 0
  };
}

/* ---------- Seed único: custos de abertura trazidos do sistema antigo ---------- */
function seedInitialData(){
  if(DB.seedV1AbrirLoja) return;
  const items = [
    ['Compra do Ponto','Ponto/Aluguel',6000.00],
    ['Aluguel','Ponto/Aluguel',1410.00],
    ['Compra da porta de vidro','Material para reforma',2500.00],
    ['Hospedagem do sistema','Outros',67.00],
    ['Tinta stand 20L rende muito coral','Material para reforma',404.15],
    ['Massa corrida coral Bd 25kg','Material para reforma',95.64],
    ['Soleira para porta de entrada e soleira do wc','Material para reforma',300.00],
    ['Lâmpada filamento 2 und','Material para reforma',66.00],
    ['Trilho eletrificado 6und','Material para reforma',48.00],
    ['Corda transada 2und','Material para reforma',62.00],
    ['Luminária led spot 18 und','Material para reforma',288.00],
    ['Tapete porta de entrada','Outros',20.00],
    ['Luminária ventilador','Outros',58.00],
    ['Camera inteligente Wi-Fi','Equipamentos',182.00],
    ['Cabide','Móveis e araras',80.00],
    ['Tapete para fotografia','Marketing/Fachada',35.00],
    ['Cortinas para provador','Outros',32.94],
    ['Caixa de luz 4x4,4x2,Argamassa, conduíte, gesso, rejunte','Material para reforma',155.17],
    ['Conduíte, caixa de luz 4x4','Material para reforma',53.57],
    ['Fachada em acm + Logotipo','Marketing/Fachada',2500.00],
    ['Gesso liso é conduíte','Material para reforma',26.40],
    ['Material para limpeza','Material para reforma',67.50],
    ['Espelho para provador','Marketing/Fachada',420.00],
    ['Alteração do CNPJ','Documentação/Alvará',150.00],
    ['Compra de araras','Móveis e araras',1300.00],
    ['Compra de cabide','Outros',400.00],
    ['Balizador de piso Conduíte e conector','Material para reforma',130.00],
    ['Embalagens','Marketing/Fachada',337.15],
    ['Manequim','Móveis e araras',1400.00],
    ['Drywall Material é Mão de Obra','Mão de obra',900.00],
    ['Lâmpada para degrau + conduíte','Material para reforma',130.00],
    ['Verniz para pintar porta de Aço Fundo preparador ,Fita crepe, Gesso liso, Lona plástica,palha de Aço e Tinner','Material para reforma',390.00],
    ['Gesso liso e Conduíte','Material para reforma',51.80],
    ['Areia, cimento, tijolo comum e lixa','Material para reforma',95.08],
    ['Mão de obra de Pintor','Mão de obra',300.00],
    ['Leitor de código de barras','Equipamentos',169.90],
    ['Compra de mercadoria','Estoque inicial',5000.00],
  ];
  items.forEach(([name,category,value])=>{
    DB.storeSetup.items.push({ id: uid(), category, name, planned: value, paid: value });
  });
  DB.seedV1AbrirLoja = true;
}

/* ---------- Load / Save ---------- */
/* Repara e normaliza o formato dos dados.
   Bancos vindos do sistema antigo (ou de versões anteriores) podem ter
   produtos sem a lista de variações, ou com os nomes de campo antigos
   (`bar` em vez de `barcode`, `loja` em vez de `showInStore`). Sem isso,
   qualquer tela que percorre `p.variations` estoura e fica em branco. */
/* Devolve true quando precisou reparar algo — o chamador grava o reparo,
   senão os ids inventados aqui se perdem e mudam a cada carregamento,
   deixando os botões de Editar e Excluir apontando para ids que não
   existem mais. */
function normalizeDB(){
  const arr = v => Array.isArray(v) ? v : [];
  const num = v => Number(v) || 0;
  let reparou = false;
  const novoId = () => { reparou = true; return uid(); };

  DB.products = arr(DB.products).filter(Boolean).map(p=>({
    ...p,
    id: p.id || novoId(),
    name: p.name || 'Produto sem nome',
    sku: p.sku || '',
    category: p.category || '',
    brand: p.brand || '',
    cost: num(p.cost),
    price: num(p.price),
    photo: p.photo || '',
    description: p.description || '',
    // `loja` era o nome antigo do "mostrar na loja virtual"
    showInStore: p.showInStore !== undefined ? p.showInStore !== false : p.loja !== false,
    isNew: !!p.isNew,
    variations: (()=>{
      const vs = arr(p.variations).filter(Boolean).map(v=>({
        ...v,
        size: v.size || '',
        color: v.color || '',
        stock: num(v.stock),
        // `bar` era o nome antigo do código de barras
        barcode: v.barcode || v.bar || ''
      }));
      // Um produto sem variação some do Estoque, do PDV e das Etiquetas,
      // que são montados a partir delas. Garante a variação padrão.
      if(vs.length) return vs;
      reparou = true;
      return [{ size:'Único', color:'Padrão', stock:0, barcode:'' }];
    })()
  }));

  DB.customers = arr(DB.customers).filter(Boolean).map(c=>({ ...c, id: c.id || novoId(), name: c.name || 'Cliente' }));

  DB.sales = arr(DB.sales).filter(Boolean).map(s=>({
    ...s,
    id: s.id || novoId(),
    date: s.date || todayISO(),
    items: arr(s.items).filter(Boolean).map(i=>({ ...i, qty: num(i.qty), price: num(i.price) })),
    discount: num(s.discount),
    total: num(s.total),
    payment: s.payment || 'Dinheiro',
    seller: s.seller || '-',
    // `origem` era o nome antigo de `origin`
    origin: s.origin || s.origem || 'pdv',
    canceled: !!s.canceled
  }));

  if(!DB.finance || typeof DB.finance !== 'object') DB.finance = { entries: [] };
  DB.finance.entries = arr(DB.finance.entries).filter(Boolean).map(e=>({ ...e, id: e.id || novoId(), amount: num(e.amount) }));

  if(!DB.storeSetup || typeof DB.storeSetup !== 'object') DB.storeSetup = { items: [] };
  DB.storeSetup.items = arr(DB.storeSetup.items).filter(Boolean).map(i=>({ ...i, id: i.id || novoId(), planned: num(i.planned), paid: num(i.paid) }));

  if(!DB.cashRegister || typeof DB.cashRegister !== 'object') DB.cashRegister = defaultDB().cashRegister;
  DB.cashRegister.movements = arr(DB.cashRegister.movements);
  DB.cashRegister.closedHistory = arr(DB.cashRegister.closedHistory);

  if(!DB.monthlyExpenses || typeof DB.monthlyExpenses !== 'object') DB.monthlyExpenses = defaultDB().monthlyExpenses;
  if(!Array.isArray(DB.monthlyExpenses.fixed)) DB.monthlyExpenses.fixed = [];
  DB.monthlyExpenses.fixed = DB.monthlyExpenses.fixed.filter(Boolean).map(f=>({
    ...f, id: f.id || novoId(), category: f.category || 'Outros',
    note: f.note || '', amount: num(f.amount), dueDay: num(f.dueDay) || 0
  }));

  DB.users = arr(DB.users).filter(Boolean).map(u=>({
    ...u, id: u.id || novoId(), user: (u.user||'').trim(), pass: u.pass==null ? '' : String(u.pass)
  })).filter(u=>u.user);
  /* A loja não pode ficar sem administrador. Se o único admin foi apagado,
     renomeado ou só sobrou vendedora, ninguém mais entra no sistema e não
     há tela para consertar isso. Nesses casos o admin padrão volta, sem
     mexer em quem já existe. */
  if(!DB.users.some(u=>u.role==='admin')){
    DB.users.push(defaultDB().users[0]);
    reparou = true;
  }

  return reparou;
}

function migrateDB(){
  // garante campos novos em bancos antigos, sem tocar no localStorage
  const d = defaultDB();
  for(const k in d){ if(!(k in DB)) DB[k] = d[k]; }
  if(!DB.monthlyExpenses) DB.monthlyExpenses = d.monthlyExpenses;
  if(!DB.monthlyExpenses.categories) DB.monthlyExpenses.categories = d.monthlyExpenses.categories;
  if(!Array.isArray(DB.monthlyExpenses.records)) DB.monthlyExpenses.records = [];
  if(!DB.config || typeof DB.config !== 'object') DB.config = d.config;
  if(!DB.storeName) DB.storeName = d.storeName;
  // Renome da marca: quem já usava o sistema tem o nome antigo gravado no
  // banco e continuaria vendo "Estilo & Cia" na tela. Só troca quando é o
  // nome padrão antigo — um nome escolhido pela loja é preservado.
  let renomeou = false;
  if(DB.storeName === 'Estilo & Cia'){ DB.storeName = d.storeName; renomeou = true; }
  if(DB.config && DB.config.heroPhrase === 'Estilo que é só seu ✨'){
    DB.config.heroPhrase = d.config.heroPhrase; renomeou = true;
  }
  const reparou = normalizeDB() || renomeou;
  if(!DB.barcodeSeq) DB.barcodeSeq = 0;
  seedInitialData();
  // Grava o reparo: sem isso os ids recém-criados só existem em memória e
  // mudam a cada carregamento, e os botões de Editar/Excluir passam a
  // apontar para registros que não existem mais.
  if(reparou) saveDB();
}
function loadDB(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    DB = raw ? JSON.parse(raw) : defaultDB();
  }catch(e){ DB = defaultDB(); }
  migrateDB();
}

/* ---------- Código de barras interno (gerado pela loja) ---------- */
function nextBarcodeCode(){
  DB.barcodeSeq = (DB.barcodeSeq||0) + 1;
  return 'EC' + String(DB.barcodeSeq).padStart(6,'0');
}
function allBarcodes(){
  const set = new Set();
  DB.products.forEach(p=>p.variations.forEach(v=>{ if(v.barcode) set.add(v.barcode); }));
  return set;
}
function generateUniqueBarcode(){
  const used = allBarcodes();
  let code = nextBarcodeCode();
  while(used.has(code)) code = nextBarcodeCode();
  return code;
}

/* Antes isto gravava sem rede de proteção. Quando o armazenamento do
   navegador enchia (bastavam ~56 peças com foto), o setItem estourava no
   meio de uma venda: o recibo não saía, o estoque não baixava e a venda
   sumia — o caixa só via um erro em inglês. Agora a gravação avisa se deu
   certo, tenta liberar espaço sozinha e nunca deixa o sistema dizer que
   salvou quando não salvou. */
function saveDB(skipCloud){
  const gravou = gravarLocal();
  if(!skipCloud){
    clearTimeout(pushTimer);
    pushTimer = setTimeout(cloudPush, 800);
  }
  return gravou;
}

function gravarLocal(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
    localStorage.setItem(LOCAL_TS_KEY, String(Date.now()));
    return true;
  }catch(err){
    if(!ehErroDeEspaco(err)){ console.error('Erro ao gravar:', err); return false; }
    /* Sem espaço. O que ocupa lugar são as fotos antigas guardadas dentro
       do próprio banco; elas já estão (ou vão) na nuvem, então podem sair
       daqui para a venda caber. */
    const liberou = liberarEspacoDeFotos();
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
      localStorage.setItem(LOCAL_TS_KEY, String(Date.now()));
      if(liberou) toast('Espaço do aparelho estava cheio: as fotos foram movidas para a nuvem.','warn');
      return true;
    }catch(err2){
      console.error('Sem espaço mesmo depois de liberar:', err2);
      return false;
    }
  }
}

function ehErroDeEspaco(err){
  return err && (err.name==='QuotaExceededError'
    || err.name==='NS_ERROR_DOM_QUOTA_REACHED'
    || err.code===22 || err.code===1014);
}

/* Tira do armazenamento local as fotos que estão embutidas em texto
   (as antigas, em base64). A foto não some da peça: fica marcada como
   pendente e sobe para a nuvem na primeira oportunidade. */
function liberarEspacoDeFotos(){
  let mexeu = false;
  DB.products.forEach(p=>{
    if(p.photo && p.photo.startsWith('data:')){
      fotosPendentes.set(p.id, p.photo);
      p.photo = '';
      p.photoPendente = true;
      mexeu = true;
    }
  });
  if(mexeu) enviarFotosPendentes();
  return mexeu;
}

/* Chame quando o sistema for dizer "pronto, salvo". Se a gravação falhou,
   o usuário precisa saber na hora, e não descobrir ao recarregar a página. */
function exigirGravacao(oQue){
  if(saveDB()) return true;
  alert('ATENÇÃO: não foi possível salvar ' + oQue + '.\n\n'
      + 'O armazenamento deste aparelho está cheio. Anote esta operação, '
      + 'libere espaço (apague fotos de peças antigas em Produtos) e refaça.\n\n'
      + 'Nada foi perdido do que já estava salvo.');
  return false;
}

/* ---------- Supabase sync ---------- */
async function cloudPull(){
  try{
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?id=eq.main&select=data,updated_at`, {
      headers:{ apikey:SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}` }
    });
    if(!res.ok) return;
    const rows = await res.json();
    if(rows && rows[0] && rows[0].data){
      const cloudTs = rows[0].updated_at ? new Date(rows[0].updated_at).getTime() : 0;
      const localTs = Number(localStorage.getItem(LOCAL_TS_KEY)) || 0;
      if(cloudTs <= localTs) return; // dados locais estão iguais ou mais novos: não sobrescreve
      DB = rows[0].data;
      migrateDB(); // preenche campos novos sem sobrescrever com o localStorage
      saveDB(true);
      if(document.getElementById('app') && !document.getElementById('app').classList.contains('hidden')){ renderShell(); navigate(currentRoute); }
    }
  }catch(e){ /* offline: segue com dados locais */ }
}

async function cloudPush(){
  try{
    await fetch(`${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}`, {
      method:'POST',
      headers:{
        apikey:SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}`,
        'Content-Type':'application/json',
        'Prefer':'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({ id:'main', data: DB, updated_at: todayISO() })
    });
  }catch(e){ /* offline: tenta na próxima alteração */ }
}

/* =========================================================
   FOTOS NA NUVEM (Supabase Storage)
   A foto não fica mais dentro do banco. O banco guarda só o endereço
   dela, que ocupa ~80 bytes no lugar de ~90 KB. Assim o armazenamento do
   aparelho não enche, e cada venda deixa de reenviar todas as fotos.
   ========================================================= */
const SUPABASE_BUCKET = "fotos";

/* Fotos que ainda não subiram (sem internet, ou vindas do formato antigo).
   Ficam aqui na memória e são reenviadas sozinhas. */
const fotosPendentes = new Map();
let enviandoFotos = false;

function urlDaFoto(caminho){
  return `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/${caminho}`;
}

/* Sobe uma foto e devolve o endereço público. Lança erro se não conseguir,
   para quem chamou poder avisar ou tentar de novo. */
async function subirFoto(dataUrl, nomeBase){
  const bin = await (await fetch(dataUrl)).blob();
  const caminho = `${nomeBase}-${Date.now()}.jpg`;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${caminho}`, {
    method:'POST',
    headers:{ apikey:SUPABASE_KEY, Authorization:`Bearer ${SUPABASE_KEY}`,
              'Content-Type':'image/jpeg', 'x-upsert':'true' },
    body: bin
  });
  if(!res.ok){
    /* 404 aqui quase sempre quer dizer que a pasta de fotos ainda não foi
       criada no Supabase — dizer "sem internet" nesse caso seria mentira e
       faria o lojista procurar o problema no lugar errado. */
    const err = new Error('Storage respondeu ' + res.status);
    err.motivo = (res.status===404 || res.status===400) ? 'bucket'
               : (res.status===401 || res.status===403) ? 'permissao' : 'rede';
    throw err;
  }
  return urlDaFoto(caminho);
}

/* Reenvia em segundo plano o que ficou pendente. Uma de cada vez, para não
   travar o caixa, e sem apagar nada enquanto não confirmar o envio. */
async function enviarFotosPendentes(){
  if(enviandoFotos || !fotosPendentes.size) return;
  enviandoFotos = true;
  try{
    for(const [pid, dataUrl] of [...fotosPendentes]){
      const prod = DB.products.find(x=>x.id===pid);
      if(!prod){ fotosPendentes.delete(pid); continue; }
      try{
        prod.photo = await subirFoto(dataUrl, pid);
        delete prod.photoPendente;
        fotosPendentes.delete(pid);
        saveDB();
        if(currentRoute==='produtos') renderProdutosTable();
      }catch(e){
        break; // sem internet: para aqui e tenta de novo mais tarde
      }
    }
  } finally { enviandoFotos = false; }
}

/* Fotos do formato antigo (embutidas no banco) sobem para a nuvem sozinhas
   na primeira vez que o sistema abre com internet, liberando o espaço. */
function migrarFotosAntigas(){
  DB.products.forEach(p=>{
    if(p.photo && p.photo.startsWith('data:')) fotosPendentes.set(p.id, p.photo);
  });
  if(fotosPendentes.size) enviarFotosPendentes();
}

/* =========================================================
   BARCODE SCANNER (câmera) — usado em PDV, Estoque, Produtos
   ========================================================= */
function openScanner(onDetect){
  const supported = 'BarcodeDetector' in window;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:420px;text-align:center">
      <h2>📷 Ler código de barras</h2>
      ${supported ? `<video id="scanVideo" autoplay playsinline style="width:100%;border-radius:10px;background:#000;max-height:320px"></video>
      <p class="text-muted" style="margin-top:10px;font-size:12px">Aponte a câmera para o código de barras</p>` :
      `<p class="text-muted" style="margin:10px 0">Câmera não suportada neste navegador. Digite o código manualmente:</p>`}
      <div class="field" style="margin-top:14px;text-align:left">
        <label>Código manual</label>
        <input id="scanManual" placeholder="Digite ou bipe o código" autofocus>
      </div>
      <div class="modal-actions">
        <button class="btn" id="scanCancel">Cancelar</button>
        <button class="btn btn-accent" id="scanUseManual">Usar código digitado</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  let stream=null, detectorLoop=null;

  function close(){
    if(stream) stream.getTracks().forEach(t=>t.stop());
    if(detectorLoop) clearInterval(detectorLoop);
    overlay.remove();
  }
  overlay.querySelector('#scanCancel').onclick = close;
  overlay.querySelector('#scanUseManual').onclick = ()=>{
    const v = overlay.querySelector('#scanManual').value.trim();
    if(v){ onDetect(v); close(); }
  };
  overlay.querySelector('#scanManual').addEventListener('keydown', e=>{
    if(e.key==='Enter'){ const v=e.target.value.trim(); if(v){ onDetect(v); close(); } }
  });

  if(supported){
    navigator.mediaDevices.getUserMedia({ video:{ facingMode:'environment' } }).then(s=>{
      stream = s;
      const video = overlay.querySelector('#scanVideo');
      video.srcObject = s;
      const detector = new BarcodeDetector({ formats:['ean_13','ean_8','code_128','code_39','upc_a','upc_e'] });
      detectorLoop = setInterval(async ()=>{
        try{
          const codes = await detector.detect(video);
          if(codes && codes[0]){ onDetect(codes[0].rawValue); close(); }
        }catch(e){}
      }, 400);
    }).catch(()=>{ /* sem permissão de câmera: segue com input manual */ });
  }
}

/* =========================================================
   AUTH
   ========================================================= */
function tryLogin(user, pass){
  const u = DB.users.find(x=>x.user===user && x.pass===pass);
  if(u){
    SESSION = { id:u.id, user:u.user, name:u.name||u.user, role:u.role };
    localStorage.setItem(SESSION_KEY, JSON.stringify(SESSION));
    return true;
  }
  return false;
}
/* A dica embaixo do botão era o texto fixo "admin / 1234". Quando o lojista
   troca a senha ou renomeia o usuário, ela passa a mentir — foi o que
   aconteceu na loja. Agora ela lê o banco: só mostra a senha enquanto ela
   ainda for a de fábrica. */
function atualizaDicaLogin(){
  const el = document.getElementById('loginHint');
  if(!el) return;
  const admins = DB.users.filter(u=>u.role==='admin');
  const padrao = admins.find(u=>u.user==='admin' && u.pass==='1234');
  el.textContent = padrao ? 'admin / 1234'
    : 'Entre como: ' + (admins.map(u=>u.user).join(' ou ') || 'admin');
}

/* Caminho de volta para quem perdeu a senha. Sem isso a loja fica trancada
   para fora do próprio sistema e não existe tela nenhuma para consertar.
   Não é um cofre: as senhas ficam salvas em texto puro neste aparelho, então
   quem já está com o celular na mão consegue lê-las de qualquer jeito. */
function recuperarAcesso(){
  const admins = DB.users.filter(u=>u.role==='admin').map(u=>u.user).join(', ');
  const ok = confirm(
    'Recuperar o acesso de administrador?\n\n' +
    'Administradores neste sistema: ' + (admins||'nenhum') + '\n\n' +
    'Vamos restaurar o login admin com a senha 1234. Nenhum produto, venda ou ' +
    'gasto é apagado, e os outros usuários continuam como estão.\n\n' +
    'Troque a senha depois em Configurações.'
  );
  if(!ok) return;
  const admin = DB.users.find(u=>u.user==='admin');
  if(admin){ admin.pass='1234'; admin.role='admin'; }
  else DB.users.push({ id:uid(), user:'admin', pass:'1234', role:'admin', name:'Administrador' });
  saveDB();
  atualizaDicaLogin();
  document.getElementById('loginError').textContent = '';
  document.getElementById('loginUser').value = 'admin';
  document.getElementById('loginPass').value = '';
  document.getElementById('loginPass').focus();
  toast('Acesso restaurado. Entre com admin / 1234 e troque a senha em Configurações.','warn');
}

function logout(){
  SESSION = null;
  localStorage.removeItem(SESSION_KEY);
  showLogin();
}
function restoreSession(){
  try{ SESSION = JSON.parse(localStorage.getItem(SESSION_KEY)); }catch(e){ SESSION=null; }
}

/* =========================================================
   SHELL / ROUTER
   ========================================================= */
/* O menu é separado pelo uso: em cima o que a loja abre todo dia, embaixo
   o que se mexe de vez em quando. Nada foi removido — só deixou de
   competir por atenção com o balcão. */
const NAV = [
  { id:'pdv', label:'Vender (PDV)', icon:'🛒', group:'dia' },
  { id:'produtos', label:'Produtos', icon:'👗', group:'dia' },
  { id:'estoque', label:'Estoque', icon:'📦', group:'dia' },
  { id:'vendas', label:'Vendas', icon:'🧾', group:'dia' },

  { id:'painel', label:'Painel', icon:'🏠', group:'gestao' },
  { id:'balanco', label:'Balanço', icon:'💵', group:'gestao' },
  { id:'caixa', label:'Caixa', icon:'💰', group:'gestao' },
  { id:'etiquetas', label:'Etiquetas', icon:'🏷️', group:'gestao' },
  { id:'clientes', label:'Clientes', icon:'👤', group:'gestao' },
  { id:'financeiro', label:'Financeiro', icon:'📊', group:'gestao' },
  { id:'gastos', label:'Gastos Mensais', icon:'🧮', group:'gestao' },
  { id:'abrirloja', label:'Abrir Loja', icon:'🏗️', group:'gestao' },
  { id:'relatorios', label:'Relatórios', icon:'📈', group:'gestao' },
  { id:'config', label:'Configurações', icon:'⚙️', group:'gestao' },
];

function showLogin(){
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}
function showApp(){
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  renderShell();
  navigate(currentRoute);
}

function renderShell(){
  document.getElementById('sidebarStoreName').textContent = DB.storeName;
  document.getElementById('userPill').textContent = `${SESSION.name} · ${SESSION.role==='admin'?'Admin':'Vendedor(a)'}`;
  const navEl = document.getElementById('navList');
  const item = n => `<li><a href="#${n.id}" data-route="${n.id}">${n.icon} ${n.label}</a></li>`;
  navEl.innerHTML =
      NAV.filter(n=>n.group==='dia').map(item).join('')
    + `<li class="nav-sep">Gerenciar</li>`
    + NAV.filter(n=>n.group==='gestao').map(item).join('');
  const ver = document.getElementById('appVersion');
  if(ver) ver.textContent = 'versão '+APP_VERSION;
}
function toggleSidebar(){
  document.getElementById('sidebar')?.classList.toggle('open');
  document.getElementById('sidebarBackdrop')?.classList.toggle('open');
}
function closeSidebar(){
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebarBackdrop')?.classList.remove('open');
}

function navigate(route){
  currentRoute = route;
  location.hash = route;
  document.querySelectorAll('.nav-list a').forEach(a=>a.classList.toggle('active', a.dataset.route===route));
  const title = NAV.find(n=>n.id===route)?.label || '';
  document.getElementById('viewTitle').textContent = title;
  const view = document.getElementById('view');
  const renderers = {
    painel: renderPainel, pdv: renderPDV, produtos: renderProdutos, estoque: renderEstoque,
    etiquetas: renderEtiquetas, clientes: renderClientes, vendas: renderVendas, caixa: renderCaixa,
    financeiro: renderFinanceiro, gastos: renderGastos, abrirloja: renderAbrirLoja,
    relatorios: renderRelatorios, config: renderConfig, balanco: renderBalanco
  };
  view.innerHTML = '';
  try{
    (renderers[route]||renderPainel)(view);
  }catch(err){
    // Uma tela em branco não diz nada a quem está usando: mostra o que houve
    // e oferece o reparo, em vez de engolir o erro.
    console.error('Erro ao abrir a tela "'+route+'":', err);
    view.innerHTML = `<div class="panel">
      <h3 style="color:var(--danger)">Não foi possível carregar esta tela</h3>
      <p class="text-muted" style="margin-bottom:14px">Detalhe técnico: ${escapeHtml(err.message)}</p>
      <button class="btn btn-accent" onclick="repairAndReload()">Reparar dados e recarregar</button>
    </div>`;
  }
}

/* Reparo manual: renormaliza o banco local e recarrega a tela. */
function repairAndReload(){
  try{
    normalizeDB();
    saveDB();
    toast('Dados reparados');
    navigate(currentRoute);
  }catch(err){
    toast('Falha ao reparar: '+err.message, 'error');
  }
}

/* =========================================================
   PAINEL
   ========================================================= */
function renderPainel(el){
  const today = new Date(); today.setHours(0,0,0,0);
  const salesToday = DB.sales.filter(s=>!s.canceled && new Date(s.date)>=today);
  const totalToday = salesToday.reduce((a,s)=>a+s.total,0);
  const lowStock = countLowStock();
  const pendingOnline = DB.sales.filter(s=>s.origin==='loja' && s.status==='pendente').length;
  const mk = monthKey();
  const financeMonth = DB.finance.entries.filter(e=>e.date && e.date.startsWith(mk));
  const receitasMes = financeMonth.filter(e=>e.type==='receita' && e.status==='pago').reduce((a,e)=>a+e.amount,0);
  const despesasMes = financeMonth.filter(e=>e.type==='despesa' && e.status==='pago').reduce((a,e)=>a+e.amount,0);

  el.innerHTML = `
    <div class="cards-row">
      <div class="card"><div class="label">Vendas hoje</div><div class="value">${salesToday.length}</div></div>
      <div class="card"><div class="label">Faturado hoje</div><div class="value">${money(totalToday)}</div></div>
      <div class="card"><div class="label">Estoque baixo</div><div class="value ${lowStock>0?'text-danger':''}">${lowStock}</div></div>
      <div class="card"><div class="label">Pedidos online pendentes</div><div class="value ${pendingOnline>0?'text-danger':''}">${pendingOnline}</div></div>
      <div class="card"><div class="label">Saldo do mês</div><div class="value ${receitasMes-despesasMes>=0?'text-success':'text-danger'}">${money(receitasMes-despesasMes)}</div></div>
    </div>
    <div class="grid-2">
      <div class="panel">
        <h3>Últimas vendas</h3>
        ${lastSalesTable()}
      </div>
      <div class="panel">
        <h3>Produtos com estoque baixo</h3>
        ${lowStockTable()}
      </div>
    </div>`;
}
function countLowStock(){
  let n=0;
  DB.products.forEach(p=>p.variations.forEach(v=>{ if(v.stock<=DB.config.minStock) n++; }));
  return n;
}
function lastSalesTable(){
  const list = [...DB.sales].filter(s=>!s.canceled).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6);
  if(!list.length) return `<div class="empty-state">Nenhuma venda ainda</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Cliente</th><th>Total</th><th>Pagto</th></tr></thead><tbody>
    ${list.map(s=>`<tr><td>${dateBR(s.date)}</td><td>${escapeHtml(customerName(s.customerId))}</td><td>${money(s.total)}</td><td>${s.payment}</td></tr>`).join('')}
  </tbody></table></div>`;
}
function lowStockTable(){
  const rows=[];
  DB.products.forEach(p=>p.variations.forEach(v=>{
    if(v.stock<=DB.config.minStock) rows.push({name:p.name, size:v.size, color:v.color, stock:v.stock});
  }));
  if(!rows.length) return `<div class="empty-state">Tudo certo com o estoque ✅</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Produto</th><th>Var.</th><th>Estoque</th></tr></thead><tbody>
    ${rows.slice(0,8).map(r=>`<tr><td>${escapeHtml(r.name)}</td><td>${escapeHtml(r.size)}/${escapeHtml(r.color)}</td><td class="text-danger">${r.stock}</td></tr>`).join('')}
  </tbody></table></div>`;
}
function customerName(id){ const c=DB.customers.find(x=>x.id===id); return c?c.name:'Consumidor final'; }

/* =========================================================
   PRODUTOS
   ========================================================= */
let prodFilter = '';
function renderProdutos(el){
  el.innerHTML = `
    <div class="toolbar">
      <input id="prodSearch" placeholder="Buscar por nome, SKU ou categoria..." value="${escapeHtml(prodFilter)}">
      <div class="spacer"></div>
      <button class="btn btn-accent" onclick="openProductModal()">+ Novo produto</button>
    </div>
    <div id="prodTableWrap"></div>`;
  el.querySelector('#prodSearch').addEventListener('input', e=>{ prodFilter=e.target.value; renderProdutosTable(); });
  renderProdutosTable();
}
function renderProdutosTable(){
  const wrap = document.getElementById('prodTableWrap');
  if(!wrap) return;
  const f = prodFilter.toLowerCase();
  const list = DB.products.filter(p=> !f || p.name.toLowerCase().includes(f) || (p.sku||'').toLowerCase().includes(f)
    || (p.category||'').toLowerCase().includes(f) || p.variations.some(v=>(v.barcode||'').toLowerCase().includes(f)));
  if(!list.length){ wrap.innerHTML = `<div class="empty-state">Nenhum produto cadastrado</div>`; return; }
  const mostra = t => (!t || t==='Único' || t==='Padrão') ? '-' : escapeHtml(t);
  wrap.innerHTML = `<div class="table-wrap"><table><thead><tr>
    <th>Foto</th><th>Peça</th><th>Cor</th><th>Tam.</th><th>Código de barras</th><th>Preço</th><th>Estoque</th><th></th>
  </tr></thead><tbody>
    ${list.map(p=>{
      const total = p.variations.reduce((a,v)=>a+Number(v.stock||0),0);
      const v0 = p.variations[0] || {};
      const grade = p.variations.length > 1;
      return `<tr>
        <td><img src="${escapeHtml(p.photo||'')}" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'" style="width:40px;height:40px;object-fit:cover;border-radius:6px;background:var(--sand)"></td>
        <td>${escapeHtml(p.name)} ${p.isNew?'<span class="tag-new">NOVO</span>':''}</td>
        <td>${grade ? `<span class="text-muted">${p.variations.length} combinações</span>` : mostra(v0.color)}</td>
        <td>${grade ? '' : mostra(v0.size)}</td>
        <td>${grade ? `<span class="text-muted">${p.variations.length} códigos</span>` : escapeHtml(v0.barcode||'-')}</td>
        <td>${money(p.price)}</td>
        <td class="${total<=DB.config.minStock?'text-danger':''}">${total}</td>
        <td><button class="btn btn-sm" onclick="openProductModal('${p.id}')">Editar</button>
            <button class="btn btn-sm" title="Ir para Etiquetas" onclick="goToLabels('${p.id}')">🏷️</button>
            <button class="btn btn-sm btn-danger" onclick="deleteProduct('${p.id}')">Excluir</button></td>
      </tr>`;
    }).join('')}
  </tbody></table></div>`;
}
/* Lê um arquivo de imagem, redimensiona (maior lado = maxDim) e comprime
   em JPEG, devolvendo uma data URL — assim a foto vai junto no mesmo
   JSON sincronizado com o Supabase, sem precisar de um bucket separado. */
function resizeImageFile(file, maxDim, quality){
  return new Promise((resolve, reject)=>{
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = ev=>{
      const img = new Image();
      img.onerror = reject;
      img.onload = ()=>{
        let w = img.width, h = img.height;
        if(w > h && w > maxDim){ h = Math.round(h*maxDim/w); w = maxDim; }
        else if(h >= w && h > maxDim){ w = Math.round(w*maxDim/h); h = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}
function goToLabels(pid){
  const p = DB.products.find(x=>x.id===pid);
  if(!p) return;
  p.variations.forEach(v=>{ etiquetaQty[varKey(p.id, v.size, v.color)] = v.stock>0 ? v.stock : 1; });
  navigate('etiquetas');
}
function deleteProduct(id){
  if(!confirm('Excluir este produto?')) return;
  const antes = DB.products.length;
  DB.products = DB.products.filter(p=>p.id!==id);
  saveDB(); renderProdutosTable();
  // Dizer "excluído" sem ter excluído nada é o que faz o usuário achar que
  // o botão não funciona. Só confirma quando a lista realmente encolheu.
  if(DB.products.length < antes) toast('Produto excluído');
  else toast('Esse produto não foi encontrado. Atualize a página e tente de novo.','error');
}
function openProductModal(id){
  const editing = id ? DB.products.find(p=>p.id===id) : null;
  const p = editing || { id:uid(), sku:'', name:'', category:'', brand:'', cost:0, price:0, photo:'', description:'', showInStore:true, isNew:false, variations:[{size:'',color:'',stock:0,barcode:''}] };
  const overlay = document.createElement('div');
  overlay.className='modal-overlay';
  // Uma peça é nome + cor + tamanho + quantidade. Só quando a mesma peça
  // tem várias combinações é que o editor de grade entra em cena.
  const temGrade = p.variations.length > 1;
  const v0 = p.variations[0] || { size:'', color:'', stock:0 };
  overlay.innerHTML = `<div class="modal" style="max-width:640px">
    <h2>${editing?'Editar':'Nova'} peça</h2>

    <div class="field"><label>Nome da peça</label>
      <input id="f_name" value="${escapeHtml(p.name)}" placeholder="Ex.: Vestido Floral"></div>

    <div id="pecaSimples" ${temGrade?'style="display:none"':''}>
      <div class="form-grid" style="margin-top:12px">
        <div class="field"><label>Cor</label>
          <input id="f_color" value="${escapeHtml(v0.color==='Padrão'?'':v0.color)}" placeholder="Ex.: Preto"></div>
        <div class="field"><label>Tamanho</label>
          <input id="f_size" value="${escapeHtml(v0.size==='Único'?'':v0.size)}" placeholder="Ex.: M"></div>
        <div class="field"><label>Quantidade</label>
          <input id="f_qty" type="number" inputmode="numeric" value="${v0.stock||0}"></div>
        <div class="field"><label>Quanto você pagou (custo R$)</label>
          <input id="f_cost" type="number" step="0.01" inputmode="decimal" value="${p.cost||''}" placeholder="0,00"></div>
        <div class="field"><label>Por quanto vai vender (R$)</label>
          <input id="f_price" type="number" step="0.01" inputmode="decimal" value="${p.price||''}" placeholder="0,00"></div>
      </div>
      <div id="lucroPeca" class="lucro-box"></div>
      <p class="text-muted" style="font-size:12px;margin-top:8px">O código de barras é gerado automaticamente ao salvar.</p>
    </div>

    <div id="precoGrade" ${temGrade?'':'style="display:none"'} style="margin-top:12px">
      <div class="form-grid">
        <div class="field"><label>Quanto você pagou (custo R$)</label>
          <input id="f_cost_grade" type="number" step="0.01" inputmode="decimal" value="${p.cost||''}" placeholder="0,00"></div>
        <div class="field"><label>Por quanto vai vender (R$)</label>
          <input id="f_price_grade" type="number" step="0.01" inputmode="decimal" value="${p.price||''}" placeholder="0,00"></div>
      </div>
      <div id="lucroPecaGrade" class="lucro-box"></div>
    </div>

    <button class="btn btn-sm" id="toggleMore" type="button" style="margin-top:16px">
      ${temGrade?'▾':'▸'} Mais opções (foto, categoria, mais tamanhos)
    </button>

    <div id="moreOptions" style="${temGrade?'':'display:none'};margin-top:14px;border-top:1px solid var(--border);padding-top:14px">
      <div class="form-grid">
        <div class="field"><label>Categoria</label><input id="f_category" value="${escapeHtml(p.category)}" placeholder="Vestidos, Blusas..."></div>
        <div class="field"><label>SKU</label><input id="f_sku" value="${escapeHtml(p.sku)}"></div>
        <div class="field"><label>Marca</label><input id="f_brand" value="${escapeHtml(p.brand)}"></div>
        <div class="field full">
          <label>Foto do produto</label>
          <input id="f_photo" value="${escapeHtml(p.photo)}" placeholder="Cole uma URL ou envie um arquivo abaixo">
          <div style="display:flex;align-items:center;gap:12px;margin-top:8px">
            <label class="btn btn-sm" style="cursor:pointer;margin:0">📁 Enviar do computador/celular
              <input type="file" id="f_photoFile" accept="image/*" style="display:none">
            </label>
            <img id="f_photoPreview" src="${escapeHtml(p.photo||'')}" style="height:52px;width:52px;object-fit:cover;border-radius:8px;background:var(--sand);${p.photo?'':'display:none'}">
            <span id="f_photoStatus" class="text-muted" style="font-size:12px"></span>
          </div>
        </div>
        <div class="field full"><label>Descrição</label><textarea id="f_desc" rows="2">${escapeHtml(p.description)}</textarea></div>
        <div class="field"><label><input type="checkbox" id="f_show" ${p.showInStore!==false?'checked':''}> Mostrar na loja virtual</label></div>
        <div class="field"><label><input type="checkbox" id="f_new" ${p.isNew?'checked':''}> Selo NOVO</label></div>
      </div>
      <h3 style="margin:18px 0 6px;font-size:14px">Mais tamanhos e cores da mesma peça</h3>
      <p class="text-muted" style="font-size:12px;margin-bottom:10px">Use só se a mesma peça tiver várias combinações. Cada linha vira um código de barras e um estoque próprio.</p>
      <div id="varRows"></div>
      <button class="btn btn-sm" id="addVarBtn" type="button">+ Adicionar tamanho/cor</button>
    </div>

    <div class="modal-actions">
      <button class="btn" id="cancelBtn">Cancelar</button>
      <button class="btn btn-accent" id="saveBtn">Salvar</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#toggleMore').addEventListener('click', e=>{
    const box = overlay.querySelector('#moreOptions');
    const aberto = box.style.display !== 'none';
    box.style.display = aberto ? 'none' : '';
    e.target.textContent = (aberto?'▸':'▾') + ' Mais opções (tamanhos, foto, categoria)';
  });
  overlay.querySelector('#f_photo').addEventListener('input', e=>{
    const preview = overlay.querySelector('#f_photoPreview');
    preview.src = e.target.value; preview.style.display = e.target.value ? '' : 'none';
  });
  overlay.querySelector('#f_photoFile').addEventListener('change', e=>{
    const file = e.target.files[0];
    if(!file) return;
    const status = overlay.querySelector('#f_photoStatus');
    status.textContent = 'Preparando a foto...';
    resizeImageFile(file, 900, 0.75).then(async dataUrl=>{
      const preview = overlay.querySelector('#f_photoPreview');
      preview.src = dataUrl; preview.style.display = '';
      status.textContent = 'Enviando para a nuvem...';
      try{
        /* A foto vai para a nuvem e o banco guarda só o endereço. Guardar a
           imagem inteira aqui dentro é o que enchia o aparelho e fazia o
           sistema perder venda. */
        const url = await subirFoto(dataUrl, p.id);
        overlay.querySelector('#f_photo').value = url;
        status.textContent = 'Foto salva na nuvem ✓';
      }catch(e){
        /* Sem internet agora: a foto fica na fila e sobe sozinha depois.
           A peça pode ser salva normalmente. */
        fotosPendentes.set(p.id, dataUrl);
        overlay.querySelector('#f_photo').value = '';
        overlay.dataset.fotoPendente = '1';
        if(e.motivo === 'bucket'){
          status.textContent = 'A pasta de fotos ainda não existe no Supabase';
          toast('Crie o bucket público "fotos" no Supabase. A peça é salva normalmente e a foto sobe depois.','warn');
        } else if(e.motivo === 'permissao'){
          status.textContent = 'Sem permissão para enviar fotos';
          toast('O bucket "fotos" precisa estar público no Supabase. A foto ficou na fila.','warn');
        } else {
          status.textContent = 'Sem internet: a foto sobe sozinha quando voltar';
          toast('A foto ficou na fila e será enviada quando a internet voltar.','warn');
        }
      }
    }).catch(()=>{ status.textContent=''; toast('Não foi possível ler essa imagem','error'); });
  });
  /* O lojista digita custo e preço e vê na hora quanto sobra na peça.
     Sem isso o custo virava um campo esquecido, e o Balanço mostrava
     lucro maior do que o real. */
  function mostrarLucro(){
    const grade = overlay.querySelector('#precoGrade').style.display !== 'none';
    const custo = Number(overlay.querySelector(grade ? '#f_cost_grade' : '#f_cost').value) || 0;
    const preco = Number(overlay.querySelector(grade ? '#f_price_grade' : '#f_price').value) || 0;
    const caixa = overlay.querySelector(grade ? '#lucroPecaGrade' : '#lucroPeca');
    const outra = overlay.querySelector(grade ? '#lucroPeca' : '#lucroPecaGrade');
    if(outra) outra.innerHTML = '';
    if(!caixa) return;
    if(!preco && !custo){ caixa.innerHTML = ''; return; }
    if(!custo){
      caixa.className = 'lucro-box aviso';
      caixa.innerHTML = 'Preencha o custo para o sistema calcular seu lucro.';
      return;
    }
    if(!preco){ caixa.innerHTML = ''; return; }
    const lucro = preco - custo;
    const margem = Math.round(lucro / preco * 100);
    const markup = Math.round(lucro / custo * 100);
    caixa.className = 'lucro-box ' + (lucro > 0 ? 'bom' : 'ruim');
    caixa.innerHTML = lucro > 0
      ? `<strong>Lucro por peça: ${money(lucro)}</strong>
         <span>margem de ${margem}% sobre a venda · ${markup}% em cima do custo</span>`
      : (lucro === 0
        ? `<strong>Sem lucro nenhum</strong><span>você vende pelo mesmo que pagou</span>`
        : `<strong>Prejuízo de ${money(Math.abs(lucro))} por peça</strong>
           <span>o preço de venda está abaixo do que você pagou</span>`);
  }
  ['#f_cost','#f_price','#f_cost_grade','#f_price_grade'].forEach(sel=>{
    const el = overlay.querySelector(sel);
    if(el) el.addEventListener('input', mostrarLucro);
  });
  mostrarLucro();

  let variations = p.variations.map(v=>({...v}));
  function renderVars(){
    overlay.querySelector('#varRows').innerHTML = variations.map((v,i)=>`
      <div class="variation-row">
        <input placeholder="Tamanho" value="${escapeHtml(v.size)}" data-i="${i}" data-k="size">
        <input placeholder="Cor" value="${escapeHtml(v.color)}" data-i="${i}" data-k="color">
        <input placeholder="Estoque" type="number" value="${v.stock}" data-i="${i}" data-k="stock">
        <input placeholder="Cód. barras" value="${escapeHtml(v.barcode||'')}" data-i="${i}" data-k="barcode">
        <div style="display:flex;gap:4px">
          <button class="btn btn-icon btn-sm" type="button" data-scan="${i}" title="Ler código pela câmera">📷</button>
          <button class="btn btn-icon btn-sm" type="button" data-gen="${i}" title="Gerar código interno">🔢</button>
          <button class="btn btn-icon btn-sm btn-danger" type="button" data-rm="${i}" title="Remover">✕</button>
        </div>
      </div>`).join('');
    overlay.querySelectorAll('#varRows input').forEach(inp=>{
      inp.addEventListener('input', e=>{
        const i=e.target.dataset.i, k=e.target.dataset.k;
        variations[i][k] = k==='stock' ? Number(e.target.value) : e.target.value;
      });
    });
    overlay.querySelectorAll('[data-rm]').forEach(btn=>btn.addEventListener('click', e=>{
      variations.splice(Number(e.target.dataset.rm),1); renderVars();
    }));
    overlay.querySelectorAll('[data-scan]').forEach(btn=>btn.addEventListener('click', e=>{
      const i = Number(e.target.dataset.scan);
      openScanner(code=>{ variations[i].barcode = code; renderVars(); });
    }));
    overlay.querySelectorAll('[data-gen]').forEach(btn=>btn.addEventListener('click', e=>{
      const i = Number(e.target.dataset.gen);
      variations[i].barcode = generateUniqueBarcode(); saveDB(); renderVars();
      toast('Código gerado: '+variations[i].barcode);
    }));
  }
  renderVars();
  overlay.querySelector('#addVarBtn').addEventListener('click', ()=>{ variations.push({size:'',color:'',stock:0,barcode:''}); renderVars(); });
  overlay.querySelector('#cancelBtn').addEventListener('click', ()=>overlay.remove());
  overlay.querySelector('#saveBtn').addEventListener('click', ()=>{
    try{
      const name = overlay.querySelector('#f_name').value.trim();
      if(!name){ toast('Informe o nome do produto','error'); return; }
      const usandoGrade = overlay.querySelector('#pecaSimples').style.display === 'none';
      let finalVariations;
      if(usandoGrade){
        // Peça com várias combinações: cada linha tem seu estoque e código.
        finalVariations = variations.filter(v=>v.size || v.color || v.stock || v.barcode);
      } else {
        // Peça simples: cor, tamanho e quantidade vêm da tela principal.
        const cor = overlay.querySelector('#f_color').value.trim();
        const tam = overlay.querySelector('#f_size').value.trim();
        const qtd = Number(overlay.querySelector('#f_qty').value) || 0;
        const extras = variations.slice(1).filter(v=>v.size || v.color || v.stock || v.barcode);
        finalVariations = [{
          ...(variations[0] || {}),
          size: tam || 'Único',
          color: cor || 'Padrão',
          stock: qtd,
          barcode: (variations[0] && variations[0].barcode) || ''
        }, ...extras];
      }
      // Sem nenhuma variação a peça sumiria do Estoque, do PDV e das
      // Etiquetas, que são montados a partir delas.
      if(!finalVariations.length) finalVariations = [{ size:'Único', color:'Padrão', stock:0, barcode:'' }];
      // Cada peça recebe seu próprio código de barras.
      const novosCodigos = [];
      finalVariations.forEach(v=>{
        if(!v.barcode){ v.barcode = generateUniqueBarcode(); novosCodigos.push(v.barcode); }
      });
      const precoInput = usandoGrade ? overlay.querySelector('#f_price_grade') : overlay.querySelector('#f_price');
      const data = {
        id:p.id, name,
        sku: overlay.querySelector('#f_sku').value.trim(),
        category: overlay.querySelector('#f_category').value.trim(),
        brand: overlay.querySelector('#f_brand').value.trim(),
        cost: Number((usandoGrade ? overlay.querySelector('#f_cost_grade') : overlay.querySelector('#f_cost')).value)||0,
        price: Number(precoInput.value)||0,
        photo: overlay.querySelector('#f_photo').value.trim(),
        photoPendente: overlay.dataset.fotoPendente === '1' ? true : undefined,
        description: overlay.querySelector('#f_desc').value.trim(),
        showInStore: overlay.querySelector('#f_show').checked,
        isNew: overlay.querySelector('#f_new').checked,
        variations: finalVariations
      };
      if(editing){ Object.assign(editing, data); }
      else DB.products.push(data);
      if(!exigirGravacao('esta peça')){
        if(!editing) DB.products.pop();   // não deixa a peça só na tela
        return;
      }
      // vincula com Etiquetas: a etiqueta da variação já fica pronta pra imprimir
      data.variations.forEach(v=>{ etiquetaQty[varKey(data.id, v.size, v.color)] = v.stock>0 ? v.stock : 1; });
      overlay.remove();
      if(!editing){
        // garante que o produto recém-criado apareça, mesmo com um filtro de busca antigo aplicado
        prodFilter = '';
        const searchInput = document.getElementById('prodSearch');
        if(searchInput) searchInput.value = '';
      }
      renderProdutosTable();
      if(fotosPendentes.size) enviarFotosPendentes();
      const codigo = novosCodigos.length === 1 ? ' · código '+novosCodigos[0]
                   : novosCodigos.length > 1 ? ' · '+novosCodigos.length+' códigos gerados' : '';
      if(editing){ toast('Peça salva'+codigo); }
      else toast('Peça salva'+codigo+' — clique para imprimir a etiqueta 🏷️', 'ok', ()=>navigate('etiquetas'));
    }catch(err){
      console.error('Erro ao salvar produto:', err);
      toast('Não foi possível salvar o produto: '+err.message, 'error');
    }
  });
}


/* =========================================================
   BALANÇO — as três perguntas que o lojista faz toda semana:
   quanto tenho parado em estoque, quanto gastei e quanto vendi.
   ========================================================= */
let balancoPeriodo = 'mes';

function periodoBalanco(){
  const hoje = new Date();
  const ano = hoje.getFullYear();
  if(balancoPeriodo === 'mes'){
    const mk = monthKey();
    return { rotulo: monthLabel(mk), casa: d => (d||'').startsWith(mk), mesUnico: mk };
  }
  if(balancoPeriodo === 'mesPassado'){
    const d = new Date(ano, hoje.getMonth()-1, 1);
    const mk = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    return { rotulo: monthLabel(mk), casa: x => (x||'').startsWith(mk), mesUnico: mk };
  }
  if(balancoPeriodo === 'ano'){
    return { rotulo: 'ano de '+ano, casa: x => (x||'').startsWith(String(ano)), mesUnico: null };
  }
  return { rotulo: 'desde o começo', casa: () => true, mesUnico: null };
}

/* Quanto está parado nas araras. Custo é o dinheiro investido; venda é o que
   ele vira se tudo for vendido pelo preço de etiqueta. */
function valorDoEstoque(){
  let pecas = 0, custo = 0, venda = 0, semCusto = 0;
  DB.products.forEach(p => {
    const qtd = p.variations.reduce((a,v) => a + (Number(v.stock)||0), 0);
    if(!qtd) return;
    pecas += qtd;
    custo += qtd * (Number(p.cost)||0);
    venda += qtd * (Number(p.price)||0);
    if(!Number(p.cost)) semCusto += qtd;
  });
  return { pecas, custo, venda, lucroPrevisto: venda - custo, semCusto };
}

/* Quanto entrou. O custo das peças vendidas sai do que foi congelado na
   venda; nas vendas antigas, que não guardavam isso, caímos no custo atual
   da peça — e a tela avisa quando isso acontece. */
function resumoVendas(per){
  const vendas = DB.sales.filter(s => !s.canceled && per.casa(s.date));
  let total = 0, custoVendido = 0, pecas = 0, estimadas = 0;
  vendas.forEach(s => {
    total += Number(s.total)||0;
    s.items.forEach(i => {
      pecas += i.qty;
      if(i.cost === undefined){
        const prod = DB.products.find(x => x.id === i.productId);
        custoVendido += (prod ? Number(prod.cost)||0 : 0) * i.qty;
        estimadas++;
      } else {
        custoVendido += (Number(i.cost)||0) * i.qty;
      }
    });
  });
  return { qtd: vendas.length, total, custoVendido, pecas, estimadas,
           lucroBruto: total - custoVendido,
           ticket: vendas.length ? total/vendas.length : 0 };
}

/* Quanto saiu, juntando os três lugares onde o gasto pode estar. */
function resumoGastos(per){
  const mensais = DB.monthlyExpenses.records
    .filter(r => per.casa(r.month))
    .reduce((a,r) => a + (Number(r.amount)||0), 0);

  const despesas = DB.finance.entries
    .filter(e => e.type === 'despesa' && per.casa(e.date))
    .reduce((a,e) => a + (Number(e.amount)||0), 0);

  /* Abrir a loja foi um gasto de uma vez só, sem data de mês. Entra apenas
     quando se olha "desde o começo", senão ele apareceria repetido todo mês. */
  const abertura = balancoPeriodo === 'tudo'
    ? DB.storeSetup.items.reduce((a,i) => a + (Number(i.paid) || Number(i.planned) || 0), 0)
    : 0;

  return { mensais, despesas, abertura, total: mensais + despesas + abertura };
}

function gastosPorCategoria(per){
  const mapa = {};
  DB.monthlyExpenses.records.filter(r => per.casa(r.month))
    .forEach(r => { mapa[r.category] = (mapa[r.category]||0) + (Number(r.amount)||0); });
  DB.finance.entries.filter(e => e.type === 'despesa' && per.casa(e.date))
    .forEach(e => { const c = e.category || 'Outros';
                    mapa[c] = (mapa[c]||0) + (Number(e.amount)||0); });
  return Object.entries(mapa).sort((a,b) => b[1] - a[1]);
}

function setBalancoPeriodo(v){ balancoPeriodo = v; navigate('balanco'); }

function renderBalanco(el){
  const per = periodoBalanco();
  const est = valorDoEstoque();
  const ven = resumoVendas(per);
  const gas = resumoGastos(per);
  const resultado = ven.total - ven.custoVendido - gas.total;

  const avisos = [];
  if(est.semCusto) avisos.push(`${est.semCusto} peça(s) em estoque estão sem o custo preenchido. Enquanto isso, o lucro aparece maior do que é — preencha o campo <strong>Custo</strong> em Produtos.`);
  if(ven.estimadas) avisos.push(`${ven.estimadas} item(ns) de vendas antigas não guardaram o custo da época; para eles usamos o custo atual da peça.`);

  el.innerHTML = `
    <div class="panel" style="display:flex;flex-wrap:wrap;gap:12px;align-items:center">
      <strong>Período:</strong>
      <select id="balPeriodo" style="max-width:220px">
        <option value="mes"        ${balancoPeriodo==='mes'?'selected':''}>Este mês</option>
        <option value="mesPassado" ${balancoPeriodo==='mesPassado'?'selected':''}>Mês passado</option>
        <option value="ano"        ${balancoPeriodo==='ano'?'selected':''}>Este ano</option>
        <option value="tudo"       ${balancoPeriodo==='tudo'?'selected':''}>Desde o começo</option>
      </select>
      <span class="text-muted" style="font-size:12.5px">Vendas e gastos abaixo referem-se a <strong>${per.rotulo}</strong>. O estoque é sempre o de agora.</span>
    </div>

    <div class="panel">
      <h3>📦 O que está parado no estoque (hoje)</h3>
      <div class="cards-row">
        <div class="card"><div class="label">Peças em estoque</div><div class="value">${est.pecas}</div></div>
        <div class="card"><div class="label">Dinheiro investido (custo)</div><div class="value">${money(est.custo)}</div></div>
        <div class="card"><div class="label">Se vender tudo (preço)</div><div class="value">${money(est.venda)}</div></div>
        <div class="card"><div class="label">Lucro previsto</div><div class="value text-success">${money(est.lucroPrevisto)}</div></div>
      </div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <h3>💰 Quanto vendi — ${escapeHtml(per.rotulo)}</h3>
        <table><tbody>
          <tr><td>Vendas realizadas</td><td style="text-align:right">${ven.qtd}</td></tr>
          <tr><td>Peças vendidas</td><td style="text-align:right">${ven.pecas}</td></tr>
          <tr><td>Ticket médio</td><td style="text-align:right">${money(ven.ticket)}</td></tr>
          <tr><td><strong>Total vendido</strong></td><td style="text-align:right"><strong>${money(ven.total)}</strong></td></tr>
          <tr><td>Custo das peças vendidas</td><td style="text-align:right">− ${money(ven.custoVendido)}</td></tr>
          <tr><td><strong>Lucro nas peças</strong></td><td style="text-align:right"><strong class="text-success">${money(ven.lucroBruto)}</strong></td></tr>
        </tbody></table>
      </div>

      <div class="panel">
        <h3>🧾 Quanto gastei — ${escapeHtml(per.rotulo)}</h3>
        <table><tbody>
          <tr><td>Gastos mensais (aluguel, luz, água…)</td><td style="text-align:right">${money(gas.mensais)}</td></tr>
          <tr><td>Outras despesas (Financeiro)</td><td style="text-align:right">${money(gas.despesas)}</td></tr>
          ${gas.abertura ? `<tr><td>Custos para abrir a loja</td><td style="text-align:right">${money(gas.abertura)}</td></tr>` : ''}
          <tr><td><strong>Total gasto</strong></td><td style="text-align:right"><strong>${money(gas.total)}</strong></td></tr>
        </tbody></table>
        ${balancoPeriodo !== 'tudo' ? `<p class="text-muted" style="font-size:12px;margin-top:10px">Os custos de abertura da loja só entram na conta em "Desde o começo" — foram um gasto único.</p>` : ''}
      </div>
    </div>

    <div class="panel" style="border-left:4px solid ${resultado>=0?'var(--success,#4C8B5C)':'var(--danger,#B33A3A)'}">
      <h3>${resultado>=0?'✅':'⚠️'} Resultado de ${escapeHtml(per.rotulo)}</h3>
      <table><tbody>
        <tr><td>Vendi</td><td style="text-align:right">${money(ven.total)}</td></tr>
        <tr><td>Paguei pelas peças que vendi</td><td style="text-align:right">− ${money(ven.custoVendido)}</td></tr>
        <tr><td>Gastei com a loja</td><td style="text-align:right">− ${money(gas.total)}</td></tr>
        <tr><td style="font-size:16px"><strong>${resultado>=0?'Sobrou' : 'Faltou'}</strong></td>
            <td style="text-align:right;font-size:16px"><strong class="${resultado>=0?'text-success':'text-danger'}">${money(Math.abs(resultado))}</strong></td></tr>
      </tbody></table>
    </div>

    ${avisos.length ? `<div class="panel" style="border-left:4px solid var(--warning,#C1874F)">
      <h3>Para a conta ficar certa</h3>
      <ul style="margin:0;padding-left:18px;line-height:1.7">${avisos.map(a=>`<li>${a}</li>`).join('')}</ul>
    </div>` : ''}

    <div class="grid-2">
      <div class="panel"><h3>Gastos por categoria — ${escapeHtml(per.rotulo)}</h3>${tabelaGastosCategoria(per)}</div>
      <div class="panel"><h3>Estoque parado por peça</h3>${tabelaEstoqueValor()}</div>
    </div>`;

  el.querySelector('#balPeriodo').addEventListener('change', e => setBalancoPeriodo(e.target.value));
}

function tabelaGastosCategoria(per){
  const lista = gastosPorCategoria(per);
  if(!lista.length) return `<div class="empty-state">Nenhum gasto lançado neste período</div>`;
  const total = lista.reduce((a,[,v]) => a+v, 0);
  return `<div class="table-wrap"><table><thead><tr><th>Categoria</th><th style="text-align:right">Valor</th><th style="text-align:right">%</th></tr></thead><tbody>
    ${lista.map(([c,v]) => `<tr><td>${escapeHtml(c)}</td><td style="text-align:right">${money(v)}</td>
      <td style="text-align:right">${total ? Math.round(v/total*100) : 0}%</td></tr>`).join('')}
    <tr><td><strong>Total</strong></td><td style="text-align:right"><strong>${money(total)}</strong></td><td></td></tr>
  </tbody></table></div>`;
}

function tabelaEstoqueValor(){
  const linhas = DB.products.map(p => {
    const qtd = p.variations.reduce((a,v) => a + (Number(v.stock)||0), 0);
    return { nome: p.name, qtd,
             custo: qtd * (Number(p.cost)||0),
             venda: qtd * (Number(p.price)||0),
             semCusto: !Number(p.cost) && qtd > 0 };
  }).filter(l => l.qtd > 0).sort((a,b) => b.custo - a.custo || b.venda - a.venda);

  if(!linhas.length) return `<div class="empty-state">Nenhuma peça em estoque</div>`;
  const mostrar = linhas.slice(0, 15);
  return `<div class="table-wrap"><table><thead><tr>
      <th>Peça</th><th style="text-align:right">Qtd</th>
      <th style="text-align:right">Custo</th><th style="text-align:right">Venda</th>
    </tr></thead><tbody>
    ${mostrar.map(l => `<tr>
      <td>${escapeHtml(l.nome)}${l.semCusto ? ' <span class="text-muted" style="font-size:11px">(sem custo)</span>' : ''}</td>
      <td style="text-align:right">${l.qtd}</td>
      <td style="text-align:right">${money(l.custo)}</td>
      <td style="text-align:right">${money(l.venda)}</td></tr>`).join('')}
  </tbody></table></div>
  ${linhas.length > 15 ? `<p class="text-muted" style="font-size:12px;margin-top:8px">Mostrando as 15 peças com mais dinheiro parado, de ${linhas.length}.</p>` : ''}`;
}

/* =========================================================
   ESTOQUE
   ========================================================= */
let estoqueMode = null; // 'entrada' | 'saida' | null
function renderEstoque(el){
  el.innerHTML = `
    <div class="toolbar">
      <button class="btn ${estoqueMode==='entrada'?'btn-accent':''}" onclick="setEstoqueMode('entrada')">➕ Entrada por bipe</button>
      <button class="btn ${estoqueMode==='saida'?'btn-accent':''}" onclick="setEstoqueMode('saida')">➖ Saída por bipe</button>
      <button class="btn" onclick="setEstoqueMode(null)">Ver estoque</button>
      <div class="spacer"></div>
      <div class="field" style="margin:0"><label>Estoque mínimo (alerta)</label>
        <input type="number" id="minStockInput" value="${DB.config.minStock}" style="width:90px">
      </div>
    </div>
    ${estoqueMode ? `<div class="panel">
      <h3>${estoqueMode==='entrada'?'➕ Entrada de estoque':'➖ Saída de estoque'} por código de barras</h3>
      <div class="toolbar">
        <input id="bipeInput" placeholder="Bipe ou digite o código e pressione Enter" autofocus style="flex:1">
        <button class="btn btn-accent" id="bipeCamBtn">📷 Câmera</button>
      </div>
      <div id="bipeMsg" class="text-muted" style="margin-top:6px;font-size:12.5px"></div>
    </div>` : ''}
    <div id="stockTableWrap"></div>`;
  document.getElementById('minStockInput').addEventListener('change', e=>{
    DB.config.minStock = Number(e.target.value)||0; saveDB(); toast('Estoque mínimo atualizado');
  });
  if(estoqueMode){
    const inp = document.getElementById('bipeInput');
    inp.addEventListener('keydown', e=>{ if(e.key==='Enter'){ handleBipe(inp.value.trim()); inp.value=''; inp.focus(); } });
    document.getElementById('bipeCamBtn').addEventListener('click', ()=>openScanner(code=>handleBipe(code)));
    inp.focus();
  }
  renderStockTable();
}
function setEstoqueMode(m){ estoqueMode = (estoqueMode===m) ? null : m; renderEstoque(document.getElementById('view')); }
function findVariationByBarcode(code){
  for(const p of DB.products){
    for(const v of p.variations){
      if(v.barcode && v.barcode===code) return {product:p, variation:v};
    }
  }
  return null;
}
function handleBipe(code){
  const msg = document.getElementById('bipeMsg');
  if(!code) return;
  const found = findVariationByBarcode(code);
  if(!found){ if(msg) msg.innerHTML = `<span class="text-danger">Código "${escapeHtml(code)}" não encontrado</span>`; return; }
  const { product, variation } = found;
  if(estoqueMode==='entrada') variation.stock = Number(variation.stock||0)+1;
  else variation.stock = Math.max(0, Number(variation.stock||0)-1);
  saveDB();
  if(msg) msg.innerHTML = `<span class="text-success">${estoqueMode==='entrada'?'+1':'-1'} — ${escapeHtml(product.name)} (${escapeHtml(variation.size)}/${escapeHtml(variation.color)}) → estoque: ${variation.stock}</span>`;
  renderStockTable();
}
/* Estoque e Etiquetas são montados a partir das variações. Se existem
   produtos mas nenhuma variação, "Nenhum produto cadastrado" mentiria. */
function emptyProductsMessage(){
  return DB.products.length
    ? `<div class="empty-state">Os produtos cadastrados ainda não têm variação (tamanho/cor).<br>Abra o produto em <strong>Produtos</strong> e adicione ao menos uma variação.</div>`
    : `<div class="empty-state">Nenhum produto cadastrado</div>`;
}
function renderStockTable(){
  const wrap = document.getElementById('stockTableWrap');
  if(!wrap) return;
  const rows=[];
  DB.products.forEach(p=>p.variations.forEach(v=>rows.push({p,v})));
  if(!rows.length){ wrap.innerHTML = emptyProductsMessage(); return; }
  wrap.innerHTML = `<div class="table-wrap"><table><thead><tr>
    <th>Produto</th><th>Tam/Cor</th><th>Cód. barras</th><th>Estoque</th><th>Status</th><th>Ajuste manual</th>
  </tr></thead><tbody>
    ${rows.map(({p,v},i)=>`<tr>
      <td>${escapeHtml(p.name)}</td>
      <td>${escapeHtml(v.size)}/${escapeHtml(v.color)}</td>
      <td>${escapeHtml(v.barcode||'-')}</td>
      <td>${v.stock}</td>
      <td>${v.stock<=DB.config.minStock?'<span class="badge badge-danger">Baixo</span>':'<span class="badge badge-success">OK</span>'}</td>
      <td><input type="number" value="${v.stock}" style="width:80px" onchange="adjustStock('${p.id}','${v.size}','${v.color}',this.value)"></td>
    </tr>`).join('')}
  </tbody></table></div>`;
}
function adjustStock(pid,size,color,val){
  const p = DB.products.find(x=>x.id===pid);
  const v = p.variations.find(x=>x.size===size && x.color===color);
  v.stock = Number(val)||0;
  saveDB(); renderStockTable(); toast('Estoque ajustado');
}

/* =========================================================
   ETIQUETAS — geração e impressão de códigos de barras
   ========================================================= */
const LABEL_LAYOUTS = {
  pimaco: { name:'Folha A4 — 3 colunas (padrão Pimaco 6180)', cols:3, labelW:'63.5mm', labelH:'26.6mm', gap:'3mm', page:'A4', pageMargin:'8mm' },
  termica50: { name:'Rolo térmico 50mm — 1 coluna', cols:1, labelW:'46mm', labelH:'30mm', gap:'2mm', page:'50mm auto', pageMargin:'2mm' },
  termica40: { name:'Rolo térmico 40mm — 1 coluna', cols:1, labelW:'36mm', labelH:'24mm', gap:'2mm', page:'40mm auto', pageMargin:'2mm' },
};
let etiquetaLayout = 'pimaco';
let etiquetaQty = {}; // key -> quantidade selecionada

function varKey(pid,size,color){ return `${pid}|${size}|${color}`; }

function renderEtiquetas(el){
  const missing = countMissingBarcodes();
  el.innerHTML = `
    <div class="panel">
      <h3>Imprimir etiquetas com código de barras</h3>
      <p class="text-muted" style="margin-bottom:14px">Selecione as variações e a quantidade de etiquetas de cada uma, escolha o layout da folha/rolo e clique em Imprimir. O código de barras é gerado automaticamente para variações que ainda não têm um.</p>
      <div class="toolbar">
        <label style="font-size:12px;color:var(--muted);font-weight:600">Layout:</label>
        <select id="layoutSel">
          ${Object.entries(LABEL_LAYOUTS).map(([k,v])=>`<option value="${k}" ${etiquetaLayout===k?'selected':''}>${v.name}</option>`).join('')}
        </select>
        <div class="spacer"></div>
        ${missing>0 ? `<button class="btn" id="genMissingBtn">🔢 Gerar ${missing} código(s) faltando</button>` : ''}
        <button class="btn" id="selAllBtn">Selecionar todas (estoque atual)</button>
        <button class="btn btn-accent" id="printLabelsBtn">🖨️ Imprimir etiquetas</button>
      </div>
    </div>
    <div id="etiquetasTableWrap"></div>
    <div id="labelSheet"></div>`;
  el.querySelector('#layoutSel').addEventListener('change', e=>{ etiquetaLayout = e.target.value; });
  el.querySelector('#genMissingBtn')?.addEventListener('click', ()=>{
    generateMissingBarcodes(); saveDB(); renderEtiquetas(el); toast('Códigos gerados');
  });
  el.querySelector('#selAllBtn').addEventListener('click', ()=>{
    DB.products.forEach(p=>p.variations.forEach(v=>{
      if(v.stock>0) etiquetaQty[varKey(p.id,v.size,v.color)] = v.stock;
    }));
    renderEtiquetasTable();
  });
  el.querySelector('#printLabelsBtn').addEventListener('click', printLabels);
  renderEtiquetasTable();
}
function countMissingBarcodes(){
  let n=0;
  DB.products.forEach(p=>p.variations.forEach(v=>{ if(!v.barcode) n++; }));
  return n;
}
function generateMissingBarcodes(){
  DB.products.forEach(p=>p.variations.forEach(v=>{ if(!v.barcode) v.barcode = generateUniqueBarcode(); }));
}
function renderEtiquetasTable(){
  const wrap = document.getElementById('etiquetasTableWrap');
  if(!wrap) return;
  const rows=[];
  DB.products.forEach(p=>p.variations.forEach(v=>rows.push({p,v})));
  if(!rows.length){ wrap.innerHTML = emptyProductsMessage(); return; }
  wrap.innerHTML = `<div class="table-wrap"><table><thead><tr>
    <th></th><th>Produto</th><th>Tam/Cor</th><th>Código</th><th>Estoque</th><th>Qtd. etiquetas</th>
  </tr></thead><tbody>
    ${rows.map(({p,v})=>{
      const key = varKey(p.id,v.size,v.color);
      const checked = etiquetaQty[key] > 0;
      return `<tr>
        <td><input type="checkbox" data-check="${key}" ${checked?'checked':''}></td>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(v.size)}/${escapeHtml(v.color)}</td>
        <td>${escapeHtml(v.barcode||'(sem código — será gerado ao imprimir)')}</td>
        <td>${v.stock}</td>
        <td><input type="number" min="1" style="width:70px" data-qty="${key}" value="${etiquetaQty[key]||v.stock||1}"></td>
      </tr>`;
    }).join('')}
  </tbody></table></div>`;
  wrap.querySelectorAll('[data-check]').forEach(chk=>chk.addEventListener('change', e=>{
    const key = e.target.dataset.check;
    if(e.target.checked){
      const qtyInput = wrap.querySelector(`[data-qty="${key}"]`);
      etiquetaQty[key] = Number(qtyInput.value)||1;
    } else delete etiquetaQty[key];
  }));
  wrap.querySelectorAll('[data-qty]').forEach(inp=>inp.addEventListener('input', e=>{
    const key = e.target.dataset.qty;
    if(etiquetaQty[key] !== undefined) etiquetaQty[key] = Number(e.target.value)||1;
  }));
}
function printLabels(){
  const selected = Object.entries(etiquetaQty).filter(([,qty])=>qty>0);
  if(!selected.length){ toast('Selecione ao menos uma variação','error'); return; }
  if(typeof JsBarcode === 'undefined'){
    toast('Não foi possível carregar o gerador de código de barras. Verifique sua conexão com a internet e tente novamente.','error');
    return;
  }
  generateMissingBarcodes(); saveDB();

  const items = [];
  selected.forEach(([key, qty])=>{
    const [pid,size,color] = key.split('|');
    const p = DB.products.find(x=>x.id===pid);
    const v = p && p.variations.find(x=>x.size===size && x.color===color);
    if(!p || !v) return;
    for(let i=0;i<qty;i++) items.push({ p, v });
  });

  const layout = LABEL_LAYOUTS[etiquetaLayout];
  const sheet = document.getElementById('labelSheet');
  sheet.innerHTML = items.map((item,idx)=>`
    <div class="label">
      <div class="label-store">${escapeHtml(DB.storeName)}</div>
      <div class="label-name">${escapeHtml(item.p.name)} ${escapeHtml(item.v.size)}/${escapeHtml(item.v.color)}</div>
      <svg id="lbl-bc-${idx}"></svg>
      <div class="label-price">${money(item.p.price)}</div>
    </div>`).join('');

  let styleTag = document.getElementById('labelPrintStyle');
  if(!styleTag){ styleTag = document.createElement('style'); styleTag.id='labelPrintStyle'; document.head.appendChild(styleTag); }
  styleTag.textContent = `
    @media print {
      @page { size:${layout.page}; margin:${layout.pageMargin}; }
      #labelSheet { display:grid; grid-template-columns: repeat(${layout.cols}, ${layout.labelW}); gap:${layout.gap}; }
      .label { width:${layout.labelW}; height:${layout.labelH}; }
    }`;

  items.forEach((item,idx)=>{
    JsBarcode(`#lbl-bc-${idx}`, item.v.barcode, { format:'CODE128', width:1.3, height:32, fontSize:10, margin:0, displayValue:true });
  });

  setTimeout(()=>window.print(), 200);
}

/* =========================================================
   CLIENTES
   ========================================================= */
function renderClientes(el){
  el.innerHTML = `
    <div class="toolbar">
      <input id="custSearch" placeholder="Buscar cliente...">
      <div class="spacer"></div>
      <button class="btn btn-accent" onclick="openCustomerModal()">+ Novo cliente</button>
    </div>
    <div id="custTableWrap"></div>`;
  el.querySelector('#custSearch').addEventListener('input', e=>renderCustomerTable(e.target.value));
  renderCustomerTable('');
}
function renderCustomerTable(filter){
  const wrap = document.getElementById('custTableWrap');
  const f=(filter||'').toLowerCase();
  const list = DB.customers.filter(c=>!f || c.name.toLowerCase().includes(f) || (c.phone||'').includes(f));
  if(!list.length){ wrap.innerHTML=`<div class="empty-state">Nenhum cliente</div>`; return; }
  wrap.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Nome</th><th>Telefone</th><th>E-mail</th><th>Compras</th><th></th></tr></thead><tbody>
    ${list.map(c=>{
      const n = DB.sales.filter(s=>s.customerId===c.id && !s.canceled).length;
      return `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.phone||'-')}</td><td>${escapeHtml(c.email||'-')}</td><td>${n}</td>
      <td><button class="btn btn-sm" onclick="openCustomerModal('${c.id}')">Editar</button></td></tr>`;
    }).join('')}
  </tbody></table></div>`;
}
function openCustomerModal(id){
  const editing = id ? DB.customers.find(c=>c.id===id) : null;
  const c = editing || { id:uid(), name:'', phone:'', email:'', address:'', createdAt: todayISO() };
  const overlay = document.createElement('div');
  overlay.className='modal-overlay';
  overlay.innerHTML = `<div class="modal">
    <h2>${editing?'Editar':'Novo'} cliente</h2>
    <div class="form-grid">
      <div class="field full"><label>Nome</label><input id="c_name" value="${escapeHtml(c.name)}"></div>
      <div class="field"><label>Telefone</label><input id="c_phone" value="${escapeHtml(c.phone)}"></div>
      <div class="field"><label>E-mail</label><input id="c_email" value="${escapeHtml(c.email)}"></div>
      <div class="field full"><label>Endereço</label><input id="c_address" value="${escapeHtml(c.address)}"></div>
    </div>
    <div class="modal-actions"><button class="btn" id="cancelBtn">Cancelar</button><button class="btn btn-accent" id="saveBtn">Salvar</button></div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#cancelBtn').addEventListener('click', ()=>overlay.remove());
  overlay.querySelector('#saveBtn').addEventListener('click', ()=>{
    const name = overlay.querySelector('#c_name').value.trim();
    if(!name){ toast('Informe o nome','error'); return; }
    const data = { ...c, name, phone:overlay.querySelector('#c_phone').value.trim(), email:overlay.querySelector('#c_email').value.trim(), address:overlay.querySelector('#c_address').value.trim() };
    if(editing) Object.assign(editing, data); else DB.customers.push(data);
    saveDB(); overlay.remove(); renderCustomerTable('');
    toast('Cliente salvo');
  });
}

/* =========================================================
   PDV
   ========================================================= */
let cart = [];
let pdvSearch = '';
let pdvPayment = 'PIX';
let pdvCustomer = '';
let pdvDiscount = 0;

function renderPDV(el){
  el.innerHTML = `
    <div class="pdv-layout">
      <div>
        <div class="toolbar">
          <input id="pdvSearchInput" placeholder="Buscar produto ou bipar código..." value="${escapeHtml(pdvSearch)}" style="flex:1" autofocus>
          <button class="btn btn-accent" id="pdvCamBtn">📷 Bipar</button>
        </div>
        <div class="pdv-search-results" id="pdvResults"></div>
      </div>
      <div class="cart-box">
        <h3>Carrinho</h3>
        <div id="cartItems"></div>
        <div class="field" style="margin-top:10px">
          <label>Cliente</label>
          <select id="pdvCustomerSel"><option value="">Consumidor final</option>
            ${DB.customers.map(c=>`<option value="${c.id}" ${pdvCustomer===c.id?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Desconto (R$)</label>
          <input type="number" id="pdvDiscount" value="${pdvDiscount}" min="0" step="0.01">
        </div>
        <div class="pay-methods">
          ${['PIX','Dinheiro','Débito','Crédito'].map(m=>`<button class="${pdvPayment===m?'active':''}" data-pay="${m}">${m}</button>`).join('')}
        </div>
        <div class="cart-totals">
          <div class="row"><span>Subtotal</span><span>${money(cartSubtotal())}</span></div>
          <div class="row"><span>Desconto</span><span>-${money(pdvDiscount)}</span></div>
          <div class="row total"><span>Total</span><span>${money(Math.max(0,cartSubtotal()-pdvDiscount))}</span></div>
        </div>
        <button class="btn btn-accent" style="margin-top:12px" onclick="finalizeSale()">Finalizar venda</button>
        <button class="btn" style="margin-top:8px" onclick="clearCart()">Limpar carrinho</button>
      </div>
    </div>
    <div id="receipt"></div>`;

  const input = el.querySelector('#pdvSearchInput');
  input.addEventListener('input', e=>{ pdvSearch=e.target.value; renderPDVResults(); });
  input.addEventListener('keydown', e=>{
    if(e.key==='Enter'){
      const code = pdvSearch.trim();
      const found = findVariationByBarcode(code);
      if(found){ addToCart(found.product, found.variation); }
      else if(code) toast('Código não encontrado','error');
      pdvSearch=''; input.value=''; renderPDVResults(); input.focus();
    }
  });
  el.querySelector('#pdvCamBtn').addEventListener('click', ()=>openScanner(code=>{
    const found = findVariationByBarcode(code);
    if(found) addToCart(found.product, found.variation);
    else toast('Código não encontrado','error');
    input.focus();
  }));
  input.focus();
  /* só marca o botão escolhido. Redesenhar o PDV inteiro aqui fazia o
     teclado do celular reabrir a cada toque na forma de pagamento. */
  el.querySelectorAll('[data-pay]').forEach(b=>b.addEventListener('click', e=>{
    pdvPayment = e.currentTarget.dataset.pay;
    el.querySelectorAll('[data-pay]').forEach(o=>o.classList.toggle('active', o.dataset.pay===pdvPayment));
  }));
  el.querySelector('#pdvCustomerSel').addEventListener('change', e=>pdvCustomer=e.target.value);
  el.querySelector('#pdvDiscount').addEventListener('input', e=>{ pdvDiscount=Number(e.target.value)||0; renderCartItems(); });

  renderPDVResults();
  renderCartItems();
}
function renderPDVResults(){
  const wrap = document.getElementById('pdvResults');
  if(!wrap) return;
  const f = pdvSearch.toLowerCase();
  const list = DB.products.filter(p=> p.variations.some(v=>v.stock>0) && (!f || p.name.toLowerCase().includes(f) || (p.sku||'').toLowerCase().includes(f)));
  wrap.innerHTML = list.map(p=>`
    <div class="pdv-product" onclick="quickAdd('${p.id}')">
      <img src="${escapeHtml(p.photo||'')}" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'">
      <div class="pname">${escapeHtml(p.name)}</div>
      <div class="pprice">${money(p.price)}</div>
    </div>`).join('') || `<div class="empty-state">Nenhum produto encontrado</div>`;
}
function quickAdd(pid){
  const p = DB.products.find(x=>x.id===pid);
  const v = p.variations.find(v=>v.stock>0);
  if(!v){ toast('Sem estoque','error'); return; }
  addToCart(p, v);
}
function addToCart(product, variation){
  if(variation.stock<=0){ toast('Sem estoque para essa variação','error'); return; }
  const existing = cart.find(i=>i.productId===product.id && i.size===variation.size && i.color===variation.color);
  if(existing){
    if(existing.qty>=variation.stock){ toast('Estoque insuficiente','error'); return; }
    existing.qty++;
  } else {
    cart.push({ productId:product.id, name:product.name, size:variation.size, color:variation.color, price:product.price, qty:1, maxStock:variation.stock });
  }
  renderCartItems();
}
function cartSubtotal(){ return cart.reduce((a,i)=>a+i.price*i.qty,0); }
function renderCartItems(){
  const wrap = document.getElementById('cartItems');
  if(!wrap) return;
  wrap.innerHTML = cart.length ? cart.map((i,idx)=>`
    <div class="cart-item">
      <div><div class="ci-name">${escapeHtml(i.name)}</div><div class="ci-meta">${escapeHtml(i.size)}/${escapeHtml(i.color)} × ${i.qty} = ${money(i.price*i.qty)}</div></div>
      <div style="display:flex;gap:4px">
        <button class="btn btn-icon btn-sm" onclick="changeQty(${idx},-1)">-</button>
        <button class="btn btn-icon btn-sm" onclick="changeQty(${idx},1)">+</button>
        <button class="btn btn-icon btn-sm btn-danger" onclick="removeFromCart(${idx})">✕</button>
      </div>
    </div>`).join('') : `<div class="empty-state" style="padding:20px">Carrinho vazio</div>`;
  document.querySelectorAll('.cart-totals .row span:last-child')[0].textContent = money(cartSubtotal());
  document.querySelectorAll('.cart-totals .total span:last-child')[0].textContent = money(Math.max(0,cartSubtotal()-pdvDiscount));
}
function changeQty(idx,delta){
  const i = cart[idx];
  const newQty = i.qty+delta;
  if(newQty<=0){ cart.splice(idx,1); }
  else if(newQty>i.maxStock){ toast('Estoque insuficiente','error'); return; }
  else i.qty = newQty;
  renderCartItems();
}
function removeFromCart(idx){ cart.splice(idx,1); renderCartItems(); }
function clearCart(){ cart=[]; pdvDiscount=0; renderPDV(document.getElementById('view')); }

function finalizeSale(){
  if(!cart.length){ toast('Carrinho vazio','error'); return; }
  // Vender é o que não pode parar. Se o caixa não foi aberto, abre sozinho
  // com valor inicial zero em vez de bloquear a venda — quem controla o
  // caixa continua podendo abrir com troco pela tela de Caixa.
  if(!DB.cashRegister.open){
    DB.cashRegister = { open:true, openedAt: todayISO(), openingAmount:0, movements:[], closedHistory: DB.cashRegister.closedHistory || [] };
  }
  const total = Math.max(0, cartSubtotal()-pdvDiscount);
  const sale = {
    id: uid(), date: todayISO(),
    items: cart.map(i=>{
      const prod = DB.products.find(x=>x.id===i.productId);
      /* guardamos o custo daqui, congelado: se amanhã o custo da peça mudar,
         o lucro desta venda não pode mudar junto. */
      return { productId:i.productId, name:i.name, size:i.size, color:i.color,
               price:i.price, qty:i.qty, cost: prod ? Number(prod.cost)||0 : 0 };
    }),
    discount: pdvDiscount, payment: pdvPayment, customerId: pdvCustomer || null,
    seller: SESSION.name, total, status:'concluida', origin:'pdv', canceled:false
  };
  // baixa estoque
  cart.forEach(i=>{
    const p = DB.products.find(x=>x.id===i.productId);
    const v = p.variations.find(v=>v.size===i.size && v.color===i.color);
    if(v) v.stock = Math.max(0, v.stock - i.qty);
  });
  DB.sales.push(sale);
  DB.finance.entries.push({ id:uid(), type:'receita', category:'Venda PDV', amount: total, date: todayISO(), status:'pago', description:`Venda #${sale.id.slice(-6)}` });

  /* Só damos a venda por feita depois que ela está realmente gravada. Antes
     o recibo saía mesmo quando o armazenamento recusava a gravação, e a
     venda sumia no recarregamento seguinte. */
  if(!exigirGravacao('esta venda')){
    DB.sales.pop();
    DB.finance.entries.pop();
    cart.forEach(i=>{
      const p = DB.products.find(x=>x.id===i.productId);
      const v = p && p.variations.find(v=>v.size===i.size && v.color===i.color);
      if(v) v.stock += i.qty;   // devolve o estoque: a venda não aconteceu
    });
    toast('A venda NÃO foi salva. O carrinho continua aqui para você refazer.','error');
    return;
  }
  printReceipt(sale);
  cart=[]; pdvDiscount=0; pdvCustomer='';
  renderPDV(document.getElementById('view'));
  toast('Venda finalizada!');
}
function printReceipt(sale){
  const r = document.getElementById('receipt');
  if(!r) return;
  r.innerHTML = `<div class="receipt-sheet">
    <div style="text-align:center"><strong>${escapeHtml(DB.storeName)}</strong><br>${dateBR(sale.date)}</div><hr>
    ${sale.items.map(i=>`${escapeHtml(i.name)} (${escapeHtml(i.size)}/${escapeHtml(i.color)})<br>${i.qty} x ${money(i.price)} = ${money(i.qty*i.price)}<br>`).join('')}
    <hr>Desconto: ${money(sale.discount)}<br><strong>Total: ${money(sale.total)}</strong><br>Pagamento: ${sale.payment}<br>Vendedor(a): ${escapeHtml(sale.seller)}
    <hr><div style="text-align:center">Obrigado pela preferência! 💛</div>
  </div>`;
  setTimeout(()=>window.print(), 200);
}

/* =========================================================
   VENDAS
   ========================================================= */
function renderVendas(el){
  el.innerHTML = `<div id="vendasWrap"></div>`;
  renderVendasTable();
}
/* A tela desenhava TODAS as vendas de uma vez. Com 800 vendas já eram 8.814
   elementos na tela; em um ano de loja isso trava o celular. Mostramos as
   mais recentes e o resto sob demanda. */
let vendasMostradas = 100;
function renderVendasTable(){
  const wrap = document.getElementById('vendasWrap');
  const todas = [...DB.sales].sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(!todas.length){ wrap.innerHTML=`<div class="empty-state">Nenhuma venda registrada</div>`; return; }
  const list = todas.slice(0, vendasMostradas);
  const faltam = todas.length - list.length;
  wrap.innerHTML = `<div class="table-wrap"><table><thead><tr>
    <th>Data</th><th>Cliente</th><th>Itens</th><th>Total</th><th>Pagto</th><th>Origem</th><th>Status</th><th></th>
  </tr></thead><tbody>
    ${list.map(s=>`<tr style="${s.canceled?'opacity:.5':''}">
      <td>${dateBR(s.date)}</td>
      <td>${escapeHtml(customerName(s.customerId))}</td>
      <td>${s.items.reduce((a,i)=>a+i.qty,0)}</td>
      <td>${money(s.total)}</td>
      <td>${s.payment}</td>
      <td>${s.origin==='loja'?'<span class="badge badge-gold">Loja virtual</span>':'PDV'}</td>
      <td>${saleStatusBadge(s)}</td>
      <td>${saleActions(s)}</td>
    </tr>`).join('')}
  </tbody></table></div>
  ${faltam ? `<div style="text-align:center;margin-top:12px">
    <button class="btn" onclick="verMaisVendas()">Ver mais ${Math.min(faltam,100)} de ${faltam} vendas antigas</button>
  </div>` : ''}`;
}
function verMaisVendas(){ vendasMostradas += 100; renderVendasTable(); }
function saleStatusBadge(s){
  if(s.canceled) return '<span class="badge badge-danger">Cancelada</span>';
  if(s.status==='pendente') return '<span class="badge badge-warning">Pendente</span>';
  if(s.status==='pago') return '<span class="badge badge-success">Pago</span>';
  if(s.status==='entregue') return '<span class="badge badge-gold">Entregue</span>';
  return '<span class="badge badge-success">Concluída</span>';
}
function saleActions(s){
  if(s.canceled) return '-';
  let btns='';
  if(s.origin==='loja' && s.status==='pendente') btns += `<button class="btn btn-sm btn-accent" onclick="markSalePaid('${s.id}')">Marcar Pago</button> `;
  if(s.origin==='loja' && s.status==='pago') btns += `<button class="btn btn-sm btn-gold" onclick="markSaleDelivered('${s.id}')">Marcar Entregue</button> `;
  btns += `<button class="btn btn-sm btn-danger" onclick="cancelSale('${s.id}')">Cancelar</button>`;
  return btns;
}
function markSalePaid(id){
  const s = DB.sales.find(x=>x.id===id);
  s.status='pago';
  DB.finance.entries.push({ id:uid(), type:'receita', category:'Venda loja virtual', amount:s.total, date:todayISO(), status:'pago', description:`Pedido online #${id.slice(-6)}` });
  saveDB(); renderVendasTable(); toast('Pedido marcado como pago');
}
function markSaleDelivered(id){
  const s = DB.sales.find(x=>x.id===id); s.status='entregue';
  saveDB(); renderVendasTable(); toast('Pedido marcado como entregue');
}
function cancelSale(id){
  if(!confirm('Cancelar esta venda? O estoque será devolvido.')) return;
  const s = DB.sales.find(x=>x.id===id);
  s.items.forEach(i=>{
    const p = DB.products.find(x=>x.id===i.productId);
    const v = p && p.variations.find(v=>v.size===i.size && v.color===i.color);
    if(v) v.stock += i.qty;
  });
  s.canceled = true;
  saveDB(); renderVendasTable(); toast('Venda cancelada');
}

/* =========================================================
   CAIXA
   ========================================================= */
function renderCaixa(el){
  const cr = DB.cashRegister;
  const salesInSession = cr.open ? DB.sales.filter(s=>!s.canceled && new Date(s.date)>=new Date(cr.openedAt)) : [];
  const byPay = {};
  salesInSession.forEach(s=>{ byPay[s.payment]=(byPay[s.payment]||0)+s.total; });
  el.innerHTML = `
    <div class="panel">
      <h3>Status do caixa</h3>
      ${cr.open ? `
        <p>Caixa <strong class="text-success">aberto</strong> desde ${dateBR(cr.openedAt)} — valor inicial ${money(cr.openingAmount)}</p>
        <div class="toolbar" style="margin-top:14px">
          <button class="btn" onclick="openMovementModal('sangria')">➖ Sangria</button>
          <button class="btn" onclick="openMovementModal('reforco')">➕ Reforço</button>
          <div class="spacer"></div>
          <button class="btn btn-danger" onclick="closeCashRegister()">Fechar caixa</button>
        </div>
      ` : `
        <p>Caixa <strong class="text-danger">fechado</strong></p>
        <div class="toolbar" style="margin-top:14px">
          <input type="number" id="openAmount" placeholder="Valor inicial (R$)" style="width:180px">
          <button class="btn btn-accent" onclick="openCashRegister()">Abrir caixa</button>
        </div>
      `}
    </div>
    ${cr.open ? `<div class="panel">
      <h3>Resumo por forma de pagamento</h3>
      <div class="table-wrap"><table><thead><tr><th>Forma</th><th>Total</th></tr></thead><tbody>
        ${Object.keys(byPay).length ? Object.entries(byPay).map(([k,v])=>`<tr><td>${k}</td><td>${money(v)}</td></tr>`).join('') : '<tr><td colspan="2">Nenhuma venda nesta sessão</td></tr>'}
      </tbody></table></div>
      <h3 style="margin-top:18px">Movimentações</h3>
      <div class="table-wrap"><table><thead><tr><th>Tipo</th><th>Valor</th><th>Obs</th><th>Data</th></tr></thead><tbody>
        ${cr.movements.length ? cr.movements.map(m=>`<tr><td>${m.type==='sangria'?'➖ Sangria':'➕ Reforço'}</td><td>${money(m.amount)}</td><td>${escapeHtml(m.note||'-')}</td><td>${dateBR(m.date)}</td></tr>`).join('') : '<tr><td colspan="4">Nenhuma movimentação</td></tr>'}
      </tbody></table></div>
    </div>` : ''}`;
}
function openCashRegister(){
  const amount = Number(document.getElementById('openAmount').value)||0;
  DB.cashRegister = { open:true, openedAt: todayISO(), openingAmount: amount, movements:[], closedHistory: DB.cashRegister.closedHistory };
  saveDB(); renderCaixa(document.getElementById('view')); toast('Caixa aberto');
}
function closeCashRegister(){
  if(!confirm('Fechar o caixa?')) return;
  const cr = DB.cashRegister;
  const salesInSession = DB.sales.filter(s=>!s.canceled && new Date(s.date)>=new Date(cr.openedAt));
  const total = salesInSession.reduce((a,s)=>a+s.total,0);
  cr.closedHistory.push({ openedAt:cr.openedAt, closedAt: todayISO(), openingAmount:cr.openingAmount, totalSales: total, movements: cr.movements });
  DB.cashRegister = { open:false, openedAt:null, openingAmount:0, movements:[], closedHistory: cr.closedHistory };
  saveDB(); renderCaixa(document.getElementById('view')); toast('Caixa fechado');
}
function openMovementModal(type){
  const overlay = document.createElement('div');
  overlay.className='modal-overlay';
  overlay.innerHTML = `<div class="modal" style="max-width:400px">
    <h2>${type==='sangria'?'➖ Sangria':'➕ Reforço'}</h2>
    <div class="field"><label>Valor (R$)</label><input type="number" id="m_amount" step="0.01"></div>
    <div class="field" style="margin-top:10px"><label>Observação</label><input id="m_note"></div>
    <div class="modal-actions"><button class="btn" id="cancelBtn">Cancelar</button><button class="btn btn-accent" id="saveBtn">Confirmar</button></div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#cancelBtn').addEventListener('click', ()=>overlay.remove());
  overlay.querySelector('#saveBtn').addEventListener('click', ()=>{
    const amount = Number(overlay.querySelector('#m_amount').value)||0;
    if(amount<=0){ toast('Informe um valor','error'); return; }
    DB.cashRegister.movements.push({ type, amount, note: overlay.querySelector('#m_note').value.trim(), date: todayISO() });
    saveDB(); overlay.remove(); renderCaixa(document.getElementById('view'));
    toast('Movimentação registrada');
  });
}

/* =========================================================
   FINANCEIRO
   ========================================================= */
function renderFinanceiro(el){
  const mk = monthKey();
  const monthEntries = DB.finance.entries.filter(e=>e.date && e.date.startsWith(mk));
  const receitas = monthEntries.filter(e=>e.type==='receita' && e.status==='pago').reduce((a,e)=>a+e.amount,0);
  const despesas = monthEntries.filter(e=>e.type==='despesa' && e.status==='pago').reduce((a,e)=>a+e.amount,0);
  const aPagar = DB.finance.entries.filter(e=>e.type==='despesa' && e.status==='pendente').reduce((a,e)=>a+e.amount,0);
  const aReceber = DB.finance.entries.filter(e=>e.type==='receita' && e.status==='pendente').reduce((a,e)=>a+e.amount,0);
  el.innerHTML = `
    <div class="cards-row">
      <div class="card"><div class="label">Receitas do mês</div><div class="value text-success">${money(receitas)}</div></div>
      <div class="card"><div class="label">Despesas do mês</div><div class="value text-danger">${money(despesas)}</div></div>
      <div class="card"><div class="label">Saldo do mês</div><div class="value">${money(receitas-despesas)}</div></div>
      <div class="card"><div class="label">A pagar</div><div class="value small text-danger">${money(aPagar)}</div></div>
      <div class="card"><div class="label">A receber</div><div class="value small text-success">${money(aReceber)}</div></div>
    </div>
    <div class="toolbar">
      <button class="btn btn-accent" onclick="openFinanceModal('receita')">+ Receita</button>
      <button class="btn btn-accent" onclick="openFinanceModal('despesa')">+ Despesa</button>
    </div>
    <div id="financeTableWrap"></div>`;
  renderFinanceTable();
}
function renderFinanceTable(){
  const wrap = document.getElementById('financeTableWrap');
  const list = [...DB.finance.entries].sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(!list.length){ wrap.innerHTML=`<div class="empty-state">Nenhum lançamento</div>`; return; }
  wrap.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Valor</th><th>Status</th><th></th></tr></thead><tbody>
    ${list.map(e=>`<tr>
      <td>${dateBR(e.date)}</td>
      <td>${e.type==='receita'?'<span class="badge badge-success">Receita</span>':'<span class="badge badge-danger">Despesa</span>'}</td>
      <td>${escapeHtml(e.category)}</td><td>${escapeHtml(e.description||'-')}</td><td>${money(e.amount)}</td>
      <td>${e.status==='pago'?'<span class="badge badge-success">Pago</span>':'<span class="badge badge-warning">Pendente</span>'}</td>
      <td>${e.status==='pendente'?`<button class="btn btn-sm btn-accent" onclick="markFinanceEntryPaid('${e.id}')">Marcar pago</button>`:''}
          <button class="btn btn-sm" onclick="openFinanceModal('${e.type}','${e.id}')">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="deleteFinanceEntry('${e.id}')">Excluir</button></td>
    </tr>`).join('')}
  </tbody></table></div>`;
}
function markFinanceEntryPaid(id){
  const e = DB.finance.entries.find(x=>x.id===id); e.status='pago'; e.date=todayISO();
  saveDB(); renderFinanceTable(); toast('Lançamento marcado como pago');
}
function deleteFinanceEntry(id){
  if(!confirm('Excluir este lançamento?')) return;
  DB.finance.entries = DB.finance.entries.filter(e=>e.id!==id);
  saveDB(); renderFinanceTable();
}
function openFinanceModal(type, id){
  const editing = id ? DB.finance.entries.find(x=>x.id===id) : null;
  const e = editing || { id:uid(), type, category:'', description:'', amount:0, status:'pago' };
  const overlay = document.createElement('div');
  overlay.className='modal-overlay';
  overlay.innerHTML = `<div class="modal" style="max-width:420px">
    <h2>${editing?'Editar':'+'} ${type==='receita'?'Receita':'Despesa'}</h2>
    <div class="field"><label>Categoria</label><input id="fe_cat" value="${escapeHtml(e.category)}"></div>
    <div class="field" style="margin-top:10px"><label>Descrição</label><input id="fe_desc" value="${escapeHtml(e.description||'')}"></div>
    <div class="field" style="margin-top:10px"><label>Valor (R$)</label><input type="number" id="fe_amount" step="0.01" value="${e.amount}"></div>
    <div class="field" style="margin-top:10px"><label>Status</label>
      <select id="fe_status"><option value="pago" ${e.status==='pago'?'selected':''}>Pago</option><option value="pendente" ${e.status==='pendente'?'selected':''}>Pendente</option></select>
    </div>
    <div class="modal-actions">
      ${editing?`<button class="btn btn-danger" id="deleteBtn" style="margin-right:auto">Excluir</button>`:''}
      <button class="btn" id="cancelBtn">Cancelar</button><button class="btn btn-accent" id="saveBtn">Salvar</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#cancelBtn').addEventListener('click', ()=>overlay.remove());
  overlay.querySelector('#deleteBtn')?.addEventListener('click', ()=>{
    overlay.remove(); deleteFinanceEntry(e.id);
  });
  overlay.querySelector('#saveBtn').addEventListener('click', ()=>{
    const amount = Number(overlay.querySelector('#fe_amount').value)||0;
    if(amount<=0){ toast('Informe um valor','error'); return; }
    const data = { category: overlay.querySelector('#fe_cat').value.trim()||'Outros',
      description: overlay.querySelector('#fe_desc').value.trim(), amount, status: overlay.querySelector('#fe_status').value };
    if(editing){ Object.assign(editing, data); }
    else DB.finance.entries.push({ ...e, ...data, date: todayISO() });
    saveDB(); overlay.remove(); renderFinanceiro(document.getElementById('view'));
    toast('Lançamento salvo');
  });
}

/* =========================================================
   GASTOS MENSAIS (Aluguel, Água, Luz, Manutenção, etc.)
   ========================================================= */
let gastosMonth = monthKey();
function renderGastos(el){
  const me = DB.monthlyExpenses;
  const records = me.records.filter(r=>r.month===gastosMonth);
  const total = records.reduce((a,r)=>a+Number(r.amount||0),0);
  const pago = records.filter(r=>r.status==='pago').reduce((a,r)=>a+Number(r.amount||0),0);
  el.innerHTML = `
    <div class="toolbar">
      <label style="font-size:12px;color:var(--muted);font-weight:600">Mês:</label>
      <input type="month" id="gastosMonthInput" value="${gastosMonth}">
      <div class="spacer"></div>
      <button class="btn" onclick="openCategoryModal()">+ Nova categoria</button>
      <button class="btn btn-accent" onclick="openGastoModal()">+ Lançar gasto</button>
    </div>
    <div class="cards-row">
      <div class="card"><div class="label">Total previsto — ${monthLabel(gastosMonth)}</div><div class="value">${money(total)}</div></div>
      <div class="card"><div class="label">Já pago</div><div class="value text-success">${money(pago)}</div></div>
      <div class="card"><div class="label">Falta pagar</div><div class="value text-danger">${money(total-pago)}</div></div>
    </div>
    <div id="fixasWrap"></div>
    <h3 style="margin:22px 0 10px;font-size:15px">Gastos de ${monthLabel(gastosMonth)}</h3>
    <div id="gastosTableWrap"></div>`;
  el.querySelector('#gastosMonthInput').addEventListener('change', e=>{ gastosMonth=e.target.value; renderGastos(el); });
  renderFixas();
  renderGastosTable();
}

/* ---------- Despesas fixas ----------
   Aluguel, luz, internet: o valor é quase o mesmo todo mês. Cadastrar uma
   vez e lançar o mês inteiro num clique evita redigitar as mesmas linhas
   a cada 30 dias — que era o motivo de os gastos ficarem sem lançar. */
function fixasJaLancadas(mes){
  const doMes = DB.monthlyExpenses.records.filter(r=>r.month===mes);
  return DB.monthlyExpenses.fixed.filter(f=>
    doMes.some(r=>r.fixedId===f.id
      || (!r.fixedId && r.category===f.category && Number(r.amount)===Number(f.amount)))
  ).map(f=>f.id);
}

function renderFixas(){
  const wrap = document.getElementById('fixasWrap');
  if(!wrap) return;
  const fixas = DB.monthlyExpenses.fixed;
  const jaLancadas = fixasJaLancadas(gastosMonth);
  const faltam = fixas.filter(f=>!jaLancadas.includes(f.id));
  const totalFixo = fixas.reduce((a,f)=>a+Number(f.amount||0),0);

  wrap.innerHTML = `<div class="panel">
    <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:12px">
      <h3 style="margin:0;flex:1;min-width:200px">🔁 Despesas fixas — todo mês ${totalFixo?'· '+money(totalFixo):''}</h3>
      <button class="btn btn-sm" onclick="openFixaModal()">+ Nova despesa fixa</button>
      ${faltam.length ? `<button class="btn btn-sm btn-accent" onclick="lancarFixas()">
        Lançar as ${faltam.length} fixas em ${monthLabel(gastosMonth)}</button>` : ''}
    </div>
    ${!fixas.length
      ? `<div class="empty-state">Cadastre aqui o que você paga todo mês — aluguel, água, luz, internet.
           Depois é só um clique para lançar tudo no mês, sem digitar de novo.</div>`
      : `<div class="table-wrap"><table><thead><tr>
          <th>Categoria</th><th>Descrição</th><th style="text-align:right">Valor por mês</th>
          <th>Vence dia</th><th>${monthLabel(gastosMonth)}</th><th></th>
        </tr></thead><tbody>
        ${fixas.map(f=>`<tr>
          <td>${escapeHtml(f.category)}</td>
          <td>${escapeHtml(f.note||'-')}</td>
          <td style="text-align:right">${money(f.amount)}</td>
          <td>${f.dueDay ? 'dia '+f.dueDay : '-'}</td>
          <td>${jaLancadas.includes(f.id)
                ? '<span class="badge badge-success">Lançada</span>'
                : '<span class="badge badge-warning">Falta lançar</span>'}</td>
          <td><button class="btn btn-sm" onclick="openFixaModal('${f.id}')">Editar</button>
              <button class="btn btn-sm btn-danger" onclick="deleteFixa('${f.id}')">Excluir</button></td>
        </tr>`).join('')}
      </tbody></table></div>
      ${faltam.length ? '' : `<p class="text-muted" style="font-size:12px;margin-top:10px">Todas as despesas fixas já estão lançadas em ${monthLabel(gastosMonth)}.</p>`}`}
  </div>`;
}

function lancarFixas(){
  const jaLancadas = fixasJaLancadas(gastosMonth);
  const faltam = DB.monthlyExpenses.fixed.filter(f=>!jaLancadas.includes(f.id));
  if(!faltam.length){ toast('As fixas deste mês já estão lançadas'); return; }
  faltam.forEach(f=>{
    DB.monthlyExpenses.records.push({
      id: uid(), month: gastosMonth, fixedId: f.id,
      category: f.category, note: f.note, amount: f.amount,
      status: 'pendente', paidDate: null
    });
  });
  if(!exigirGravacao('as despesas fixas')){
    DB.monthlyExpenses.records.splice(-faltam.length);  // desfaz: não foram salvas
    return;
  }
  toast(faltam.length+' despesa(s) fixa(s) lançada(s) em '+monthLabel(gastosMonth));
  navigate('gastos');
}

function deleteFixa(id){
  const f = DB.monthlyExpenses.fixed.find(x=>x.id===id);
  if(!f) return;
  if(!confirm('Excluir a despesa fixa "'+f.category+'"?\n\nOs lançamentos já feitos nos meses continuam onde estão.')) return;
  DB.monthlyExpenses.fixed = DB.monthlyExpenses.fixed.filter(x=>x.id!==id);
  if(exigirGravacao('a exclusão')) { toast('Despesa fixa excluída'); navigate('gastos'); }
}

function openFixaModal(id){
  const editing = id ? DB.monthlyExpenses.fixed.find(x=>x.id===id) : null;
  const cats = DB.monthlyExpenses.categories;
  const f = editing || { id: uid(), category: cats[0], note:'', amount:0, dueDay:0 };
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal" style="max-width:440px">
    <h2>${editing?'Editar despesa fixa':'Nova despesa fixa'}</h2>
    <p class="text-muted" style="font-size:12.5px;margin-bottom:14px">
      O que você paga todo mês. Depois de cadastrada, é lançada no mês inteiro com um clique.</p>
    <div class="field"><label>Categoria</label>
      <select id="x_cat">${cats.map(c=>`<option value="${escapeHtml(c)}" ${f.category===c?'selected':''}>${escapeHtml(c)}</option>`).join('')}</select>
    </div>
    <div class="field" style="margin-top:10px"><label>Descrição (opcional)</label>
      <input id="x_note" value="${escapeHtml(f.note||'')}" placeholder="Ex.: aluguel da loja"></div>
    <div class="form-grid" style="margin-top:10px">
      <div class="field"><label>Valor por mês (R$)</label>
        <input type="number" id="x_amount" step="0.01" inputmode="decimal" value="${f.amount||''}" placeholder="0,00"></div>
      <div class="field"><label>Vence no dia (opcional)</label>
        <input type="number" id="x_due" min="1" max="31" inputmode="numeric" value="${f.dueDay||''}" placeholder="Ex.: 10"></div>
    </div>
    <div class="modal-actions">
      <button class="btn" id="cancelBtn">Cancelar</button>
      <button class="btn btn-accent" id="saveBtn">Salvar</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#cancelBtn').addEventListener('click', ()=>overlay.remove());
  overlay.querySelector('#saveBtn').addEventListener('click', ()=>{
    const amount = Number(overlay.querySelector('#x_amount').value) || 0;
    if(amount <= 0){ toast('Informe o valor que você paga por mês','error'); return; }
    const dia = Number(overlay.querySelector('#x_due').value) || 0;
    const dados = {
      category: overlay.querySelector('#x_cat').value,
      note: overlay.querySelector('#x_note').value.trim(),
      amount,
      dueDay: (dia >= 1 && dia <= 31) ? dia : 0
    };
    if(editing) Object.assign(editing, dados);
    else DB.monthlyExpenses.fixed.push({ ...f, ...dados });
    if(!exigirGravacao('a despesa fixa')){
      if(!editing) DB.monthlyExpenses.fixed.pop();
      return;
    }
    overlay.remove();
    toast(editing ? 'Despesa fixa salva' : 'Despesa fixa cadastrada');
    navigate('gastos');
  });
}
function renderGastosTable(){
  const wrap = document.getElementById('gastosTableWrap');
  if(!wrap) return;
  const records = DB.monthlyExpenses.records.filter(r=>r.month===gastosMonth);
  if(!records.length){ wrap.innerHTML = `<div class="empty-state">Nenhum gasto lançado em ${monthLabel(gastosMonth)}. Categorias sugeridas: ${DB.monthlyExpenses.categories.join(', ')}.</div>`; return; }
  wrap.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Categoria</th><th>Descrição</th><th>Valor</th><th>Status</th><th></th></tr></thead><tbody>
    ${records.map(r=>`<tr>
      <td>${escapeHtml(r.category)}</td><td>${escapeHtml(r.note||'-')}</td><td>${money(r.amount)}</td>
      <td>${r.status==='pago'?'<span class="badge badge-success">Pago</span>':'<span class="badge badge-warning">Pendente</span>'}</td>
      <td>${r.status==='pendente'?`<button class="btn btn-sm btn-accent" onclick="markGastoPaid('${r.id}')">Marcar pago</button>`:''}
          <button class="btn btn-sm" onclick="openGastoModal('${r.id}')">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="deleteGasto('${r.id}')">Excluir</button></td>
    </tr>`).join('')}
  </tbody></table></div>`;
}
function openCategoryModal(){
  const name = prompt('Nome da nova categoria de gasto:');
  if(name && name.trim()){
    DB.monthlyExpenses.categories.push(name.trim());
    saveDB(); toast('Categoria adicionada');
  }
}
function openGastoModal(id){
  const editing = id ? DB.monthlyExpenses.records.find(x=>x.id===id) : null;
  const cats = DB.monthlyExpenses.categories;
  const r = editing || { id:uid(), month:gastosMonth, category:cats[0], note:'', amount:0, status:'pendente' };
  const overlay = document.createElement('div');
  overlay.className='modal-overlay';
  overlay.innerHTML = `<div class="modal" style="max-width:420px">
    <h2>${editing?'Editar gasto':'Lançar gasto mensal'} — ${monthLabel(r.month)}</h2>
    <div class="field"><label>Categoria</label>
      <select id="g_cat">${cats.map(c=>`<option value="${escapeHtml(c)}" ${r.category===c?'selected':''}>${escapeHtml(c)}</option>`).join('')}</select>
    </div>
    <div class="field" style="margin-top:10px"><label>Descrição (opcional)</label><input id="g_note" value="${escapeHtml(r.note||'')}"></div>
    <div class="field" style="margin-top:10px"><label>Valor (R$)</label><input type="number" id="g_amount" step="0.01" value="${r.amount}"></div>
    <div class="field" style="margin-top:10px"><label>Status</label>
      <select id="g_status"><option value="pendente" ${r.status==='pendente'?'selected':''}>Pendente</option><option value="pago" ${r.status==='pago'?'selected':''}>Pago</option></select>
    </div>
    <div class="modal-actions">
      ${editing?`<button class="btn btn-danger" id="deleteBtn" style="margin-right:auto">Excluir</button>`:''}
      <button class="btn" id="cancelBtn">Cancelar</button><button class="btn btn-accent" id="saveBtn">Salvar</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#cancelBtn').addEventListener('click', ()=>overlay.remove());
  overlay.querySelector('#deleteBtn')?.addEventListener('click', ()=>{
    overlay.remove(); deleteGasto(r.id);
  });
  overlay.querySelector('#saveBtn').addEventListener('click', ()=>{
    const amount = Number(overlay.querySelector('#g_amount').value)||0;
    if(amount<=0){ toast('Informe um valor','error'); return; }
    const status = overlay.querySelector('#g_status').value;
    const data = { category: overlay.querySelector('#g_cat').value, note: overlay.querySelector('#g_note').value.trim(), amount, status };
    if(editing){
      Object.assign(editing, data);
    } else {
      DB.monthlyExpenses.records.push({ ...r, ...data, paidDate: status==='pago'?todayISO():null });
      if(status==='pago'){
        DB.finance.entries.push({ id:uid(), type:'despesa', category:`Gasto mensal — ${data.category}`, amount, date: todayISO(), status:'pago', description: data.note||data.category });
      }
    }
    saveDB(); overlay.remove(); renderGastos(document.getElementById('view'));
    toast('Gasto salvo');
  });
}
function markGastoPaid(id){
  const r = DB.monthlyExpenses.records.find(x=>x.id===id);
  r.status='pago'; r.paidDate=todayISO();
  DB.finance.entries.push({ id:uid(), type:'despesa', category:`Gasto mensal — ${r.category}`, amount:r.amount, date: todayISO(), status:'pago', description: r.note||r.category });
  saveDB(); renderGastosTable(); toast('Gasto marcado como pago e lançado no Financeiro');
}
function deleteGasto(id){
  if(!confirm('Excluir este gasto?')) return;
  DB.monthlyExpenses.records = DB.monthlyExpenses.records.filter(r=>r.id!==id);
  saveDB(); renderGastosTable();
}

/* =========================================================
   ABRIR LOJA (custos de implantação)
   ========================================================= */
const SETUP_CATEGORIES = ['Ponto/Aluguel','Material para reforma','Mão de obra','Móveis e araras','Equipamentos','Estoque inicial','Documentação/Alvará','Marketing/Fachada','Outros'];
function renderAbrirLoja(el){
  const items = DB.storeSetup.items;
  const previsto = items.reduce((a,i)=>a+Number(i.planned||0),0);
  const pago = items.reduce((a,i)=>a+Number(i.paid||0),0);
  el.innerHTML = `
    <div class="cards-row">
      <div class="card"><div class="label">Previsto</div><div class="value">${money(previsto)}</div></div>
      <div class="card"><div class="label">Pago</div><div class="value text-success">${money(pago)}</div></div>
      <div class="card"><div class="label">Falta</div><div class="value text-danger">${money(previsto-pago)}</div></div>
    </div>
    <div class="toolbar"><button class="btn btn-accent" onclick="openSetupModal()">+ Novo custo</button></div>
    <div id="setupTableWrap"></div>`;
  renderSetupTable();
}
function renderSetupTable(){
  const wrap = document.getElementById('setupTableWrap');
  const items = DB.storeSetup.items;
  if(!items.length){ wrap.innerHTML = `<div class="empty-state">Nenhum custo cadastrado</div>`; return; }
  wrap.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Categoria</th><th>Descrição</th><th>Previsto</th><th>Pago</th><th>Falta</th><th></th></tr></thead><tbody>
    ${items.map(i=>`<tr>
      <td>${escapeHtml(i.category)}</td><td>${escapeHtml(i.name||'-')}</td><td>${money(i.planned)}</td><td>${money(i.paid)}</td>
      <td class="${i.planned-i.paid>0?'text-danger':'text-success'}">${money(Math.max(0,i.planned-i.paid))}</td>
      <td>${i.paid<i.planned?`<button class="btn btn-sm btn-accent" onclick="markSetupPaid('${i.id}')">Marcar pago</button>`:''}
          <button class="btn btn-sm" onclick="openSetupModal('${i.id}')">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="deleteSetup('${i.id}')">Excluir</button></td>
    </tr>`).join('')}
  </tbody></table></div>`;
}
function openSetupModal(id){
  const editing = id ? DB.storeSetup.items.find(x=>x.id===id) : null;
  const i = editing || { id:uid(), category:SETUP_CATEGORIES[0], name:'', planned:0, paid:0 };
  const overlay = document.createElement('div');
  overlay.className='modal-overlay';
  overlay.innerHTML = `<div class="modal" style="max-width:420px">
    <h2>${editing?'Editar':'+'} custo de abertura</h2>
    <div class="field"><label>Categoria</label>
      <select id="s_cat">${SETUP_CATEGORIES.map(c=>`<option value="${c}" ${i.category===c?'selected':''}>${c}</option>`).join('')}</select>
    </div>
    <div class="field" style="margin-top:10px"><label>Descrição</label><input id="s_name" value="${escapeHtml(i.name)}"></div>
    <div class="field" style="margin-top:10px"><label>Valor previsto (R$)</label><input type="number" id="s_planned" step="0.01" value="${i.planned}"></div>
    <div class="field" style="margin-top:10px"><label>Valor pago (R$)</label><input type="number" id="s_paid" step="0.01" value="${i.paid}"></div>
    <div class="modal-actions">
      ${editing?`<button class="btn btn-danger" id="deleteBtn" style="margin-right:auto">Excluir</button>`:''}
      <button class="btn" id="cancelBtn">Cancelar</button><button class="btn btn-accent" id="saveBtn">Salvar</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#cancelBtn').addEventListener('click', ()=>overlay.remove());
  overlay.querySelector('#deleteBtn')?.addEventListener('click', ()=>{
    overlay.remove(); deleteSetup(i.id);
  });
  overlay.querySelector('#saveBtn').addEventListener('click', ()=>{
    const data = {
      category: overlay.querySelector('#s_cat').value,
      name: overlay.querySelector('#s_name').value.trim(),
      planned: Number(overlay.querySelector('#s_planned').value)||0,
      paid: Number(overlay.querySelector('#s_paid').value)||0,
    };
    if(editing){ Object.assign(editing, data); }
    else DB.storeSetup.items.push({ id:i.id, ...data });
    saveDB(); overlay.remove(); renderAbrirLoja(document.getElementById('view'));
    toast('Custo salvo');
  });
}
function markSetupPaid(id){
  const i = DB.storeSetup.items.find(x=>x.id===id);
  i.paid = i.planned;
  DB.finance.entries.push({ id:uid(), type:'despesa', category:`Abertura — ${i.category}`, amount:i.planned, date:todayISO(), status:'pago', description:i.name });
  saveDB(); renderSetupTable(); toast('Marcado como pago');
}
function deleteSetup(id){
  if(!confirm('Excluir este item?')) return;
  DB.storeSetup.items = DB.storeSetup.items.filter(i=>i.id!==id);
  saveDB(); renderSetupTable();
}

/* =========================================================
   RELATÓRIOS
   ========================================================= */
function renderRelatorios(el){
  el.innerHTML = `
    <div class="panel"><h3>Vendas nos últimos 7 dias</h3><canvas id="chart7d" height="90"></canvas></div>
    <div class="grid-2">
      <div class="panel"><h3>Ticket médio</h3><div class="value" style="font-size:26px">${money(avgTicket())}</div></div>
      <div class="panel"><h3>Top produtos</h3>${topProductsTable()}</div>
    </div>
    <div class="grid-2">
      <div class="panel"><h3>Vendas por forma de pagamento</h3>${byPaymentTable()}</div>
      <div class="panel"><h3>Vendas por vendedor(a)</h3>${bySellerTable()}</div>
    </div>`;
  drawBarChart('chart7d', last7Days());
}
function avgTicket(){
  const valid = DB.sales.filter(s=>!s.canceled);
  if(!valid.length) return 0;
  return valid.reduce((a,s)=>a+s.total,0)/valid.length;
}
function topProductsTable(){
  const map={};
  DB.sales.filter(s=>!s.canceled).forEach(s=>s.items.forEach(i=>{ map[i.name]=(map[i.name]||0)+i.qty; }));
  const list = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,6);
  if(!list.length) return `<div class="empty-state">Sem dados</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Produto</th><th>Qtd. vendida</th></tr></thead><tbody>
    ${list.map(([n,q])=>`<tr><td>${escapeHtml(n)}</td><td>${q}</td></tr>`).join('')}
  </tbody></table></div>`;
}
function byPaymentTable(){
  const map={};
  DB.sales.filter(s=>!s.canceled).forEach(s=>{ map[s.payment]=(map[s.payment]||0)+s.total; });
  const entries = Object.entries(map);
  if(!entries.length) return `<div class="empty-state">Sem dados</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Forma</th><th>Total</th></tr></thead><tbody>
    ${entries.map(([k,v])=>`<tr><td>${k}</td><td>${money(v)}</td></tr>`).join('')}
  </tbody></table></div>`;
}
function bySellerTable(){
  const map={};
  DB.sales.filter(s=>!s.canceled).forEach(s=>{ map[s.seller]=(map[s.seller]||0)+s.total; });
  const entries = Object.entries(map);
  if(!entries.length) return `<div class="empty-state">Sem dados</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Vendedor(a)</th><th>Total</th></tr></thead><tbody>
    ${entries.map(([k,v])=>`<tr><td>${escapeHtml(k)}</td><td>${money(v)}</td></tr>`).join('')}
  </tbody></table></div>`;
}
function last7Days(){
  const days=[];
  for(let i=6;i>=0;i--){
    const d = new Date(); d.setDate(d.getDate()-i); d.setHours(0,0,0,0);
    const next = new Date(d); next.setDate(d.getDate()+1);
    const total = DB.sales.filter(s=>!s.canceled && new Date(s.date)>=d && new Date(s.date)<next).reduce((a,s)=>a+s.total,0);
    days.push({ label: d.toLocaleDateString('pt-BR',{weekday:'short'}), total });
  }
  return days;
}
function drawBarChart(canvasId, data){
  const canvas = document.getElementById(canvasId);
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.clientWidth || 600; canvas.width = w; canvas.height = 160;
  ctx.clearRect(0,0,w,160);
  const max = Math.max(...data.map(d=>d.total), 1);
  const barW = w/data.length;
  data.forEach((d,i)=>{
    const h = (d.total/max)*110;
    ctx.fillStyle = '#C1694F';
    ctx.fillRect(i*barW+10, 130-h, barW-20, h);
    ctx.fillStyle = '#8A7F77';
    ctx.font = '11px Poppins, sans-serif';
    ctx.textAlign='center';
    ctx.fillText(d.label, i*barW+barW/2, 148);
  });
}

/* =========================================================
   CONFIGURAÇÕES
   ========================================================= */
function renderConfig(el){
  el.innerHTML = `
    <div class="grid-2">
      <div class="panel">
        <h3>Loja</h3>
        <div class="field"><label>Nome da loja</label><input id="cfg_storeName" value="${escapeHtml(DB.storeName)}"></div>
        <div class="field" style="margin-top:10px"><label>Estoque mínimo</label><input type="number" id="cfg_minStock" value="${DB.config.minStock}"></div>
        <button class="btn btn-accent" style="margin-top:14px" id="saveStoreBtn">Salvar</button>
      </div>
      <div class="panel">
        <h3>Loja virtual</h3>
        <div class="field"><label>WhatsApp (com DDD)</label><input id="cfg_whats" value="${escapeHtml(DB.config.whatsapp)}" placeholder="5511999999999"></div>
        <div class="field" style="margin-top:10px"><label>Chave PIX</label><input id="cfg_pix" value="${escapeHtml(DB.config.pixKey)}"></div>
        <div class="field" style="margin-top:10px"><label>Endereço</label><input id="cfg_address" value="${escapeHtml(DB.config.address)}"></div>
        <div class="field" style="margin-top:10px"><label>Frase do topo</label><input id="cfg_phrase" value="${escapeHtml(DB.config.heroPhrase)}"></div>
        <button class="btn btn-accent" style="margin-top:14px" id="saveOnlineBtn">Salvar</button>
      </div>
    </div>
    <div class="panel">
      <h3>Usuários</h3>
      <div id="usersWrap"></div>
      <button class="btn" style="margin-top:10px" onclick="openUserModal()">+ Novo usuário</button>
    </div>
    <div class="panel">
      <h3>Backup</h3>
      <button class="btn" onclick="exportBackup()">⬇️ Exportar JSON</button>
      <label class="btn" style="display:inline-block;margin-left:8px">⬆️ Importar JSON<input type="file" id="importFile" accept=".json" style="display:none"></label>
    </div>`;
  el.querySelector('#saveStoreBtn').addEventListener('click', ()=>{
    DB.storeName = el.querySelector('#cfg_storeName').value.trim() || DB.storeName;
    DB.config.minStock = Number(el.querySelector('#cfg_minStock').value)||0;
    saveDB(); renderShell(); toast('Configurações salvas');
  });
  el.querySelector('#saveOnlineBtn').addEventListener('click', ()=>{
    DB.config.whatsapp = el.querySelector('#cfg_whats').value.trim();
    DB.config.pixKey = el.querySelector('#cfg_pix').value.trim();
    DB.config.address = el.querySelector('#cfg_address').value.trim();
    DB.config.heroPhrase = el.querySelector('#cfg_phrase').value.trim();
    saveDB(); toast('Configurações da loja virtual salvas');
  });
  el.querySelector('#importFile').addEventListener('change', e=>{
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ev=>{
      try{ DB = JSON.parse(ev.target.result); loadDB(); saveDB(); toast('Backup importado'); navigate('painel'); }
      catch(err){ toast('Arquivo inválido','error'); }
    };
    reader.readAsText(file);
  });
  renderUsersTable();
}
function renderUsersTable(){
  const wrap = document.getElementById('usersWrap');
  if(!wrap) return;
  wrap.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Usuário</th><th>Nome</th><th>Perfil</th><th></th></tr></thead><tbody>
    ${DB.users.map(u=>`<tr><td>${escapeHtml(u.user)}</td><td>${escapeHtml(u.name||'-')}</td><td>${u.role==='admin'?'Admin':'Vendedor(a)'}</td>
      <td><button class="btn btn-sm" onclick="openUserModal('${u.id}')">Editar</button></td></tr>`).join('')}
  </tbody></table></div>`;
}
function openUserModal(id){
  const editing = id ? DB.users.find(u=>u.id===id) : null;
  const u = editing || { id:uid(), user:'', pass:'', name:'', role:'vendedor' };
  const overlay = document.createElement('div');
  overlay.className='modal-overlay';
  overlay.innerHTML = `<div class="modal" style="max-width:400px">
    <h2>${editing?'Editar':'Novo'} usuário</h2>
    <div class="field"><label>Nome</label><input id="u_name" value="${escapeHtml(u.name)}"></div>
    <div class="field" style="margin-top:10px"><label>Usuário (login)</label><input id="u_user" value="${escapeHtml(u.user)}"></div>
    <div class="field" style="margin-top:10px"><label>Senha</label><input id="u_pass" value="${escapeHtml(u.pass)}"></div>
    <div class="field" style="margin-top:10px"><label>Perfil</label>
      <select id="u_role"><option value="vendedor" ${u.role==='vendedor'?'selected':''}>Vendedor(a)</option><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option></select>
    </div>
    <div class="modal-actions"><button class="btn" id="cancelBtn">Cancelar</button><button class="btn btn-accent" id="saveBtn">Salvar</button></div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#cancelBtn').addEventListener('click', ()=>overlay.remove());
  overlay.querySelector('#saveBtn').addEventListener('click', ()=>{
    const user = overlay.querySelector('#u_user').value.trim();
    if(!user){ toast('Informe o login','error'); return; }
    const data = { id:u.id, user, pass: overlay.querySelector('#u_pass').value, name: overlay.querySelector('#u_name').value.trim(), role: overlay.querySelector('#u_role').value };
    if(editing) Object.assign(editing, data); else DB.users.push(data);
    saveDB(); overlay.remove(); renderUsersTable();
    toast('Usuário salvo');
  });
}
function exportBackup(){
  const blob = new Blob([JSON.stringify(DB,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `estilo-e-cia-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
}

/* =========================================================
   LEITOR FÍSICO (USB/Bluetooth) — captura global de segurança
   Um leitor "de balcão" digita o código + Enter como se fosse um
   teclado. Os campos do PDV e do Estoque já capturam isso
   normalmente; este listener é só uma rede de segurança para
   quando o foco escapa do campo durante o corre-corre do caixa.
   ========================================================= */
let scanBuffer = '';
let scanLastTime = 0;
document.addEventListener('keydown', e=>{
  const active = document.activeElement;
  const inField = active && ['INPUT','TEXTAREA','SELECT'].includes(active.tagName);
  if(inField){ scanBuffer=''; return; }
  if(!SESSION || (currentRoute!=='pdv' && !estoqueMode)) return;
  const now = Date.now();
  if(now - scanLastTime > 80) scanBuffer = '';
  scanLastTime = now;
  if(e.key==='Enter'){
    if(scanBuffer.length>=3){
      if(currentRoute==='pdv'){
        const found = findVariationByBarcode(scanBuffer);
        if(found) addToCart(found.product, found.variation);
        else toast('Código não encontrado','error');
      } else if(estoqueMode){
        handleBipe(scanBuffer);
      }
    }
    scanBuffer='';
  } else if(e.key.length===1){
    scanBuffer += e.key;
  }
});

/* =========================================================
   INIT
   ========================================================= */
/* Rede de segurança: qualquer erro não tratado vira um aviso visível,
   em vez de deixar a tela em branco sem explicação. */
/* Internet de loja cai o tempo todo. Quando ela volta, o que ficou na fila
   sobe sozinho, sem ninguém precisar lembrar. */
window.addEventListener('online', ()=>enviarFotosPendentes());

window.addEventListener('error', e=>{
  if(e && e.message) toast('Erro: '+e.message, 'error');
});

document.addEventListener('DOMContentLoaded', ()=>{
  loadDB();
  restoreSession();
  cloudPull();

  document.getElementById('loginForm').addEventListener('submit', e=>{
    e.preventDefault();
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value;
    if(tryLogin(user, pass)){ showApp(); }
    else {
      /* Dizer só "inválidos" não ajuda quem trocou a senha e esqueceu:
         mostramos quais usuários existem de verdade neste sistema. */
      const nomes = DB.users.map(u=>u.user).join(', ');
      document.getElementById('loginError').textContent =
        'Usuário ou senha inválidos. Cadastrados aqui: ' + nomes;
      document.getElementById('loginHelpBtn').style.display = 'block';
    }
  });
  document.getElementById('loginHelpBtn').addEventListener('click', recuperarAcesso);
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('navList').addEventListener('click', e=>{
    const a = e.target.closest('a[data-route]');
    if(a){ e.preventDefault(); navigate(a.dataset.route); closeSidebar(); }
  });
  document.getElementById('menuToggle')?.addEventListener('click', toggleSidebar);
  document.getElementById('sidebarBackdrop')?.addEventListener('click', closeSidebar);

  migrarFotosAntigas();
  atualizaDicaLogin();
  const lv = document.getElementById('loginVersion');
  if(lv) lv.textContent = 'versão ' + APP_VERSION;
  if(SESSION){ showApp(); } else { showLogin(); }
});

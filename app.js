/* =========================================================
   ESTILO & CIA — Sistema (ERP / PDV)
   Puro HTML/CSS/JS. Estado em localStorage sincronizado
   com Supabase (estado inteiro num JSON).
   ========================================================= */

/* ---------- Supabase ---------- */
const SUPABASE_URL = "https://sjuvryprgbkrbzkvnnhw.supabase.co";
const SUPABASE_KEY = "sb_publishable_8uMMZINGFWPcXmwQGevnBQ_ksULyUau";
const SUPABASE_TABLE = "loja_roupas_db";
const STORAGE_KEY = "estiloCiaDB";
const SESSION_KEY = "estiloCiaSession";

let DB = null;
let SESSION = null;
let currentRoute = "painel";
let pushTimer = null;

/* ---------- Util ---------- */
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function money(v){ return (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function todayISO(){ return new Date().toISOString(); }
function dateBR(iso){ if(!iso) return '-'; const d=new Date(iso); return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); }
function monthKey(d=new Date()){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
function monthLabel(mk){ const [y,m]=mk.split('-'); const names=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']; return names[Number(m)-1]+'/'+y; }
function escapeHtml(s){ return String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function toast(msg, type='ok'){
  let t = document.getElementById('toast');
  if(!t){ t=document.createElement('div'); t.id='toast'; document.body.appendChild(t);
    t.style.cssText='position:fixed;bottom:20px;right:20px;z-index:999;padding:12px 18px;border-radius:10px;color:#fff;font-size:13.5px;box-shadow:0 6px 20px rgba(0,0,0,.2);transition:opacity .3s'; }
  t.style.background = type==='error' ? '#B33A3A' : (type==='warn' ? '#C1874F' : '#4C8B5C');
  t.textContent = msg; t.style.opacity='1';
  clearTimeout(t._h); t._h=setTimeout(()=>{ t.style.opacity='0'; },2200);
}

/* ---------- DB default schema ---------- */
function defaultDB(){
  return {
    storeName: "Estilo & Cia",
    config: {
      minStock: 5,
      whatsapp: "",
      pixKey: "",
      address: "",
      heroPhrase: "Estilo que é só seu ✨"
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
      records: []
    },
    barcodeSeq: 0
  };
}

/* ---------- Load / Save ---------- */
function loadDB(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    DB = raw ? JSON.parse(raw) : defaultDB();
  }catch(e){ DB = defaultDB(); }
  // migração: garante campos novos em bancos antigos
  const d = defaultDB();
  for(const k in d){ if(!(k in DB)) DB[k] = d[k]; }
  if(!DB.monthlyExpenses) DB.monthlyExpenses = d.monthlyExpenses;
  if(!DB.monthlyExpenses.categories) DB.monthlyExpenses.categories = d.monthlyExpenses.categories;
  if(!DB.monthlyExpenses.records) DB.monthlyExpenses.records = [];
  if(!DB.cashRegister.closedHistory) DB.cashRegister.closedHistory = [];
  if(!DB.barcodeSeq) DB.barcodeSeq = 0;
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

function saveDB(skipCloud){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
  if(!skipCloud){
    clearTimeout(pushTimer);
    pushTimer = setTimeout(cloudPush, 800);
  }
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
      DB = rows[0].data;
      loadDB(); // reaplica migração de campos novos
      saveDB(true);
      if(document.getElementById('app') && !document.getElementById('app').classList.contains('hidden')) render();
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
const NAV = [
  { id:'painel', label:'Painel', icon:'🏠' },
  { id:'pdv', label:'PDV', icon:'🛒' },
  { id:'produtos', label:'Produtos', icon:'👗' },
  { id:'estoque', label:'Estoque', icon:'📦' },
  { id:'etiquetas', label:'Etiquetas', icon:'🏷️' },
  { id:'clientes', label:'Clientes', icon:'👤' },
  { id:'vendas', label:'Vendas', icon:'🧾' },
  { id:'caixa', label:'Caixa', icon:'💰' },
  { id:'financeiro', label:'Financeiro', icon:'📊' },
  { id:'gastos', label:'Gastos Mensais', icon:'🧮' },
  { id:'abrirloja', label:'Abrir Loja', icon:'🏗️' },
  { id:'relatorios', label:'Relatórios', icon:'📈' },
  { id:'config', label:'Configurações', icon:'⚙️' },
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
  navEl.innerHTML = NAV.map(n=>`<li><a href="#${n.id}" data-route="${n.id}">${n.icon} ${n.label}</a></li>`).join('');
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
    relatorios: renderRelatorios, config: renderConfig
  };
  view.innerHTML = '';
  (renderers[route]||renderPainel)(view);
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
  const list = DB.products.filter(p=> !f || p.name.toLowerCase().includes(f) || (p.sku||'').toLowerCase().includes(f) || (p.category||'').toLowerCase().includes(f));
  if(!list.length){ wrap.innerHTML = `<div class="empty-state">Nenhum produto cadastrado</div>`; return; }
  wrap.innerHTML = `<div class="table-wrap"><table><thead><tr>
    <th>Foto</th><th>Produto</th><th>SKU</th><th>Categoria</th><th>Preço</th><th>Estoque total</th><th>Loja</th><th></th>
  </tr></thead><tbody>
    ${list.map(p=>{
      const total = p.variations.reduce((a,v)=>a+Number(v.stock||0),0);
      return `<tr>
        <td><img src="${escapeHtml(p.photo||'')}" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'" style="width:40px;height:40px;object-fit:cover;border-radius:6px;background:var(--sand)"></td>
        <td>${escapeHtml(p.name)} ${p.isNew?'<span class="tag-new">NOVO</span>':''}</td>
        <td>${escapeHtml(p.sku||'-')}</td>
        <td>${escapeHtml(p.category||'-')}</td>
        <td>${money(p.price)}</td>
        <td class="${total<=DB.config.minStock?'text-danger':''}">${total}</td>
        <td>${p.showInStore!==false?'<span class="badge badge-success">Visível</span>':'<span class="badge badge-muted">Oculto</span>'}</td>
        <td><button class="btn btn-sm" onclick="openProductModal('${p.id}')">Editar</button>
            <button class="btn btn-sm btn-danger" onclick="deleteProduct('${p.id}')">Excluir</button></td>
      </tr>`;
    }).join('')}
  </tbody></table></div>`;
}
function deleteProduct(id){
  if(!confirm('Excluir este produto?')) return;
  DB.products = DB.products.filter(p=>p.id!==id);
  saveDB(); renderProdutosTable(); toast('Produto excluído');
}
function openProductModal(id){
  const editing = id ? DB.products.find(p=>p.id===id) : null;
  const p = editing || { id:uid(), sku:'', name:'', category:'', brand:'', cost:0, price:0, photo:'', description:'', showInStore:true, isNew:false, variations:[{size:'',color:'',stock:0,barcode:''}] };
  const overlay = document.createElement('div');
  overlay.className='modal-overlay';
  overlay.innerHTML = `<div class="modal" style="max-width:640px">
    <h2>${editing?'Editar':'Novo'} produto</h2>
    <div class="form-grid">
      <div class="field"><label>Nome</label><input id="f_name" value="${escapeHtml(p.name)}"></div>
      <div class="field"><label>SKU</label><input id="f_sku" value="${escapeHtml(p.sku)}"></div>
      <div class="field"><label>Categoria</label><input id="f_category" value="${escapeHtml(p.category)}" placeholder="Vestidos, Blusas..."></div>
      <div class="field"><label>Marca</label><input id="f_brand" value="${escapeHtml(p.brand)}"></div>
      <div class="field"><label>Custo (R$)</label><input id="f_cost" type="number" step="0.01" value="${p.cost}"></div>
      <div class="field"><label>Preço de venda (R$)</label><input id="f_price" type="number" step="0.01" value="${p.price}"></div>
      <div class="field full"><label>Foto (URL)</label><input id="f_photo" value="${escapeHtml(p.photo)}" placeholder="https://..."></div>
      <div class="field full"><label>Descrição</label><textarea id="f_desc" rows="2">${escapeHtml(p.description)}</textarea></div>
      <div class="field"><label><input type="checkbox" id="f_show" ${p.showInStore!==false?'checked':''}> Mostrar na loja virtual</label></div>
      <div class="field"><label><input type="checkbox" id="f_new" ${p.isNew?'checked':''}> Selo NOVO</label></div>
    </div>
    <h3 style="margin:18px 0 10px;font-size:14px">Variações (tamanho / cor / estoque / código de barras)</h3>
    <div id="varRows"></div>
    <button class="btn btn-sm" id="addVarBtn" type="button">+ Adicionar variação</button>
    <div class="modal-actions">
      <button class="btn" id="cancelBtn">Cancelar</button>
      <button class="btn btn-accent" id="saveBtn">Salvar</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
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
    const name = overlay.querySelector('#f_name').value.trim();
    if(!name){ toast('Informe o nome do produto','error'); return; }
    const finalVariations = variations.filter(v=>v.size || v.color || v.stock);
    finalVariations.forEach(v=>{ if(!v.barcode) v.barcode = generateUniqueBarcode(); });
    const data = {
      id:p.id, name,
      sku: overlay.querySelector('#f_sku').value.trim(),
      category: overlay.querySelector('#f_category').value.trim(),
      brand: overlay.querySelector('#f_brand').value.trim(),
      cost: Number(overlay.querySelector('#f_cost').value)||0,
      price: Number(overlay.querySelector('#f_price').value)||0,
      photo: overlay.querySelector('#f_photo').value.trim(),
      description: overlay.querySelector('#f_desc').value.trim(),
      showInStore: overlay.querySelector('#f_show').checked,
      isNew: overlay.querySelector('#f_new').checked,
      variations: finalVariations
    };
    if(editing){ Object.assign(editing, data); }
    else DB.products.push(data);
    saveDB(); overlay.remove(); renderProdutosTable();
    toast('Produto salvo');
  });
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
function renderStockTable(){
  const wrap = document.getElementById('stockTableWrap');
  if(!wrap) return;
  const rows=[];
  DB.products.forEach(p=>p.variations.forEach(v=>rows.push({p,v})));
  if(!rows.length){ wrap.innerHTML = `<div class="empty-state">Nenhum produto cadastrado</div>`; return; }
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
  if(!rows.length){ wrap.innerHTML = `<div class="empty-state">Nenhum produto cadastrado</div>`; return; }
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
  el.querySelectorAll('[data-pay]').forEach(b=>b.addEventListener('click', e=>{ pdvPayment=e.target.dataset.pay; renderPDV(el); }));
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
  if(!DB.cashRegister.open){ toast('Abra o caixa antes de vender','error'); return; }
  const total = Math.max(0, cartSubtotal()-pdvDiscount);
  const sale = {
    id: uid(), date: todayISO(),
    items: cart.map(i=>({productId:i.productId, name:i.name, size:i.size, color:i.color, price:i.price, qty:i.qty})),
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
  saveDB();
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
function renderVendasTable(){
  const wrap = document.getElementById('vendasWrap');
  const list = [...DB.sales].sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(!list.length){ wrap.innerHTML=`<div class="empty-state">Nenhuma venda registrada</div>`; return; }
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
  </tbody></table></div>`;
}
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
function openFinanceModal(type){
  const overlay = document.createElement('div');
  overlay.className='modal-overlay';
  overlay.innerHTML = `<div class="modal" style="max-width:420px">
    <h2>${type==='receita'?'+ Receita':'+ Despesa'}</h2>
    <div class="field"><label>Categoria</label><input id="fe_cat"></div>
    <div class="field" style="margin-top:10px"><label>Descrição</label><input id="fe_desc"></div>
    <div class="field" style="margin-top:10px"><label>Valor (R$)</label><input type="number" id="fe_amount" step="0.01"></div>
    <div class="field" style="margin-top:10px"><label>Status</label>
      <select id="fe_status"><option value="pago">Pago</option><option value="pendente">Pendente</option></select>
    </div>
    <div class="modal-actions"><button class="btn" id="cancelBtn">Cancelar</button><button class="btn btn-accent" id="saveBtn">Salvar</button></div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#cancelBtn').addEventListener('click', ()=>overlay.remove());
  overlay.querySelector('#saveBtn').addEventListener('click', ()=>{
    const amount = Number(overlay.querySelector('#fe_amount').value)||0;
    if(amount<=0){ toast('Informe um valor','error'); return; }
    DB.finance.entries.push({ id:uid(), type, category: overlay.querySelector('#fe_cat').value.trim()||'Outros',
      description: overlay.querySelector('#fe_desc').value.trim(), amount, date: todayISO(), status: overlay.querySelector('#fe_status').value });
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
    <div id="gastosTableWrap"></div>`;
  el.querySelector('#gastosMonthInput').addEventListener('change', e=>{ gastosMonth=e.target.value; renderGastos(el); });
  renderGastosTable();
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
function openGastoModal(){
  const cats = DB.monthlyExpenses.categories;
  const overlay = document.createElement('div');
  overlay.className='modal-overlay';
  overlay.innerHTML = `<div class="modal" style="max-width:420px">
    <h2>Lançar gasto mensal — ${monthLabel(gastosMonth)}</h2>
    <div class="field"><label>Categoria</label>
      <select id="g_cat">${cats.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}</select>
    </div>
    <div class="field" style="margin-top:10px"><label>Descrição (opcional)</label><input id="g_note"></div>
    <div class="field" style="margin-top:10px"><label>Valor (R$)</label><input type="number" id="g_amount" step="0.01"></div>
    <div class="field" style="margin-top:10px"><label>Status</label>
      <select id="g_status"><option value="pendente">Pendente</option><option value="pago">Pago</option></select>
    </div>
    <div class="modal-actions"><button class="btn" id="cancelBtn">Cancelar</button><button class="btn btn-accent" id="saveBtn">Salvar</button></div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#cancelBtn').addEventListener('click', ()=>overlay.remove());
  overlay.querySelector('#saveBtn').addEventListener('click', ()=>{
    const amount = Number(overlay.querySelector('#g_amount').value)||0;
    if(amount<=0){ toast('Informe um valor','error'); return; }
    const status = overlay.querySelector('#g_status').value;
    const record = { id:uid(), month:gastosMonth, category: overlay.querySelector('#g_cat').value, note: overlay.querySelector('#g_note').value.trim(), amount, status, paidDate: status==='pago'?todayISO():null };
    DB.monthlyExpenses.records.push(record);
    if(status==='pago'){
      DB.finance.entries.push({ id:uid(), type:'despesa', category:`Gasto mensal — ${record.category}`, amount, date: todayISO(), status:'pago', description: record.note||record.category });
    }
    saveDB(); overlay.remove(); renderGastos(document.getElementById('view'));
    toast('Gasto lançado');
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
          <button class="btn btn-sm btn-danger" onclick="deleteSetup('${i.id}')">Excluir</button></td>
    </tr>`).join('')}
  </tbody></table></div>`;
}
function openSetupModal(){
  const overlay = document.createElement('div');
  overlay.className='modal-overlay';
  overlay.innerHTML = `<div class="modal" style="max-width:420px">
    <h2>+ Custo de abertura</h2>
    <div class="field"><label>Categoria</label>
      <select id="s_cat">${SETUP_CATEGORIES.map(c=>`<option value="${c}">${c}</option>`).join('')}</select>
    </div>
    <div class="field" style="margin-top:10px"><label>Descrição</label><input id="s_name"></div>
    <div class="field" style="margin-top:10px"><label>Valor previsto (R$)</label><input type="number" id="s_planned" step="0.01"></div>
    <div class="modal-actions"><button class="btn" id="cancelBtn">Cancelar</button><button class="btn btn-accent" id="saveBtn">Salvar</button></div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#cancelBtn').addEventListener('click', ()=>overlay.remove());
  overlay.querySelector('#saveBtn').addEventListener('click', ()=>{
    const planned = Number(overlay.querySelector('#s_planned').value)||0;
    DB.storeSetup.items.push({ id:uid(), category: overlay.querySelector('#s_cat').value, name: overlay.querySelector('#s_name').value.trim(), planned, paid:0 });
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
document.addEventListener('DOMContentLoaded', ()=>{
  loadDB();
  restoreSession();
  cloudPull();

  document.getElementById('loginForm').addEventListener('submit', e=>{
    e.preventDefault();
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value;
    if(tryLogin(user, pass)){ showApp(); }
    else document.getElementById('loginError').textContent = 'Usuário ou senha inválidos';
  });
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('navList').addEventListener('click', e=>{
    const a = e.target.closest('a[data-route]');
    if(a){ e.preventDefault(); navigate(a.dataset.route); }
  });
  document.getElementById('menuToggle')?.addEventListener('click', ()=>{
    document.querySelector('.sidebar').classList.toggle('open');
  });

  if(SESSION){ showApp(); } else { showLogin(); }
});

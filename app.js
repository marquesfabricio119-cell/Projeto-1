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
const APP_VERSION = "64";

/* A ligação com a nuvem deixou de ser fixa no código. A loja perdeu o
   acesso ao projeto antigo do Supabase e ficou sem poder trocar sozinha —
   dependia de mim mexer no código e publicar. Agora o endereço, a chave e
   a tabela são configuráveis pela tela, e ficam guardados só neste
   aparelho: não sobem para a nuvem, para uma configuração ruim não se
   espalhar para os outros aparelhos da loja. */
const NUVEM_PADRAO = {
  url: "https://mfywchoecdhbzuiskpwx.supabase.co",
  key: "sb_publishable_aHss5Ke_FyBqGAdoXsM9ZA_OWv9iNER",
  tabela: "loja_roupas_db",
  bucket: "fotos"
};

/* O projeto anterior ficou sem dono acessível. Um aparelho que tenha a
   ligação antiga guardada continuaria falando com ele para sempre, então
   ela é descartada uma vez, e o aparelho passa a usar o projeto novo. */
const NUVEM_ABANDONADA = "sjuvryprgbkrbzkvnnhw";
const CHAVE_NUVEM = 'estiloFashion_nuvem';

function configNuvem(){
  try{
    const c = JSON.parse(localStorage.getItem(CHAVE_NUVEM) || 'null');
    if(c && c.url && c.key){
      if(String(c.url).includes(NUVEM_ABANDONADA)){
        localStorage.removeItem(CHAVE_NUVEM);
        return { ...NUVEM_PADRAO };
      }
      return { ...NUVEM_PADRAO, ...c };
    }
  }catch(e){}
  /* Cópia aberta num servidor local (teste, desenvolvimento) NÃO fala com
     a nuvem da loja por padrão: um teste de venda iria parar no estoque
     de verdade. Quem precisar liga a nuvem em Configurações → Nuvem. */
  if(typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname || '')){
    return { ...NUVEM_PADRAO, url:'https://teste-desligado.supabase.co', key:'teste-local' };
  }
  return { ...NUVEM_PADRAO };
}
function salvarConfigNuvem(c){
  localStorage.setItem(CHAVE_NUVEM, JSON.stringify(c));
}
function cabecalhosNuvem(extra){
  const c = configNuvem();
  return { apikey: c.key, Authorization: 'Bearer ' + c.key, ...(extra||{}) };
}
const STORAGE_KEY = "estiloCiaDB";
const LOCAL_TS_KEY = "estiloCiaDB_ts";
const SESSION_KEY = "estiloCiaSession";

let DB = null;
let SESSION = null;
let currentRoute = "painel"; // recarregou a página? volta para o resumo do dia
let pushTimer = null;

/* ---------- Util ---------- */
function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
function money(v){ return (Number(v)||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}); }
function todayISO(){ return new Date().toISOString(); }
function dateBR(iso){ if(!iso) return '-'; const d=new Date(iso); return d.toLocaleDateString('pt-BR')+' '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); }
function monthKey(d=new Date()){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
function monthLabel(mk){ const [y,m]=mk.split('-'); const names=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']; return names[Number(m)-1]+'/'+y; }
function escapeHtml(s){ return String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
/* O mês de uma data, NO FUSO DA LOJA. As datas são gravadas em UTC
   (terminam em Z), e comparar o texto delas com o mês local errava na
   virada: uma venda das 22h do dia 30 aqui é dia 1º em UTC, e caía no
   mês seguinte no Balanço e no Financeiro. */
function chaveMes(iso){
  if(!iso) return '';
  const d = new Date(iso);
  if(isNaN(d)) return String(iso).slice(0,7);
  return monthKey(d);
}
function chaveDia(iso){
  if(!iso) return '';
  const d = new Date(iso);
  if(isNaN(d)) return String(iso).slice(0,10);
  return monthKey(d) + '-' + String(d.getDate()).padStart(2,'0');
}
/* Uma venda que conta como dinheiro que entrou: não cancelada e, se veio
   da loja virtual, já paga. O pedido pendente do site aparecia no
   "Faturado hoje" e nos relatórios antes de a cliente pagar. */
function vendaValida(s){ return s && !s.canceled && s.status !== 'pendente'; }
/* Carimbo de "mexido em". Quando dois aparelhos editam o mesmo registro,
   a junção fica com o mais recente em vez de sempre o local. */
/* Dinheiro sempre em centavos inteiros: 3 × 33,33 não pode virar 99,99000000000001. */
function centavos(v){ return Math.round((Number(v)||0) * 100) / 100; }
function carimbar(obj){ if(obj && typeof obj === 'object') obj.atualizadoEm = todayISO(); return obj; }
/* Data e hora locais no formato do campo datetime-local. O campo mostrava
   a hora em UTC (3 h à frente) e cada salvamento empurrava a venda 3 h. */
function paraDatetimeLocal(iso){
  const d = iso ? new Date(iso) : new Date();
  if(isNaN(d)) return '';
  const p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
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
  t.style.background = type==='error' ? '#DC3545' : (type==='warn' ? '#C27A12' : '#17171C');
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
      heroPhrase: "Moda que realça quem você é ✨",
      /* Cupom fiscal (NFC-e). O que é da loja fica aqui e vai para a
         nuvem; a chave de emissão fica só no aparelho. */
      fiscal: { ativo:false, cnpj:'', naturezaOperacao:'Venda ao consumidor', ncmPadrao:'61091000',
                cfop:'5102', csosn:'102', origem:'0', pisCofins:'49', unidade:'UN', serie:'', endpoint:'/api/nfce' }
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
    /* Perdas e devoluções: cada peça que saiu sem ser vendida, ou voltou. */
    perdas: { records:[] },
    monthlyExpenses: {
      categories: ["Aluguel","Água","Luz","Internet","Telefone","Manutenção","Salários e encargos","Contador","Segurança/Alarme","Embalagens","Marketing","IPTU","Taxas de maquininha","Limpeza","Outros"],
      records: [],
      /* Despesas que se repetem todo mês (aluguel, luz, internet…).
         Cadastradas uma vez e lançadas no mês com um clique, em vez de
         digitar as mesmas linhas de novo a cada 30 dias. */
      fixed: []
    },
    barcodeSeq: 0,
    /* O que foi apagado DE PROPÓSITO. Sem esta lista, juntar o banco daqui
       com o da nuvem trazia de volta a peça que o lojista tinha acabado de
       excluir — ele apagava, ela reaparecia, e ninguém entendia. */
    apagados: {}
  };
}

/* ---------- Custos de abertura: a semeadura foi desligada ----------
   A lista padrão de custos "Abrir Loja" era plantada em todo aparelho que
   abrisse sem dados — inclusive num aparelho novo que ainda ia buscar a
   nuvem. Cada plantio criava os mesmos 37 itens com ids novos, e a junção
   com a nuvem os somava: a loja ficou com 75 custos, 36 repetidos, e o
   "total previsto" dobrou. A lista já vive na nuvem; não se planta mais. */
function seedInitialData(){
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
  /* Um produto sem id ganhava um id novo A CADA carregamento. Quem já estava
     marcado na tela de etiquetas passava a apontar para um id que não existe
     mais, e o sistema dizia que nada estava selecionado — com a caixa
     marcada na frente do lojista. O id passa a sair do próprio conteúdo,
     então é sempre o mesmo. */
  const idEstavel = (p, i) => {
    reparou = true;
    const semente = (p && (p.sku || p.name || '') || '') + '#' + i;
    let h = 5381;
    for(let k = 0; k < semente.length; k++) h = ((h * 33) ^ semente.charCodeAt(k)) >>> 0;
    return 'r' + h.toString(36) + i;
  };

  /* O id é SEMPRE texto. O sistema antigo gravava números (id: 1), e os
     botões da tela passam o id como texto ('1'): 1 !== '1', então Editar
     abria uma peça nova e Excluir dizia "não encontrado". Foi assim que a
     loja ficou com um "Produto sem nome" que não saía de jeito nenhum. */
  const idTexto = v => (v === undefined || v === null || v === '') ? '' : String(v);
  const idMudou = (antes, depois) => { if(antes !== depois) reparou = true; return depois; };

  /* Sobras do sistema antigo (outra estrutura, outro nome de loja). Nada
     aqui é lido por este sistema, e tudo viajava para a nuvem a cada
     gravação. O que tinha valor já foi trazido: `abertura` virou Abrir
     Loja, `clients` virou Clientes. */
  /* Backup do sistema antigo importado agora: clientes e custos de
     abertura só existem no formato velho. Entram antes de a sobra sair. */
  if(arr(DB.clients).length && !arr(DB.customers).length){
    DB.customers = arr(DB.clients).filter(Boolean).map((c, i)=>({
      id: 'cli' + idTexto(c.id || i + 1), name: c.name || c.nome || 'Cliente', phone: c.phone || c.tel || c.telefone || c.whatsapp || '',
      email: c.email || '', address: c.address || c.endereco || '', notes: c.notes || c.obs || '' }));
  }
  if(arr(DB.abertura).length && !arr((DB.storeSetup||{}).items).length){
    DB.storeSetup = { ...(DB.storeSetup||{}), items: arr(DB.abertura).filter(Boolean).map((a, i)=>({
      id: 'ab' + idTexto(a.id || i + 1), name: a.desc || a.name || 'Item', category: a.cat || a.category || 'Outros',
      planned: num(a.previsto), paid: a.pago === true ? num(a.previsto) : num(a.pago), note: a.obs || '' })) };
  }
  ['seq','cash','clients','abertura','settings'].forEach(k=>{ if(k in DB){ delete DB[k]; reparou = true; } });

  DB.products = arr(DB.products).filter(Boolean).map((p, i)=>({
    ...p,
    id: idMudou(p.id, idTexto(p.id) || idEstavel(p, i)),
    /* Campos do sistema antigo (nome, marca, codigo, categoria, precoCusto,
       precoVenda) valem quando os novos estão vazios: um backup antigo
       importado chegava como "Produto sem nome, R$ 0,00". */
    name: p.name || p.nome || 'Produto sem nome',
    sku: p.sku || p.codigo || '',
    category: p.category || p.categoria || '',
    brand: p.brand || p.marca || '',
    cost: num(p.cost) || num(p.precoCusto),
    price: num(p.price) || num(p.precoVenda),
    photo: p.photo || '',
    description: p.description || '',
    // `loja` era o nome antigo do "mostrar na loja virtual"
    showInStore: p.showInStore !== undefined ? p.showInStore !== false : p.loja !== false,
    isNew: !!p.isNew,
    variations: (()=>{
      let fonte = arr(p.variations).filter(Boolean);
      /* `variacoes` (tam/cor/qtd/bar) era a lista do sistema antigo. Só
         entra quando não há a lista nova com estoque de verdade. */
      const antigas = arr(p.variacoes).filter(Boolean);
      if(antigas.length && !fonte.some(v=>num(v.stock) > 0 || v.barcode)){
        fonte = antigas.map(v=>({ size: v.tam || v.size || '', color: v.cor || v.color || '',
                                 stock: num(v.qtd !== undefined ? v.qtd : v.stock), barcode: v.bar || v.barcode || '' }));
        reparou = true;
      }
      const vs = fonte.map(v=>({
        ...v,
        size: v.size || v.tam || '',
        color: v.color || v.cor || '',
        stock: num(v.stock !== undefined ? v.stock : v.qtd),
        // `bar` era o nome antigo do código de barras
        barcode: v.barcode || v.bar || ''
      }));
      // Um produto sem variação some do Estoque, do PDV e das Etiquetas,
      // que são montados a partir delas. Garante a variação padrão.
      if(vs.length) return vs;
      reparou = true;
      return [{ size:'Único', color:'Padrão', stock:0, barcode:'' }];
    })()
  })).map(p=>{
    /* Os campos do sistema antigo saem depois de aproveitados. Ficando,
       a peça vendida até zerar "ressuscitava" com o estoque antigo na
       abertura seguinte, e o preço zerado de propósito voltava ao velho. */
    ['variacoes','nome','codigo','categoria','marca','precoCusto','precoVenda','loja'].forEach(k=>{
      if(k in p){ delete p[k]; reparou = true; }
    });
    p.variations.forEach(v=>{ ['tam','cor','qtd','bar'].forEach(k=>{ if(k in v){ delete v[k]; reparou = true; } }); });
    return p;
  });

  DB.customers = arr(DB.customers).filter(Boolean).map(c=>({
    ...c, id: idMudou(c.id, idTexto(c.id) || novoId()), name: c.name || 'Cliente'
  }));

  DB.sales = arr(DB.sales).filter(Boolean).map(s=>({
    ...s,
    id: idMudou(s.id, idTexto(s.id) || novoId()),
    date: s.date || idMudou('', todayISO()),
    items: arr(s.items).filter(Boolean).map(i=>({ ...i, productId: idTexto(i.productId), qty: num(i.qty), price: num(i.price) })),
    discount: num(s.discount),
    total: num(s.total),
    payment: s.payment || 'Dinheiro',
    seller: s.seller || '-',
    // `origem` era o nome antigo de `origin`
    origin: s.origin || s.origem || 'pdv',
    canceled: !!s.canceled,
    customerId: s.customerId ? idTexto(s.customerId) : null
  }));

  if(!DB.finance || typeof DB.finance !== 'object') DB.finance = { entries: [] };
  DB.finance.entries = arr(DB.finance.entries).filter(Boolean).map(e=>({ ...e, id: idTexto(e.id) || novoId(), amount: num(e.amount) }));

  if(!DB.storeSetup || typeof DB.storeSetup !== 'object') DB.storeSetup = { items: [] };
  DB.storeSetup.items = arr(DB.storeSetup.items).filter(Boolean).map(i=>({ ...i, id: idTexto(i.id) || novoId(), planned: num(i.planned), paid: num(i.paid) }));

  /* O que foi apagado de propósito fica apagado — também aqui, e não só
     na hora de juntar com a nuvem. A peça que a loja excluiu e que voltou
     por um id mal comparado sai agora, de vez. */
  const lapides = (DB.apagados && typeof DB.apagados === 'object') ? DB.apagados : {};
  const tirar = (lista, chave) => {
    const fora = new Set(arr(lapides[chave]).map(String));
    if(!fora.size) return lista;
    const sobra = lista.filter(x=>!fora.has(String(x.id)));
    if(sobra.length !== lista.length) reparou = true;
    return sobra;
  };
  DB.products = tirar(DB.products, 'products');
  DB.customers = tirar(DB.customers, 'customers');
  DB.sales = tirar(DB.sales, 'sales');
  DB.finance.entries = tirar(DB.finance.entries, 'finance');
  DB.storeSetup.items = tirar(DB.storeSetup.items, 'setup');
  if(!DB.perdas || typeof DB.perdas !== 'object') DB.perdas = { records: [] };
  DB.perdas.records = tirar(arr(DB.perdas.records).filter(Boolean).map(r=>({
    ...r, id: idTexto(r.id) || novoId(), tipo: r.tipo === 'devolucao' ? 'devolucao' : 'perda',
    productId: idTexto(r.productId), qty: num(r.qty), date: r.date || todayISO(),
    custoUnit: num(r.custoUnit), precoUnit: num(r.precoUnit), valor: num(r.valor)
  })), 'perdas');
  /* Custos de abertura repetidos (mesmo nome e categoria) viram um só —
     pela mesma regra em todo aparelho: fica o mexido por último; empatando,
     o de maior valor (o que a loja corrigiu à mão); empatando, o de id
     menor. Os outros ganham lápide, para não voltarem pela junção. */
  /* Só vale para item SEM carimbo — as cópias da lista de fábrica, que é
     de onde as repetições vieram. Dois "Manequim" lançados pela loja são
     duas compras, e cada um carrega o carimbo de quando foi lançado. */
  const chaveCusto = i => String(i.name||'').trim().toLowerCase().replace(/\s+/g,' ') + '|' + String(i.category||'').trim().toLowerCase();
  const porCusto = new Map();
  const comCarimbo = new Set(DB.storeSetup.items.filter(i=>i.atualizadoEm).map(chaveCusto));
  DB.storeSetup.items.forEach(i=>{
    if(i.atualizadoEm){ porCusto.set('#' + i.id, i); return; }
    const k = chaveCusto(i);
    if(comCarimbo.has(k)) return;        // a loja já corrigiu este item à mão: a cópia de fábrica sai
    const atual = porCusto.get(k);
    if(!atual){ porCusto.set(k, i); return; }
    const tA = Date.parse(atual.atualizadoEm||'') || 0, tI = Date.parse(i.atualizadoEm||'') || 0;
    let fica = atual;
    if(tI !== tA) fica = tI > tA ? i : atual;
    else if((num(i.planned) + num(i.paid)) !== (num(atual.planned) + num(atual.paid))) fica = (num(i.planned) + num(i.paid)) > (num(atual.planned) + num(atual.paid)) ? i : atual;
    else if(String(i.id) < String(atual.id)) fica = i;
    porCusto.set(k, fica);
  });
  if(porCusto.size !== DB.storeSetup.items.length){
    const ficam = new Set([...porCusto.values()].map(i=>i.id));
    DB.apagados = DB.apagados || {};
    DB.apagados.setup = DB.apagados.setup || [];
    DB.storeSetup.items.forEach(i=>{ if(!ficam.has(i.id) && !DB.apagados.setup.includes(String(i.id))) DB.apagados.setup.push(String(i.id)); });
    DB.storeSetup.items = DB.storeSetup.items.filter(i=>ficam.has(i.id));
    reparou = true;
  }

  if(!DB.cashRegister || typeof DB.cashRegister !== 'object') DB.cashRegister = defaultDB().cashRegister;
  DB.cashRegister.movements = arr(DB.cashRegister.movements);
  DB.cashRegister.closedHistory = arr(DB.cashRegister.closedHistory);

  if(!DB.monthlyExpenses || typeof DB.monthlyExpenses !== 'object') DB.monthlyExpenses = defaultDB().monthlyExpenses;
  if(!Array.isArray(DB.monthlyExpenses.fixed)) DB.monthlyExpenses.fixed = [];
  DB.monthlyExpenses.fixed = DB.monthlyExpenses.fixed.filter(Boolean).map(f=>({
    ...f, id: idTexto(f.id) || novoId(), category: f.category || 'Outros',
    note: f.note || '', amount: num(f.amount), dueDay: num(f.dueDay) || 0
  }));
  DB.monthlyExpenses.fixed = tirar(DB.monthlyExpenses.fixed, 'fixed');
  if(!Array.isArray(DB.monthlyExpenses.records)) DB.monthlyExpenses.records = [];
  DB.monthlyExpenses.records = DB.monthlyExpenses.records.filter(Boolean).map(r=>({
    ...r, id: idTexto(r.id) || novoId(), amount: num(r.amount), status: r.status || 'pendente'
  }));
  DB.monthlyExpenses.records = tirar(DB.monthlyExpenses.records, 'records');
  if(!Array.isArray(DB.monthlyExpenses.categories) || !DB.monthlyExpenses.categories.length){
    DB.monthlyExpenses.categories = defaultDB().monthlyExpenses.categories;
  }

  DB.users = arr(DB.users).filter(Boolean).map(u=>({
    ...u, id: idTexto(u.id) || novoId(), user: (u.user||'').trim(), pass: u.pass==null ? '' : String(u.pass),
    role: u.role === 'admin' ? 'admin' : 'vendedor'
  })).filter(u=>u.user);
  DB.users = tirar(DB.users, 'users');
  /* Dois usuários com o mesmo login: acontece quando um aparelho novo cria
     o admin de fábrica e depois se junta à nuvem, que já tinha o admin da
     loja. Só o primeiro da lista conseguia entrar. Fica um — o mesmo em
     todos os aparelhos, por uma regra fixa: o que não está com a senha de
     fábrica; empatando, o de id menor. O outro ganha lápide. */
  const porLogin = new Map();
  DB.users.forEach(u=>{
    const chave = u.user.toLowerCase();
    const atual = porLogin.get(chave);
    if(!atual){ porLogin.set(chave, u); return; }
    const fabrica = x => String(x.pass) === '1234' || x.pass === '';
    let fica = atual;
    if(fabrica(atual) !== fabrica(u)) fica = fabrica(atual) ? u : atual;
    else if(String(u.id) < String(atual.id)) fica = u;
    porLogin.set(chave, fica);
  });
  if(porLogin.size !== DB.users.length){
    const ficam = new Set([...porLogin.values()].map(u=>u.id));
    DB.users.filter(u=>!ficam.has(u.id)).forEach(u=>{
      DB.apagados = DB.apagados || {};
      DB.apagados.users = DB.apagados.users || [];
      if(!DB.apagados.users.includes(String(u.id))) DB.apagados.users.push(String(u.id));
    });
    DB.users = DB.users.filter(u=>ficam.has(u.id));
    reparou = true;
  }
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

/* Enxuga as listas de exclusão. Roda a cada abertura: o aparelho que já
   está com a lista inchada se cura sozinho, sem ninguém precisar apagar
   nada à mão. O limite existe para que nem um defeito futuro consiga
   transformar isto num peso outra vez. */
const MAX_LAPIDES = 2000;
function enxugarApagados(){
  if(!DB.apagados || typeof DB.apagados !== 'object') { DB.apagados = {}; return false; }
  let mudou = false;
  Object.keys(DB.apagados).forEach(k=>{
    const lista = DB.apagados[k];
    if(!Array.isArray(lista)) { DB.apagados[k] = []; mudou = true; return; }
    const unicos = [...new Set(lista)];
    const cortada = unicos.length > MAX_LAPIDES ? unicos.slice(-MAX_LAPIDES) : unicos;
    if(cortada.length !== lista.length){ DB.apagados[k] = cortada; mudou = true; }
  });
  return mudou;
}

function migrateDB(){
  // garante campos novos em bancos antigos, sem tocar no localStorage
  const d = defaultDB();
  for(const k in d){ if(!(k in DB)) DB[k] = d[k]; }
  if(!DB.monthlyExpenses) DB.monthlyExpenses = d.monthlyExpenses;
  if(!DB.monthlyExpenses.categories) DB.monthlyExpenses.categories = d.monthlyExpenses.categories;
  if(!Array.isArray(DB.monthlyExpenses.records)) DB.monthlyExpenses.records = [];
  if(!DB.config || typeof DB.config !== 'object') DB.config = d.config;
  /* Um banco antigo pode ter o config pela metade (sem minStock, por
     exemplo). Sem o campo, o alerta de estoque baixo simplesmente não
     aparecia — comparar com undefined é sempre falso. */
  for(const k in d.config){ if(DB.config[k] === undefined || DB.config[k] === null) DB.config[k] = d.config[k]; }
  if(!DB.storeName) DB.storeName = d.storeName;
  // Renome da marca: quem já usava o sistema tem o nome antigo gravado no
  // banco e continuaria vendo "Estilo & Cia" na tela. Só troca quando é o
  // nome padrão antigo — um nome escolhido pela loja é preservado.
  let renomeou = false;
  if(DB.storeName === 'Estilo & Cia'){ DB.storeName = d.storeName; renomeou = true; }
  if(DB.config && DB.config.heroPhrase === 'Estilo que é só seu ✨'){
    DB.config.heroPhrase = d.config.heroPhrase; renomeou = true;
  }
  let reparou = normalizeDB() || renomeou;
  if(!DB.barcodeSeq) DB.barcodeSeq = 0;
  seedInitialData();
  if(enxugarApagados()) reparou = true;
  if(aplicarPedidosDaLoja()) reparou = true;
  // Grava o reparo: sem isso os ids recém-criados só existem em memória e
  // mudam a cada carregamento, e os botões de Editar/Excluir passam a
  // apontar para registros que não existem mais.
  if(reparou) saveDB();
}

/* =========================================================
   PEDIDOS DA LOJA VIRTUAL × ESTOQUE
   A vitrine não mexe mais no estoque da peça: ela só registra o pedido.
   Quem dá a baixa é o sistema da loja, na primeira vez que vê o pedido —
   e marca o pedido como baixado para nunca baixar duas vezes.

   Antes a vitrine gravava a peça com o estoque já descontado, e a junção
   com o aparelho da loja (onde a cópia local da peça sempre vence) jogava
   o desconto fora: a cliente comprava pelo site e a peça continuava
   "disponível" no balcão. Com a baixa feita aqui, ela sobrevive à junção,
   porque é o próprio aparelho que a faz na sua cópia.
   ========================================================= */
function aplicarPedidosDaLoja(){
  let mexeu = false;
  (DB.sales||[]).forEach(s=>{
    if(!s || s.origin !== 'loja' || s.estoqueBaixado) return;
    if(!s.canceled){
      (s.items||[]).forEach(i=>{
        const p = DB.products.find(x=>x.id===i.productId);
        const v = variacaoDoItem(i);
        if(v){ const tem = Math.max(0, Number(v.stock)||0); i.baixou = Math.min(Number(i.qty||0), tem); v.stock = tem - i.baixou; }
        /* Congela o custo da peça no pedido, como o PDV faz, para o lucro
           desta venda não mudar quando o custo da peça mudar. */
        if(i.cost === undefined && p) i.cost = Number(p.cost)||0;
      });
    }
    s.estoqueBaixado = true;
    carimbar(s);          // a versão "já baixado" vence a do site na junção
    mexeu = true;
  });
  return mexeu;
}
/* Um aparelho que abre SEM dados locais não pode mandar nada para a nuvem
   antes de ler o que há lá. O iPhone apaga os dados de sites que ficam
   alguns dias sem uso; quando isso acontece o sistema abre vazio, e um
   único salvamento substituía a loja inteira na nuvem por um banco em
   branco. Foi assim que o estoque se perdeu. */
let bancoVeioVazio = false;
let nuvemLida = false;
let nuvemVaziaConfirmada = false;
/* A primeira leitura da nuvem leva um instante. Nesse instante o sistema
   dizia "sem ligação com a nuvem" — um alarme falso que aparecia logo ao
   entrar, com o selo de cima já verde. Só se avisa depois que a nuvem
   respondeu (ou deixou de responder). */
let nuvemJaRespondeu = false;

/* TRÊS RECADOS QUE O APARELHO GUARDA PARA SI MESMO, e que antes viviam só
   na memória — bastava fechar a página para o sistema esquecer:

   · PENDENTE: há trabalho feito aqui que a nuvem ainda não confirmou. Sem
     isto, a venda feita sem internet era trocada pelo que estava na nuvem
     na próxima abertura, sem nunca ter subido.
   · CARIMBO: qual versão da nuvem este aparelho já tem dentro dele. A
     decisão de trazer ou não era feita comparando RELÓGIOS (o da nuvem
     com o do aparelho); celular com a hora errada, ou venda feita depois
     da última leitura, e o aparelho gravava por cima do trabalho dos
     outros. Agora a pergunta é outra: "a nuvem mudou desde a versão que
     eu tenho?".
   · SEM NUVEM: este banco nasceu vazio neste aparelho e ainda não foi
     juntado com a loja de verdade. Enquanto for assim, a nuvem é a base. */
const CHAVE_PENDENTE = 'estiloCiaDB_pendente';
const CHAVE_CARIMBO = 'estiloCiaDB_carimboNuvem';
const CHAVE_SEM_NUVEM = 'estiloCiaDB_semNuvem';
/* · SUBSTITUIR: o lojista restaurou um backup ou voltou a uma versão
     antiga. Isso é TROCAR a loja, não juntar: juntando, o que ele quis
     desfazer voltava pela nuvem no primeiro envio. */
const CHAVE_SUBSTITUIR = 'estiloCiaDB_substituir';
let substituirNaNuvem = false;
function lembrarSubstituicao(sim){ substituirNaNuvem = !!sim; guardarRecado(CHAVE_SUBSTITUIR, sim ? '1' : ''); }
/* Troca o banco inteiro por outro (backup, cópia, versão da nuvem). */
function trocarBancoInteiro(banco){
  DB = banco;
  migrateDB();
  restaurarEscolhaDaEtiqueta();
  lembrarBancoVazio(false);
  lembrarSubstituicao(true);
}
function lerRecado(chave){ try{ return localStorage.getItem(chave); }catch(e){ return null; } }
function guardarRecado(chave, valor){
  try{ if(valor) localStorage.setItem(chave, String(valor)); else localStorage.removeItem(chave); }catch(e){}
}
function lembrarPendencia(tem){ temPendencia = !!tem; guardarRecado(CHAVE_PENDENTE, tem ? '1' : ''); }
function lembrarCarimbo(carimbo){ ultimoCarimboDaNuvem = carimbo || null; guardarRecado(CHAVE_CARIMBO, carimbo || ''); }
function lembrarBancoVazio(vazio){ bancoVeioVazio = !!vazio; guardarRecado(CHAVE_SEM_NUVEM, vazio ? '1' : ''); }

function loadDB(){
  let raw = null;
  try{ raw = localStorage.getItem(STORAGE_KEY); }catch(e){ raw = null; }
  try{
    DB = raw ? JSON.parse(raw) : defaultDB();
  }catch(e){ DB = defaultDB(); raw = null; }
  if(!raw){ lembrarBancoVazio(true); lembrarCarimbo(null); lembrarPendencia(false); lembrarSubstituicao(false); }
  else {
    substituirNaNuvem = lerRecado(CHAVE_SUBSTITUIR) === '1';
    bancoVeioVazio = lerRecado(CHAVE_SEM_NUVEM) === '1';
    ultimoCarimboDaNuvem = lerRecado(CHAVE_CARIMBO) || null;
    temPendencia = lerRecado(CHAVE_PENDENTE) === '1';
  }
  migrateDB();
}

/* ---------- Código de barras interno (gerado pela loja) ---------- */
/* O código nasce SÓ COM NÚMEROS, e isso não é detalhe: o Code 128 tem um
   modo (o subset C) em que cada símbolo carrega dois dígitos de uma vez.
   Seis dígitos ocupam 68 módulos; os antigos "EC000008" ocupavam 101.
   Na fita de 29 mm da QL-800 essa diferença é a diferença entre uma barra
   de 0,25 mm, que o leitor do balcão lê, e uma de 0,17 mm, que ele não lê.
   Os códigos antigos continuam valendo — o leitor lê os dois. */
function nextBarcodeCode(){
  DB.barcodeSeq = (DB.barcodeSeq||0) + 1;
  return String(DB.barcodeSeq).padStart(6,'0');
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
  if(!skipCloud) marcarParaEnviar();
  return gravou;
}

function gravarLocal(){
  /* Se o número de produtos ou de vendas caiu, guarda o que ESTAVA gravado
     antes de escrever por cima. Tirar a cópia do banco em memória não
     adiantaria: nesse ponto ele já é o banco reduzido. */
  guardarCopiaAntesDeEncolher();

  const escrever = ()=>{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DB));
    localStorage.setItem(LOCAL_TS_KEY, String(Date.now()));
  };

  try{ escrever(); return true; }
  catch(err){
    if(!ehErroDeEspaco(err)){ console.error('Erro ao gravar:', err); return false; }
  }

  /* APARELHO CHEIO. A venda não pode ser a coisa que se perde por falta de
     espaço — ela é o motivo de o sistema existir. Então libera-se espaço em
     degraus, do que é mais descartável para o que é menos, tentando gravar
     depois de cada degrau. Antes só existia um degrau (tirar as fotos do
     banco), e ele nem tocava nas cópias de segurança, que são justamente o
     que mais ocupa o aparelho. */
  /* Cada degrau precisa LIBERAR BYTES, não remanejá-los. É a diferença
     entre a venda caber e o caixa parar com um aviso. */
  const degraus = [
    ['cópias de segurança antigas', ()=>{
      const copias = lerCopiasDeSeguranca();
      if(copias.length <= 1) return false;
      localStorage.setItem(CHAVE_COPIAS, JSON.stringify(copias.slice(0, 1)));
      return true;
    }],
    ['todas as cópias de segurança', ()=>{
      if(!localStorage.getItem(CHAVE_COPIAS)) return false;
      localStorage.removeItem(CHAVE_COPIAS);
      return true;
    }],
    /* Daqui para baixo alguma foto sai do aparelho. Perder uma foto dói;
       perder a venda fecha o caixa. O lojista é avisado do que saiu. */
    ['fotos guardadas dentro do banco', ()=>{
      if(!tirarFotoDeDentroDoBanco(false)) return false;
      fotosDescartadas++;
      return true;
    }],
    ['fotos que ainda não subiram', ()=>{
      const chaves = chavesDeFotosPendentes();
      if(!chaves.length) return false;
      const chave = chaves[0];
      fotosPendentes.delete(chave.slice(PREFIXO_FOTO.length));
      localStorage.removeItem(chave);
      fotosDescartadas++;
      return true;
    }],
    /* Se nem assim couber, o que sobrou de grande no aparelho é lixo de
       versões antigas do sistema. Nada aqui pertence ao cadastro da loja,
       que mora em estiloCiaDB. */
    ['sobras de versões antigas', ()=>{
      let mexeu = false;
      try{
        Object.keys(localStorage).forEach(k=>{
          if(k === STORAGE_KEY || k === LOCAL_TS_KEY || k === SESSION_KEY) return;
          if(k === CHAVE_COPIAS || k === CHAVE_NUVEM) return;
          /* A chave de emissão do cupom fiscal mora só neste aparelho, e
             os recados da sincronização são o que impede este aparelho
             de gravar por cima da loja. */
          if(k === CHAVE_FISCAL || k === CHAVE_PENDENTE || k === CHAVE_CARIMBO || k === CHAVE_SEM_NUVEM || k === CHAVE_SUBSTITUIR) return;
          if(k.indexOf(PREFIXO_FOTO) === 0) return;
          localStorage.removeItem(k); mexeu = true;
        });
      }catch(e){}
      return mexeu;
    }],
  ];

  for(const [oQue, liberar] of degraus){
    let mexeu = true;
    while(mexeu){
      try{ mexeu = liberar(); }catch(e){ mexeu = false; }
      if(!mexeu) break;
      try{
        escrever();
        avisarDoEspacoLiberado(oQue);
        return true;
      }catch(e){
        if(!ehErroDeEspaco(e)){ console.error('Erro ao gravar:', e); return false; }
      }
    }
  }

  console.error('Sem espaço mesmo depois de liberar tudo o que dava.');
  return false;
}

let fotosDescartadas = 0;
function avisarDoEspacoLiberado(oQue){
  if(fotosDescartadas > 0){
    toast('O aparelho estava cheio: ' + fotosDescartadas + ' foto(s) que ainda não tinham subido para a nuvem foram descartadas para a venda poder ser salva.','warn');
    fotosDescartadas = 0;
    return;
  }
  toast('O aparelho estava cheio. Liberamos espaço (' + oQue + ') e a gravação foi feita.','warn');
}

function ehErroDeEspaco(err){
  return err && (err.name==='QuotaExceededError'
    || err.name==='NS_ERROR_DOM_QUOTA_REACHED'
    || err.code===22 || err.code===1014);
}

/* Tira do banco a foto que está embutida em texto (as antigas, em base64)
   e a põe na fila para subir.

   `guardando` decide onde ela fica. Em situação normal, guardada numa
   chave própria do aparelho, para sobreviver a fechar o sistema. Mas
   quando o aparelho está CHEIO isso não serve de nada: sair de dentro do
   banco e entrar noutra chave do mesmo armazenamento são os mesmos bytes
   no mesmo lugar — era um degrau que não liberava um byte sequer, e por
   isso a venda continuava sem caber. Nessa hora a foto fica só na memória
   e sobe se der; a venda vem antes. */
function tirarFotoDeDentroDoBanco(guardando){
  const p = DB.products.find(x=>x.photo && x.photo.indexOf('data:') === 0);
  if(!p) return false;
  if(guardando) guardarFotoPendente(p.id, p.photo);
  else fotosPendentes.set(p.id, p.photo);
  p.photo = '';
  p.photoPendente = true;
  enviarFotosPendentes();
  return true;
}
function liberarEspacoDeFotos(){ return tirarFotoDeDentroDoBanco(true); }

/* Chame quando o sistema for dizer "pronto, salvo". Se a gravação falhou,
   o usuário precisa saber na hora, e não descobrir ao recarregar a página. */
function exigirGravacao(oQue){
  if(saveDB()) return true;
  /* Mandar "apagar fotos de peças antigas em Produtos" não resolvia nada:
     apagar a foto de uma peça não devolve espaço se ela já saiu do banco.
     O caminho que funciona é o botão de liberar espaço em Configurações,
     e é para lá que o aviso aponta agora. */
  alert('ATENÇÃO: não foi possível salvar ' + oQue + '.\n\n'
      + 'O armazenamento deste aparelho está cheio, e o sistema já apagou tudo o que podia sozinho.\n\n'
      + 'Vá em Configurações > Espaço deste aparelho e toque em "Liberar espaço agora". '
      + 'Depois refaça esta operação.\n\n'
      + 'Nada foi perdido do que já estava salvo.');
  return false;
}

/* =========================================================
   CÓPIAS DE SEGURANÇA
   Guarda no próprio aparelho as últimas versões do banco antes de cada
   troca grande. Não substitui a nuvem, mas é o que permite voltar atrás
   quando algo dá errado — nesta loja o estoque sumiu e não havia nada
   para onde voltar.
   ========================================================= */
const CHAVE_COPIAS = 'estiloCiaDB_copias';
/* Três cópias bastam para voltar atrás, e três cabem no aparelho. Cinco
   cópias de um banco grande é o que não cabia. */
const MAX_COPIAS = 3;

/* A cópia guarda o CADASTRO, não as imagens. Uma cópia com as fotos dentro
   chega a alguns megabytes, e são cinco: eram elas que enchiam o aparelho
   e faziam a venda não caber. As fotos moram na nuvem, e a cópia guarda o
   endereço delas. */
function semAsFotos(banco){
  return JSON.stringify(banco, (chave, valor)=>
    chave === 'photo' && typeof valor === 'string' && valor.indexOf('data:') === 0 ? '' : valor);
}
function guardarCopiaDeSeguranca(motivo, bancoTexto){
  try{
    const banco = bancoTexto ? JSON.parse(bancoTexto) : DB;
    const texto = semAsFotos(banco);
    const produtos = (banco.products||[]).length;
    const vendas = (banco.sales||[]).length;
    if(!produtos && !vendas) return;      // nada que valha a pena guardar
    const copias = lerCopiasDeSeguranca();
    const anterior = copias[0];
    /* Mesma contagem não é mesmo conteúdo: um dia de ajustes de estoque
       e de preço não muda o número de peças. Só se pula a cópia idêntica. */
    if(anterior && anterior.dados === texto) return;
    copias.unshift({ quando: todayISO(), motivo, produtos, vendas, dados: texto });
    localStorage.setItem(CHAVE_COPIAS, JSON.stringify(copias.slice(0, MAX_COPIAS)));
  }catch(err){
    /* Sem espaço para a cópia: não é motivo para impedir o trabalho. */
    console.warn('Não foi possível guardar a cópia de segurança:', err);
  }
}

/* Compara o que vai ser gravado com o que já está gravado. Se encolheu,
   a versão de antes vira cópia — é a rede que faltou quando o estoque
   desta loja sumiu. */
function guardarCopiaAntesDeEncolher(){
  try{
    const anterior = localStorage.getItem(STORAGE_KEY);
    if(!anterior) return;
    const antes = JSON.parse(anterior);
    const produtosAntes = (antes.products||[]).length;
    const vendasAntes = (antes.sales||[]).length;
    const produtosAgora = (DB.products||[]).length;
    const vendasAgora = (DB.sales||[]).length;
    if(produtosAgora < produtosAntes || vendasAgora < vendasAntes){
      guardarCopiaDeSeguranca('antes de o estoque encolher', anterior);
    }
  }catch(err){
    console.warn('Não foi possível conferir a cópia de segurança:', err);
  }
}

function lerCopiasDeSeguranca(){
  try{ return JSON.parse(localStorage.getItem(CHAVE_COPIAS) || '[]'); }
  catch(e){ return []; }
}

/* O banco que chegou pode não ter o usuário que está logado. */
function entrarDepoisDeTrocarOBanco(){
  validarSessao();
  if(!SESSION){ showLogin(); toast('Esses dados não têm o seu usuário. Entre de novo.','warn'); return; }
  renderShell(); navigate('painel');
}
function restaurarCopiaDeSeguranca(indice){
  const copia = lerCopiasDeSeguranca()[indice];
  if(!copia) return;
  if(!confirm('Voltar para a cópia de ' + dateBR(copia.quando) + '?\n\n' +
              copia.produtos + ' produto(s) e ' + copia.vendas + ' venda(s).\n\n' +
              'O que está no sistema agora será guardado como cópia antes da troca.')) return;
  guardarCopiaDeSeguranca('antes de restaurar');
  trocarBancoInteiro(JSON.parse(copia.dados));
  if(exigirGravacao('a restauração')){
    toast('Cópia restaurada: ' + copia.produtos + ' produto(s).');
    entrarDepoisDeTrocarOBanco();
  }
}

/* A loja pediu que nenhum aviso fique fixo na tela, e a faixa que ficava no
   topo saiu. Mas trabalhar horas achando que está salvo, quando não está,
   foi exatamente o que fez o estoque desta loja sumir — então o estado da
   nuvem não vira silêncio: ele aparece UMA vez, como recado que some
   sozinho, e fica escrito por extenso em Configurações → Ligação com a
   nuvem, que é onde se vai olhar quando se desconfia de alguma coisa. */
let jaAvisouDaNuvem = false;

/* Um selo pequeno na barra de cima, do lado do título. Não é um aviso
   plantado na tela: é o estado, do jeito que o relógio do celular mostra
   a bateria. Quando está tudo salvo ele fica quieto e discreto; quando
   há coisa esperando para subir, ele diz. Tocar nele abre o diagnóstico.
   Sem isso não existe resposta para a única pergunta que importa nesta
   loja: "isso aqui está salvo?". */
function atualizaSeloDaNuvem(){
  const selo = document.getElementById('seloNuvem');
  if(!selo) return;
  const est = estadoDaNuvem();
  if(est.tudoSalvo){
    selo.className = 'selo-nuvem salvo';
    selo.textContent = '☁️ salvo';
    selo.title = 'Tudo o que foi feito aqui já está na nuvem.';
    return;
  }
  if(est.ok){
    selo.className = 'selo-nuvem enviando';
    selo.textContent = '⏳ salvando';
    selo.title = 'Enviando as últimas alterações para a nuvem.';
    return;
  }
  if(!nuvemJaRespondeu){
    selo.className = 'selo-nuvem enviando';
    selo.textContent = '⏳ conectando';
    selo.title = 'Lendo a nuvem pela primeira vez.';
    return;
  }
  selo.className = 'selo-nuvem parado';
  selo.textContent = '⚠️ não salvo';
  selo.title = 'Sem ligação com a nuvem. Toque para ver o motivo.';
}

function estadoDaNuvem(){
  const semNuvem = !nuvemLida && !nuvemVaziaConfirmada;
  const naoEstaSalvando = semNuvem || falhouAoEnviar;
  return { ok: !naoEstaSalvando, pendente: temPendencia,
           tudoSalvo: !naoEstaSalvando && !temPendencia,
           porque: naoEstaSalvando || temPendencia ? explicarErroDaNuvem(ultimoErroNuvem) : '' };
}

function atualizaAvisoDeNuvem(){
  const est = estadoDaNuvem();

  /* Um recado só por sessão. Repetir a cada tentativa viraria barulho, e
     barulho é o que faz o lojista parar de ler. */
  if(!est.ok && nuvemJaRespondeu && !jaAvisouDaNuvem && document.getElementById('app')
     && !document.getElementById('app').classList.contains('hidden')){
    jaAvisouDaNuvem = true;
    toast(falhouAoEnviar && (nuvemLida || nuvemVaziaConfirmada)
      ? 'A nuvem não está aceitando gravar. O trabalho está guardado neste aparelho — toque no selo ☁️ lá em cima para ver o motivo.'
      : 'Sem ligação com a nuvem agora. O trabalho está sendo salvo neste aparelho e sobe sozinho quando a ligação voltar.','warn');
  }
  if(est.ok) jaAvisouDaNuvem = false;   // caiu de novo depois? avisa de novo

  atualizaSeloDaNuvem();

  /* Se a tela de Configurações está aberta, ela mostra o estado por extenso. */
  const painel = document.getElementById('estadoDaNuvem');
  if(!painel) return;
  /* Foto parada na fila é dinheiro parado: a loja paga o Supabase para
     guardá-las e elas estão ocupando o aparelho. Dizer quantas são, e
     por quê, é o que permite resolver. */
  const naFila = fotosPendentes.size;
  const recadoDasFotos = naFila
    ? `<div class="aviso-codigo" style="margin-top:10px"><strong>${naFila} foto(s) esperando para subir.</strong>
        Elas estão guardadas neste aparelho e sobem sozinhas assim que a pasta
        <code>${escapeHtml(configNuvem().bucket)}</code> existir no Supabase e estiver pública.
        Enquanto isso, ocupam espaço aqui.</div>`
    : '';
  if(est.ok){
    painel.className = 'estado-nuvem ok';
    painel.innerHTML = (est.pendente
      ? '⏳ Salvando na nuvem…'
      : '✅ Ligado à nuvem, tudo salvo. O que é feito aqui vai para lá na hora e chega nos outros aparelhos.')
      + recadoDasFotos;
    return;
  }
  if(!nuvemJaRespondeu){
    painel.className = 'estado-nuvem ok';
    painel.innerHTML = '⏳ Conectando à nuvem…' + recadoDasFotos;
    return;
  }
  painel.className = 'estado-nuvem ruim';
  /* Se nem LER deu certo, o problema não é permissão de gravação — dizer
     "não está aceitando gravar" mandaria o lojista mexer nas permissões
     quando o projeto está fora do ar. A leitura manda no recado. */
  const soNaoGrava = falhouAoEnviar && nuvemLida && !(ultimoErroNuvem && ultimoErroNuvem.status === 0);
  painel.innerHTML = (soNaoGrava
      ? '⚠️ <strong>A nuvem não está aceitando gravar.</strong> '
      : '⚠️ <strong>Sem ligação com a nuvem.</strong> ') +
    'O trabalho está sendo salvo neste aparelho e sobe quando a ligação voltar. ' +
    'Nada é enviado enquanto isso, para não gravar por cima do que está lá.' +
    (est.porque ? '<br><span style="font-size:12px">' + escapeHtml(est.porque) + '</span>' : '')
    + recadoDasFotos;
}

/* ---------- Supabase sync ---------- */
let ultimoErroNuvem = null;

/* Diagnóstico em português do que o Supabase respondeu. "Sem internet" era
   um chute que mandava a loja olhar para o lugar errado. */
function explicarErroDaNuvem(erro){
  if(!erro) return '';
  if(erro.status === 401 || erro.status === 403)
    return 'A nuvem recusou a chave de acesso (' + erro.status + '). A chave pode ter sido trocada ou as permissões da tabela mudaram, no painel do Supabase.';
  if(erro.status === 404)
    return 'A nuvem respondeu, mas não encontrou o que foi pedido (404) — a tabela "' + configNuvem().tabela + '" ou a pasta "' + configNuvem().bucket + '". Rode o SQL de instalação em Configurações: ele cria as duas.';
  if(erro.status >= 500)
    return 'O servidor da nuvem respondeu com erro ' + erro.status + '. Projetos gratuitos do Supabase são pausados após alguns dias sem uso — confira no painel se o projeto precisa ser reativado.';
  if(erro.status === 0)
    return 'O servidor da nuvem não respondeu NADA — nem para recusar. Como o resto do sistema está carregando, a internet está funcionando: '
         + 'ou o projeto do Supabase está pausado/apagado, ou o endereço está errado. '
         + 'Abra ' + configNuvem().url + ' no navegador: se não abrir, o projeto não está no ar.';
  return 'A nuvem respondeu ' + erro.status + '.';
}

async function cloudPull(){
  try{
    const c = configNuvem();
    const res = await fetch(`${c.url}/rest/v1/${c.tabela}?id=eq.main&select=data,updated_at`, {
      headers: cabecalhosNuvem()
    });
    if(!res.ok){
      let detalhe = '';
      try{ detalhe = (await res.text()).slice(0, 200); }catch(e){}
      ultimoErroNuvem = { status: res.status, detalhe };
      nuvemJaRespondeu = true;
      atualizaAvisoDeNuvem();
      return;
    }
    ultimoErroNuvem = null;
    const rows = await res.json();
    nuvemLida = true;
    nuvemJaRespondeu = true;                       // conseguimos ler: já sabemos o que há lá
    /* O aviso é atualizado AQUI, e não só no fim. Havia um caminho — o mais
       comum de todos, o aparelho que reabre já com os dados em dia — que
       saía por um `return` no meio e deixava na tela o aviso de que a nuvem
       não respondia, com a nuvem respondendo. Nesta loja, que já perdeu
       dados, alarme falso custa caro: o lojista para de acreditar no aviso
       justamente quando ele for verdade. */
    atualizaAvisoDeNuvem();
    if(rows && rows[0] && rows[0].data){
      const carimbo = rows[0].updated_at || null;
      /* Backup restaurado esperando para subir: o que vale é o que está
         aqui, e a nuvem vai ser trocada por ele. */
      if(substituirNaNuvem){ if(temPendencia) agendarEnvio(400); return; }
      const cloudTs = carimbo ? new Date(carimbo).getTime() : 0;
      const localTs = Number(localStorage.getItem(LOCAL_TS_KEY)) || 0;
      const conhecido = ultimoCarimboDaNuvem;
      /* Aparelho que ainda não guardava o carimbo (veio de uma versão
         anterior): o relógio é a única pista. Se ele gravou DEPOIS da
         última versão da nuvem, pode ter trabalho que nunca subiu — na
         dúvida, junta. Juntar duas cópias iguais não muda nada. */
      if(!conhecido && !bancoVeioVazio && localTs > cloudTs) lembrarPendencia(true);
      const mudouLa = conhecido ? carimbo !== conhecido : (bancoVeioVazio || temPendencia || cloudTs !== localTs);
      if(!mudouLa && !bancoVeioVazio){
        /* A nuvem é a mesma versão que já está aqui dentro. */
        lembrarCarimbo(carimbo);
        if(temPendencia) agendarEnvio(400);
        return;
      }
      guardarCopiaDeSeguranca('antes de trazer da nuvem');
      const antigo = DB;
      /* Se ainda há coisa daqui esperando para subir, o que vem da nuvem
         entra JUNTO, não por cima: senão o aparelho perderia a alteração
         que ele mesmo acabou de fazer. E se este aparelho abriu sem dados,
         o que está aqui não é a verdade da loja — é um banco em branco:
         a nuvem é a base e só entra daqui o que ela não tem. */
      if(!temPendencia) DB = rows[0].data;
      else DB = bancoVeioVazio ? juntarBancos(rows[0].data, DB) : juntarBancos(DB, rows[0].data);
      manterReferencias(antigo, DB);
      lembrarBancoVazio(false);
      lembrarCarimbo(carimbo);
      /* Linha antiga, das que ainda traziam a imagem dentro: a foto entra
         na fila para ir ao Storage e sai da linha no próximo envio. */
      migrarFotosAntigas();
      migrateDB(); // preenche campos novos sem sobrescrever com o localStorage
      restaurarEscolhaDaEtiqueta();   // o rolo da impressora também vem da nuvem
      saveDB(true);
      /* O usuário desta sessão pode ter sido apagado em outro aparelho. */
      if(SESSION){ validarSessao(); if(!SESSION){ showLogin(); toast('Seu usuário foi removido. Entre de novo.','warn'); return; } }
      /* Redesenha a tela com o que chegou — mas não embaixo de quem está
         digitando: trocar a tela com o teclado aberto fecha o teclado e
         apaga o que estava no campo. Nesse caso os dados já estão certos e
         a tela se acerta na próxima troca de tela. */
      const digitando = document.activeElement && ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName);
      if(document.getElementById('app') && !document.getElementById('app').classList.contains('hidden') && !digitando && !temFormularioAberto()){ renderShell(); navigate(currentRoute); }
      if(temPendencia) agendarEnvio(400);
    } else {
      nuvemVaziaConfirmada = true;          // loja nova: não há o que preservar
      lembrarBancoVazio(false);
      lembrarCarimbo(null);
    }
    atualizaAvisoDeNuvem();
  }catch(e){
    ultimoErroNuvem = { status: 0, detalhe: String(e && e.message || e) };
    nuvemJaRespondeu = true;
    atualizaAvisoDeNuvem();
  }
}

/* =========================================================
   ENVIO PARA A NUVEM
   Antes isto era um tiro no escuro: mandava e não olhava a resposta. Se o
   Supabase respondesse 401 (chave recusada) ou 404 (tabela não existe), o
   sistema seguia achando que tinha salvo — e a loja podia trabalhar dias
   inteiros sem nada estar indo para lá. E se a rede falhasse na hora do
   envio, aquela alteração não era reenviada nunca: só subia se por acaso
   alguém salvasse outra coisa depois.

   Agora: toda alteração fica marcada como PENDENTE até a nuvem confirmar
   que gravou. Enquanto houver pendência o sistema insiste — na hora, e
   depois de novo a cada tentativa, com espera crescente para não ficar
   martelando um servidor fora do ar. Volta a internet, o aparelho é
   desbloqueado ou o sistema volta para a frente da tela: tenta de novo na
   mesma hora.
   ========================================================= */
let temPendencia = false;      // há mudança local que a nuvem ainda não confirmou
let enviandoAgora = false;
let tentativasDeEnvio = 0;
/* Ler da nuvem pode dar certo e ESCREVER dar errado — chave sem permissão
   de gravação, tabela só de leitura. Sem separar as duas coisas o sistema
   dizia "salvando…" para sempre, que é a pior mentira possível aqui. */
let falhouAoEnviar = false;
let ultimoCarimboDaNuvem = null;   // o updated_at que lemos por último
let horaDoUltimoEnvioOk = null;

/* Espera antes de tentar de novo: começa curta e cresce até meio minuto. */
const ESPERAS_DE_REENVIO = [1000, 3000, 8000, 15000, 30000];
function esperaDoReenvio(){
  return ESPERAS_DE_REENVIO[Math.min(tentativasDeEnvio, ESPERAS_DE_REENVIO.length - 1)];
}
function agendarEnvio(atraso){
  clearTimeout(pushTimer);
  pushTimer = setTimeout(cloudPush, atraso);
}
/* Cada gravação local sobe este número. O envio anota qual número levou;
   se no fim ele já mudou, houve alteração DURANTE o envio, e ela ainda
   não está na nuvem. Antes o sistema marcava "salvo" nessa hora, e a
   alteração ficava presa no aparelho até alguém salvar outra coisa. */
let versaoLocal = 0;
/* Chamado por saveDB: a alteração acabou de acontecer, vai agora. */
function marcarParaEnviar(){
  lembrarPendencia(true);
  versaoLocal++;
  atualizaAvisoDeNuvem();
  agendarEnvio(400);           // junta as alterações de um mesmo clique
}

function estadoDoEnvio(){
  if(!temPendencia) return { rotulo:'salvo', texto:'Tudo salvo na nuvem' };
  if(!nuvemLida && !nuvemVaziaConfirmada) return { rotulo:'parado', texto:'Sem ligação com a nuvem — o trabalho está guardado neste aparelho' };
  return { rotulo:'enviando', texto:'Salvando na nuvem…' };
}

/* Junta o que está na nuvem com o que está aqui, SEM PERDER NADA. Se o
   computador cadastrou uma peça enquanto o celular registrava uma venda,
   os dois têm de sobreviver — antes o último a salvar apagava o outro.
   Onde o mesmo registro existe dos dois lados, vale o daqui, que é o que
   o lojista acabou de mexer; o que só existe lá é trazido junto. */
function registrarApagado(colecao, id){
  if(id === undefined || id === null || id === '') return;
  id = String(id);
  DB.apagados = DB.apagados || {};
  DB.apagados[colecao] = DB.apagados[colecao] || [];
  if(!DB.apagados[colecao].includes(id)) DB.apagados[colecao].push(id);
}
function juntarPorId(daqui, deLa, apagados){
  const fora = new Set((apagados || []).map(String));
  const lista = (Array.isArray(daqui) ? daqui : []).filter(x=>!(x && fora.has(String(x.id))));
  const posicao = new Map();
  lista.forEach((x, i)=>{ if(x && x.id) posicao.set(String(x.id), i); });
  (Array.isArray(deLa) ? deLa : []).forEach(x=>{
    if(!x || !x.id || fora.has(String(x.id))) return;
    const i = posicao.get(String(x.id));
    if(i === undefined){ posicao.set(String(x.id), lista.length); lista.push(x); return; }
    /* O mesmo registro dos dois lados: fica o que foi mexido por último.
       Antes valia sempre o daqui — e a venda corrigida no computador
       voltava para a versão errada quando o celular gravava depois. Sem
       carimbo nos dois, vale o daqui, como sempre valeu. */
    const meu = lista[i];
    const tMeu = meu && meu.atualizadoEm ? Date.parse(meu.atualizadoEm) : 0;
    const tDele = x.atualizadoEm ? Date.parse(x.atualizadoEm) : 0;
    if(tDele > tMeu) lista[i] = x;
  });
  return lista;
}
/* ESTOQUE NA JUNÇÃO.
   O estoque de uma peça não é um valor que se escolhe entre dois lados:
   é o resultado das vendas. Quando o celular vendia uma peça e o
   computador vendia outra ao mesmo tempo, o registro de cada peça vinha
   de um lado só — e a baixa feita no outro lado sumia (a peça voltava a
   "ter" o que já foi vendido). Agora, escolhido o registro, ele é
   acertado pela diferença entre as vendas que ele conhecia e as vendas
   da lista juntada. Um ajuste manual de estoque continua valendo pelo
   carimbo de hora, como antes. */
function efeitoDasVendas(vendas, movimentos){
  const m = new Map();
  /* Perdas tiram do estoque e devoluções devolvem: entram na mesma conta
     das vendas, senão a perda registrada num aparelho sumia quando o
     outro vendia a mesma peça. */
  (movimentos||[]).forEach(r=>{
    if(!r) return;
    const d = (Number(r.baixou)||0) - (Number(r.voltou)||0);
    if(!d) return;
    const k = String(r.productId) + '|' + (r.size||'') + '|' + (r.color||'');
    m.set(k, (m.get(k)||0) + d);
  });
  (vendas||[]).forEach(s=>{
    if(!s || s.canceled) return;
    if(s.origin === 'loja' && !s.estoqueBaixado) return;   // o pedido do site só baixa quando o sistema o aplica
    (s.items||[]).forEach(i=>{
      const k = String(i.productId) + '|' + (i.size||'') + '|' + (i.color||'');
      m.set(k, (m.get(k)||0) + (i.baixou === undefined ? (Number(i.qty)||0) : (Number(i.baixou)||0)));
    });
  });
  return m;
}
function juntarProdutos(daqui, deLa, vendasJuntas, apagados, movimentosJuntos){
  const lista = juntarPorId(daqui.products, deLa.products, apagados);
  const meus = new Set(Array.isArray(daqui.products) ? daqui.products : []);
  const deles = new Set(Array.isArray(deLa.products) ? deLa.products : []);
  const movs = b => (b && b.perdas && b.perdas.records) || [];
  const vistoDaqui = efeitoDasVendas(daqui.sales, movs(daqui));
  const vistoDeLa  = efeitoDasVendas(deLa.sales, movs(deLa));
  const juntado    = efeitoDasVendas(vendasJuntas, movimentosJuntos);
  return lista.map(p=>{
    if(!p || !Array.isArray(p.variations)) return p;
    /* Peça que só um lado conhece já reflete as vendas desse lado. */
    const visto = meus.has(p) ? vistoDaqui : (deles.has(p) ? vistoDeLa : null);
    if(!visto) return p;
    let mexeu = false;
    const variations = p.variations.map(v=>{
      const k = String(p.id) + '|' + (v.size||'') + '|' + (v.color||'');
      const delta = (juntado.get(k)||0) - (visto.get(k)||0);
      if(!delta) return v;
      mexeu = true;
      return { ...v, stock: Math.max(0, (Number(v.stock)||0) - delta) };
    });
    return mexeu ? { ...p, variations } : p;
  });
}
/* O CAIXA NA JUNÇÃO. Ele vinha sempre do aparelho que gravava: o celular
   que fazia uma venda sem ter visto a abertura do caixa no computador
   abria um caixa zerado por conta própria e apagava a abertura, o troco
   e as sangrias do outro. Agora: sessão fechada em qualquer aparelho fica
   fechada; duas sessões abertas viram a que foi aberta de propósito (ou a
   mais antiga); sangrias e reforços dos dois lados ficam. */
function chaveDoMovimento(m){
  return m && (m.id || m.devolucaoId || [m.type, m.amount, m.date, m.note||''].join('|'));
}
function juntarMovimentos(a, b, perdasJuntas){
  const vivas = new Set((perdasJuntas||[]).map(r=>String(r.id)));
  const visto = new Map();
  [ ...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : []) ].forEach(m=>{
    if(!m) return;
    /* A saída de gaveta de uma devolução excluída não volta. */
    if(m.devolucaoId && !vivas.has(String(m.devolucaoId))) return;
    const k = chaveDoMovimento(m);
    if(!visto.has(k)) visto.set(k, m);
  });
  return [...visto.values()].sort((x, y)=>new Date(x.date) - new Date(y.date));
}
function juntarCaixa(daqui, deLa, perdasJuntas){
  const vazio = { open:false, openedAt:null, openingAmount:0, movements:[], closedHistory:[] };
  const a = (daqui && typeof daqui === 'object') ? daqui : vazio;
  const b = (deLa && typeof deLa === 'object') ? deLa : vazio;
  const fechadas = new Map();
  [ ...(Array.isArray(a.closedHistory) ? a.closedHistory : []), ...(Array.isArray(b.closedHistory) ? b.closedHistory : []) ].forEach(h=>{
    if(!h) return;
    const k = String(h.openedAt) + '>' + (h.openedAt ? '' : String(h.closedAt));
    const ja = fechadas.get(k);
    fechadas.set(k, ja ? { ...ja, movements: juntarMovimentos(ja.movements, h.movements, null) } : h);
  });
  const jaFechou = c => c.openedAt && fechadas.has(String(c.openedAt) + '>');
  const abertas = [a, b].filter(c=>c.open && c.openedAt && !jaFechou(c));
  /* Sangria feita num aparelho depois de o outro ter fechado a sessão:
     entra no histórico dela. */
  [a, b].forEach(c=>{
    if(!c.open || !jaFechou(c)) return;
    const k = String(c.openedAt) + '>';
    const h = fechadas.get(k);
    fechadas.set(k, { ...h, movements: juntarMovimentos(h.movements, c.movements, null) });
  });
  const closedHistory = [...fechadas.values()].sort((x, y)=>new Date(x.closedAt) - new Date(y.closedAt));
  if(!abertas.length) return { ...a, open:false, openedAt:null, openingAmount:0, movements:[], closedHistory };
  let fica = abertas[0];
  if(abertas.length > 1 && abertas[1].openedAt !== fica.openedAt){
    const outra = abertas[1];
    if(!!fica.automatica !== !!outra.automatica) fica = fica.automatica ? outra : fica;
    else if(new Date(outra.openedAt) < new Date(fica.openedAt)) fica = outra;
  }
  const movements = juntarMovimentos(abertas[0].movements, abertas[1] ? abertas[1].movements : [], perdasJuntas);
  const junto = { ...fica, open:true, movements, closedHistory };
  if(!junto.automatica) delete junto.automatica;
  return junto;
}
/* Configurações e nome da loja: vale o lado que foi mexido por último.
   Sem carimbo dos dois lados, vale o daqui, como sempre valeu. */
function ladoMaisNovo(a, b){
  const ta = Date.parse((a && a.atualizadoEm) || '') || 0, tb = Date.parse((b && b.atualizadoEm) || '') || 0;
  return tb > ta ? 'deLa' : 'daqui';
}
/* Os formulários abertos seguram o registro que estão editando. Quando o
   banco era trocado por baixo (a nuvem trouxe novidade), o formulário
   passava a gravar num registro que não estava mais no banco: aparecia
   "salvo" e nada mudava. Depois de trocar o banco, o registro que já
   existia continua sendo O MESMO objeto, só com o conteúdo novo. */
function manterReferencias(antigo, novo){
  if(!antigo || !novo || antigo === novo) return;
  const listas = b => [ [b, 'products'], [b, 'customers'], [b, 'sales'], [b, 'users'],
    [b.finance, 'entries'], [b.monthlyExpenses, 'records'], [b.monthlyExpenses, 'fixed'],
    [b.storeSetup, 'items'], [b.perdas, 'records'] ];
  const deAntes = listas(antigo), deAgora = listas(novo);
  deAgora.forEach(([dono, chave], n)=>{
    const donoAntigo = deAntes[n][0];
    if(!dono || !donoAntigo || !Array.isArray(dono[chave]) || !Array.isArray(donoAntigo[chave])) return;
    const porId = new Map();
    donoAntigo[chave].forEach(x=>{ if(x && x.id !== undefined) porId.set(String(x.id), x); });
    dono[chave] = dono[chave].map(x=>{
      const velho = x && x.id !== undefined ? porId.get(String(x.id)) : null;
      if(!velho || velho === x) return x;
      Object.keys(velho).forEach(k=>{ delete velho[k]; });
      return Object.assign(velho, x);
    });
  });
}
const COLECOES_COM_LAPIDE = ['products','customers','sales','users','fixed','finance','records','setup','perdas'];
function juntarBancos(daqui, deLa){
  if(!deLa || typeof deLa !== 'object') return daqui;
  const junto = { ...daqui };
  /* As lápides dos dois aparelhos valem juntas: o que um apagou fica
     apagado no outro. */
  const lapides = {};
  COLECOES_COM_LAPIDE.forEach(k=>{
    /* SEM O Set AQUI a lista DOBRAVA a cada junção. No aparelho da loja
       ela chegou a 580.610 registros do que eram 5 exclusões — 3,9 MB de
       lixo enchendo o aparelho e viajando para o Supabase a cada
       gravação. Duas listas iguais juntadas mil vezes continuam sendo a
       mesma lista; o Set é o que diz isso ao código. */
    lapides[k] = [ ...new Set([ ...(((daqui.apagados||{})[k])||[]),
                                ...(((deLa.apagados||{})[k])||[]) ].map(String)) ];
  });
  junto.apagados = lapides;
  junto.customers = juntarPorId(daqui.customers, deLa.customers, lapides.customers);
  junto.sales     = juntarPorId(daqui.sales,     deLa.sales,     lapides.sales);
  junto.perdas    = { ...(daqui.perdas||{}),
                      records: juntarPorId((daqui.perdas||{}).records, (deLa.perdas||{}).records, lapides.perdas) };
  junto.products  = juntarProdutos(daqui, deLa, junto.sales, lapides.products, junto.perdas.records);
  junto.users     = juntarPorId(daqui.users,     deLa.users,     lapides.users);
  /* Lançamento, gasto e custo de abertura também ganharam lápide: o
     lançamento excluído num aparelho voltava assim que o outro gravava. */
  junto.finance   = { ...(daqui.finance||{}),
                      entries: juntarPorId((daqui.finance||{}).entries, (deLa.finance||{}).entries, lapides.finance) };
  junto.monthlyExpenses = { ...(daqui.monthlyExpenses||{}),
    records: juntarPorId((daqui.monthlyExpenses||{}).records, (deLa.monthlyExpenses||{}).records, lapides.records),
    fixed:   juntarPorId((daqui.monthlyExpenses||{}).fixed,   (deLa.monthlyExpenses||{}).fixed, lapides.fixed) };
  junto.storeSetup = { ...(daqui.storeSetup||{}),
    items: juntarPorId((daqui.storeSetup||{}).items, (deLa.storeSetup||{}).items, lapides.setup) };
  /* Categorias de gasto criadas em qualquer aparelho valem em todos. */
  const cats = [ ...new Set([ ...(((daqui.monthlyExpenses||{}).categories)||[]),
                              ...(((deLa.monthlyExpenses||{}).categories)||[]) ]) ];
  if(cats.length) junto.monthlyExpenses.categories = cats;
  /* O número do próximo código de barras nunca anda para trás: dois
     aparelhos gerando código não podem chegar ao mesmo número. */
  junto.barcodeSeq = Math.max(Number(daqui.barcodeSeq)||0, Number(deLa.barcodeSeq)||0);
  junto.cashRegister = juntarCaixa(daqui.cashRegister, deLa.cashRegister, junto.perdas.records);
  if(ladoMaisNovo(daqui.config, deLa.config) === 'deLa'){
    junto.config = deLa.config;
    if(deLa.storeName) junto.storeName = deLa.storeName;
  }
  return junto;
}

/* O QUE VAI PARA O BANCO — e o que NUNCA deve ir.
   A foto que ainda não conseguiu subir para o Storage viajava dentro da
   linha do banco, em texto. Com 40 peças isso dá uma linha de quase 6 MB,
   REESCRITA POR INTEIRO a cada venda, a cada ajuste de estoque, a cada
   clique. Somando as leituras de todos os aparelhos, é carga suficiente
   para derrubar um banco pequeno — e foi provavelmente o que sufocou o
   desta loja.

   A partir daqui a linha carrega só o cadastro e o ENDEREÇO das fotos. A
   imagem tem um lugar só: o Storage do Supabase. Enquanto ela não sobe,
   espera no armazenamento grande do aparelho, sem pesar em nada. */
function dadosParaNuvem(){
  return JSON.parse(semAsFotos(DB));
}

async function cloudPush(){
  if(enviandoAgora) return;

  /* A nuvem só recebe depois que foi lida. Escrever sem ter lido é como
     apagar o caderno da loja para anotar de novo o que a gente lembra:
     foi exatamente assim que o estoque sumiu. */
  if(!nuvemLida && !nuvemVaziaConfirmada){
    await cloudPull();
    if(!nuvemLida && !nuvemVaziaConfirmada){
      atualizaAvisoDeNuvem();
      tentativasDeEnvio++;
      agendarEnvio(esperaDoReenvio());
      return;
    }
  }

  enviandoAgora = true;
  const versaoEnviada = versaoLocal;
  try{
    const c = configNuvem();

    /* Alguém mexeu na nuvem depois da última vez que lemos? Então tem
       trabalho de outro aparelho lá, e ele entra junto em vez de ser
       apagado por este envio. */
    const trazerDaNuvem = async ()=>{
      const olhada = await fetch(`${c.url}/rest/v1/${c.tabela}?id=eq.main&select=data,updated_at`,
                                 { headers: cabecalhosNuvem() });
      if(!olhada.ok){ const erro = new Error('leitura recusada'); erro.resposta = olhada; throw erro; }
      const linhas = await olhada.json();
      const carimbo = linhas && linhas[0] ? linhas[0].updated_at : null;
      if(carimbo && carimbo !== ultimoCarimboDaNuvem && linhas[0].data && !substituirNaNuvem){
        const antigo = DB;
        DB = bancoVeioVazio ? juntarBancos(linhas[0].data, DB) : juntarBancos(DB, linhas[0].data);
        manterReferencias(antigo, DB);
        aplicarPedidosDaLoja();
        gravarLocal();
        lembrarBancoVazio(false);
        /* O usuário desta sessão pode ter sido apagado ou rebaixado no
           outro aparelho: a junção acabou de trazer isso. */
        if(SESSION){
          const perfil = SESSION.role;
          validarSessao();
          if(!SESSION){ showLogin(); toast('Seu usuário foi removido. Entre de novo.','warn'); }
          else if(SESSION.role !== perfil && !temFormularioAberto()){ renderShell(); navigate(currentRoute); }
        }
      }
      lembrarCarimbo(carimbo);
    };
    /* Sem conseguir LER não se grava. Antes o envio seguia mesmo assim, e
       na terceira tentativa ia sem condição nenhuma: era o caminho por
       onde um aparelho desatualizado gravava por cima da loja. Se a
       leitura falhou, a gravação muito provavelmente falharia também — e
       o trabalho continua guardado aqui, esperando. */
    try{ await trazerDaNuvem(); }
    catch(e){
      const r = e && e.resposta;
      ultimoErroNuvem = { status: r ? r.status : 0, detalhe: r ? 'a nuvem não deixou ler antes de gravar' : String(e && e.message || e) };
      falhouAoEnviar = true;
      tentativasDeEnvio++;
      agendarEnvio(esperaDoReenvio());
      atualizaAvisoDeNuvem();
      return;
    }

    /* A gravação é CONDICIONAL: só entra se a linha ainda for a que lemos
       (mesmo updated_at). Se outro aparelho — ou a vitrine — gravou entre
       a olhada e o envio, a nuvem responde "nenhuma linha", trazemos o que
       ele fez e tentamos de novo. Sem isto havia um segundo em que a
       venda do site podia ser apagada pelo caixa, sem ninguém ver. */
    let res = null, carimboNovo = null, gravado = false;
    for(let tentativa = 0; tentativa < 3 && !gravado; tentativa++){
      carimboNovo = todayISO();
      const corpo = JSON.stringify({ id:'main', data: dadosParaNuvem(), updated_at: carimboNovo });
      /* Com linha na nuvem a gravação é sempre condicional. Só vai sem
         condição quando não existe linha nenhuma lá (loja nova). */
      if(ultimoCarimboDaNuvem){
        res = await fetch(`${c.url}/rest/v1/${c.tabela}?id=eq.main&updated_at=eq.${encodeURIComponent(ultimoCarimboDaNuvem)}&select=updated_at`, {
          method:'PATCH',
          headers:{ ...cabecalhosNuvem({ 'Content-Type':'application/json' }), 'Prefer':'return=representation' },
          body: corpo
        });
        if(res.ok){
          let linhas = [];
          try{ linhas = await res.json(); }catch(e){}
          if(Array.isArray(linhas) && linhas.length){
            gravado = true;
            if(linhas[0].updated_at) carimboNovo = linhas[0].updated_at;
            break;
          }
          /* Ninguém casou com o carimbo: a linha mudou (ou sumiu). */
          res = null;
          try{ await trazerDaNuvem(); }catch(e){ break; }
          continue;
        }
        /* Havia linha lá (temos o carimbo dela) e a gravação foi recusada:
           é erro de verdade. Cair no envio sem condição daqui apagaria o
           que os outros aparelhos fizeram. */
        break;
      }
      res = await fetch(`${c.url}/rest/v1/${c.tabela}`, {
        method:'POST',
        headers:{
          ...cabecalhosNuvem({ 'Content-Type':'application/json' }),
          'Prefer':'resolution=merge-duplicates,return=minimal'
        },
        body: corpo
      });
      if(res.ok) gravado = true;
      else break;
    }

    /* A resposta AGORA é conferida. Sem isto, um 401 ou um 404 passava por
       gravação bem-sucedida e a loja não ficava sabendo de nada. */
    if(!gravado){
      let detalhe = '';
      try{ detalhe = res ? (await res.text()).slice(0, 200) : 'a linha mudou três vezes seguidas'; }catch(e){}
      ultimoErroNuvem = { status: res ? res.status : 0, detalhe };
      falhouAoEnviar = true;
      tentativasDeEnvio++;
      agendarEnvio(esperaDoReenvio());
      atualizaAvisoDeNuvem();
      return;
    }

    ultimoErroNuvem = null;
    falhouAoEnviar = false;
    lembrarCarimbo(carimboNovo);
    /* O carimbo local passa a valer o mesmo do que acabou de subir. Sem
       isto, o carimbo da nuvem ficava sempre alguns décimos à FRENTE do
       local (o envio acontece depois da gravação), e toda leitura seguinte
       achava que a nuvem estava mais nova e trocava o banco inteiro por
       uma cópia igual — desfazendo, no caminho, o que tivesse acabado de
       mudar aqui. Foi assim que o endereço de uma foto recém-enviada
       sumia. */
    try{ localStorage.setItem(LOCAL_TS_KEY, String(new Date(carimboNovo).getTime())); }catch(e){}
    horaDoUltimoEnvioOk = Date.now();
    tentativasDeEnvio = 0;
    lembrarSubstituicao(false);
    if(versaoLocal === versaoEnviada){
      lembrarPendencia(false);
    } else {
      /* Mudou alguma coisa enquanto o envio viajava: continua pendente e
         vai de novo já. */
      agendarEnvio(400);
    }
    atualizaAvisoDeNuvem();
  }catch(e){
    /* Sem rede no meio do envio. A alteração continua pendente e volta a
       ser tentada — antes ela ficava para trás em silêncio. */
    ultimoErroNuvem = { status: 0, detalhe: String(e && e.message || e) };
    falhouAoEnviar = true;
    tentativasDeEnvio++;
    agendarEnvio(esperaDoReenvio());
    atualizaAvisoDeNuvem();
  }finally{
    enviandoAgora = false;
  }
}

/* Sincronizar é MÃO DUPLA, e a volta faltava: o aparelho mandava o que
   fazia, mas não buscava o que os outros tinham feito. Quem deixasse o
   sistema aberto no computador não via a venda do celular até recarregar
   a página — e ninguém recarrega página de propósito. Agora, sempre que o
   sistema volta para a frente da tela, o lojista desbloqueia o aparelho
   ou a internet volta, ele manda o que tem e busca o que falta. */
function temFormularioAberto(){
  return !!document.querySelector('.modal-overlay');
}
async function sincronizarAgora(){
  if(temPendencia || (!nuvemLida && !nuvemVaziaConfirmada)){
    tentativasDeEnvio = 0;
    agendarEnvio(200);
  }
  /* As fotos entram no mesmo laço insistente do banco. Antes elas só
     tentavam subir quando alguém cadastrava uma peça — se a nuvem
     estivesse fora naquele instante, a foto ficava parada no aparelho
     esperando o próximo cadastro, que podia não vir nunca. */
  if(fotosPendentes.size) enviarFotosPendentes();
  /* Não puxa no meio de um cadastro: trocar o banco embaixo de um
     formulário aberto seria apagar o que a pessoa está digitando. */
  if(temFormularioAberto()) return;
  await cloudPull();
}

function ligarGatilhosDeEnvio(){
  window.addEventListener('online', sincronizarAgora);
  window.addEventListener('focus', sincronizarAgora);
  document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) sincronizarAgora(); });
  /* E, com o sistema aberto e parado, uma conferida por minuto: é o que
     faz a venda do celular aparecer no computador do balcão sozinha. */
  setInterval(sincronizarAgora, 60000);
}

/* =========================================================
   FOTOS NA NUVEM (Supabase Storage)
   A foto não fica mais dentro do banco. O banco guarda só o endereço
   dela, que ocupa ~80 bytes no lugar de ~90 KB. Assim o armazenamento do
   aparelho não enche, e cada venda deixa de reenviar todas as fotos.
   ========================================================= */

/* Fotos que ainda não subiram (sem internet, ou porque a pasta no Supabase
   não existe). Ficavam SÓ NA MEMÓRIA: bastava fechar o sistema e elas
   sumiam para sempre — foi assim que as peças desta loja ficaram sem foto,
   com a pasta do Supabase ainda por criar. Agora cada foto pendente é
   guardada no aparelho, numa chave própria, e continua lá depois de
   fechar. Chave própria também importa por outro motivo: assim ela não
   engorda o banco que é sincronizado a cada venda. */
/* =========================================================
   FILA DE FOTOS — no armazenamento GRANDE do navegador
   =========================================================
   A fila morava no localStorage, junto com o cadastro da loja. E o
   localStorage é o menor armazenamento que o navegador tem: cerca de
   5 MB no total. Uma foto de peça ocupa ~150 KB ali (texto base64, que é
   um terço maior que o arquivo). Conta feita: A PARTIR DA 31ª FOTO O
   APARELHO ENCHE — e a loja tem mais de 40 peças. Não era um azar, era
   uma certeza matemática: com a nuvem fora do ar, o aparelho ia encher
   sempre.

   A fila passa para o IndexedDB, que é o armazenamento grande (centenas
   de megabytes, não cinco), e guarda a foto como arquivo binário em vez
   de texto — outro terço a menos. O localStorage fica só com o cadastro
   da loja, que tem alguns kilobytes e nunca disputa espaço com foto
   nenhuma. */
const fotosPendentes = new Map();
let enviandoFotos = false;
let ultimoErroFoto = null;
const PREFIXO_FOTO = 'estiloCiaFoto_';     // formato antigo, ainda migrado
const BANCO_FOTOS = 'estiloFashionFotos';
const LOJA_FOTOS = 'pendentes';

let bancoDeFotos = null;
function abrirBancoDeFotos(){
  if(bancoDeFotos) return bancoDeFotos;
  bancoDeFotos = new Promise((resolve, reject)=>{
    if(!window.indexedDB) return reject(new Error('sem IndexedDB'));
    const req = indexedDB.open(BANCO_FOTOS, 1);
    req.onupgradeneeded = ()=>{
      if(!req.result.objectStoreNames.contains(LOJA_FOTOS)) req.result.createObjectStore(LOJA_FOTOS);
    };
    req.onsuccess = ()=>resolve(req.result);
    req.onerror = ()=>reject(req.error);
  }).catch(err=>{ bancoDeFotos = null; throw err; });
  return bancoDeFotos;
}
function comALoja(modo, fazer){
  return abrirBancoDeFotos().then(db=>new Promise((resolve, reject)=>{
    const t = db.transaction(LOJA_FOTOS, modo);
    const pedido = fazer(t.objectStore(LOJA_FOTOS));
    t.oncomplete = ()=>resolve(pedido && pedido.result);
    t.onerror = ()=>reject(t.error);
    t.onabort = ()=>reject(t.error);
  }));
}

function dataUrlParaBlob(dataUrl){
  return fetch(dataUrl).then(r=>r.blob());
}
function blobParaDataUrl(blob){
  return new Promise((resolve, reject)=>{
    const leitor = new FileReader();
    leitor.onload = ()=>resolve(leitor.result);
    leitor.onerror = reject;
    leitor.readAsDataURL(blob);
  });
}

/* Guardar é imediato na memória e persistente logo em seguida. A parte
   imediata importa: quem chama isto pode estar no meio de uma venda, e
   esperar o disco responder não é opção. */
function guardarFotoPendente(pid, dataUrl){
  fotosPendentes.set(pid, dataUrl);
  dataUrlParaBlob(dataUrl)
    .then(blob=>comALoja('readwrite', loja=>loja.put(blob, pid)))
    .catch(err=>console.warn('Não deu para guardar a foto na fila:', err));
}
function esquecerFotoPendente(pid){
  fotosPendentes.delete(pid);
  comALoja('readwrite', loja=>loja.delete(pid)).catch(()=>{});
  try{ localStorage.removeItem(PREFIXO_FOTO + pid); }catch(e){}
}
async function carregarFotosPendentes(){
  /* Primeiro traz o que ficou no formato antigo, dentro do localStorage,
     e liberta aquele espaço — é ele que estava fazendo falta. */
  let antigas = [];
  try{ antigas = Object.keys(localStorage).filter(k=>k.indexOf(PREFIXO_FOTO) === 0); }catch(e){}
  for(const chave of antigas){
    const pid = chave.slice(PREFIXO_FOTO.length);
    let valor = null;
    try{ valor = localStorage.getItem(chave); }catch(e){}
    if(valor){
      fotosPendentes.set(pid, valor);
      try{
        const blob = await dataUrlParaBlob(valor);
        await comALoja('readwrite', loja=>loja.put(blob, pid));
        localStorage.removeItem(chave);      // só depois de estar guardada lá
      }catch(err){ console.warn('Não deu para mudar a foto de lugar:', err); }
    }
  }
  /* Agora o que já está no armazenamento grande. */
  try{
    const chaves = await comALoja('readonly', loja=>loja.getAllKeys());
    for(const pid of (chaves||[])){
      if(fotosPendentes.has(pid)) continue;
      const blob = await comALoja('readonly', loja=>loja.get(pid));
      if(blob) fotosPendentes.set(pid, await blobParaDataUrl(blob));
    }
  }catch(err){ console.warn('Não deu para ler a fila de fotos:', err); }
}
function chavesDeFotosPendentes(){
  try{ return Object.keys(localStorage).filter(k=>k.indexOf(PREFIXO_FOTO) === 0); }
  catch(e){ return []; }
}
/* Quanto a fila está ocupando, para a tela de espaço poder mostrar. */
async function tamanhoDaFilaDeFotos(){
  let total = 0;
  try{
    const chaves = await comALoja('readonly', loja=>loja.getAllKeys());
    for(const pid of (chaves||[])){
      const blob = await comALoja('readonly', loja=>loja.get(pid));
      if(blob) total += blob.size || 0;
    }
  }catch(e){}
  return total;
}

function urlDaFoto(caminho){
  const c = configNuvem();
  return `${c.url}/storage/v1/object/public/${c.bucket}/${caminho}`;
}

/* Sobe uma foto e devolve o endereço público. Lança erro se não conseguir,
   para quem chamou poder avisar ou tentar de novo. */
async function subirFoto(dataUrl, nomeBase){
  const bin = await (await fetch(dataUrl)).blob();
  const caminho = `${nomeBase}-${Date.now()}.jpg`;
  const c = configNuvem();
  const res = await fetch(`${c.url}/storage/v1/object/${c.bucket}/${caminho}`, {
    method:'POST',
    headers: cabecalhosNuvem({ 'Content-Type':'image/jpeg', 'x-upsert':'true' }),
    body: bin
  });
  if(!res.ok){
    /* 404 aqui quase sempre quer dizer que a pasta de fotos ainda não foi
       criada no Supabase — dizer "sem internet" nesse caso seria mentira e
       faria o lojista procurar o problema no lugar errado. */
    const err = new Error('Storage respondeu ' + res.status);
    err.motivo = (res.status===404 || res.status===400) ? 'bucket'
               : (res.status===401 || res.status===403) ? 'permissao' : 'rede';
    err.status = res.status;
    ultimoErroFoto = { status: res.status };
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
      if(!DB.products.some(x=>x.id===pid)){
        /* Peça que ainda está sendo cadastrada (formulário aberto): a foto
           espera por ela em vez de ser jogada fora. */
        if(!temFormularioAberto()) esquecerFotoPendente(pid);
        continue;
      }
      try{
        const endereco = await subirFoto(dataUrl, pid);
        ultimoErroFoto = null;
        /* O envio leva segundos, e nesse tempo a nuvem pode ter trocado o
           banco: a peça é procurada de novo, no banco de agora. */
        const prod = DB.products.find(x=>x.id===pid);
        if(prod){ prod.photo = endereco; delete prod.photoPendente; carimbar(prod); }
        esquecerFotoPendente(pid);
        saveDB();
        if(currentRoute==='produtos') renderProdutosTable();
      }catch(e){
        if(!ultimoErroFoto) ultimoErroFoto = { status: e && e.status || 0 };
        break; // não deu agora: para aqui e tenta de novo mais tarde
      }
    }
  } finally { enviandoFotos = false; }
}

/* Fotos do formato antigo (embutidas no banco) sobem para a nuvem sozinhas
   na primeira vez que o sistema abre com internet, liberando o espaço. */
async function migrarFotosAntigas(){
  await carregarFotosPendentes();    // o que ficou de sessões anteriores
  /* Antes isto só COPIAVA a foto para a fila e a deixava dentro do banco.
     A imagem continuava então em dois lugares: enchendo o espaço pequeno
     do aparelho e viajando para o Supabase a cada gravação. Agora ela sai
     do banco de verdade — o lugar dela é a fila, até o Storage aceitar. */
  let mexeu = false;
  DB.products.forEach(p=>{
    if(p.photo && p.photo.indexOf('data:') === 0){
      guardarFotoPendente(p.id, p.photo);
      p.photo = '';
      p.photoPendente = true;
      mexeu = true;
    }
  });
  if(mexeu) gravarLocal();
  if(fotosPendentes.size) enviarFotosPendentes();
}

/* A foto de uma peça para mostrar na tela: o endereço na nuvem quando já
   subiu, e a que está esperando na fila enquanto não subiu. Sem isto, a
   peça ficaria sem imagem nenhuma no cadastro enquanto a nuvem não
   aceitasse — e o lojista acharia que a foto se perdeu. */
function fotoDaPeca(p){
  if(p.photo) return p.photo;
  if(p.photoPendente && fotosPendentes.has(p.id)) return fotosPendentes.get(p.id);
  return '';
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
/* SENHAS.
   Ficam em texto, como sempre ficaram. Guardar a impressão digital (SHA-256)
   parecia melhor, mas quebrou a loja: o site publicado numa versão antiga
   compara a senha em texto e passou a recusar todo mundo até ser
   atualizado. Uma senha que já esteja gravada como impressão digital
   continua entrando — o sistema confere dos dois jeitos. */
const MARCA_SENHA = 'sha256:';
function temCofre(){ return !!(window.crypto && crypto.subtle && crypto.subtle.digest); }
async function impressaoDaSenha(senha){
  const bytes = new TextEncoder().encode('estilo-fashion|' + senha);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return MARCA_SENHA + [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function guardarSenha(senha){ return String(senha); }
async function senhaConfere(u, senha){
  const guardada = u.pass == null ? '' : String(u.pass);
  if(guardada.indexOf(MARCA_SENHA) !== 0) return guardada === String(senha);
  if(!temCofre()) return false;
  try{ return (await impressaoDaSenha(senha)) === guardada; }catch(e){ return false; }
}
async function tryLogin(user, pass){
  const alvo = String(user||'').trim().toLowerCase();
  const u = DB.users.find(x=>String(x.user||'').toLowerCase() === alvo);
  if(!u || !(await senhaConfere(u, pass))) return false;
  /* Senha gravada como impressão digital por uma versão anterior volta a
     texto, para os aparelhos na versão antiga voltarem a entrar. */
  if(String(u.pass).indexOf(MARCA_SENHA) === 0){ u.pass = String(pass); saveDB(); }
  SESSION = { id:u.id, user:u.user, name:u.name||u.user, role:u.role };
  localStorage.setItem(SESSION_KEY, JSON.stringify(SESSION));
  return true;
}
/* A dica embaixo do botão era o texto fixo "admin / 1234". Quando o lojista
   troca a senha ou renomeia o usuário, ela passa a mentir — foi o que
   aconteceu na loja. Agora ela lê o banco: só mostra a senha enquanto ela
   ainda for a de fábrica. */
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
  /* O login não olha maiúsculas: "Admin" e "admin" são o mesmo usuário. */
  const admin = DB.users.find(u=>String(u.user||'').trim().toLowerCase()==='admin');
  if(admin){ admin.pass='1234'; admin.role='admin'; carimbar(admin); }
  else DB.users.push(carimbar({ id:uid(), user:'admin', pass:'1234', role:'admin', name:'Administrador' }));
  saveDB();
  document.getElementById('loginError').textContent = '';
  document.getElementById('loginUser').value = 'admin';
  document.getElementById('loginPass').value = '';
  document.getElementById('loginPass').focus();
  toast('Acesso restaurado. Entre com admin / 1234 e troque a senha em Configurações.','warn');
}

function logout(){
  SESSION = null;
  localStorage.removeItem(SESSION_KEY);
  /* Quem entra depois não herda o carrinho, o desconto nem o CPF de quem
     saiu — a venda sairia no nome da pessoa errada. */
  cart = []; pdvDiscount = 0; pdvCustomer = ''; pdvCpf = '';
  estoqueMode = null;
  currentRoute = 'painel';
  document.querySelectorAll('.modal-overlay').forEach(m=>m.remove());
  showLogin();
}
function restoreSession(){
  try{ SESSION = JSON.parse(localStorage.getItem(SESSION_KEY)); }catch(e){ SESSION=null; }
  validarSessao();
}
/* A sessão guardada continuava valendo depois de o usuário ser apagado ou
   rebaixado: a vendedora demitida seguia entrando como admin até limpar o
   navegador. A sessão vale enquanto o usuário existir, com o perfil atual. */
function validarSessao(){
  if(!SESSION || !SESSION.id){ SESSION = null; return; }
  const u = (DB && DB.users || []).find(x=>x.id === SESSION.id);
  if(!u){ SESSION = null; try{ localStorage.removeItem(SESSION_KEY); }catch(e){} return; }
  SESSION.user = u.user; SESSION.name = u.name || u.user; SESSION.role = u.role;
}
/* O que cada perfil abre. Vendedor(a) fica com o balcão; o resto é do
   Admin. Antes qualquer login via tudo, inclusive Configurações. */
const ROTAS_DE_ADMIN = ['balanco','financeiro','gastos','abrirloja','relatorios','config'];
function podeAbrir(route){
  if(!SESSION) return false;
  return SESSION.role === 'admin' || !ROTAS_DE_ADMIN.includes(route);
}

/* =========================================================
   SHELL / ROUTER
   ========================================================= */
/* O menu é separado pelo uso: em cima o que a loja abre todo dia, embaixo
   o que se mexe de vez em quando. Nada foi removido — só deixou de
   competir por atenção com o balcão. */
/* Ícones do menu, em linha (SVG). Emojis mudam de cara em cada aparelho
   e não combinam com o resto da interface; estes seguem a cor do texto. */
const ICONES = {
  painel: '<path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z"/>',
  pdv: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
  produtos: '<path d="M20.4 6.3L16 4l-1.5 2h-5L8 4 3.6 6.3 2 10l3 1.5V20h14v-8.5L22 10z"/>',
  estoque: '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="M3.3 7l8.7 5 8.7-5M12 22V12"/>',
  vendas: '<path d="M4 2v20l3-2 3 2 2-2 2 2 3-2 3 2V2l-3 2-3-2-2 2-2-2-3 2z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  perdas: '<path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7.7L3 7"/><path d="M12 8v5M12 16.5v.01"/>',
  balanco: '<path d="M21.2 15.9A10 10 0 1 1 8 2.8"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>',
  caixa: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  etiquetas: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.2"/>',
  clientes: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  financeiro: '<path d="M12 20V10M18 20V4M6 20v-4"/>',
  gastos: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
  abrirloja: '<path d="M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6"/>',
  relatorios: '<path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
  config: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};
function icone(id){
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONES[id]||ICONES.painel}</svg>`;
}
const NAV = [
  /* O Painel abre o menu e o sistema. Ele é o resumo do dia: quem chega na
     loja de manhã quer ver como está antes de vender. */
  { id:'painel', label:'Painel', icon:'🏠', group:'dia' },
  { id:'pdv', label:'Vender (PDV)', icon:'🛒', group:'dia' },
  { id:'produtos', label:'Produtos', icon:'👗', group:'dia' },
  { id:'estoque', label:'Estoque', icon:'📦', group:'dia' },
  { id:'vendas', label:'Vendas', icon:'🧾', group:'dia' },
  { id:'perdas', label:'Perdas e Devoluções', icon:'↩', group:'dia' },

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
  /* A nuvem costuma falhar ANTES do login, enquanto a tela de entrada está
     na frente — e recado dado numa tela que ninguém está vendo é recado
     perdido. Com a faixa fixa isso não aparecia porque ela ficava lá,
     parada. Agora que o aviso some sozinho, ele tem de ser dado quando o
     lojista chega. */
  atualizaAvisoDeNuvem();
}

function renderShell(){
  document.getElementById('sidebarStoreName').textContent = DB.storeName;
  document.getElementById('userPill').textContent = `${SESSION.name} · ${SESSION.role==='admin'?'Admin':'Vendedor(a)'}`;
  const navEl = document.getElementById('navList');
  const item = n => `<li><a href="#${n.id}" data-route="${n.id}"><span class="nav-ico">${icone(n.id)}</span><span>${n.label}</span></a></li>`;
  const visiveis = NAV.filter(n=>podeAbrir(n.id));
  const gestao = visiveis.filter(n=>n.group==='gestao');
  navEl.innerHTML =
      visiveis.filter(n=>n.group==='dia').map(item).join('')
    + (gestao.length ? `<li class="nav-sep">Gerenciar</li>` + gestao.map(item).join('') : '');
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
  if(!SESSION) return;
  if(!podeAbrir(route)){ toast('Essa tela é só para o administrador','warn'); route = 'painel'; }
  if(!NAV.some(n=>n.id===route)) route = 'painel';
  /* A entrada/saída por bipe pertence à tela de Estoque. Ligada fora dela,
     um bipe solto em Relatórios mexia no estoque sem ninguém ver. */
  if(route !== 'estoque') estoqueMode = null;
  currentRoute = route;
  if(location.hash !== '#' + route) location.hash = route;
  document.querySelectorAll('.nav-list a').forEach(a=>a.classList.toggle('active', a.dataset.route===route));
  const title = NAV.find(n=>n.id===route)?.label || '';
  document.getElementById('viewTitle').textContent = title;
  const view = document.getElementById('view');
  const renderers = {
    painel: renderPainel, pdv: renderPDV, produtos: renderProdutos, estoque: renderEstoque,
    etiquetas: renderEtiquetas, clientes: renderClientes, vendas: renderVendas, caixa: renderCaixa,
    financeiro: renderFinanceiro, gastos: renderGastos, abrirloja: renderAbrirLoja,
    relatorios: renderRelatorios, config: renderConfig, balanco: renderBalanco, perdas: renderPerdas
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

/* Redesenha a tela atual com um renderizador, se ela estiver na frente. */
function redesenhar(render){
  const view = document.getElementById('view');
  if(view && typeof render === 'function') render(view);
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
  const salesToday = DB.sales.filter(s=>vendaValida(s) && new Date(s.date)>=today);
  const totalToday = salesToday.reduce((a,s)=>a+s.total,0);
  const lowStock = countLowStock();
  const pendingOnline = DB.sales.filter(s=>s.origin==='loja' && s.status==='pendente' && !s.canceled).length;
  const mk = monthKey();
  const financeMonth = DB.finance.entries.filter(e=>chaveMes(e.date) === mk);
  const receitasMes = financeMonth.filter(e=>e.type==='receita' && e.status==='pago').reduce((a,e)=>a+e.amount,0);
  const despesasMes = financeMonth.filter(e=>e.type==='despesa' && e.status==='pago').reduce((a,e)=>a+e.amount,0);
  const perdasMes = resumoPerdas(d => chaveMes(d) === mk);

  el.innerHTML = `
    <div class="cards-row">
      <div class="card"><div class="label">Vendas hoje</div><div class="value">${salesToday.length}</div></div>
      <div class="card"><div class="label">Faturado hoje</div><div class="value">${money(totalToday)}</div></div>
      <div class="card"><div class="label">Estoque baixo</div><div class="value ${lowStock>0?'text-danger':''}">${lowStock}</div></div>
      <div class="card"><div class="label">Pedidos online pendentes</div><div class="value ${pendingOnline>0?'text-danger':''}">${pendingOnline}</div></div>
      ${ehAdmin() ? `<div class="card"><div class="label">Saldo do mês</div><div class="value ${receitasMes-despesasMes>=0?'text-success':'text-danger'}">${money(receitasMes-despesasMes)}</div></div>` : ''}
      <div class="card" style="cursor:pointer" onclick="navigate('perdas')" title="Abrir Perdas e Devoluções"><div class="label">Perdas e devoluções no mês</div>
        <div class="value ${perdasMes.perdasPecas ? 'text-danger' : ''}">${perdasMes.perdasPecas} <span class="unidade">perda(s)</span> · ${perdasMes.devPecas} <span class="unidade">devol.</span></div></div>
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
    ${list.map(s=>`<tr><td>${dateBR(s.date)}</td><td>${escapeHtml(customerName(s.customerId))}</td><td>${money(s.total)}</td><td>${escapeHtml(s.payment)}${s.status==='pendente'?' <span class="badge badge-warning">Pendente</span>':''}</td></tr>`).join('')}
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
        <td>${fotoDaPeca(p) ? `<img src="${escapeHtml(fotoDaPeca(p))}" alt="" loading="lazy" decoding="async" onerror="this.remove()" style="width:40px;height:40px;object-fit:cover;border-radius:6px;background:var(--sand)">` : ''}</td>
        <td>${escapeHtml(p.name)} ${p.isNew?'<span class="tag-new">NOVO</span>':''}</td>
        <td>${grade ? `<span class="text-muted">${p.variations.length} combinações</span>` : mostra(v0.color)}</td>
        <td>${grade ? '' : mostra(v0.size)}</td>
        <td>${grade ? `<span class="text-muted">${p.variations.length} códigos</span>` : escapeHtml(v0.barcode||'-')}</td>
        <td>${money(p.price)}</td>
        <td class="${total<=DB.config.minStock?'text-danger':''}">${total}</td>
        <td><button class="btn btn-sm" onclick="openProductModal('${p.id}')">Editar</button>
            <button class="btn btn-sm" title="Ir para Etiquetas" onclick="goToLabels('${p.id}')">🏷️</button>
            ${ehAdmin() ? `<button class="btn btn-sm btn-danger" onclick="deleteProduct('${p.id}')">Excluir</button>` : ''}</td>
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
  if(!soAdministrador('excluir uma peça')) return;
  if(!confirm('Excluir este produto?')) return;
  const antes = DB.products.length;
  DB.products = DB.products.filter(p=>p.id!==id);
  registrarApagado('products', id);
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
        <div class="field"><label>NCM (cupom fiscal)</label><input id="f_ncm" value="${escapeHtml(p.ncm||'')}" inputmode="numeric" placeholder="vazio = padrão ${escapeHtml(configFiscal().ncmPadrao)}" maxlength="10"></div>
        <div class="field full">
          <label>Foto do produto</label>
          <input id="f_photo" value="${escapeHtml(p.photo)}" placeholder="Cole uma URL ou envie um arquivo abaixo">
          <div style="display:flex;align-items:center;gap:12px;margin-top:8px">
            <label class="btn btn-sm" style="cursor:pointer;margin:0">📁 Enviar do computador/celular
              <input type="file" id="f_photoFile" accept="image/*" style="display:none">
            </label>
            <img id="f_photoPreview" src="${escapeHtml(fotoDaPeca(p))}" style="height:52px;width:52px;object-fit:cover;border-radius:8px;background:var(--sand);${fotoDaPeca(p)?'':'display:none'}">
            <span id="f_photoStatus" class="text-muted" style="font-size:12px">${p.photoPendente && !p.photo ? 'Foto guardada aqui, esperando a nuvem' : ''}</span>
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
    resizeImageFile(file, 800, 0.7).then(async dataUrl=>{
      const preview = overlay.querySelector('#f_photoPreview');
      preview.src = dataUrl; preview.style.display = '';
      overlay.dataset.fotoPendente = '';
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
        guardarFotoPendente(p.id, dataUrl);
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
  /* Na peça simples a primeira combinação É a da tela principal (cor,
     tamanho, quantidade). Ela aparecia de novo aqui embaixo, como linha
     vazia: quem escrevia nela ("G / Preto / 3") perdia tudo ao salvar,
     porque a tela principal gravava por cima. */
  const pecaSimples = ()=>overlay.querySelector('#pecaSimples').style.display !== 'none';
  function renderVars(){
    const primeira = pecaSimples() ? 1 : 0;
    overlay.querySelector('#varRows').innerHTML = variations.map((v,i)=> i < primeira ? '' : `
      <div class="variation-row">
        <input placeholder="Tamanho" value="${escapeHtml(v.size)}" data-i="${i}" data-k="size">
        <input placeholder="Cor" value="${escapeHtml(v.color)}" data-i="${i}" data-k="color">
        <input placeholder="Estoque" type="number" min="0" step="1" inputmode="numeric" value="${v.stock}" data-i="${i}" data-k="stock">
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
        variations[i][k] = k==='stock' ? Math.max(0, Math.floor(Number(e.target.value)||0)) : e.target.value;
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
      const emUso = new Set(variations.map(v=>String(v.barcode||'')));
      let codigo = generateUniqueBarcode();
      while(emUso.has(codigo)) codigo = generateUniqueBarcode();
      variations[i].barcode = codigo; saveDB(); renderVars();
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
        const qtd = Math.max(0, Math.floor(Number(overlay.querySelector('#f_qty').value) || 0));
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
      finalVariations.forEach(v=>{
        v.stock = Math.max(0, Math.floor(Number(v.stock)||0));
        v.barcode = String(v.barcode||'').trim();
        if(!v.size) v.size = 'Único';
        if(!v.color) v.color = 'Padrão';
      });
      /* A peça pode ter sido excluída em outro aparelho com este
         formulário aberto. */
      if(editing && !DB.products.includes(editing)){
        toast('Esta peça foi excluída em outro aparelho enquanto você editava. Feche e cadastre de novo, se for o caso.','error'); return;
      }
      /* O MESMO CÓDIGO DE BARRAS EM DUAS PEÇAS faz o caixa vender a peça
         errada: o bipe acha a primeira e baixa o estoque dela. Digitado
         ou lido pela câmera, o código é conferido contra todo o cadastro
         (sem olhar maiúsculas) antes de gravar. */
      const normal = c => String(c||'').trim().toLowerCase();
      const daPeca = new Set();
      for(const v of finalVariations){
        if(!v.barcode) continue;
        const c = normal(v.barcode);
        if(daPeca.has(c)){ toast('O código ' + v.barcode + ' está em duas linhas desta peça. Cada tamanho/cor precisa do seu.','error'); return; }
        daPeca.add(c);
        const dona = DB.products.find(o=>o.id !== p.id && o.variations.some(x=>normal(x.barcode) === c));
        if(dona){ toast('O código ' + v.barcode + ' já é da peça "' + dona.name + '". Use outro, ou deixe em branco para o sistema gerar.','error'); return; }
      }
      const combosAntes = new Set();
      for(const v of finalVariations){
        const k = (v.size||'') + '|' + (v.color||'');
        if(combosAntes.has(k)){ toast('A combinação ' + (v.size||'-') + '/' + (v.color||'-') + ' está repetida','error'); return; }
        combosAntes.add(k);
      }
      const precoDigitado = Number((usandoGrade ? overlay.querySelector('#f_price_grade') : overlay.querySelector('#f_price')).value)||0;
      const custoDigitado = Number((usandoGrade ? overlay.querySelector('#f_cost_grade') : overlay.querySelector('#f_cost')).value)||0;
      if(precoDigitado < 0 || custoDigitado < 0){ toast('Preço e custo não podem ser negativos','error'); return; }
      // Cada peça recebe seu próprio código de barras — só depois de tudo
      // conferido, para a tentativa recusada não gastar números.
      const novosCodigos = [];
      finalVariations.forEach(v=>{
        if(!v.barcode){
          let codigo = generateUniqueBarcode();
          while(daPeca.has(normal(codigo))) codigo = generateUniqueBarcode();
          v.barcode = codigo; daPeca.add(normal(codigo)); novosCodigos.push(codigo);
        }
      });
      const precoInput = usandoGrade ? overlay.querySelector('#f_price_grade') : overlay.querySelector('#f_price');
      const cost = Number((usandoGrade ? overlay.querySelector('#f_cost_grade') : overlay.querySelector('#f_cost')).value)||0;
      const price = Number(precoInput.value)||0;
      if(price < 0 || cost < 0){ toast('Preço e custo não podem ser negativos','error'); return; }
      const fotoUrl = overlay.querySelector('#f_photo').value.trim();
      /* Uma foto que ainda está na fila continua na fila: salvar a peça
         sem trocar a foto apagava a marca de "pendente" e a imagem sumia
         da tela até a nuvem aceitar. */
      const fotoPendente = overlay.dataset.fotoPendente === '1'
        || (!fotoUrl && !!(editing && editing.photoPendente && fotosPendentes.has(p.id)));
      const data = {
        id:p.id, name,
        sku: overlay.querySelector('#f_sku').value.trim(),
        category: overlay.querySelector('#f_category').value.trim(),
        brand: overlay.querySelector('#f_brand').value.trim(),
        ncm: overlay.querySelector('#f_ncm').value.replace(/\D/g,'').slice(0,8),
        cost, price,
        photo: fotoUrl,
        photoPendente: fotoPendente ? true : undefined,
        description: overlay.querySelector('#f_desc').value.trim(),
        showInStore: overlay.querySelector('#f_show').checked,
        isNew: overlay.querySelector('#f_new').checked,
        variations: finalVariations
      };
      /* Dois tamanhos iguais na mesma peça (M/Preto duas vezes) viram um
         estoque só que ninguém sabe qual é. */
      const combos = new Set();
      for(const v of finalVariations){
        const k = (v.size||'') + '|' + (v.color||'');
        if(combos.has(k)){ toast('A combinação ' + (v.size||'-') + '/' + (v.color||'-') + ' está repetida','error'); return; }
        combos.add(k);
      }
      carimbar(data);
      if(editing){ Object.assign(editing, data); if(!fotoPendente) delete editing.photoPendente; }
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
   RECUPERAR DADOS DA NUVEM
   A linha da loja é uma só e foi gravada por cima, então não há histórico
   nela. Mas o projeto do Supabase pode guardar outras linhas e outras
   tabelas — do sistema antigo, de outra loja, de um teste. Esta tela
   varre tudo o que a chave alcança e mostra o que parecer um banco da
   loja, com quantos produtos e vendas tem cada um.
   ========================================================= */
/* O SQL que cria a tabela no projeto novo. Fica na tela para o lojista
   copiar e colar no Supabase — sem isso ele dependeria de mim para uma
   coisa que leva um minuto. */
/* A INSTALAÇÃO INTEIRA NUM SQL SÓ.
   Antes isto criava só a tabela, e a pasta das fotos ficava para o lojista
   criar à mão numa outra tela do Supabase — que é exatamente o passo que
   ficou por fazer e deixou 74 fotos presas no aparelho. Agora um comando
   monta tudo: a tabela, as permissões dela, a pasta das fotos e as
   permissões da pasta.

   Pode ser rodado quantas vezes quiser: nada aqui apaga dado nenhum, e as
   permissões são refeitas em vez de dar erro de "já existe". */
/* SEM UM COMENTÁRIO SEQUER, e isso é de propósito.

   A loja colou este SQL no Supabase e recebeu "erro de sintaxe próximo a
   ESTILO" — a primeira linha, que era o comentário `-- ESTILO FASHION`,
   chegou lá sem os dois tracinhos e virou comando. O tradutor automático
   do navegador estava ligado na página do Supabase e reescreveu o texto
   dentro do editor (dava para ver `create policy` virado em `criar
   política`).

   Não dá para impedir o tradutor de fora, mas dá para tirar dele o que
   estragar: sem comentários, toda linha é comando de verdade, e o texto é
   o mais curto possível. A explicação de cada parte fica na tela do
   sistema, fora do SQL. */
const SQL_CRIAR_TABELA = `create table if not exists public.TABELA (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.TABELA enable row level security;

drop policy if exists "loja le" on public.TABELA;
create policy "loja le" on public.TABELA
  for select to anon using (true);

drop policy if exists "loja grava" on public.TABELA;
create policy "loja grava" on public.TABELA
  for insert to anon with check (true);

drop policy if exists "loja atualiza" on public.TABELA;
create policy "loja atualiza" on public.TABELA
  for update to anon using (true) with check (true);

drop policy if exists "loja apaga" on public.TABELA;
create policy "loja apaga" on public.TABELA
  for delete to anon using (true);

create table if not exists public.BASE_historico (
  id bigserial primary key,
  linha text not null,
  data jsonb not null,
  gravado_em timestamptz not null,
  guardado_em timestamptz not null default now(),
  produtos integer not null default 0,
  vendas integer not null default 0
);

create index if not exists BASE_historico_idx
  on public.BASE_historico (linha, guardado_em desc);

alter table public.BASE_historico enable row level security;

drop policy if exists "historico le" on public.BASE_historico;
create policy "historico le" on public.BASE_historico
  for select to anon using (true);

create or replace function public.BASE_conta(d jsonb, chave text)
returns integer language sql immutable as $$
  select case when jsonb_typeof(d -> chave) = 'array' then jsonb_array_length(d -> chave) else 0 end;
$$;

create or replace function public.BASE_guardar_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ultimo timestamptz;
  encolheu boolean;
begin
  if old.data is not distinct from new.data then
    return new;
  end if;
  encolheu := BASE_conta(new.data, 'products') < BASE_conta(old.data, 'products')
           or BASE_conta(new.data, 'sales') < BASE_conta(old.data, 'sales');
  select guardado_em into ultimo
    from public.BASE_historico
   where linha = old.id
   order by guardado_em desc
   limit 1;
  if not encolheu and ultimo is not null and ultimo > now() - interval '10 minutes' then
    return new;
  end if;
  insert into public.BASE_historico (linha, data, gravado_em, produtos, vendas)
  values (old.id, old.data, old.updated_at,
          BASE_conta(old.data, 'products'),
          BASE_conta(old.data, 'sales'));
  delete from public.BASE_historico
   where linha = old.id
     and id not in (
       select id from public.BASE_historico
        where linha = old.id
        order by guardado_em desc
        limit 300
     );
  return new;
end;
$$;

drop trigger if exists BASE_historico_trg on public.TABELA;
create trigger BASE_historico_trg
  before update on public.TABELA
  for each row execute function public.BASE_guardar_historico();

insert into storage.buckets (id, name, public)
values ('BUCKET', 'BUCKET', true)
on conflict (id) do update set public = true;

drop policy if exists "fotos leitura" on storage.objects;
create policy "fotos leitura" on storage.objects
  for select to anon using (bucket_id = 'BUCKET');

drop policy if exists "fotos envio" on storage.objects;
create policy "fotos envio" on storage.objects
  for insert to anon with check (bucket_id = 'BUCKET');

drop policy if exists "fotos troca" on storage.objects;
create policy "fotos troca" on storage.objects
  for update to anon using (bucket_id = 'BUCKET') with check (bucket_id = 'BUCKET');

drop policy if exists "fotos remocao" on storage.objects;
create policy "fotos remocao" on storage.objects
  for delete to anon using (bucket_id = 'BUCKET');`;

/* Os objetos do histórico levam o nome da tabela sem o "_db":
   loja_roupas_db -> loja_roupas_historico, loja_roupas_conta... */
function baseDaTabela(){ return configNuvem().tabela.replace(/_db$/, ''); }
function tabelaHistorico(){ return baseDaTabela() + '_historico'; }
function sqlDaTabela(){
  const c = configNuvem();
  return SQL_CRIAR_TABELA.replaceAll('BASE_', baseDaTabela() + '_').replaceAll('TABELA', c.tabela).replaceAll('BUCKET', c.bucket);
}

function copiarSqlDaTabela(){
  const texto = sqlDaTabela();
  const pronto = ()=>toast('SQL copiado. Cole no SQL Editor do Supabase.');
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(texto).then(pronto).catch(()=>selecionarSql());
  } else selecionarSql();
  function selecionarSql(){
    const campo = document.getElementById('sqlTabela');
    if(campo){ campo.select(); toast('Toque e segure para copiar o SQL.','warn'); }
  }
}

/* Testa a ligação ANTES de gravar. Salvar uma configuração que não
   funciona deixaria a loja sem nuvem sem ninguém perceber. */
async function conectarNuvem(){
  const url = (document.getElementById('nv_url').value || '').trim().replace(/\/+$/, '');
  const key = (document.getElementById('nv_key').value || '').trim();
  const tabela = (document.getElementById('nv_tabela').value || '').trim() || 'loja_roupas_db';
  const box = document.getElementById('resultadoConexao');
  if(!/^https:\/\/.+\.supabase\.co$/.test(url)){
    box.innerHTML = '<div class="aviso-codigo">O endereço deve ser parecido com <code>https://abcdefgh.supabase.co</code>.</div>';
    return;
  }
  if(!key){ box.innerHTML = '<div class="aviso-codigo">Falta a chave publicável.</div>'; return; }

  box.innerHTML = '<p class="text-muted">Testando a ligação...</p>';
  let res;
  try{
    res = await fetch(`${url}/rest/v1/${tabela}?select=id&limit=1`, {
      headers:{ apikey:key, Authorization:'Bearer '+key }
    });
  }catch(err){
    box.innerHTML = `<div class="aviso-codigo">Não houve resposta desse endereço.
      Confira se o projeto existe e está ativo.</div>`;
    return;
  }
  if(!res.ok){
    const corpo = await res.text().catch(()=>'');
    box.innerHTML = `<div class="aviso-codigo">
      <strong>A nuvem respondeu ${res.status}.</strong><br>
      ${escapeHtml(explicarErroDaNuvem({status:res.status}))}
      ${/relation|does not exist|404/i.test(corpo + res.status)
        ? '<br><br>Se a tabela ainda não existe, rode o SQL abaixo no Supabase e teste de novo.' : ''}
    </div>`;
    return;
  }

  salvarConfigNuvem({ url, key, tabela, bucket: configNuvem().bucket });
  nuvemLida = false; nuvemVaziaConfirmada = false; ultimoErroNuvem = null;
  lembrarCarimbo(null);           // outro projeto: nada do que está lá foi visto por este aparelho
  box.innerHTML = `<div class="pdf-pronto"><strong>Ligado.</strong>
    O sistema já está falando com este projeto.</div>`;
  await cloudPull();
  atualizaAvisoDeNuvem();
  toast('Nuvem conectada.');
  navigate('config');
}

/* Manda para a nuvem o que está neste aparelho. Serve para semear o
   projeto novo com o que a loja tem agora. */
async function enviarTudoParaNuvem(){
  const quantos = (DB.products||[]).length;
  if(!confirm('Enviar o que está neste aparelho para a nuvem?\n\n' +
              quantos + ' produto(s) e ' + (DB.sales||[]).length + ' venda(s).\n\n' +
              'O que já estiver na nuvem e não estiver aqui é preservado.')) return;
  nuvemVaziaConfirmada = true;      // decisão do lojista, tomada na tela
  lembrarPendencia(true);
  await cloudPush();
  /* Dizer "Enviado" sem a nuvem ter confirmado é a mentira que fez esta
     loja confiar num backup que não existia. */
  if(temPendencia){
    toast('NÃO foi possível enviar: ' + (explicarErroDaNuvem(ultimoErroNuvem) || 'a nuvem não respondeu.'), 'error');
  } else {
    toast(quantos + ' produto(s) salvos na nuvem.');
  }
  atualizaAvisoDeNuvem();
}

/* Diz, em português e sem rodeio, o que a nuvem respondeu. Enquanto a loja
   só via "sem internet", ninguém sabia para onde olhar. */
async function testarNuvem(){
  const box = document.getElementById('diagnosticoNuvem');
  if(!box) return;
  box.innerHTML = '<p class="text-muted">Testando...</p>';
  const linhas = [];
  const anotar = (rotulo, status, ok, corpo)=>linhas.push({ rotulo, status, ok, corpo });
  const tentar = async (rotulo, url, opcoes)=>{
    try{
      const res = await fetch(url, opcoes || { headers: cabecalhosNuvem() });
      let corpo = '';
      try{ corpo = (await res.text()).slice(0,160); }catch(e){}
      anotar(rotulo, res.status, res.ok, corpo);
      return res;
    }catch(err){
      anotar(rotulo, 0, false, String(err && err.message || err));
      return null;
    }
  };
  const cfg = configNuvem();

  await tentar('1. Ler a tabela da loja', `${cfg.url}/rest/v1/${cfg.tabela}?select=id&limit=1`);

  /* GRAVAR é o teste que faltava — e é o que decide se o trabalho da loja
     está indo para a nuvem. Uma chave pode ler e não poder escrever (é o
     padrão do Supabase até alguém liberar), e o diagnóstico antigo dava
     "está respondendo" em verde nesse caso, que é a pior resposta
     possível. A gravação é feita numa linha de teste, chamada _teste, que
     não encosta nos dados da loja e é apagada logo depois. */
  await tentar('2. GRAVAR na tabela', `${cfg.url}/rest/v1/${cfg.tabela}`, {
    method:'POST',
    headers:{ ...cabecalhosNuvem({ 'Content-Type':'application/json' }),
              'Prefer':'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id:'_teste', data:{ teste:true }, updated_at: todayISO() })
  });
  /* Limpa a linha de teste. Se não der, não tem problema: ela é minúscula
     e não atrapalha nada. */
  await fetch(`${cfg.url}/rest/v1/${cfg.tabela}?id=eq._teste`,
              { method:'DELETE', headers: cabecalhosNuvem() }).catch(()=>{});

  /* Enviar uma foto de mentira é o único jeito de saber que a pasta existe
     E aceita envio. Listar a pasta só provava que ela existe — e foi
     assim que 74 fotos ficaram presas no aparelho com o teste em verde. */
  const pontinho = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  try{
    const bin = await (await fetch(pontinho)).blob();
    const res = await fetch(`${cfg.url}/storage/v1/object/${cfg.bucket}/_teste.gif`, {
      method:'POST',
      headers: cabecalhosNuvem({ 'Content-Type':'image/gif', 'x-upsert':'true' }),
      body: bin
    });
    let corpo = ''; try{ corpo = (await res.text()).slice(0,160); }catch(e){}
    anotar('3. ENVIAR foto para a pasta', res.status, res.ok, corpo);
    if(res.ok){
      await fetch(`${cfg.url}/storage/v1/object/${cfg.bucket}/_teste.gif`,
                  { method:'DELETE', headers: cabecalhosNuvem() }).catch(()=>{});
    }
  }catch(err){
    anotar('3. ENVIAR foto para a pasta', 0, false, String(err && err.message || err));
  }

  /* O histórico é a rede de proteção contra a linha gravada por cima: a
     nuvem guarda as versões anteriores sozinha. Sem ele o sistema
     funciona, mas sem como voltar atrás. */
  await tentar('4. Ler o histórico da nuvem', `${cfg.url}/rest/v1/${tabelaHistorico()}?select=id&limit=1`);

  const leitura = linhas[0], gravacao = linhas[1], fotos = linhas[2], historico = linhas[3];
  const tudoBem = leitura.ok && gravacao.ok && fotos.ok && historico.ok;

  let recado, comoResolver = '';
  if(tudoBem){
    recado = 'Instalação completa: a nuvem lê, grava, recebe fotos e guarda o histórico. Nada fica preso neste aparelho.';
  } else if(leitura.ok && gravacao.ok && fotos.ok && !historico.ok){
    recado = 'Tudo funciona, mas a nuvem ainda não guarda o histórico das versões (' + historico.status + ').';
    comoResolver = 'Sem ele não há como voltar atrás se alguém gravar por cima. Copie o SQL de instalação logo abaixo e rode no SQL Editor do Supabase: ele cria a tabela de histórico.';
  } else if(leitura.ok && gravacao.ok && !fotos.ok){
    recado = 'A tabela está certa, mas a pasta das fotos não aceita envio (' + fotos.status + ').';
    comoResolver = 'As fotos ficam presas no aparelho enquanto isso. Copie o SQL de instalação logo abaixo e rode no SQL Editor do Supabase: ele cria a pasta e libera o envio.';
  } else if(!leitura.ok && (leitura.status === 404 || /does not exist|not find/i.test(leitura.corpo||''))){
    recado = 'A tabela "' + cfg.tabela + '" não existe neste projeto do Supabase.';
    comoResolver = 'Nada está sendo salvo na nuvem. Copie o SQL que está logo abaixo, cole no SQL Editor do Supabase e clique em Run. Isso cria a tabela e libera o acesso.';
  } else if(!leitura.ok && leitura.status === 0){
    recado = 'O servidor da nuvem não respondeu nada.';
    comoResolver = 'O sistema carregou normalmente, então a internet está boa — quem não respondeu foi o Supabase. '
      + 'Confira no painel do Supabase se o projeto está ATIVO (projeto pausado ou apagado responde assim), '
      + 'e se o endereço abaixo é mesmo o do seu projeto.';
  } else if(!leitura.ok){
    recado = 'A nuvem não deixou nem LER (' + leitura.status + ').';
    comoResolver = explicarErroDaNuvem({ status: leitura.status });
  } else {
    recado = 'A nuvem deixa ler, mas NÃO deixa gravar (' + gravacao.status + ').';
    comoResolver = 'É por isso que o trabalho fica só no aparelho. As permissões da tabela precisam liberar gravação para a chave publicável — o SQL abaixo faz exatamente isso; rode-o de novo no SQL Editor do Supabase.';
  }

  ultimoDiagnostico = [
    'DIAGNÓSTICO DA NUVEM — Estilo Fashion, versão ' + APP_VERSION,
    'Projeto: ' + cfg.url.replace('https://','').split('.')[0] + ' · tabela: ' + cfg.tabela + ' · pasta de fotos: ' + cfg.bucket,
    recado,
    ...linhas.map(l=>l.rotulo + ' -> ' + (l.status || 'sem resposta') + (l.corpo ? ' | ' + l.corpo : '')),
    'Fotos esperando no aparelho: ' + fotosPendentes.size
  ].join('\n');

  box.innerHTML = `<div class="${tudoBem ? 'pdf-pronto' : 'aviso-codigo'}">
      <strong>${escapeHtml(recado)}</strong>
      ${comoResolver ? '<br>' + escapeHtml(comoResolver) : ''}
    </div>
    <div class="table-wrap" style="margin-top:10px"><table><thead><tr>
      <th>Teste</th><th>Resposta</th><th>Detalhe</th></tr></thead><tbody>
      ${linhas.map(l=>`<tr><td>${escapeHtml(l.rotulo)}</td>
        <td><strong>${l.ok ? '✅ ' : '❌ '}${l.status || 'sem resposta'}</strong></td>
        <td class="text-muted" style="font-size:11px">${escapeHtml(l.corpo || '-')}</td></tr>`).join('')}
    </tbody></table></div>
    <button class="btn btn-sm" style="margin-top:10px" onclick="copiarDiagnostico()">📋 Copiar este diagnóstico</button>
    <p class="text-muted" style="font-size:12px;margin-top:8px">
      Projeto: <code>${escapeHtml(cfg.url.replace('https://','').split('.')[0])}</code> ·
      tabela <code>${escapeHtml(cfg.tabela)}</code><br>
      <a href="${escapeHtml(cfg.url)}/rest/v1/" target="_blank" rel="noopener">Abrir o endereço da nuvem no navegador</a>
      — se esta página não abrir, o projeto do Supabase não está no ar, e nenhum ajuste no sistema resolve isso.</p>`;
}

/* =========================================================
   ESPAÇO DO APARELHO
   O navegador dá alguns megabytes ao sistema e não avisa quando estão
   acabando — avisa quando acabaram, no meio de uma venda. Esta tela
   mostra o que está ocupando e dá o botão para resolver, em vez de
   deixar o lojista adivinhando o que apagar.
   ========================================================= */
function tamanhoNoAparelho(chave){
  try{ const v = localStorage.getItem(chave); return v ? v.length : 0; }
  catch(e){ return 0; }
}
function medirEspacoDoAparelho(){
  let cadastro = 0, copias = 0, fotos = 0, resto = 0, nFotos = 0;
  try{
    Object.keys(localStorage).forEach(k=>{
      const n = tamanhoNoAparelho(k);
      if(k === STORAGE_KEY || k === LOCAL_TS_KEY) cadastro += n;
      else if(k === CHAVE_COPIAS) copias += n;
      else if(k.indexOf(PREFIXO_FOTO) === 0){ fotos += n; nFotos++; }
      else resto += n;
    });
  }catch(e){}
  return { cadastro, copias, fotos, resto, nFotos, total: cadastro + copias + fotos + resto };
}
function emMB(bytes){
  const mb = bytes / (1024*1024);
  return (mb < 0.1 ? (bytes/1024).toFixed(0) + ' KB' : mb.toFixed(1) + ' MB');
}
async function renderEspacoDoAparelho(){
  const box = document.getElementById('espacoDoAparelho');
  if(!box) return;
  const m = medirEspacoDoAparelho();
  m.fotos = await tamanhoDaFilaDeFotos();
  m.nFotos = fotosPendentes.size;
  /* O limite do navegador costuma ficar em torno de 5 MB. Não dá para
     perguntar o número exato, então mostramos o que é sabido — o quanto
     está ocupado — e deixamos claro que perto de 5 MB é hora de limpar. */
  const usadoNoPequeno = m.cadastro + m.copias + m.resto;
  const apertado = usadoNoPequeno > 3.5 * 1024 * 1024;
  box.innerHTML = `
    <div class="${apertado ? 'aviso-codigo' : 'pdf-pronto'}">
      <strong>${emMB(usadoNoPequeno)} ocupados pelo cadastro da loja.</strong>
      ${m.nFotos
        ? `${m.nFotos} foto(s) ainda não subiram — é isso que ocupa lugar. Toque em "Mandar as fotos para a nuvem agora".`
        : 'Só a cópia de trabalho da loja. As fotos estão todas na nuvem.'}
      ${apertado ? '<br>Está perto do limite do navegador (cerca de 5 MB).' : ''}
    </div>
    <div class="table-wrap" style="margin-top:10px"><table><tbody>
      <tr><td>Cadastro da loja (peças, vendas, clientes)</td><td><strong>${emMB(m.cadastro)}</strong></td></tr>
      <tr><td>Cópias de segurança</td><td><strong>${emMB(m.copias)}</strong></td></tr>
      <tr><td>Outros</td><td><strong>${emMB(m.resto)}</strong></td></tr>
      <tr><td>Fotos esperando para subir <span class="text-muted">(${m.nFotos})</span><br>
        <span class="text-muted" style="font-size:11px">no armazenamento grande, fora do espaço acima</span></td>
        <td><strong>${emMB(m.fotos)}</strong></td></tr>
    </tbody></table></div>
    <div class="table-wrap" style="margin-top:10px"><table><tbody>
      <tr><td>O que é enviado ao banco a cada alteração</td>
        <td><strong>${emMB(JSON.stringify(dadosParaNuvem()).length)}</strong></td></tr>
    </tbody></table></div>
    <p class="text-muted" style="font-size:12px;margin-top:8px">
      O lugar das fotos é o Supabase. As que aparecem aqui são as que ele ainda não aceitou —
      elas esperam num armazenamento separado, que é centenas de vezes maior, para nunca
      atrapalharem uma venda.</p>`;
}
/* O botão deixou de ser "apague suas fotos para caber". Com a nuvem de pé,
   o que resolve é MANDAR as fotos para lá — e o espaço se resolve sozinho,
   sem ninguém ter de escolher entre a foto e a venda. */
async function forcarEnvioDasFotos(){
  if(!fotosPendentes.size){
    toast('Não há foto esperando: está tudo na nuvem.');
    renderEspacoDoAparelho();
    return;
  }
  const antes = fotosPendentes.size;
  toast('Enviando ' + antes + ' foto(s) para a nuvem...');
  await enviarFotosPendentes();
  renderEspacoDoAparelho();
  const restam = fotosPendentes.size;
  if(!restam){ toast(antes + ' foto(s) enviadas. O espaço do aparelho foi liberado.'); return; }
  const motivo = explicarErroDaNuvem(ultimoErroFoto) || 'a nuvem não aceitou.';
  toast('Subiram ' + (antes - restam) + ' de ' + antes + '. As outras continuam guardadas aqui: ' + motivo, 'warn');
}

/* O diagnóstico em texto puro, para o lojista colar numa conversa. Print de
   tela se perde, chega cortado ou não chega — texto sempre chega. */
let ultimoDiagnostico = '';
function copiarDiagnostico(){
  if(!ultimoDiagnostico){ toast('Rode o teste primeiro','warn'); return; }
  const pronto = ()=>toast('Diagnóstico copiado. É só colar na conversa.');
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(ultimoDiagnostico).then(pronto).catch(()=>caixaDeTexto());
    return;
  }
  caixaDeTexto();
  function caixaDeTexto(){
    /* Sem permissão para a área de transferência (acontece no iPhone fora
       do toque direto): mostra o texto para copiar à mão, em vez de dizer
       que copiou sem ter copiado. */
    const box = document.getElementById('diagnosticoNuvem');
    const ta = document.createElement('textarea');
    ta.readOnly = true; ta.rows = 8;
    ta.style.cssText = 'width:100%;margin-top:10px;font-family:monospace;font-size:11px';
    ta.value = ultimoDiagnostico;
    box.appendChild(ta);
    ta.focus(); ta.select();
    toast('Selecione o texto acima e copie.','warn');
  }
}

function pareceBancoDaLoja(v){
  return v && typeof v === 'object' &&
    (Array.isArray(v.products) || Array.isArray(v.sales) || Array.isArray(v.customers));
}

/* Um banco pode estar na raiz da linha ou dentro de alguma coluna. */
function acharBancosNaLinha(linha){
  const achados = [];
  if(pareceBancoDaLoja(linha)) achados.push({ onde:'linha', banco: linha });
  Object.keys(linha||{}).forEach(coluna=>{
    let v = linha[coluna];
    if(typeof v === 'string' && v.length > 40 && v.trim().startsWith('{')){
      try{ v = JSON.parse(v); }catch(e){ return; }
    }
    if(pareceBancoDaLoja(v)) achados.push({ onde:'coluna '+coluna, banco: v });
  });
  return achados;
}

/* O endereço raiz do PostgREST lista as tabelas, mas a chave pública nem
   sempre tem permissão para ele — a loja recebeu 401 ali. Então tentamos,
   e se não der, procuramos pelos nomes de tabela mais prováveis. A leitura
   das tabelas em si funciona: é assim que o sistema sincroniza. */
const TABELAS_PROVAVEIS = [
  'loja_roupas_db', 'loja_roupas_historico', 'lumina_db', 'loja_db', 'sistema_db', 'estilo_db',
  'db', 'dados', 'banco', 'backup', 'backups', 'loja', 'store', 'sistema',
  'app_data', 'estado', 'snapshot', 'snapshots', 'historico'
];

async function listarTabelasDoProjeto(){
  try{
    const res = await fetch(`${configNuvem().url}/rest/v1/`, {
      headers: cabecalhosNuvem({ Accept:'application/openapi+json' })
    });
    if(res.ok){
      const spec = await res.json();
      const defs = spec.definitions || (spec.components && spec.components.schemas) || {};
      const nomes = Object.keys(defs).filter(n=>!n.startsWith('('));
      if(nomes.length) return { nomes, completa:true };
    }
  }catch(e){ /* segue para a tentativa por nomes */ }
  return { nomes: TABELAS_PROVAVEIS, completa:false };
}

let achadosDaNuvem = [];

async function procurarNaNuvem(tabelaExtra){
  const saida = document.getElementById('resultadoBusca');
  if(!saida) return;
  saida.innerHTML = '<p class="text-muted">Procurando no Supabase...</p>';
  achadosDaNuvem = [];
  const problemas = [];
  let algumaLeituraDeu = false;

  const { nomes: base, completa } = await listarTabelasDoProjeto();
  const extra = (tabelaExtra||'').trim();
  const nomes = extra ? [extra, ...base.filter(n=>n!==extra)] : base;
  saida.innerHTML = `<p class="text-muted">Lendo ${nomes.length} tabela(s)...</p>`;

  for(const tabela of nomes){
    let linhas = null;
    try{
      /* Sem filtro de id: a linha principal foi gravada por cima, mas pode
         haver outras linhas guardadas ao lado dela. */
      const res = await fetch(`${configNuvem().url}/rest/v1/${tabela}?select=*&limit=100`, {
        headers: cabecalhosNuvem()
      });
      if(res.status === 404 || res.status === 400) continue;   // tabela não existe
      if(!res.ok){ problemas.push(tabela + ' (' + res.status + ')'); continue; }
      linhas = await res.json();
      algumaLeituraDeu = true;
    }catch(e){ problemas.push(tabela + ' (sem resposta)'); continue; }

    (linhas||[]).forEach((linha, i)=>{
      acharBancosNaLinha(linha).forEach(({onde, banco})=>{
        achadosDaNuvem.push({
          tabela, onde,
          id: linha.id != null ? String(linha.id) : ('linha ' + (i+1)),
          quando: linha.updated_at || linha.created_at || null,
          produtos: (banco.products||[]).length,
          vendas: (banco.sales||[]).length,
          clientes: (banco.customers||[]).length,
          banco
        });
      });
    });
  }

  achadosDaNuvem.sort((a,b)=> (b.produtos + b.vendas) - (a.produtos + a.vendas));
  mostrarAchadosDaNuvem({ completa, problemas, algumaLeituraDeu });
}

function mostrarAchadosDaNuvem(info){
  const saida = document.getElementById('resultadoBusca');
  if(!saida) return;
  const { completa, problemas, algumaLeituraDeu } = info || {};

  const rodape = `
    ${!completa ? `<p class="text-muted" style="font-size:12px;margin-top:10px">
      A chave pública não deixa listar as tabelas do projeto, então procurei pelos nomes mais
      comuns. Se você souber o nome da tabela antiga, me diga que eu incluo na busca.</p>` : ''}
    ${problemas && problemas.length ? `<p class="text-muted" style="font-size:12px;margin-top:6px">
      Sem permissão de leitura em: ${escapeHtml(problemas.join(', '))}.</p>` : ''}`;

  if(!achadosDaNuvem.length){
    saida.innerHTML = `<div class="empty-state">
      ${algumaLeituraDeu
        ? 'Li o que a chave alcança e não encontrei outro banco da loja além do que já está aqui.'
        : 'Não consegui ler nenhuma tabela. Confira a chave do Supabase em uso.'}
    </div>` + rodape;
    return;
  }
  saida.innerHTML = `<div class="table-wrap"><table><thead><tr>
      <th>Onde</th><th style="text-align:right">Produtos</th><th style="text-align:right">Vendas</th>
      <th>Quando</th><th></th></tr></thead><tbody>
    ${achadosDaNuvem.map((a,i)=>`<tr>
      <td>${escapeHtml(a.tabela)}<div class="text-muted" style="font-size:11px">${escapeHtml(a.id)} · ${escapeHtml(a.onde)}</div></td>
      <td style="text-align:right"><strong>${a.produtos}</strong></td>
      <td style="text-align:right">${a.vendas}</td>
      <td>${a.quando ? dateBR(a.quando) : '-'}</td>
      <td>${a.produtos || a.vendas
            ? `<button class="btn btn-sm btn-accent" onclick="restaurarDaNuvem(${i})">Usar este</button>`
            : ''}</td>
    </tr>`).join('')}
  </tbody></table></div>
  <p class="text-muted" style="font-size:12px;margin-top:10px">
    O que está no sistema agora vira cópia de segurança antes de qualquer troca.</p>` + rodape;
}

function restaurarDaNuvem(indice){
  const a = achadosDaNuvem[indice];
  if(!a) return;
  if(!confirm('Trazer este banco para o sistema?\n\n' +
              a.produtos + ' produto(s), ' + a.vendas + ' venda(s), ' + a.clientes + ' cliente(s).\n' +
              'Origem: ' + a.tabela + ' · ' + a.id + '\n\n' +
              'O que está no sistema agora será guardado como cópia antes da troca.')) return;
  guardarCopiaDeSeguranca('antes de trazer da nuvem (recuperação)');
  trocarBancoInteiro(JSON.parse(JSON.stringify(a.banco)));
  if(exigirGravacao('os dados recuperados')){
    toast(a.produtos + ' produto(s) recuperados.');
    entrarDepoisDeTrocarOBanco();
  }
}

/* =========================================================
   HISTÓRICO NA NUVEM
   A linha da loja é uma só. Antes, quem gravasse por cima apagava tudo
   sem deixar rastro — foi assim que o estoque sumiu. Agora o próprio
   Supabase guarda a versão anterior a cada gravação (no máximo uma a
   cada 10 minutos, e sempre que algo encolhe), e as últimas 300 ficam.
   Esta tela lista essas versões e traz uma de volta com um toque.
   ========================================================= */
let versoesDaNuvem = [];
async function carregarHistoricoDaNuvem(){
  const box = document.getElementById('historicoNuvem');
  if(!box) return;
  box.innerHTML = '<p class="text-muted">Lendo o histórico...</p>';
  const c = configNuvem();
  try{
    const res = await fetch(`${c.url}/rest/v1/${tabelaHistorico()}?linha=eq.main&select=id,gravado_em,guardado_em,produtos,vendas&order=guardado_em.desc&limit=60`,
                            { headers: cabecalhosNuvem() });
    if(res.status === 404){
      box.innerHTML = `<div class="aviso-codigo">A nuvem ainda não guarda histórico. Rode o SQL de instalação (logo acima) no Supabase: ele cria a tabela e o gatilho.</div>`;
      return;
    }
    if(!res.ok){ box.innerHTML = `<div class="aviso-codigo">A nuvem respondeu ${res.status} ao ler o histórico.</div>`; return; }
    versoesDaNuvem = await res.json();
  }catch(e){
    box.innerHTML = `<div class="aviso-codigo">Sem ligação com a nuvem agora.</div>`;
    return;
  }
  if(!versoesDaNuvem.length){
    box.innerHTML = `<div class="empty-state">Nenhuma versão guardada ainda. A primeira aparece na próxima gravação que mudar alguma coisa.</div>`;
    return;
  }
  box.innerHTML = `<div class="table-wrap"><table><thead><tr>
      <th>Versão de</th><th style="text-align:right">Produtos</th><th style="text-align:right">Vendas</th><th></th></tr></thead><tbody>
    ${versoesDaNuvem.map((v,i)=>`<tr>
      <td>${dateBR(v.gravado_em)}<div class="text-muted" style="font-size:11px">guardada ${dateBR(v.guardado_em)}</div></td>
      <td style="text-align:right"><strong>${v.produtos}</strong></td>
      <td style="text-align:right">${v.vendas}</td>
      <td><button class="btn btn-sm" onclick="restaurarVersaoDaNuvem(${i})">Voltar para esta</button></td>
    </tr>`).join('')}
  </tbody></table></div>
  <p class="text-muted" style="font-size:12px;margin-top:10px">
    O que está no sistema agora vira cópia de segurança antes de qualquer troca, e a versão escolhida
    é enviada para a nuvem em seguida.</p>`;
}
async function restaurarVersaoDaNuvem(i){
  const v = versoesDaNuvem[i];
  if(!v) return;
  if(!confirm('Voltar para a versão de ' + dateBR(v.gravado_em) + '?\n\n' +
              v.produtos + ' produto(s) e ' + v.vendas + ' venda(s).\n\n' +
              'O que está no sistema agora será guardado como cópia antes da troca.')) return;
  const c = configNuvem();
  let banco = null;
  try{
    const res = await fetch(`${c.url}/rest/v1/${tabelaHistorico()}?id=eq.${v.id}&select=data`, { headers: cabecalhosNuvem() });
    const rows = res.ok ? await res.json() : [];
    banco = rows[0] && rows[0].data;
  }catch(e){}
  if(!banco){ toast('Não consegui ler essa versão da nuvem','error'); return; }
  guardarCopiaDeSeguranca('antes de voltar a uma versão da nuvem');
  trocarBancoInteiro(banco);
  if(exigirGravacao('a versão restaurada')){
    toast('Versão de ' + dateBR(v.gravado_em) + ' restaurada. Enviando para a nuvem…');
    entrarDepoisDeTrocarOBanco();
  }
}

/* =========================================================
   ATUALIZAÇÃO AUTOMÁTICA
   O celular da loja ficou preso numa versão antiga por dias, e cada
   correção que eu publicava parecia não funcionar — quando na verdade nem
   chegava lá. Agora o sistema pergunta ao servidor qual é a versão atual
   e, se estiver atrasado, recarrega sozinho buscando os arquivos novos.
   ========================================================= */
const CHAVE_RECARGA = 'estiloFashion_recarregou';

async function conferirVersao(){
  try{
    const res = await fetch('versao.json?t=' + Date.now(), { cache:'no-store' });
    if(!res.ok) return;
    const info = await res.json();
    if(!info || !info.versao) return;
    if(String(info.versao) === String(APP_VERSION)){
      sessionStorage.removeItem(CHAVE_RECARGA);
      return;
    }
    /* Recarrega uma vez só. Se mesmo assim continuar atrasado, é cache do
       navegador que não solta, e aí quem avisa é a tela — melhor do que
       ficar recarregando em círculo. */
    if(sessionStorage.getItem(CHAVE_RECARGA) === String(info.versao)){
      toast('Há uma versão nova (' + info.versao + '). Feche e abra o navegador para atualizar.', 'warn');
      return;
    }
    sessionStorage.setItem(CHAVE_RECARGA, String(info.versao));
    location.reload();
  }catch(err){
    /* Sem internet: segue com o que está instalado. */
  }
}

/* =========================================================
   BALANÇO — as três perguntas que o lojista faz toda semana:
   quanto tenho parado em estoque, quanto gastei e quanto vendi.
   ========================================================= */
let balancoPeriodo = 'mes';

function periodoBalanco(){
  const hoje = new Date();
  const ano = hoje.getFullYear();
  /* `casa` recebe tanto datas completas (vendas, lançamentos) quanto o
     mês "2026-09" dos gastos mensais. As datas são convertidas para o
     fuso da loja antes de comparar. */
  const mesDe = x => (typeof x === 'string' && /^\d{4}-\d{2}$/.test(x)) ? x : chaveMes(x);
  if(balancoPeriodo === 'mes'){
    const mk = monthKey();
    return { rotulo: monthLabel(mk), casa: d => mesDe(d) === mk, mesUnico: mk };
  }
  if(balancoPeriodo === 'mesPassado'){
    const d = new Date(ano, hoje.getMonth()-1, 1);
    const mk = monthKey(d);
    return { rotulo: monthLabel(mk), casa: x => mesDe(x) === mk, mesUnico: mk };
  }
  if(balancoPeriodo === 'ano'){
    return { rotulo: 'ano de '+ano, casa: x => mesDe(x).startsWith(String(ano)), mesUnico: null };
  }
  return { rotulo: 'desde o começo', casa: () => true, mesUnico: null };
}

/* Lançamento do Financeiro que é ESPELHO de outra tela (gasto mensal
   marcado como pago, custo de abertura pago). O Balanço já soma o gasto
   na tela de origem; somar o espelho de novo dobrava o aluguel na conta. */
function lancamentoEspelhado(e){
  if(!e) return false;
  if(e.origem === 'gasto' || e.origem === 'abertura' || e.origem === 'devolucao') return true;
  const c = String(e.category||'');
  return c.indexOf('Gasto mensal — ') === 0 || c.indexOf('Abertura — ') === 0;
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
  const vendas = DB.sales.filter(s => vendaValida(s) && per.casa(s.date));
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
    .filter(e => e.type === 'despesa' && e.status !== 'pendente' && !lancamentoEspelhado(e) && per.casa(e.date))
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
  DB.finance.entries.filter(e => e.type === 'despesa' && e.status !== 'pendente' && !lancamentoEspelhado(e) && per.casa(e.date))
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
  /* Perda é dinheiro que saiu sem passar pelo caixa: o que a loja pagou
     pela peça. Devolução desfaz a venda: o dinheiro volta para a cliente
     e, se a peça voltou boa, o custo dela volta para o estoque. */
  const pd = resumoPerdas(per.casa);
  const custoDasPerdas = pd.perdasCusto;
  const resultado = ven.total - pd.devValor - (ven.custoVendido - pd.devCustoVoltou) - gas.total - custoDasPerdas;

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
          ${pd.devolucoes ? `<tr><td>Devolvido às clientes (${pd.devPecas} peça${pd.devPecas===1?'':'s'})</td><td style="text-align:right">− ${money(pd.devValor)}</td></tr>` : ''}
          <tr><td>Custo das peças vendidas</td><td style="text-align:right">− ${money(ven.custoVendido)}</td></tr>
          ${pd.devCustoVoltou ? `<tr><td>Custo das peças que voltaram ao estoque</td><td style="text-align:right">+ ${money(pd.devCustoVoltou)}</td></tr>` : ''}
          <tr><td><strong>Lucro nas peças</strong></td><td style="text-align:right"><strong class="${ven.lucroBruto - pd.devValor + pd.devCustoVoltou >= 0 ? 'text-success' : 'text-danger'}">${money(ven.lucroBruto - pd.devValor + pd.devCustoVoltou)}</strong></td></tr>
        </tbody></table>
      </div>

      <div class="panel">
        <h3>🧾 Quanto gastei — ${escapeHtml(per.rotulo)}</h3>
        <table><tbody>
          <tr><td>Gastos mensais (aluguel, luz, água…)</td><td style="text-align:right">${money(gas.mensais)}</td></tr>
          <tr><td>Outras despesas (Financeiro)</td><td style="text-align:right">${money(gas.despesas)}</td></tr>
          ${gas.abertura ? `<tr><td>Custos para abrir a loja</td><td style="text-align:right">${money(gas.abertura)}</td></tr>` : ''}
          <tr><td>Perdas de peças (${pd.perdasPecas}, a custo)</td><td style="text-align:right">${money(custoDasPerdas)}</td></tr>
          <tr><td><strong>Total gasto</strong></td><td style="text-align:right"><strong>${money(gas.total + custoDasPerdas)}</strong></td></tr>
        </tbody></table>
        ${balancoPeriodo !== 'tudo' ? `<p class="text-muted" style="font-size:12px;margin-top:10px">Os custos de abertura da loja só entram na conta em "Desde o começo" — foram um gasto único.</p>` : ''}
      </div>
    </div>

    <div class="panel" style="border-left:4px solid ${resultado>=0?'var(--success,#4C8B5C)':'var(--danger,#B33A3A)'}">
      <h3>${resultado>=0?'✅':'⚠️'} Resultado de ${escapeHtml(per.rotulo)}</h3>
      <table><tbody>
        <tr><td>Vendi${pd.devValor ? ' (já tirando o que devolvi)' : ''}</td><td style="text-align:right">${money(ven.total - pd.devValor)}</td></tr>
        <tr><td>Paguei pelas peças que vendi</td><td style="text-align:right">− ${money(ven.custoVendido - pd.devCustoVoltou)}</td></tr>
        <tr><td>Gastei com a loja</td><td style="text-align:right">− ${money(gas.total)}</td></tr>
        ${custoDasPerdas ? `<tr><td>Perdi em peças</td><td style="text-align:right">− ${money(custoDasPerdas)}</td></tr>` : ''}
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
    DB.config.minStock = Math.max(0, Number(e.target.value)||0); carimbar(DB.config); saveDB(); renderStockTable(); toast('Estoque mínimo atualizado');
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
/* Compara sem diferenciar maiúsculas e sem espaços em volta: leitor com
   Caps Lock ligado mandava "ec000007" e a peça "EC000007" não era achada. */
function findVariationByBarcode(code){
  const alvo = String(code||'').trim().toLowerCase();
  if(!alvo) return null;
  for(const p of DB.products){
    for(const v of p.variations){
      if(v.barcode && String(v.barcode).trim().toLowerCase() === alvo) return {product:p, variation:v};
    }
  }
  return null;
}
/* O código que está no FIM do texto. Se sobrou lixo no campo e o leitor
   digitou por cima, o que ele acabou de ler é o final. Fica o código mais
   comprido que casar, e só códigos com 4 caracteres ou mais. */
function acharCodigoNoFim(texto){
  const t = String(texto||'').trim().toLowerCase();
  let melhor = null;
  for(const p of DB.products){
    for(const v of p.variations){
      const c = String(v.barcode||'').trim().toLowerCase();
      if(c.length >= 4 && t.length > c.length && t.endsWith(c) && (!melhor || c.length > melhor.c.length)) melhor = { c, product:p, variation:v };
    }
  }
  return melhor ? { product: melhor.product, variation: melhor.variation } : null;
}
/* O bipe que se ouve. Um tom curto e agudo quando a peça entra, um grave
   quando o código não existe: no balcão ninguém olha para a tela a cada
   peça, e sem som um bipe perdido só era notado na hora de cobrar. */
let contextoDeSom = null;
function somDoBipe(deuCerto){
  try{
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) return;
    contextoDeSom = contextoDeSom || new Ctx();
    if(contextoDeSom.state === 'suspended'){ const r = contextoDeSom.resume(); if(r && r.catch) r.catch(()=>{}); }
    const tocar = (freq, inicio, dur)=>{
      const osc = contextoDeSom.createOscillator(), ganho = contextoDeSom.createGain();
      osc.type = 'square'; osc.frequency.value = freq;
      ganho.gain.setValueAtTime(0.0001, contextoDeSom.currentTime + inicio);
      ganho.gain.exponentialRampToValueAtTime(0.12, contextoDeSom.currentTime + inicio + 0.01);
      ganho.gain.exponentialRampToValueAtTime(0.0001, contextoDeSom.currentTime + inicio + dur);
      osc.connect(ganho); ganho.connect(contextoDeSom.destination);
      osc.start(contextoDeSom.currentTime + inicio); osc.stop(contextoDeSom.currentTime + inicio + dur + 0.02);
    };
    if(deuCerto === 'atencao'){ tocar(1320, 0, 0.07); tocar(990, 0.10, 0.12); }   // entrou, mas olhe a tela
    else if(deuCerto) tocar(1320, 0, 0.09);
    else { tocar(220, 0, 0.16); tocar(180, 0.18, 0.22); }
  }catch(e){ /* sem som não é motivo para parar a venda */ }
}
function handleBipe(code){
  const msg = document.getElementById('bipeMsg');
  if(!code) return;
  const found = findVariationByBarcode(code) || acharCodigoNoFim(code);
  if(!found){ somDoBipe(false); if(msg) msg.innerHTML = `<span class="text-danger">Código "${escapeHtml(code)}" não encontrado</span>`; return; }
  const { product, variation } = found;
  if(estoqueMode==='entrada') variation.stock = Number(variation.stock||0)+1;
  else {
    if(Number(variation.stock||0) <= 0){
      somDoBipe(false);
      if(msg) msg.innerHTML = `<span class="text-danger">${escapeHtml(product.name)} (${escapeHtml(variation.size)}/${escapeHtml(variation.color)}) já está zerada</span>`;
      return;
    }
    variation.stock = Number(variation.stock||0)-1;
  }
  carimbar(product);
  saveDB();
  somDoBipe(true);
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
      <td><input type="number" min="0" value="${v.stock}" style="width:80px" data-ajuste data-pid="${escapeHtml(p.id)}" data-size="${escapeHtml(v.size)}" data-color="${escapeHtml(v.color)}"></td>
    </tr>`).join('')}
  </tbody></table></div>`;
  /* Tamanho ou cor com aspas quebrava o onclick embutido no HTML; o campo
     agora carrega a peça em atributos e o ajuste lê de lá. */
  wrap.querySelectorAll('[data-ajuste]').forEach(inp=>inp.addEventListener('change', e=>{
    adjustStock(e.target.dataset.pid, e.target.dataset.size, e.target.dataset.color, e.target.value);
  }));
}
function adjustStock(pid,size,color,val){
  const p = DB.products.find(x=>x.id===pid);
  const v = p && p.variations.find(x=>x.size===size && x.color===color);
  if(!v){ toast('Peça não encontrada. Atualize a tela.','error'); renderStockTable(); return; }
  /* Campo apagado sem querer não é "zerar o estoque". */
  const texto = String(val == null ? '' : val).trim();
  const novo = Math.floor(Number(texto.replace(',', '.')));
  if(texto === '' || !(novo >= 0)){ toast('Digite a quantidade (0 ou mais). O estoque não foi alterado.','warn'); renderStockTable(); return; }
  if(novo === (Number(v.stock)||0)){ renderStockTable(); return; }
  v.stock = novo;
  carimbar(p);
  saveDB(); renderStockTable(); toast('Estoque ajustado');
}

/* =========================================================
   ETIQUETAS — geração e impressão de códigos de barras
   ========================================================= */
/* IMPRESSORA: BROTHER QL-800.
   Ela imprime a 300 dpi (0,0847 mm por ponto), aceita fita de até 62 mm e
   usa rolos Brother DK. Duas consequências que mandam em tudo aqui:

   1) Cada etiqueta é uma página do tamanho exato do rolo. O sistema usava
      `size: 50mm auto`, que não existe no CSS — `auto` não pode vir junto
      com uma medida —, o navegador jogava a regra fora e mandava uma folha
      A4 para uma impressora carregada com fita de 3 cm. Nunca mais se
      imprime pelo navegador: o caminho é o PDF, que carrega o tamanho da
      página dentro dele e é obedecido no computador e no celular.

   2) A QL-800 é ligada por CABO USB. Não tem Wi-Fi, não tem Bluetooth e
      não tem AirPrint. O iPhone não enxerga esta impressora de jeito
      nenhum — quem imprime é o computador onde ela está ligada. O PDF
      pode ser gerado no celular, mas tem de ser aberto no computador.

   As medidas abaixo são as dos rolos DK de verdade, no catálogo Brother.
   Nas fitas contínuas o comprimento é escolhido pela loja. */
const MIDIAS_QL800 = {
  dk2210: { name:'DK-2210 · fita 29 mm (mais usado)', w:29, h:40, continua:true },
  dk2205: { name:'DK-2205 · fita 62 mm',                     w:62, h:30, continua:true },
  dk2211: { name:'DK-2211 · filme 29 mm',            w:29, h:40, continua:true },
  dk2212: { name:'DK-2212 · filme 62 mm',            w:62, h:30, continua:true },
  dk2113: { name:'DK-2113 · transparente 62 mm',        w:62, h:30, continua:true },
  dk2251: { name:'DK-2251 · 62 mm preto e vermelho',    w:62, h:30, continua:true },
  dk1201: { name:'DK-1201 · 29 × 90 mm',           w:29, h:90 },
  dk1209: { name:'DK-1209 · 29 × 62 mm',           w:29, h:62 },
  dk1208: { name:'DK-1208 · 38 × 90 mm',           w:38, h:90 },
  dk1202: { name:'DK-1202 · 62 × 100 mm',          w:62, h:100 },
  dk1203: { name:'DK-1203 · 17 × 87 mm',           w:17, h:87 },
  dk1204: { name:'DK-1204 · 17 × 54 mm',           w:17, h:54 },
  dk1221: { name:'DK-1221 · 23 × 23 mm',           w:23, h:23 },
  outro:  { name:'Outro rolo (eu meço)', w:29, h:40, continua:true, medido:true },
};
let etiquetaMidia = 'dk2210';
let etiquetaComprimento = 40;

/* O tamanho que vale na hora de imprimir. Na fita contínua o comprimento é
   o que a loja escolheu; na etiqueta recortada é o do próprio rolo, que
   não se discute. */
function midiaAtual(){
  const m = MIDIAS_QL800[etiquetaMidia] || MIDIAS_QL800.dk2210;
  /* Medida mínima garantida aqui, e não só no campo da tela: digitar "2"
     a caminho de "29" já chegava como fita de 2 mm, e o desenho saía da
     etiqueta. Abaixo de 20 mm de comprimento não cabe um código que o
     leitor leia com folga. */
  if(m.medido) return { ...m, w: Math.min(62, Math.max(12, Number(etiquetaCustom.w)||29)),
                              h: Math.min(200, Math.max(20, Number(etiquetaCustom.h)||40)) };
  if(m.continua) return { ...m, h: Math.min(200, Math.max(20, Number(etiquetaComprimento)||m.h)) };
  return m;
}
/* Nome antigo, mantido porque o resto do arquivo chama por ele. */
function layoutAtual(){ return midiaAtual(); }
let etiquetaCustom = { w:29, h:40 };
let etiquetaQty = {}; // key -> quantidade selecionada

function varKey(pid,size,color){ return `${pid}|${size}|${color}`; }

/* A escolha do rolo ficava só na memória: bastava recarregar a página para
   voltar ao padrão, e o lojista reimprimia errado sem entender. Agora fica
   guardada junto com o resto dos dados da loja. */
/* O que aparece na etiqueta além do código de barras. */
let etiquetaMostra = { loja:true, variante:true, preco:true };
let etiquetaPosicao = 'auto';     // 'auto' | 'pe' | 'deitada'
function opcoesDaEtiqueta(){
  return { semLoja: !etiquetaMostra.loja, semVariante: !etiquetaMostra.variante, semPreco: !etiquetaMostra.preco, posicao: etiquetaPosicao };
}
function guardarEscolhaDaEtiqueta(){
  DB.config.etiqueta = { midia: etiquetaMidia, comp: etiquetaComprimento,
                         w: etiquetaCustom.w, h: etiquetaCustom.h, mostra: { ...etiquetaMostra }, posicao: etiquetaPosicao };
  carimbar(DB.config);
  saveDB();
}
/* Chamada em TODO lugar onde o banco é trocado por inteiro — e não só ao
   abrir o sistema, como era antes. O erro era silencioso e caro: o aparelho
   novo (ou o que acabou de receber os dados da nuvem) voltava para o rolo
   padrão enquanto a loja tinha escolhido outro, e a etiqueta saía no
   tamanho errado sem ninguém ter mexido em nada. */
function restaurarEscolhaDaEtiqueta(){
  const e = DB.config && DB.config.etiqueta;
  if(!e) return;
  if(MIDIAS_QL800[e.midia]) etiquetaMidia = e.midia;
  if(Number(e.comp) > 0) etiquetaComprimento = Number(e.comp);
  if(Number(e.w) > 0) etiquetaCustom.w = Number(e.w);
  if(Number(e.h) > 0) etiquetaCustom.h = Number(e.h);
  if(e.mostra && typeof e.mostra === 'object'){
    etiquetaMostra = { loja: e.mostra.loja !== false, variante: e.mostra.variante !== false, preco: e.mostra.preco !== false };
  }
  if(['auto','pe','deitada'].includes(e.posicao)) etiquetaPosicao = e.posicao;
}

/* Barra fina demais o leitor não enxerga. O limite prático dos leitores de
   balcão é 0,19 mm por módulo; abaixo disso a etiqueta sai bonita e não
   passa no caixa, que é pior do que não sair. Quem calcula é o gerador do
   PDF, com a régua da própria QL-800 — assim o aviso na tela e o que sai
   na fita nunca discordam. */
const BARRA_MINIMA_MM = 0.19;
function atualizaAvisoDoCodigo(){
  const box = document.getElementById('avisoCodigo');
  if(!box) return;
  const midia = midiaAtual();
  /* O aviso tem de olhar para o PIOR código da loja, não para um bonito:
     basta uma peça com código comprido para o caixa travar nela. */
  let pior = '000001', piorMM = Infinity;
  DB.products.forEach(p=>p.variations.forEach(v=>{
    if(!v.barcode) return;
    const mm = barraDaEtiquetaMM(midia, v.barcode, opcoesDaEtiqueta());
    if(mm < piorMM){ piorMM = mm; pior = v.barcode; }
  }));
  const mm = piorMM === Infinity ? barraDaEtiquetaMM(midia, '000001', opcoesDaEtiqueta()) : piorMM;
  if(mm >= BARRA_MINIMA_MM){ box.innerHTML = ''; box.className = ''; return; }
  box.className = 'aviso-codigo';
  const soNumeros = /^[0-9]+$/.test(pior);
  box.innerHTML = `<strong>${escapeHtml(pior)}</strong> não cabe em ${midia.w} mm:
    ${mm.toFixed(2)} mm por barra, fino demais para o leitor do balcão.
    ${soNumeros ? 'Use um rolo mais largo.'
                : 'É um código antigo, com letras, que ocupa o dobro. Use um rolo mais largo — as peças novas já saem com código curto.'}`;
}

function renderEtiquetas(el){
  const missing = countMissingBarcodes();
  const m = midiaAtual();
  const daMidia = MIDIAS_QL800[etiquetaMidia] || MIDIAS_QL800.dk2210;
  el.innerHTML = `
    <div class="panel">
      <h3>Imprimir etiquetas — Brother QL-800
        <span class="text-muted" style="font-size:11px;font-weight:400">· versão ${APP_VERSION}</span></h3>
      <p class="text-muted" style="margin-bottom:14px">Escolha o rolo que está na impressora, marque as peças e gere o arquivo. O código de barras é criado sozinho para quem ainda não tem.</p>
      <div class="toolbar">
        <label style="font-size:12px;color:var(--muted);font-weight:600">Rolo na impressora:</label>
        <select id="midiaSel">
          ${Object.entries(MIDIAS_QL800).map(([k,v])=>`<option value="${k}" ${etiquetaMidia===k?'selected':''}>${v.name}</option>`).join('')}
        </select>
        <span id="campoComprimento" style="display:${daMidia.continua && !daMidia.medido ? 'inline-flex' : 'none'};align-items:center;gap:6px"
              title="Na fita contínua quem decide o comprimento de cada etiqueta é você.">
          <span class="text-muted" style="font-size:12px">comprimento</span>
          <input type="number" id="compEtq" step="1" min="12" max="200" value="${m.h}" style="width:66px">
          <span class="text-muted" style="font-size:12px">mm</span>
        </span>
        <span id="campoMedido" style="display:${daMidia.medido ? 'inline-flex' : 'none'};align-items:center;gap:6px"
              title="Meça o rolo com uma régua: a largura é a da fita, o comprimento é o de cada etiqueta.">
          <input type="number" id="custW" step="1" min="10" max="62" value="${etiquetaCustom.w}" style="width:66px">
          <span class="text-muted" style="font-size:12px">×</span>
          <input type="number" id="custH" step="1" min="10" max="200" value="${etiquetaCustom.h}" style="width:66px">
          <span class="text-muted" style="font-size:12px">mm</span>
        </span>
        <div class="spacer"></div>
        ${missing>0 ? `<button class="btn" id="genMissingBtn">🔢 Gerar ${missing} código(s) faltando</button>` : ''}
        <button class="btn" id="selAllBtn">✔️ Marcar todas as peças</button>
        <button class="btn" id="testLabelBtn" title="Gera uma etiqueta só, para conferir antes de gastar o rolo">🧪 Testar 1 etiqueta</button>
        <button class="btn btn-accent" id="pdfLabelsBtn" title="Gera o arquivo já no tamanho do rolo da QL-800">🏷️ Gerar etiquetas para a QL-800</button>
      </div>
      <div class="etq-opcoes">
        <span>Mostrar na etiqueta:</span>
        <label><input type="checkbox" data-mostra="loja" ${etiquetaMostra.loja?'checked':''}> Nome da loja</label>
        <label><input type="checkbox" data-mostra="variante" ${etiquetaMostra.variante?'checked':''}> Tamanho e cor</label>
        <label><input type="checkbox" data-mostra="preco" ${etiquetaMostra.preco?'checked':''}> Preço</label>
        <label>Posição:
          <select id="etqPosicao">
            <option value="auto" ${etiquetaPosicao==='auto'?'selected':''}>Automática</option>
            <option value="pe" ${etiquetaPosicao==='pe'?'selected':''}>Em pé</option>
            <option value="deitada" ${etiquetaPosicao==='deitada'?'selected':''}>Deitada</option>
          </select></label>
      </div>
      <div id="linkDoPdf"></div>
      <div id="previewEtiqueta" class="preview-box"></div>
      <div id="avisoCodigo"></div>
      <div id="diagnosticoSelecao"></div>
    </div>

    <div class="panel">
      <h3>1 · Marque as peças que vão ganhar etiqueta</h3>
      <div id="etiquetasTableWrap"></div>
    </div>

    <div class="panel">
      <h3 style="margin:0">
        <button class="btn btn-sm" id="toggleAjuda" type="button">▸ Como imprimir na QL-800 (leia se sair errado)</button>
      </h3>
      <div id="ajudaImpressao" style="display:none;margin-top:12px">
      <div class="aviso-impressao">
        <strong>A QL-800 é ligada por cabo USB — ela não tem Wi-Fi nem Bluetooth.</strong>
        Quem imprime é o computador em que ela está ligada. Dá para gerar o arquivo pelo
        celular, mas para sair etiqueta ele precisa ser aberto nesse computador.
        <ol style="margin:8px 0 0;padding-left:20px">
          <li>Confira em cima o <strong>rolo que está na impressora</strong>. O código do rolo
              (DK-2210, DK-1201...) está escrito na caixa e no próprio carretel.</li>
          <li>Marque as peças aqui embaixo e toque em
              <strong>Gerar etiquetas para a QL-800</strong>. O arquivo baixa pronto, já no
              tamanho do rolo.</li>
          <li>Abra o arquivo no computador da impressora e mande imprimir escolhendo a
              <strong>Brother QL-800</strong>.</li>
          <li>Na janela de impressão deixe o <strong>redimensionamento em 100%</strong>
              (ou "Tamanho real"). Se estiver em "Ajustar à página", o código encolhe e o
              leitor do caixa não lê.</li>
        </ol>
        <p style="margin:8px 0 0">Antes do lote inteiro, use <strong>Testar 1 etiqueta</strong> e
        passe o leitor nela. Se bipar, pode mandar o resto.</p>
      </div>
      </div>
    </div>`;
  el.querySelectorAll('[data-mostra]').forEach(c=>c.addEventListener('change', e=>{
    etiquetaMostra[e.target.dataset.mostra] = e.target.checked;
    guardarEscolhaDaEtiqueta();
    renderPreviewEtiqueta();
  }));
  el.querySelector('#etqPosicao').addEventListener('change', e=>{
    etiquetaPosicao = e.target.value;
    guardarEscolhaDaEtiqueta(); atualizaAvisoDoCodigo(); renderPreviewEtiqueta();
  });
  el.querySelector('#toggleAjuda').addEventListener('click', e=>{
    const box = el.querySelector('#ajudaImpressao');
    const aberto = box.style.display !== 'none';
    box.style.display = aberto ? 'none' : '';
    e.target.textContent = (aberto ? '▸' : '▾') + ' Como imprimir na QL-800 (leia se sair errado)';
  });
  el.querySelector('#midiaSel').addEventListener('change', e=>{
    etiquetaMidia = e.target.value;
    const nova = MIDIAS_QL800[etiquetaMidia];
    /* O comprimento que a loja digitou NÃO é apagado ao trocar de rolo.
       Apagar parecia arrumação e era perda: quem tinha ajustado 45 mm,
       espiava outro rolo e voltava, reimprimia em 40 sem perceber. */
    el.querySelector('#campoComprimento').style.display = (nova.continua && !nova.medido) ? 'inline-flex' : 'none';
    el.querySelector('#campoMedido').style.display = nova.medido ? 'inline-flex' : 'none';
    el.querySelector('#compEtq').value = midiaAtual().h;
    guardarEscolhaDaEtiqueta();
    atualizaAvisoDoCodigo();
    renderPreviewEtiqueta();
  });
  const comprimentoMudou = ()=>{
    etiquetaComprimento = Number(el.querySelector('#compEtq').value) || 40;
    guardarEscolhaDaEtiqueta();
    atualizaAvisoDoCodigo();
    renderPreviewEtiqueta();
  };
  el.querySelector('#compEtq').addEventListener('input', comprimentoMudou);
  /* Mexeu na medida à mão? Então o rolo é "Outro". Antes o lojista digitava
     nesses campos com um tamanho pronto selecionado e a medida era ignorada
     em silêncio — parecia que o sistema não obedecia. */
  const medidaMudou = ()=>{
    etiquetaCustom.w = Math.min(62, Number(el.querySelector('#custW').value) || 29);
    etiquetaCustom.h = Number(el.querySelector('#custH').value) || 40;
    if(etiquetaMidia !== 'outro'){
      etiquetaMidia = 'outro';
      el.querySelector('#midiaSel').value = 'outro';
      el.querySelector('#campoComprimento').style.display = 'none';
      el.querySelector('#campoMedido').style.display = 'inline-flex';
    }
    guardarEscolhaDaEtiqueta();
    atualizaAvisoDoCodigo();
    renderPreviewEtiqueta();
  };
  el.querySelector('#custW').addEventListener('input', medidaMudou);
  el.querySelector('#custH').addEventListener('input', medidaMudou);
  /* Testar uma só evita queimar meio rolo até acertar o tamanho. */
  el.querySelector('#testLabelBtn').addEventListener('click', imprimirEtiquetaTeste);
  atualizaAvisoDoCodigo();
  renderPreviewEtiqueta();
  el.querySelector('#genMissingBtn')?.addEventListener('click', ()=>{
    generateMissingBarcodes(); saveDB(); renderEtiquetas(el); toast('Códigos gerados');
  });
  el.querySelector('#selAllBtn').addEventListener('click', ()=>{
    DB.products.forEach(p=>p.variations.forEach(v=>{
      if(v.stock>0) etiquetaQty[varKey(p.id,v.size,v.color)] = v.stock;
    }));
    renderEtiquetasTable();
  });
  el.querySelector('#pdfLabelsBtn').addEventListener('click', ()=>gerarPdfEtiquetas());
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
  DB.products.forEach((p, pi)=>p.variations.forEach((v, vi)=>rows.push({p,v,pi,vi})));
  if(!rows.length){ wrap.innerHTML = emptyProductsMessage(); return; }
  wrap.innerHTML = `<div class="table-wrap"><table><thead><tr>
    <th></th><th>Produto</th><th>Tam/Cor</th><th class="col-codigo">Código</th>
    <th class="col-estoque">Estoque</th><th>Etiquetas</th>
  </tr></thead><tbody>
    ${rows.map(({p,v,pi,vi})=>{
      const key = varKey(p.id,v.size,v.color);
      const checked = etiquetaQty[key] > 0;
      return `<tr data-pi="${pi}" data-vi="${vi}" data-pid="${escapeHtml(p.id)}"
        data-size="${escapeHtml(v.size)}" data-color="${escapeHtml(v.color)}"
        data-nome="${escapeHtml(p.name)}" data-barcode="${escapeHtml(v.barcode||'')}"
        data-preco="${Number(p.price)||0}">
        <td><input type="checkbox" data-check="${escapeHtml(key)}" ${checked?'checked':''}></td>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(v.size)}/${escapeHtml(v.color)}</td>
        <td class="col-codigo">${escapeHtml(v.barcode||'(será gerado)')}</td>
        <td class="col-estoque">${v.stock}</td>
        <td><input type="number" min="1" max="${MAX_ETIQUETAS_POR_PECA}" step="1" inputmode="numeric" style="width:70px" data-qty="${escapeHtml(key)}" value="${etiquetaQty[key]||v.stock||1}"></td>
      </tr>`;
    }).join('')}
  </tbody></table></div>`;
  wrap.querySelectorAll('[data-check]').forEach(chk=>chk.addEventListener('change', e=>{
    const key = e.target.dataset.check;
    if(e.target.checked){
      /* O campo é achado pela linha, não pelo texto da chave: uma cor com
         aspas (Azul "bebê") quebrava a busca e a caixa não marcava. */
      const qtyInput = e.target.closest('tr').querySelector('[data-qty]');
      etiquetaQty[key] = quantasEtiquetas(qtyInput && qtyInput.value);
    } else delete etiquetaQty[key];
    renderPreviewEtiqueta();
  }));
  wrap.querySelectorAll('[data-qty]').forEach(inp=>inp.addEventListener('input', e=>{
    const key = e.target.dataset.qty;
    if(etiquetaQty[key] !== undefined) etiquetaQty[key] = quantasEtiquetas(e.target.value);
  }));
  wrap.querySelectorAll('[data-qty]').forEach(inp=>inp.addEventListener('change', e=>{
    e.target.value = quantasEtiquetas(e.target.value);
  }));
}
/* 100000 digitado sem querer travava o navegador montando o PDF. */
const MAX_ETIQUETAS_POR_PECA = 500;
function quantasEtiquetas(v){ return Math.min(MAX_ETIQUETAS_POR_PECA, Math.max(1, Math.floor(Number(v)||1))); }
/* Imprime UMA etiqueta, com a primeira peça que tiver código. Serve para
   conferir o tamanho sem gastar o rolo inteiro descobrindo que está errado. */
function imprimirEtiquetaTeste(){
  let alvo = null;
  DB.products.some(p=>p.variations.some(v=>{ if(v.barcode){ alvo={p,v}; return true; } }));
  if(!alvo){
    const p = DB.products[0];
    if(!p){ toast('Cadastre uma peça primeiro','error'); return; }
    generateMissingBarcodes(); saveDB();
    alvo = { p, v: p.variations[0] };
  }
  imprimirOuGerarPdf([{ p: alvo.p, v: alvo.v }]);
}

/* UM CAMINHO SÓ, e de propósito. Havia dois — "imprimir direto pelo
   navegador" e "gerar PDF" — e o direto nunca funcionou: o navegador
   manda o papel da janela (A4), não o tamanho da etiqueta, e saía folha
   em branco com um borrão no canto. Dois caminhos também significavam
   dois lugares para errar e o lojista escolhendo no escuro. Agora existe
   o PDF, que carrega o tamanho da página dentro dele e é o único formato
   que o driver da QL-800 respeita. */
function imprimirOuGerarPdf(items){
  gerarPdfEtiquetas(items);
}

/* =========================================================
   PDF DAS ETIQUETAS
   O Safari do iPhone ignora o tamanho de página que a página web pede:
   manda sempre o papel escolhido na janela (A4), e a etiqueta sai
   minúscula num canto da folha. Não há CSS que resolva isso.
   Um PDF já nasce com o tamanho da página dentro dele, e esse tamanho o
   iPhone respeita. Por isso, no celular, este é o caminho certo.
   ========================================================= */
/* O que o lojista vê marcado é o que vale. Antes a seleção era procurada
   por uma chave de texto com o id do produto dentro; quando o id mudava, a
   caixa continuava marcada na tela e o sistema jurava que nada estava
   selecionado. Agora lemos as próprias caixas e chegamos ao produto pela
   posição na lista, que não depende de id nenhum. */
/* Achar a peça de uma linha marcada. São três tentativas em ordem, e não
   por capricho: a loja já ficou sem imprimir porque a peça foi procurada
   de um jeito só e o dado tinha mudado por baixo. Pela posição, pelo id, e
   por fim pelo nome com tamanho e cor. Se qualquer uma acertar, imprime. */
function acharPecaDaLinha(linha){
  if(!linha) return null;
  const pid = linha.dataset.pid;
  const size = linha.dataset.size || '';
  const color = linha.dataset.color || '';
  const nome = linha.dataset.nome || '';

  const casaVariacao = p => p && p.variations &&
    (p.variations[Number(linha.dataset.vi)] &&
     p.variations[Number(linha.dataset.vi)].size === size &&
     p.variations[Number(linha.dataset.vi)].color === color
       ? p.variations[Number(linha.dataset.vi)]
       : p.variations.find(v=>v.size === size && v.color === color));

  // 1) pela posição, confirmando que ainda é a mesma peça
  const porIndice = DB.products[Number(linha.dataset.pi)];
  if(porIndice && porIndice.id === pid){
    const v = casaVariacao(porIndice);
    if(v) return { p: porIndice, v };
  }
  // 2) pelo id, caso a lista tenha sido remexida
  const porId = DB.products.find(x=>x.id === pid);
  if(porId){
    const v = casaVariacao(porId);
    if(v) return { p: porId, v };
  }
  // 3) pelo nome, caso o id tenha mudado
  const porNome = DB.products.find(x=>x.name === nome);
  if(porNome){
    const v = casaVariacao(porNome);
    if(v) return { p: porNome, v };
  }
  /* 4) A peça sumiu do banco entre desenhar a lista e mandar imprimir — a
     nuvem responde e troca tudo por baixo. Antes disso virar "marque as
     peças" com a caixa marcada na frente do lojista, a etiqueta é montada
     com o que a própria linha carrega. O que está marcado na tela sai. */
  const codigo = linha.dataset.barcode;
  if(codigo){
    return { p: { name: nome, price: Number(linha.dataset.preco) || 0 },
             v: { size, color, barcode: codigo } };
  }
  return null;
}

function itensSelecionados(){
  const items = [];
  const wrap = document.getElementById('etiquetasTableWrap');
  const caixas = wrap ? wrap.querySelectorAll('input[type=checkbox][data-check]') : [];

  if(caixas.length){
    caixas.forEach(chk=>{
      if(!chk.checked) return;
      const linha = chk.closest('tr');
      const achado = acharPecaDaLinha(linha);
      if(!achado) return;
      const campo = linha.querySelector('[data-qty]');
      const qty = Math.max(1, Number(campo && campo.value) || 1);
      for(let i=0;i<qty;i++) items.push(achado);
    });
    return items;
  }

  /* Sem a tela aberta (o teste de uma etiqueta chama daqui), usa o registro. */
  Object.entries(etiquetaQty).filter(([,qty])=>qty>0).forEach(([key, qty])=>{
    const [pid,size,color] = key.split('|');
    const p = DB.products.find(x=>x.id===pid);
    const v = p && p.variations.find(x=>x.size===size && x.color===color);
    if(!p || !v) return;
    for(let i=0;i<qty;i++) items.push({ p, v });
  });
  return items;
}

/* "Selecione ao menos uma variação" não ajuda quem não achou a lista: no
   celular ela ficava embaixo de um paredão de texto e a loja nunca chegava
   nela. Agora o sistema leva o lojista até lá e pisca a tabela.

   E, quando ele JURA que marcou — e já jurou, com a caixa marcada na tela
   —, o aviso para de repetir a mesma frase e passa a dizer o que o sistema
   está enxergando: quantas caixas existem, quantas estão marcadas e o que
   falhou em cada linha marcada. Sem isso a conversa vira "não funciona" de
   um lado e "aqui funciona" do outro, que não conserta nada. */
function pedirSelecao(){
  const wrap = document.getElementById('etiquetasTableWrap');
  const caixas = wrap ? wrap.querySelectorAll('input[type=checkbox][data-check]') : [];
  const marcadas = [...caixas].filter(c=>c.checked);
  const box = document.getElementById('diagnosticoSelecao');

  if(marcadas.length){
    /* Marcou e mesmo assim não veio item: o problema não é o lojista. */
    const motivos = marcadas.map(chk=>{
      const linha = chk.closest('tr');
      if(!linha) return 'uma linha marcada sumiu da tabela';
      const nome = linha.dataset.nome || '(sem nome)';
      if(!acharPecaDaLinha(linha)) return `${nome} ${linha.dataset.size||''}/${linha.dataset.color||''} — sem código de barras e a peça não está mais no cadastro`;
      return null;
    }).filter(Boolean);
    toast('Marcado, mas não consegui montar a etiqueta — veja o aviso na tela','error');
    if(box){
      box.className = 'aviso-codigo';
      box.innerHTML = `<strong>O que o sistema está vendo:</strong>
        ${caixas.length} peça(s) na lista, ${marcadas.length} marcada(s).
        ${motivos.length
          ? 'Não deu para usar: <br>· ' + motivos.map(escapeHtml).join('<br>· ') +
            '<br>Toque em <strong>Gerar código(s) faltando</strong> e tente de novo.'
          : 'As peças foram encontradas — se isto apareceu, recarregue a página e tente outra vez.'}`;
    }
    return;
  }

  if(box){ box.innerHTML = ''; box.className = ''; }
  toast('Marque abaixo as peças que vão ganhar etiqueta','warn');
  if(!wrap) return;
  wrap.scrollIntoView({ behavior:'smooth', block:'center' });
  wrap.classList.remove('piscando');
  void wrap.offsetWidth;              // reinicia a animação
  wrap.classList.add('piscando');
}

/* Prévia de uma etiqueta, do tamanho real, na própria tela. Sem ela o
   lojista só descobre que deu errado depois de gastar o rolo — e, quando
   dá errado, não dá para saber se o problema é o sistema ou a impressora.

   A prévia é desenhada pelo MESMO gerador que monta o PDF. Antes vinha de
   uma biblioteca baixada da internet: numa loja com rede ruim a prévia
   sumia, e pior — ela desenhava o código de um jeito e o PDF de outro, de
   modo que conferir na tela não provava nada. Agora, se aparece certo
   aqui, é exatamente isso que vai para a fita. */
function desenhoSvgDoCodigo(codigo, larguraMM, alturaMM){
  const c = code128Barras(codigo);
  if(!c) return '';
  const modulo = larguraMM / (c.modulos + 20);   // 10 módulos de silêncio de cada lado
  const largura = c.modulos * modulo;
  const inicio = (larguraMM - largura) / 2;
  const barras = c.barras.map(b=>
    `<rect x="${(inicio + b.x*modulo).toFixed(3)}" y="0" width="${(b.w*modulo).toFixed(3)}" height="${alturaMM}" fill="#000"/>`).join('');
  return `<svg viewBox="0 0 ${larguraMM} ${alturaMM}" width="${larguraMM}mm" height="${alturaMM}mm"
               preserveAspectRatio="none" shape-rendering="crispEdges">${barras}</svg>`;
}
function renderPreviewEtiqueta(){
  const box = document.getElementById('previewEtiqueta');
  if(!box) return;
  /* A prévia mostra a primeira peça MARCADA na lista; sem nenhuma marcada,
     procura uma com nome e preço. Mostrar "Produto sem nome · R$ 0,00"
     fazia parecer que a etiqueta estava quebrada, quando o que faltava era
     o cadastro da peça. */
  let alvo = null;
  const marcada = Object.keys(etiquetaQty).find(k=>etiquetaQty[k] > 0);
  if(marcada){
    const [pid, size, color] = marcada.split('|');
    const p = DB.products.find(x=>x.id === pid);
    const v = p && p.variations.find(x=>x.size === size && x.color === color);
    if(p && v && v.barcode) alvo = { p, v };
  }
  const serve = (p,v) => v.barcode && p.name && !/sem nome/i.test(p.name) && Number(p.price) > 0;
  if(!alvo) DB.products.some(p=>p.variations.some(v=>{ if(serve(p,v)){ alvo={p,v}; return true; } }));
  if(!alvo) DB.products.some(p=>p.variations.some(v=>{ if(v.barcode){ alvo={p,v}; return true; } }));
  if(!alvo){
    box.innerHTML = '<p class="text-muted" style="font-size:12.5px">Cadastre uma peça para ver a prévia da etiqueta.</p>';
    return;
  }
  const midia = midiaAtual();
  /* A prévia é o MESMO desenho que vai para o PDF, convertido para a
     tela: se aparece certo aqui, é exatamente isso que sai na fita. */
  const desenho = desenharEtiqueta(alvo, midia, DB.storeName, money, opcoesDaEtiqueta());
  const amplia = Math.max(1.6, Math.min(3, 110 / Math.max(midia.w, midia.h)));
  box.innerHTML = `
    <div class="etq-previas">
      <div>
        <div class="preview-titulo">Tamanho real — ${midia.w} × ${midia.h} mm</div>
        <div class="etq-folha">${desenhoParaSvg(desenho, midia.w, midia.h, 1)}</div>
      </div>
      <div>
        <div class="preview-titulo">Ampliada${desenho.girar ? ' e virada para ler' : ''}</div>
        <div class="etq-folha">${desenho.girar
          ? desenhoParaSvg({ ...desenho, girar:false, L: desenho.largura, A: desenho.altura }, midia.h, midia.w, amplia)
          : desenhoParaSvg(desenho, midia.w, midia.h, amplia)}</div>
      </div>
    </div>
    ${desenho.girar ? '<p class="text-muted" style="font-size:12px;margin-top:8px">Nesta etiqueta comprida o desenho sai deitado: texto de um lado, código de barras do outro. Para mudar, use "Posição".</p>' : ''}`;
}

function gerarPdfEtiquetas(itensForcados){
  const items = itensForcados || itensSelecionados();
  if(!items.length){ pedirSelecao(); return; }
  generateMissingBarcodes();
  saveDB();

  const layout = layoutAtual();
  let blob;
  try{
    blob = criarPdfEtiquetas(items, layout, DB.storeName, money, opcoesDaEtiqueta());
  }catch(err){
    console.error('Erro ao montar o PDF:', err);
    toast('Não foi possível montar o PDF: ' + err.message, 'error');
    return;
  }
  entregarPdf(blob, items.length, layout);
}

let urlDoPdfAnterior = null;
function mostrarLinkDoPdf(blob, nome, recado, rotulo, ajuda){
  const box = document.getElementById('linkDoPdf');
  if(!box) return;
  if(urlDoPdfAnterior) URL.revokeObjectURL(urlDoPdfAnterior);
  urlDoPdfAnterior = URL.createObjectURL(blob);
  box.className = 'pdf-pronto';
  box.innerHTML = `<strong>${escapeHtml(recado)}</strong>
    <a href="${urlDoPdfAnterior}" download="${escapeHtml(nome)}">${escapeHtml(rotulo)}</a>
    <span>${escapeHtml(ajuda)}</span>`;
  box.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

/* Entrega um PDF ao lojista pelo caminho que funciona no aparelho dele:
   no celular a folha de compartilhar (de onde ele escolhe Imprimir ou
   manda pelo WhatsApp), no computador o arquivo baixado. Nos dois casos
   fica um link à vista na tela — se a folha não abrir, ou ele fechá-la
   sem querer, o arquivo continua ao alcance de um toque em vez de sumir. */
function entregarArquivo(blob, nome, recado, rotulo, ajuda, titulo){
  mostrarLinkDoPdf(blob, nome, recado, rotulo, ajuda);
  try{
    const arquivo = new File([blob], nome, { type:'application/pdf' });
    if(navigator.canShare && navigator.canShare({ files:[arquivo] })){
      navigator.share({ files:[arquivo], title: titulo })
        .then(()=>toast(recado))
        .catch(()=>{ /* fechou a folha de compartilhamento: nada a fazer */ });
      return;
    }
  }catch(err){
    console.warn('Compartilhamento não disponível:', err);
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = nome;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(()=>{ document.body.removeChild(link); URL.revokeObjectURL(url); }, 4000);
  toast(recado);
}

function entregarPdf(blob, quantas, layout){
  entregarArquivo(blob,
    `etiquetas-QL800-${layout.w}x${layout.h}mm.pdf`,
    `${quantas} etiqueta(s) de ${layout.w} × ${layout.h} mm`,
    '🏷️ Abrir / salvar as etiquetas',
    'Abra este arquivo no computador em que a Brother QL-800 está ligada pelo cabo USB e mande imprimir por ele, com o redimensionamento em 100%.',
    'Etiquetas');
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
  renderCustomerTable();
}
function renderCustomerTable(filter){
  const wrap = document.getElementById('custTableWrap');
  if(!wrap) return;
  /* Sem filtro informado vale o que está escrito na busca: salvar ou
     excluir uma cliente limpava a lista filtrada sem limpar o campo. */
  if(filter === undefined) filter = (document.getElementById('custSearch') || {}).value;
  const f=(filter||'').toLowerCase();
  const list = DB.customers.filter(c=>!f || c.name.toLowerCase().includes(f) || (c.phone||'').includes(f));
  if(!list.length){ wrap.innerHTML=`<div class="empty-state">Nenhum cliente</div>`; return; }
  wrap.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Nome</th><th>Telefone</th><th>E-mail</th><th>Compras</th><th>Gasto</th><th></th></tr></thead><tbody>
    ${list.map(c=>{
      const compras = DB.sales.filter(s=>s.customerId===c.id && vendaValida(s));
      const gasto = compras.reduce((a,s)=>a+Number(s.total||0),0);
      return `<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.phone||'-')}</td><td>${escapeHtml(c.email||'-')}</td><td>${compras.length}</td><td>${money(gasto)}</td>
      <td><button class="btn btn-sm" onclick="openCustomerModal('${c.id}')">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCustomer('${c.id}')">Excluir</button></td></tr>`;
    }).join('')}
  </tbody></table></div>`;
}
/* Não havia como apagar um cliente — e a loja virtual cria um a cada
   pedido. As vendas dele continuam no histórico, como "Consumidor final". */
function deleteCustomer(id){
  const c = DB.customers.find(x=>x.id===id);
  if(!c) return;
  const n = DB.sales.filter(s=>s.customerId===id).length;
  if(!confirm('Excluir o cliente "' + c.name + '"?' + (n ? '\n\nAs ' + n + ' venda(s) dele continuam no histórico, sem o nome.' : ''))) return;
  DB.customers = DB.customers.filter(x=>x.id!==id);
  registrarApagado('customers', id);
  if(pdvCustomer === id) pdvCustomer = '';
  saveDB(); renderCustomerTable(document.getElementById('custSearch')?.value || ''); toast('Cliente excluído');
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
    const data = carimbar({ ...c, name, phone:overlay.querySelector('#c_phone').value.trim(), email:overlay.querySelector('#c_email').value.trim(), address:overlay.querySelector('#c_address').value.trim() });
    if(editing) Object.assign(editing, data); else DB.customers.push(data);
    saveDB(); overlay.remove(); renderCustomerTable();
    toast('Cliente salvo');
  });
}

/* =========================================================
   PDV
   ========================================================= */
let cart = [];
let pdvSearch = '';
const FORMAS_DE_PAGAMENTO = ['PIX','Dinheiro','Débito','Crédito'];
let pdvPayment = 'PIX';
let pdvCustomer = '';
let pdvDiscount = 0;
let pdvCpf = '';

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
        ${configFiscal().ativo ? `<div class="field">
          <label>CPF na nota (opcional)</label>
          <input id="pdvCpf" inputmode="numeric" placeholder="000.000.000-00" value="${escapeHtml(pdvCpf)}" maxlength="14">
        </div>` : ''}
        <div class="field">
          <label>Desconto (R$)</label>
          <input type="number" id="pdvDiscount" value="${pdvDiscount}" min="0" step="0.01">
        </div>
        <div class="pay-methods">
          ${FORMAS_DE_PAGAMENTO.map(m=>`<button class="${pdvPayment===m?'active':''}" data-pay="${m}">${m}</button>`).join('')}
        </div>
        <div class="cart-totals">
          <div class="row"><span>Subtotal</span><span>${money(cartSubtotal())}</span></div>
          <div class="row"><span>Desconto</span><span>-${money(pdvDiscount)}</span></div>
          <div class="row total"><span>Total</span><span>${money(Math.max(0,cartSubtotal()-pdvDiscount))}</span></div>
        </div>
        <button class="btn btn-accent" style="margin-top:12px" onclick="finalizeSale()">Finalizar venda</button>
        <button class="btn btn-imprimir" style="margin-top:8px" onclick="finalizeSale({ imprimir:true })" title="Registra a venda e já manda o recibo para a impressora">🖨️ Finalizar e imprimir recibo</button>
        <button class="btn" style="margin-top:8px" onclick="clearCart()">Limpar carrinho</button>
      </div>
    </div>
    <div id="reciboDaVenda"></div>
    <div id="linkDoPdf"></div>`;

  const input = el.querySelector('#pdvSearchInput');
  /* O BIPE NO PDV.
     O leitor é um teclado muito rápido: digita o código e manda Enter.
     Três coisas quebravam isso, e as três estão tratadas aqui:
       1. Um bipe não encontrado deixava o texto no campo, e todos os
          bipes seguintes grudavam nele ("999999000013000014"): nada mais
          bipava até alguém apagar o campo à mão. Agora o campo é limpo, e
          mesmo com sobra de texto o código do FIM do campo é reconhecido.
       2. Com 188 peças, redesenhar a vitrine a cada tecla travava a
          leitura em aparelho lento. O desenho espera o leitor terminar.
       3. Leitor configurado sem Enter (ou com Tab) não fazia nada. Código
          exato digitado na velocidade de leitor entra sozinho. */
  let desenhoPendente = null, entradaAutomatica = null, teclas = [];
  const agendarDesenho = ()=>{ clearTimeout(desenhoPendente); desenhoPendente = setTimeout(renderPDVResults, 90); };
  const limparCampo = ()=>{ pdvSearch=''; input.value=''; teclas = []; clearTimeout(entradaAutomatica); clearTimeout(desenhoPendente); renderPDVResults(); input.focus(); };
  const veioDeLeitor = ()=>{
    /* as últimas 4+ teclas chegaram com menos de 60 ms entre elas */
    if(teclas.length < 4) return false;
    const ult = teclas.slice(-6);
    return (ult[ult.length-1] - ult[0]) / (ult.length-1) < 60;
  };
  const tentarBipe = (origem)=>{
    clearTimeout(entradaAutomatica);
    const texto = input.value.trim();
    if(!texto) return false;
    let found = findVariationByBarcode(texto) || acharCodigoNoFim(texto);
    if(found){ addToCart(found.product, found.variation); limparCampo(); return true; }
    if(origem === 'auto') return false;
    /* Não é código de barras: se a busca por nome deixou UMA peça na tela,
       Enter é ela. */
    const lista = produtosDoPDV();
    if(lista.length === 1){ quickAdd(lista[0].id); limparCampo(); return true; }
    somDoBipe(false);
    const pareceCodigo = /\d/.test(texto) && !/\s/.test(texto);
    if(pareceCodigo || veioDeLeitor()){
      toast('Código ' + texto.slice(-12) + ' não encontrado. Confira se a etiqueta é de uma peça cadastrada.','error');
      limparCampo();                      // o próximo bipe começa do zero
    } else {
      toast(lista.length ? 'Toque na peça que quer vender' : 'Nenhuma peça com esse nome','error');
      input.select();                     // o que for digitado agora substitui
    }
    return false;
  };
  input.addEventListener('input', e=>{
    pdvSearch = e.target.value;
    teclas.push(performance.now()); if(teclas.length > 40) teclas = teclas.slice(-20);
    agendarDesenho();
    /* Leitor sem Enter no fim: código exato, digitado em velocidade de
       leitor, entra sozinho depois de um instante parado. */
    clearTimeout(entradaAutomatica);
    entradaAutomatica = setTimeout(()=>{ if(veioDeLeitor()) tentarBipe('auto'); }, 280);
  });
  input.addEventListener('keydown', e=>{
    if(e.key === 'Enter'){ e.preventDefault(); tentarBipe('enter'); }
    else if(e.key === 'Tab' && input.value.trim() && (findVariationByBarcode(input.value.trim()) || acharCodigoNoFim(input.value.trim()))){
      e.preventDefault(); tentarBipe('enter');         // leitor configurado com Tab no fim
    }
  });
  el.querySelector('#pdvCamBtn').addEventListener('click', ()=>openScanner(code=>{
    const found = findVariationByBarcode(code);
    if(found) addToCart(found.product, found.variation);
    else { somDoBipe(false); toast('Código ' + code + ' não encontrado','error'); }
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
  el.querySelector('#pdvCpf')?.addEventListener('input', e=>{ pdvCpf = e.target.value; });
  let descontoAntesDoFoco = pdvDiscount;
  el.querySelector('#pdvDiscount').addEventListener('focus', ()=>{ descontoAntesDoFoco = pdvDiscount; });
  el.querySelector('#pdvDiscount').addEventListener('input', e=>{ pdvDiscount=Math.max(0, centavos(e.target.value)); renderCartItems(); });
  el.querySelector('#pdvDiscount').addEventListener('keydown', e=>{
    if(e.key !== 'Enter') return;
    e.preventDefault();
    const bipada = codigoBipadoEmCampoDeValor(e.target.value);
    if(!bipada) return;
    pdvDiscount = descontoAntesDoFoco;
    e.target.value = pdvDiscount;
    addToCart(bipada.product, bipada.variation);
    document.getElementById('pdvSearchInput')?.focus();
  });

  renderPDVResults();
  renderCartItems();
}
/* Sem busca, a vitrine mostra o que tem estoque. PROCURANDO, mostra tudo —
   inclusive a peça que o sistema acha que acabou. A atendente procurava a
   peça que estava na mão dela, não achava (o sistema marcava 0) e acabava
   cadastrando a peça de novo no meio da venda. */
function produtosDoPDV(){
  const f = pdvSearch.trim().toLowerCase();
  const lista = DB.products.filter(p=> f
    ? (p.name.toLowerCase().includes(f) || (p.sku||'').toLowerCase().includes(f) || (p.category||'').toLowerCase().includes(f)
       || p.variations.some(v=>(v.barcode||'').toLowerCase() === f || (v.color||'').toLowerCase().includes(f)))
    : p.variations.some(v=>v.stock>0));
  const tem = p => p.variations.some(v=>v.stock>0) ? 0 : 1;
  return lista.sort((a,b)=>tem(a) - tem(b));
}
function renderPDVResults(){
  const wrap = document.getElementById('pdvResults');
  if(!wrap) return;
  const list = produtosDoPDV();
  const mostra = t => (!t || t==='Único' || t==='Padrão') ? '' : t;
  wrap.innerHTML = list.map(p=>{
    const comEstoque = p.variations.filter(v=>v.stock>0);
    const zerada = !comEstoque.length;
    const v0 = comEstoque[0] || p.variations[0] || {};
    const detalhe = (zerada ? p.variations.length : comEstoque.length) > 1
      ? `${zerada ? p.variations.length : comEstoque.length} tamanhos/cores`
      : [mostra(v0.size), mostra(v0.color)].filter(Boolean).join(' · ');
    const foto = fotoDaPeca(p);
    return `
    <div class="pdv-product${zerada ? ' zerada' : ''}" onclick="quickAdd('${p.id}')">
      ${zerada ? '<span class="tag-zerada">0 no sistema</span>' : ''}
      ${foto ? `<img src="${escapeHtml(foto)}" loading="lazy" decoding="async" onerror="this.style.visibility='hidden'">` : `<div class="sem-foto">👗</div>`}
      <div class="pname">${escapeHtml(p.name)}</div>
      ${detalhe ? `<div class="pmeta">${escapeHtml(detalhe)}</div>` : ''}
      <div class="pprice">${money(p.price)}</div>
    </div>`;
  }).join('') || `<div class="empty-state">Nenhum produto encontrado</div>`;
}
/* Tocar na peça: se ela só tem uma combinação com estoque, vai direto
   para o carrinho. Se tem várias (P/M/G, cores), pergunta qual — antes
   entrava a primeira da lista sem avisar, e a venda saía com o tamanho
   errado e o estoque do tamanho certo intacto. */
function quickAdd(pid){
  const p = DB.products.find(x=>x.id===pid);
  if(!p) return;
  if(p.variations.length === 1){ addToCart(p, p.variations[0]); return; }
  const disponiveis = p.variations.filter(v=>v.stock>0);
  if(disponiveis.length === 1 && !pdvSearch.trim()){ addToCart(p, disponiveis[0]); return; }
  /* Na escolha entram todas as combinações, as zeradas por último. */
  const todas = [...p.variations].sort((a,b)=>(a.stock>0?0:1) - (b.stock>0?0:1));
  escolherVariacao(p, todas, v=>addToCart(p, v));
}
function escolherVariacao(p, variacoes, aoEscolher){
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal" style="max-width:420px">
    <h2>${escapeHtml(p.name)}</h2>
    <p class="text-muted" style="font-size:12.5px;margin-bottom:12px">Qual tamanho/cor está saindo?</p>
    <div class="escolha-variacao">
      ${variacoes.map((v,i)=>`<button type="button" class="btn" data-var="${i}">
        <strong>${escapeHtml(v.size)}${v.color && v.color!=='Padrão' ? ' · '+escapeHtml(v.color) : ''}</strong>
        <span class="${v.stock>0 ? 'text-muted' : 'text-danger'}">${v.stock>0 ? v.stock + ' em estoque' : '0 no sistema'}</span></button>`).join('')}
    </div>
    <div class="modal-actions"><button class="btn" id="cancelBtn">Cancelar</button></div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#cancelBtn').addEventListener('click', ()=>overlay.remove());
  overlay.addEventListener('click', e=>{ if(e.target === overlay) overlay.remove(); });
  overlay.querySelectorAll('[data-var]').forEach(b=>b.addEventListener('click', e=>{
    const v = variacoes[Number(e.currentTarget.dataset.var)];
    overlay.remove();
    if(v) aoEscolher(v);
  }));
}
/* A PEÇA NA MÃO MANDA.
   O PDV recusava a peça quando o estoque do sistema marcava zero. Só que
   o número do sistema erra (cor trocada numa venda anterior, contagem
   errada no cadastro) e a peça está ali, na mão da atendente, com a
   cliente esperando. No dia 17/09 isso fez a loja cadastrar peças novas e
   refazer vendas no meio do atendimento só para conseguir cobrar. Agora a
   peça entra no carrinho, o sistema AVISA que o estoque dele não bate, e
   a venda segue. O estoque nunca fica negativo. */
function estoqueNoSistema(item){
  const v = variacaoDoItem(item);
  return v ? Math.max(0, Number(v.stock)||0) : 0;
}
function addToCart(product, variation){
  const recibo = document.getElementById('reciboDaVenda');
  if(recibo && recibo.innerHTML) fecharRecibo();
  const noSistema = Math.max(0, Number(variation.stock)||0);
  const existing = cart.find(i=>i.productId===product.id && i.size===variation.size && i.color===variation.color);
  if(existing) existing.qty++;
  else cart.push({ productId:product.id, name:product.name, size:variation.size, color:variation.color, price:Number(product.price)||0, precoCadastro:Number(product.price)||0, qty:1, maxStock:noSistema });
  const noCarrinho = existing ? existing.qty : 1;
  if(noCarrinho > noSistema){
    somDoBipe('atencao');
    toast(product.name + ' ' + variation.size + '/' + variation.color + ': o sistema marca ' + noSistema + ' em estoque. Entrou no carrinho mesmo assim — depois confira em Estoque.','warn');
  } else somDoBipe(true);
  renderCartItems();
}
function cartSubtotal(){ return cart.reduce((a,i)=>a+i.price*i.qty,0); }
function renderCartItems(){
  const wrap = document.getElementById('cartItems');
  if(!wrap) return;
  wrap.innerHTML = cart.length ? cart.map((i,idx)=>`
    <div class="cart-item">
      <div><div class="ci-name">${escapeHtml(i.name)}</div><div class="ci-meta">${escapeHtml(i.size)}/${escapeHtml(i.color)} × ${i.qty} = ${money(i.price*i.qty)}</div>
        <button type="button" class="ci-preco${precoMudou(i) ? ' mudou' : ''}" onclick="editarPrecoNoCarrinho(${idx})" title="Mudar o preço desta peça só nesta venda">
          ${money(i.price)} cada${precoMudou(i) ? ` <s>${money(i.precoCadastro)}</s>` : ''} ✎</button>
        ${i.qty > estoqueNoSistema(i) ? `<div class="ci-aviso">⚠ sistema marca ${estoqueNoSistema(i)} em estoque</div>` : ''}</div>
      <div style="display:flex;gap:4px">
        <button class="btn btn-icon btn-sm" onclick="changeQty(${idx},-1)">-</button>
        <button class="btn btn-icon btn-sm" onclick="changeQty(${idx},1)">+</button>
        <button class="btn btn-icon btn-sm btn-danger" onclick="removeFromCart(${idx})">✕</button>
      </div>
    </div>`).join('') : `<div class="empty-state" style="padding:20px">Carrinho vazio</div>`;
  const linhas = document.querySelectorAll('.cart-totals .row span:last-child');
  if(linhas[0]) linhas[0].textContent = money(cartSubtotal());
  /* A linha do desconto não acompanhava o campo: mostrava "-R$ 0,00" com
     desconto digitado. */
  if(linhas[1]) linhas[1].textContent = '-' + money(pdvDiscount);
  const total = document.querySelector('.cart-totals .total span:last-child');
  if(total) total.textContent = money(Math.max(0,cartSubtotal()-pdvDiscount));
}
/* PREÇO NA HORA DA VENDA.
   A loja cobra, às vezes, um preço diferente do cadastro (promoção do dia,
   peça com defeito, combinado com a cliente). Sem um lugar para isso, a
   atendente usava o campo Desconto para "chegar" no valor — e errava a
   conta: no dia 17/09 a mesma venda foi refeita a R$ 20, R$ 120 e R$ 100.
   Aqui o preço da peça muda SÓ NESTA VENDA. O cadastro fica como está, e a
   venda guarda os dois valores. */
/* Um valor em dinheiro que é, letra por letra, um código de barras do
   cadastro (6 dígitos ou mais, sem vírgula) foi bipado, não digitado. */
function codigoBipadoEmCampoDeValor(texto){
  const t = String(texto == null ? '' : texto).trim();
  if(!/^\d{6,}$/.test(t)) return null;
  return findVariationByBarcode(t);
}
function precoMudou(i){ return i.precoCadastro !== undefined && Math.abs(Number(i.price) - Number(i.precoCadastro)) > 0.004; }
function editarPrecoNoCarrinho(idx){
  const i = cart[idx];
  if(!i) return;
  const cadastro = i.precoCadastro !== undefined ? Number(i.precoCadastro) : Number(i.price);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal" style="max-width:400px">
    <h2>Preço nesta venda</h2>
    <p class="text-muted" style="font-size:12.5px;margin-bottom:12px">${escapeHtml(i.name)} ${escapeHtml(i.size)}/${escapeHtml(i.color)} — no cadastro: <strong>${money(cadastro)}</strong>. Mudar aqui vale só para esta venda.</p>
    <div class="field"><label>Preço de cada peça (R$)</label>
      <input type="number" id="pc_valor" step="0.01" min="0" inputmode="decimal" value="${Number(i.price)||0}"></div>
    <div class="modal-actions">
      ${precoMudou(i) ? '<button class="btn" id="pc_voltar" style="margin-right:auto">Voltar ao do cadastro</button>' : ''}
      <button class="btn" id="pc_cancelar">Cancelar</button>
      <button class="btn btn-accent" id="pc_aplicar">Aplicar</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  const campo = overlay.querySelector('#pc_valor');
  const fechar = ()=>{ overlay.remove(); document.getElementById('pdvSearchInput')?.focus(); };
  const aplicar = ()=>{
    /* O leitor digita no campo que estiver com o foco. Um código bipado
       aqui viraria o preço da peça: entra no carrinho, que é o que a
       pessoa queria, e o preço fica como estava. */
    const bipada = codigoBipadoEmCampoDeValor(campo.value);
    if(bipada){ fechar(); addToCart(bipada.product, bipada.variation); return; }
    const v = Number(String(campo.value).replace(',', '.'));
    if(!(v >= 0) || campo.value === ''){ toast('Digite um preço válido','error'); return; }
    if(i.precoCadastro === undefined) i.precoCadastro = cadastro;
    i.price = Math.round(v * 100) / 100;
    fechar(); renderCartItems();
    if(precoMudou(i)) toast('Preço desta venda: ' + money(i.price) + ' (cadastro ' + money(cadastro) + ')');
  };
  overlay.querySelector('#pc_aplicar').addEventListener('click', aplicar);
  overlay.querySelector('#pc_cancelar').addEventListener('click', fechar);
  overlay.querySelector('#pc_voltar')?.addEventListener('click', ()=>{ i.price = cadastro; fechar(); renderCartItems(); });
  campo.addEventListener('keydown', e=>{ if(e.key === 'Enter'){ e.preventDefault(); aplicar(); } if(e.key === 'Escape') fechar(); });
  overlay.addEventListener('click', e=>{ if(e.target === overlay) fechar(); });
  campo.focus(); campo.select();
}
function changeQty(idx,delta){
  const i = cart[idx];
  const newQty = i.qty+delta;
  if(newQty<=0){ cart.splice(idx,1); }
  else {
    i.qty = newQty;
    if(delta > 0 && newQty > estoqueNoSistema(i)) toast('O sistema marca ' + estoqueNoSistema(i) + ' de ' + i.name + ' em estoque. A quantidade foi aceita mesmo assim.','warn');
  }
  renderCartItems();
}
function removeFromCart(idx){ cart.splice(idx,1); renderCartItems(); }
function clearCart(){ cart=[]; pdvDiscount=0; redesenhar(renderPDV); }

function finalizeSale(opcoes){
  opcoes = opcoes || {};
  if(!cart.length){ toast('Carrinho vazio','error'); return; }
  if(pdvDiscount < 0){ toast('Desconto não pode ser negativo','error'); return; }
  const cpfDigitado = (pdvCpf||'').replace(/\D/g,'');
  if(cpfDigitado && cpfDigitado.length !== 11){ toast('O CPF precisa ter 11 números (ou deixe em branco)','error'); return; }
  if(pdvDiscount > cartSubtotal()){
    if(!confirm('O desconto (' + money(pdvDiscount) + ') é maior que o total (' + money(cartSubtotal()) + ').\n\nRegistrar a venda por R$ 0,00 mesmo assim?')) return;
  }
  /* O estoque pode ter mudado desde que a peça entrou no carrinho (outro
     aparelho vendeu, a nuvem trouxe). Confere de novo antes de fechar. */
  const semEstoque = [];
  cart.forEach(i=>{
    const p = DB.products.find(x=>x.id===i.productId);
    const v = p && p.variations.find(v=>v.size===i.size && v.color===i.color);
    if(!v) semEstoque.push(i.name + ' (peça não está mais no cadastro)');
  });
  if(semEstoque.length){
    alert('Não dá para fechar esta venda:\n\n· ' + semEstoque.join('\n· ') + '\n\nTire a peça do carrinho e bipe de novo.');
    return;
  }
  // Vender é o que não pode parar. Se o caixa não foi aberto, abre sozinho
  // com valor inicial zero em vez de bloquear a venda — quem controla o
  // caixa continua podendo abrir com troco pela tela de Caixa.
  if(!DB.cashRegister.open){
    DB.cashRegister = { open:true, automatica:true, openedAt: todayISO(), openingAmount:0, movements:[], closedHistory: DB.cashRegister.closedHistory || [] };
  }
  /* em centavos exatos: 30 + 29,99 dava 59,989999999999995 no banco */
  const total = Math.round(Math.max(0, cartSubtotal()-pdvDiscount) * 100) / 100;
  const sale = {
    id: uid(), date: todayISO(),
    items: cart.map(i=>{
      const prod = DB.products.find(x=>x.id===i.productId);
      /* guardamos o custo daqui, congelado: se amanhã o custo da peça mudar,
         o lucro desta venda não pode mudar junto. */
      const item = { productId:i.productId, name:i.name, size:i.size, color:i.color,
               price:i.price, qty:i.qty, cost: prod ? Number(prod.cost)||0 : 0 };
      if(precoMudou(i)) item.precoCadastro = Number(i.precoCadastro);
      return item;
    }),
    discount: pdvDiscount, payment: pdvPayment, customerId: pdvCustomer || null,
    cpfNota: (pdvCpf||'').replace(/\D/g,'') || undefined,
    seller: SESSION.name, total, status:'concluida', origin:'pdv', canceled:false
  };
  /* Baixa o estoque, e cada item guarda quanto baixou DE VERDADE. Se o
     sistema marcava 0 e a peça foi vendida, baixou 0 — e é isso que volta
     se a venda for cancelada, para o cancelamento não inventar estoque. */
  /* A peça NÃO é carimbada como "mexida" pela venda. O carimbo decide
     qual cadastro vale quando dois aparelhos se juntam, e a venda feita
     num celular desatualizado vencia a entrada de mercadoria e a troca de
     preço feitas no computador. A baixa não se perde: a junção refaz a
     conta do estoque pelas vendas dos dois lados. */
  mexerNoEstoqueDaVenda(sale.items, -1);
  DB.sales.push(sale);
  /* A venda guarda o número do lançamento financeiro dela. Sem isso, mexer
     na venda depois deixava o Financeiro com o valor antigo, e os dois
     números da loja passavam a discordar. */
  const lancamento = { id:uid(), type:'receita', category:'Venda PDV', origem:'venda', amount: total, date: sale.date, status:'pago', description:`Venda #${sale.id.slice(-6)}` };
  sale.financeId = lancamento.id;
  DB.finance.entries.push(lancamento);

  /* Só damos a venda por feita depois que ela está realmente gravada. Antes
     o recibo saía mesmo quando o armazenamento recusava a gravação, e a
     venda sumia no recarregamento seguinte. */
  if(!exigirGravacao('esta venda')){
    DB.sales.pop();
    DB.finance.entries.pop();
    mexerNoEstoqueDaVenda(sale.items, +1);   // devolve o estoque: a venda não aconteceu
    toast('A venda NÃO foi salva. O carrinho continua aqui para você refazer.','error');
    return;
  }
  cart=[]; pdvDiscount=0; pdvCustomer=''; pdvCpf='';
  redesenhar(renderPDV);
  mostrarOfertaDeRecibo(sale, opcoes.imprimir);
  toast('Venda finalizada!');
}
/* O recibo saía pela impressão do navegador e, no celular da loja, isso
   é folha em branco: o Safari manda o papel da janela (A4) e ignora o
   desenho da página — o mesmo defeito que segurou as etiquetas por
   semanas. Agora sai um PDF de 80 mm, o tamanho do cupom, que o celular
   e o computador imprimem igual e que também dá para mandar pelo
   WhatsApp para a cliente.

   E não sai mais sozinho a cada venda: abrir a janela de impressão no
   meio do caixa atrasava a próxima cliente da fila. Fica um botão à
   vista, para quando alguém pedir o recibo, e outro na tela de Vendas
   para qualquer venda antiga. */
function receiptFileName(sale){
  return 'recibo-' + String(sale.id||'venda').slice(-6) + '.pdf';
}
/* O que vai no recibo além dos itens: a loja (endereço, telefone, CNPJ
   do cadastro fiscal) e a cliente (nome, telefone, CPF da nota). */
function formatarCpf(d){ d = String(d||'').replace(/\D/g,''); return d.length === 11 ? d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : ''; }
function formatarCnpj(d){ d = String(d||'').replace(/\D/g,''); return d.length === 14 ? d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : ''; }
function formatarTelefone(d){
  d = String(d||'').replace(/\D/g,'').replace(/^55(?=\d{10,11}$)/, '');
  if(d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if(d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return String(d||'');
}
function dadosDoRecibo(sale){
  const cliente = sale.customerId ? DB.customers.find(c=>c.id === sale.customerId) : null;
  const entrega = sale.entrega || {};
  return {
    endereco: DB.config.address || '',
    telefone: formatarTelefone(DB.config.whatsapp),
    cnpj: formatarCnpj(configFiscal().cnpj),
    cliente: entrega.nome || (cliente ? cliente.name : ''),
    clienteFone: formatarTelefone(entrega.telefone || (cliente ? cliente.phone : '')),
    cpf: formatarCpf(sale.cpfNota)
  };
}
function gerarReciboPdf(sale){
  let blob;
  try{
    blob = criarPdfRecibo(sale, DB.storeName, money, dateBR, dadosDoRecibo(sale));
  }catch(err){
    console.error('Erro ao montar o recibo:', err);
    toast('Não foi possível montar o recibo: ' + err.message, 'error');
    return;
  }
  entregarArquivo(blob, receiptFileName(sale),
    'Recibo de ' + money(sale.total),
    '🧾 Abrir / salvar o recibo',
    'O recibo tem 80 mm de largura, o tamanho do cupom. Abra o arquivo e mande imprimir, ou envie para a cliente.',
    'Recibo');
}
/* O RECIBO SAI SOZINHO. Assim que a venda é finalizada, ele aparece
   desenhado na tela do PDV, com valor e dados (loja, cliente, peças,
   pagamento, quem vendeu), e o PDF de 80 mm é gerado na mesma hora — no
   celular abre a folha de compartilhar (WhatsApp, imprimir); no
   computador o arquivo é baixado. A prévia some quando a próxima peça é
   bipada. Quem não quiser o PDF automático desliga em Configurações; a
   prévia e os botões continuam. */
function textoDoRecibo(sale){
  const d = dadosDoRecibo(sale);
  const linhas = [`*${DB.storeName}*`, `Recibo de venda nº ${String(sale.id).slice(-6).toUpperCase()} — ${dateBR(sale.date)}`, ''];
  (sale.items||[]).forEach(i=>{
    const variante = [i.size, i.color].filter(v=>v && v !== 'Único' && v !== 'Padrão').join('/');
    linhas.push(`${i.qty} x ${i.name}${variante ? ' (' + variante + ')' : ''} — ${money(i.qty * i.price)}`);
  });
  if(Number(sale.discount) > 0) linhas.push(`Desconto: -${money(sale.discount)}`);
  linhas.push(`*Total: ${money(sale.total)}*`, `Pagamento: ${sale.payment}`);
  if(d.cliente) linhas.push(`Cliente: ${d.cliente}`);
  linhas.push('', 'Obrigado pela preferência!');
  return linhas.join('\n');
}
/* O recibo desenhado — o mesmo HTML na prévia do PDV e na impressão. */
function htmlDoRecibo(sale){
  const d = dadosDoRecibo(sale);
  return `<div class="recibo-papel">
      <div class="rc-loja">${escapeHtml(DB.storeName)}</div>
      ${d.endereco ? `<div class="rc-mini">${escapeHtml(d.endereco)}</div>` : ''}
      ${d.telefone || d.cnpj ? `<div class="rc-mini">${[d.telefone ? 'Tel. ' + escapeHtml(d.telefone) : '', d.cnpj ? 'CNPJ ' + escapeHtml(d.cnpj) : ''].filter(Boolean).join(' · ')}</div>` : ''}
      <div class="rc-traco"></div>
      <div class="rc-titulo">Recibo de venda nº ${escapeHtml(String(sale.id).slice(-6).toUpperCase())}</div>
      <div class="rc-mini">${escapeHtml(dateBR(sale.date))}</div>
      <div class="rc-traco"></div>
      ${(sale.items||[]).map(i=>{
        const variante = [i.size, i.color].filter(v=>v && v !== 'Único' && v !== 'Padrão').join('/');
        return `<div class="rc-item"><span>${i.qty} × ${escapeHtml(i.name)}${variante ? ' <small>(' + escapeHtml(variante) + ')</small>' : ''}</span><span>${money(i.qty * i.price)}</span></div>`;
      }).join('')}
      <div class="rc-traco"></div>
      ${Number(sale.discount) > 0 ? `<div class="rc-item"><span>Desconto</span><span>-${money(sale.discount)}</span></div>` : ''}
      <div class="rc-total"><span>TOTAL</span><span>${money(sale.total)}</span></div>
      <div class="rc-item"><span>Pagamento</span><span>${escapeHtml(sale.payment)}</span></div>
      <div class="rc-item"><span>Vendedor(a)</span><span>${escapeHtml(sale.seller||'-')}</span></div>
      ${d.cliente || d.cpf ? `<div class="rc-traco"></div>
        ${d.cliente ? `<div class="rc-item"><span>Cliente</span><span>${escapeHtml(d.cliente)}</span></div>` : ''}
        ${d.clienteFone ? `<div class="rc-item"><span>Telefone</span><span>${escapeHtml(d.clienteFone)}</span></div>` : ''}
        ${d.cpf ? `<div class="rc-item"><span>CPF</span><span>${escapeHtml(d.cpf)}</span></div>` : ''}` : ''}
      ${temCupom(sale) ? `<div class="rc-mini" style="margin-top:6px">NFC-e nº ${escapeHtml(String(sale.nfce.numero||''))}</div>` : ''}
      <div class="rc-mini" style="margin-top:8px">Obrigado pela preferência!</div>
    </div>`;
}
/* Celular e tablet não têm "imprimir" direto da página que funcione (o
   Safari manda uma folha A4 em branco): neles o caminho é o PDF, que
   abre a folha de compartilhar com Imprimir e WhatsApp. */
function ehCelular(){
  const ua = navigator.userAgent || '';
  return /iPhone|iPad|iPod|Android|Mobile/i.test(ua) || ((navigator.maxTouchPoints||0) > 1 && /Mac/i.test(navigator.platform||''));
}
/* IMPRIMIR O RECIBO, de verdade: no computador abre a janela de impressão
   já com o recibo de 80 mm; no celular, a folha de compartilhar com o PDF.
   Um toque só, sem baixar arquivo e abrir depois. */
function imprimirRecibo(sale){
  if(ehCelular()){
    gerarReciboPdf(sale);
    toast('Na folha que abriu, toque em Imprimir — ou mande o recibo pelo WhatsApp.');
    return;
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Recibo ${escapeHtml(String(sale.id).slice(-6).toUpperCase())}</title><style>
    @page{ size: 80mm auto; margin: 4mm }
    body{ margin:0; width:72mm; font-family:"Courier New", ui-monospace, Menlo, monospace; font-size:12px; color:#000; line-height:1.4 }
    .rc-loja{ font-weight:700; font-size:15px; text-align:center; text-transform:uppercase; letter-spacing:.04em }
    .rc-mini{ text-align:center; font-size:11px }
    .rc-titulo{ text-align:center; font-weight:700 }
    .rc-traco{ border-top:1px dashed #000; margin:6px 0 }
    .rc-item{ display:flex; justify-content:space-between; gap:8px }
    .rc-item span:last-child{ white-space:nowrap }
    .rc-item small{ color:#444 }
    .rc-total{ display:flex; justify-content:space-between; font-weight:700; font-size:14px; margin:4px 0 }
  </style></head><body>${htmlDoRecibo(sale)}</body></html>`;
  const quadro = document.createElement('iframe');
  quadro.setAttribute('aria-hidden', 'true');
  quadro.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0';
  document.body.appendChild(quadro);
  const doc = quadro.contentDocument;
  doc.open(); doc.write(html); doc.close();
  const janela = quadro.contentWindow;
  const tirar = ()=>setTimeout(()=>{ if(quadro.parentNode) quadro.remove(); }, 500);
  try{ janela.addEventListener('afterprint', tirar); }catch(e){}
  setTimeout(()=>{
    try{ janela.focus(); janela.print(); }
    catch(e){ console.warn('Impressão direta falhou, vai em PDF:', e); quadro.remove(); gerarReciboPdf(sale); }
  }, 150);
  setTimeout(tirar, 180000);
}
function imprimirReciboDaVendaAgora(id){
  const sale = DB.sales.find(x=>x.id===id);
  if(!sale){ toast('Venda não encontrada','error'); return; }
  imprimirRecibo(sale);
}
/* O que o sistema faz com o recibo logo depois da venda. */
function reciboAoFinalizar(){
  const c = DB.config || {};
  if(c.reciboAoFinalizar) return c.reciboAoFinalizar;        // 'mostrar' | 'imprimir' | 'pdf'
  return c.reciboAutomatico === true ? 'pdf' : 'mostrar';
}
function mostrarOfertaDeRecibo(sale, imprimirAgora){
  const box = document.getElementById('reciboDaVenda');
  if(!box) return;
  const d = dadosDoRecibo(sale);
  const fiscal = configFiscal().ativo;
  const fone = String(d.clienteFone||'').replace(/\D/g,'');
  const whats = fone ? `https://wa.me/${(fone.length === 10 || fone.length === 11 ? '55' : '') + fone}?text=${encodeURIComponent(textoDoRecibo(sale))}` : '';
  const modo = reciboAoFinalizar();
  box.className = 'recibo-pronto';
  box.innerHTML = htmlDoRecibo(sale) + `
    <div class="rc-acoes">
      <button class="btn btn-imprimir" onclick="imprimirReciboDaVendaAgora('${sale.id}')">🖨️ Imprimir recibo</button>
      <button class="btn btn-sm" onclick="imprimirReciboDaVenda('${sale.id}')">📄 PDF</button>
      ${whats ? `<a class="btn btn-sm" href="${whats}" target="_blank" rel="noopener">💬 WhatsApp</a>` : ''}
      ${fiscal ? `<button class="btn btn-sm" onclick="emitirCupomFiscal('${sale.id}')">${temCupom(sale) ? '🧾 Abrir o cupom fiscal' : '🧾 Emitir NFC-e'}</button>` : ''}
      <button class="btn btn-sm" onclick="fecharRecibo()">Fechar</button>
    </div>
    <span class="rc-ajuda">A venda já está salva. A prévia some ao bipar a próxima peça.</span>`;
  box.scrollIntoView({ behavior:'smooth', block:'nearest' });
  if(imprimirAgora || modo === 'imprimir') imprimirRecibo(sale);
  else if(modo === 'pdf') gerarReciboPdf(sale);
}
function fecharRecibo(){
  const box = document.getElementById('reciboDaVenda');
  if(box){ box.className = ''; box.innerHTML = ''; }
  const link = document.getElementById('linkDoPdf');
  if(link && currentRoute === 'pdv'){ link.className = ''; link.innerHTML = ''; }
  document.getElementById('pdvSearchInput')?.focus();
}

function imprimirReciboDaVenda(id){
  const sale = DB.sales.find(x=>x.id===id);
  if(!sale){ toast('Venda não encontrada','error'); return; }
  gerarReciboPdf(sale);
}

/* =========================================================
   CUPOM FISCAL (NFC-e)
   O sistema não fala com a SEFAZ: ele manda a venda para /api/nfce (uma
   função no Vercel), que lê a venda na nuvem e emite pela Focus NFe. O
   navegador só guarda o resultado (número, chave, link do cupom) dentro
   da venda, e isso sobe para a nuvem como qualquer outra alteração.
   ========================================================= */
const CHAVE_FISCAL = 'estiloFashion_fiscal';
function configFiscal(){
  const d = defaultDB().config.fiscal;
  const c = Object.assign({}, d, (DB.config && DB.config.fiscal) || {});
  let local = {};
  try{ local = JSON.parse(localStorage.getItem(CHAVE_FISCAL) || '{}') || {}; }catch(e){}
  c.chave = local.chave || '';
  return c;
}
function guardarChaveFiscal(chave){
  try{ localStorage.setItem(CHAVE_FISCAL, JSON.stringify({ chave: String(chave||'').trim() })); }catch(e){}
}
async function chamarFiscal(corpo){
  const cfg = configFiscal();
  if(!cfg.chave) throw new Error('Digite a chave de emissão em Configurações → Cupom fiscal.');
  const r = await fetch(cfg.endpoint || '/api/nfce', {
    method:'POST', headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(Object.assign({}, corpo, { chave: cfg.chave }))
  });
  const tipo = r.headers.get('content-type') || '';
  if(corpo.acao === 'danfe'){
    if(!r.ok){ let j = {}; try{ j = await r.json(); }catch(e){} throw new Error(j.erro || ('O servidor respondeu ' + r.status)); }
    return await r.blob();
  }
  let j = {}; try{ j = await r.json(); }catch(e){}
  if(!r.ok || !j.ok) throw new Error(j.erro || (r.status === 404 ? 'A função /api/nfce não está publicada neste endereço.' : 'O servidor respondeu ' + r.status));
  return j;
}
function guardarNfceNaVenda(sale, nfce){
  sale.nfce = Object.assign({}, sale.nfce || {}, nfce || {});
  carimbar(sale);
  saveDB();
}
function temCupom(s){ return !!(s && s.nfce && s.nfce.chave && s.nfce.status === 'autorizado'); }
async function emitirCupomFiscal(id){
  const s = DB.sales.find(x=>x.id===id);
  if(!s){ toast('Venda não encontrada','error'); return; }
  if(!configFiscal().ativo){ toast('Ative o cupom fiscal em Configurações → Cupom fiscal.','warn'); return; }
  if(temCupom(s)){ abrirCupomFiscal(id); return; }
  if(temPendencia || enviandoAgora){ toast('Espere o selo ficar "salvo": a nota é montada a partir da nuvem.','warn'); return; }
  let cpf = s.cpfNota || '';
  if(!cpf){
    const r = prompt('CPF na nota? (deixe em branco para não identificar)', '');
    if(r === null) return;
    cpf = r.replace(/\D/g,'');
    if(cpf && cpf.length !== 11){ toast('CPF precisa ter 11 números','error'); return; }
    if(cpf){ s.cpfNota = cpf; carimbar(s); saveDB(); }
  }
  toast('Emitindo o cupom fiscal…');
  try{
    const j = await chamarFiscal({ acao:'emitir', vendaId:id, cpf });
    guardarNfceNaVenda(s, j.nfce);
    if(j.nfce.status === 'autorizado'){
      toast('Cupom fiscal autorizado — nº ' + (j.nfce.numero||'') + '. Abrindo…');
      abrirCupomFiscal(id);
    } else if(j.nfce.status === 'processando_autorizacao'){
      toast('A SEFAZ ainda está processando. Toque em "Cupom" de novo daqui a pouco.','warn');
    } else {
      toast('A SEFAZ recusou: ' + (j.nfce.mensagem || j.nfce.status), 'error');
    }
  }catch(err){
    toast(err.message, 'error');
  }
  renderVendasTable();
  mostrarOfertaDeRecibo(s);
}
async function consultarCupomFiscal(id){
  const s = DB.sales.find(x=>x.id===id);
  if(!s) return;
  try{
    const j = await chamarFiscal({ acao:'consultar', vendaId:id });
    if(j.nfce) guardarNfceNaVenda(s, j.nfce);
    renderVendasTable();
    toast(j.nfce ? 'Situação: ' + (j.nfce.status||'') : 'Esta venda não tem cupom no provedor.');
  }catch(err){ toast(err.message, 'error'); }
}
async function abrirCupomFiscal(id){
  const s = DB.sales.find(x=>x.id===id);
  if(!s || !s.nfce){ toast('Esta venda não tem cupom','error'); return; }
  /* A janela é aberta ANTES da espera: o celular só deixa abrir janela
     no toque, não depois de uma resposta da rede. */
  const janela = window.open('', '_blank');
  try{
    const blob = await chamarFiscal({ acao:'danfe', vendaId:id });
    const url = URL.createObjectURL(blob);
    if(janela) janela.location = url; else window.location = url;
  }catch(err){
    if(janela) janela.close();
    toast(err.message, 'error');
  }
}
async function cancelarCupomFiscal(id){
  const s = DB.sales.find(x=>x.id===id);
  if(!s || !temCupom(s)) return;
  const j = prompt('Motivo do cancelamento (mínimo 15 letras). A SEFAZ só aceita cancelar em até 30 minutos na maioria dos estados:', 'Venda registrada por engano');
  if(j === null) return;
  if(String(j).trim().length < 15){ toast('A justificativa precisa ter pelo menos 15 letras','error'); return; }
  toast('Cancelando na SEFAZ…');
  try{
    const r = await chamarFiscal({ acao:'cancelar', vendaId:id, justificativa: j });
    guardarNfceNaVenda(s, r.nfce);
    toast(r.nfce.status === 'cancelado' ? 'Cupom fiscal cancelado' : 'Situação: ' + r.nfce.status, r.nfce.status === 'cancelado' ? 'ok' : 'warn');
  }catch(err){ toast(err.message, 'error'); }
  renderVendasTable();
}
function badgeCupom(s){
  if(!s.nfce || !s.nfce.status) return '';
  const n = s.nfce;
  if(n.status === 'autorizado') return `<span class="badge badge-gold" title="Chave ${escapeHtml(n.chave||'')}">NFC-e ${escapeHtml(String(n.numero||''))}</span>`;
  if(n.status === 'cancelado') return `<span class="badge badge-muted">NFC-e cancelada</span>`;
  if(n.status === 'processando_autorizacao') return `<span class="badge badge-warning">NFC-e processando</span>`;
  return `<span class="badge badge-danger" title="${escapeHtml(n.mensagem||'')}">NFC-e recusada</span>`;
}
async function testarCupomFiscal(){
  const box = document.getElementById('diagnosticoFiscal');
  if(!box) return;
  box.innerHTML = '<p class="text-muted">Testando…</p>';
  const cfg = configFiscal();
  let servidor = null;
  try{
    const r = await fetch(cfg.endpoint || '/api/nfce', { cache:'no-store' });
    servidor = r.ok ? await r.json() : { erro: 'O servidor respondeu ' + r.status };
  }catch(e){ servidor = { erro: 'A função /api/nfce não respondeu. Ela só existe no site publicado (estilofashion.vercel.app), não em um servidor local.' }; }
  const linhas = [];
  const item = (ok, texto) => linhas.push(`<li>${ok ? '✅' : '❌'} ${texto}</li>`);
  if(servidor.erro){ item(false, escapeHtml(servidor.erro)); }
  else {
    item(true, 'A função /api/nfce está publicada (ambiente: <strong>' + escapeHtml(servidor.ambiente) + '</strong>).');
    item(servidor.tokenConfigurado, servidor.tokenConfigurado ? 'Token da Focus NFe configurado no Vercel.' : 'Falta o token da Focus NFe no Vercel (variável FOCUS_NFE_TOKEN).');
    item(servidor.chaveConfigurada, servidor.chaveConfigurada ? 'Chave de emissão configurada no Vercel.' : 'Falta a chave de emissão no Vercel (variável FISCAL_SENHA).');
  }
  item(!!cfg.chave, cfg.chave ? 'Chave de emissão digitada neste aparelho.' : 'Digite a chave de emissão aqui e salve.');
  item(String(cfg.cnpj||'').replace(/\D/g,'').length === 14, 'CNPJ da loja ' + (String(cfg.cnpj||'').replace(/\D/g,'').length === 14 ? 'preenchido.' : 'faltando ou incompleto.'));
  item(!!cfg.ativo, cfg.ativo ? 'Cupom fiscal ativado nas vendas.' : 'Cupom fiscal ainda desligado (marque "Ativar" e salve).');
  box.innerHTML = `<ul style="list-style:none;display:grid;gap:6px;margin:0">${linhas.join('')}</ul>`;
}

/* =========================================================
   VENDAS
   ========================================================= */
function renderVendas(el){
  el.innerHTML = `<div id="linkDoPdf"></div><div id="vendasWrap"></div>`;
  renderVendasTable();
}
/* A tela desenhava TODAS as vendas de uma vez. Com 800 vendas já eram 8.814
   elementos na tela; em um ano de loja isso trava o celular. Mostramos as
   mais recentes e o resto sob demanda. */
let vendasMostradas = 100;
function renderVendasTable(){
  const wrap = document.getElementById('vendasWrap');
  /* Cancelar ou excluir uma venda a partir de outra tela derrubava o
     sistema aqui: não havia tabela para redesenhar. Sem tela, nada a
     fazer — o dado já foi salvo, que é o que importa. */
  if(!wrap) return;
  const todas = [...DB.sales].sort((a,b)=>new Date(b.date)-new Date(a.date));
  if(!todas.length){ wrap.innerHTML=`<div class="empty-state">Nenhuma venda registrada</div>`; return; }
  const list = todas.slice(0, vendasMostradas);
  const faltam = todas.length - list.length;
  wrap.innerHTML = `<div class="table-wrap"><table><thead><tr>
    <th>Data</th><th>Cliente</th><th>Itens</th><th>Total</th><th>Pagto</th><th>Origem</th><th>Status</th><th></th>
  </tr></thead><tbody>
    ${list.map(s=>`<tr style="${s.canceled?'opacity:.5':''}">
      <td>${dateBR(s.date)}</td>
      <td>${escapeHtml(s.entrega && s.entrega.nome ? s.entrega.nome : customerName(s.customerId))}${s.entrega && s.entrega.endereco ? `<div class="text-muted" style="font-size:11.5px;white-space:normal">Entregar em: ${escapeHtml(s.entrega.endereco)}${s.entrega.telefone ? ' · ' + escapeHtml(s.entrega.telefone) : ''}</div>` : ''}</td>
      <td>${s.items.reduce((a,i)=>a+i.qty,0)}</td>
      <td>${money(s.total)}</td>
      <td>${escapeHtml(s.payment)}</td>
      <td>${s.origin==='loja'?'<span class="badge badge-gold">Loja virtual</span>':'PDV'}</td>
      <td>${saleStatusBadge(s)} ${badgeCupom(s)} ${badgeDevolucao(s)}</td>
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
function badgeDevolucao(s){
  const n = devolucoesDaVenda(s.id).reduce((a,r)=>a + (Number(r.qty)||0), 0);
  return n ? `<span class="badge badge-warning" title="Veja em Perdas e Devoluções">↩ ${n} devolvida(s)</span>` : '';
}
function saleActions(s){
  /* Venda cancelada continuava sem botão nenhum — nem para apagar. Quem
     registrou errado ficava com a linha errada na tela para sempre. */
  if(s.canceled) return ehAdmin() ? `<button class="btn btn-sm btn-danger" onclick="excluirVenda('${s.id}')">🗑️ Excluir</button>` : '';
  let btns='';
  if(s.origin==='loja' && s.status==='pendente') btns += `<button class="btn btn-sm btn-accent" onclick="markSalePaid('${s.id}')">Marcar Pago</button> `;
  if(s.origin==='loja' && s.status==='pago') btns += `<button class="btn btn-sm btn-gold" onclick="markSaleDelivered('${s.id}')">Marcar Entregue</button> `;
  if(configFiscal().ativo){
    if(temCupom(s)) btns += `<button class="btn btn-sm" onclick="abrirCupomFiscal('${s.id}')">🧾 Cupom</button> <button class="btn btn-sm" onclick="cancelarCupomFiscal('${s.id}')" title="Cancelar a NFC-e na SEFAZ">Cancelar NFC-e</button> `;
    else if(s.nfce && s.nfce.status === 'processando_autorizacao') btns += `<button class="btn btn-sm" onclick="consultarCupomFiscal('${s.id}')">🔄 Ver situação</button> `;
    else if(s.status !== 'pendente') btns += `<button class="btn btn-sm btn-gold" onclick="emitirCupomFiscal('${s.id}')">🧾 Emitir NFC-e</button> `;
  }
  btns += `<button class="btn btn-sm" onclick="imprimirReciboDaVendaAgora('${s.id}')">🖨️ Recibo</button> `;
  /* O que se usa pouco (e o que é perigoso) fica atrás do "Mais": cinco
     botões por linha empilhavam, a linha ficava com um palmo de altura e
     o Excluir ficava colado no Recibo, pedindo para ser tocado sem querer. */
  btns += `<button class="btn btn-sm" data-menu="venda" data-id="${s.id}">⋯ Mais</button>`;
  return btns;
}

/* =========================================================
   MENU "MAIS"
   Um botão com data-menu abre uma listinha de ações ao lado dele. A
   lista é montada na hora, a partir do registro — assim ela nunca
   mostra uma ação que não vale para aquela linha.
   ========================================================= */
const MENUS = {
  venda(id){
    const s = DB.sales.find(x=>x.id === id);
    if(!s) return [];
    const itens = [];
    if(s.status !== 'pendente') itens.push({ rotulo:'↩ Registrar devolução', fazer:()=>openPerdaModal('devolucao', { saleId:id }) });
    itens.push({ rotulo:'✏️ Editar venda', fazer:()=>openSaleModal(id) });
    itens.push({ rotulo:'📄 Recibo em PDF', fazer:()=>imprimirReciboDaVenda(id) });
    itens.push({ rotulo:'Cancelar venda', fazer:()=>cancelSale(id) });
    if(ehAdmin()) itens.push({ rotulo:'🗑️ Excluir venda', perigo:true, fazer:()=>excluirVenda(id) });
    return itens;
  }
};
function fecharMenuDeAcoes(){
  document.querySelectorAll('.menu-flutuante').forEach(m=>m.remove());
}
function abrirMenuDeAcoes(botao){
  const jaAberto = botao.classList.contains('menu-aberto');
  fecharMenuDeAcoes();
  document.querySelectorAll('.menu-aberto').forEach(b=>b.classList.remove('menu-aberto'));
  if(jaAberto) return;
  const montar = MENUS[botao.dataset.menu];
  const itens = montar ? montar(botao.dataset.id) : [];
  if(!itens.length) return;
  const menu = document.createElement('div');
  menu.className = 'menu-flutuante';
  menu.setAttribute('role', 'menu');
  itens.forEach(i=>{
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'menuitem');
    b.className = i.perigo ? 'perigo' : '';
    b.textContent = i.rotulo;
    b.addEventListener('click', ()=>{ fecharMenuDeAcoes(); botao.classList.remove('menu-aberto'); i.fazer(); });
    menu.appendChild(b);
  });
  document.body.appendChild(menu);
  botao.classList.add('menu-aberto');
  /* Posição: embaixo do botão, alinhado pela direita; se não couber
     embaixo, abre para cima. Sempre dentro da tela. */
  const r = botao.getBoundingClientRect(), m = menu.getBoundingClientRect();
  let topo = r.bottom + 6;
  if(topo + m.height > window.innerHeight - 8) topo = Math.max(8, r.top - m.height - 6);
  const esquerda = Math.min(Math.max(8, r.right - m.width), window.innerWidth - m.width - 8);
  menu.style.top = topo + 'px';
  menu.style.left = esquerda + 'px';
}
document.addEventListener('click', e=>{
  const botao = e.target.closest && e.target.closest('[data-menu]');
  if(botao){ e.preventDefault(); abrirMenuDeAcoes(botao); return; }
  if(!(e.target.closest && e.target.closest('.menu-flutuante'))){
    fecharMenuDeAcoes();
    document.querySelectorAll('.menu-aberto').forEach(b=>b.classList.remove('menu-aberto'));
  }
});
document.addEventListener('keydown', e=>{ if(e.key === 'Escape') fecharMenuDeAcoes(); });
window.addEventListener('scroll', fecharMenuDeAcoes, true);
window.addEventListener('resize', fecharMenuDeAcoes);

/* =========================================================
   TABELAS NO CELULAR
   Tabela larga em tela estreita obriga a rolar para o lado, e os botões
   (que ficam na última coluna) somem da vista. No celular cada linha
   vira um cartão: o nome de cada coluna aparece em cima do valor. Para
   isso cada célula precisa saber o nome da sua coluna — é o que esta
   função anota, em toda tabela que entrar na tela.
   ========================================================= */
function rotularTabelas(raiz){
  (raiz || document).querySelectorAll('table').forEach(t=>{
    const ths = t.tHead ? [...t.tHead.querySelectorAll('th')] : [];
    if(ths.length < 4){ t.classList.remove('cartoes'); return; }
    const nomes = ths.map(th=>th.textContent.trim());
    /* O título do cartão é a primeira coluna com nome que não seja a foto. */
    const titulo = nomes.findIndex(n=>n && !/^foto$/i.test(n));
    t.classList.add('cartoes');
    [...t.tBodies].forEach(tb=>[...tb.rows].forEach(tr=>{
      [...tr.cells].forEach((td, i)=>{
        if(td.colSpan > 1){ td.dataset.rotulo = ''; td.classList.add('celula-inteira'); return; }
        const nome = nomes[i] || '';
        if(td.dataset.rotulo !== nome) td.dataset.rotulo = nome;
        td.classList.toggle('celula-acoes', !nome && i === tr.cells.length - 1);
        td.classList.toggle('celula-titulo', i === titulo);
        td.classList.toggle('celula-foto', /^foto$/i.test(nome));
      });
    }));
  });
}
if(typeof MutationObserver !== 'undefined'){
  let rotuloPendente = null;
  const observador = new MutationObserver(()=>{
    /* junta as mudanças de um mesmo desenho numa passada só */
    if(rotuloPendente) return;
    rotuloPendente = setTimeout(()=>{ rotuloPendente = null; rotularTabelas(document); }, 0);
  });
  document.addEventListener('DOMContentLoaded', ()=>observador.observe(document.body, { childList:true, subtree:true }));
}

/* Mexer no estoque de uma venda: soma (devolvendo) ou subtrai (vendendo).
   Um lugar só, para a devolução e a retirada nunca discordarem. */
/* A variação (tamanho/cor) a que um item de venda ou de perda se refere.
   Quem cadastrou a peça sem cor e depois escreveu "Preto" mudou o nome da
   variação, e as vendas antigas deixavam de achá-la: cancelar dizia
   "estoque devolvido" e não devolvia nada. Peça de uma variação só não
   deixa dúvida sobre qual é. */
function variacaoDoItem(i){
  const p = i && DB.products.find(x=>x.id===i.productId);
  if(!p || !Array.isArray(p.variations)) return null;
  return p.variations.find(v=>v.size===i.size && v.color===i.color)
      || (i.barcode ? p.variations.find(v=>v.barcode && v.barcode===i.barcode) : null)
      || (p.variations.length === 1 ? p.variations[0] : null);
}
/* Devolve a lista das peças que NÃO foram achadas no cadastro. */
function mexerNoEstoqueDaVenda(itens, sinal){
  const semCadastro = [];
  (itens||[]).forEach(i=>{
    const v = variacaoDoItem(i);
    if(!v){ semCadastro.push(i.name + ' ' + (i.size||'') + '/' + (i.color||'')); return; }
    const qtd = Number(i.qty||0);
    const tem = Math.max(0, Number(v.stock)||0);
    if(sinal > 0){
      /* devolve o que saiu de verdade (vendas antigas não guardavam: vale a quantidade) */
      v.stock = tem + (i.baixou === undefined ? qtd : Math.max(0, Number(i.baixou)||0));
    } else {
      i.baixou = Math.min(qtd, tem);
      v.stock = tem - i.baixou;
    }
  });
  return semCadastro;
}
function avisoDeEstoqueQueNaoVoltou(semCadastro){
  return semCadastro.length ? ' Atenção: ' + semCadastro.join(', ') + ' não está mais no cadastro com esse tamanho/cor — o estoque dessa peça NÃO voltou; acerte em Estoque.' : '';
}

/* O lançamento no Financeiro que pertence a esta venda. As vendas novas
   guardam o número dele; as antigas são achadas pela descrição, que é como
   ele foi criado. */
function lancamentoDaVenda(s){
  const lista = (DB.finance && DB.finance.entries) || [];
  if(s.financeId){
    const achado = lista.find(e=>e.id === s.financeId);
    if(achado) return achado;
  }
  const marca = '#' + String(s.id).slice(-6);
  return lista.find(e=>e.description && e.description.indexOf(marca) >= 0) || null;
}

/* EXCLUIR é diferente de CANCELAR, e a diferença importa: cancelar guarda
   a venda no histórico como cancelada; excluir apaga a linha, como se
   nunca tivesse acontecido. Serve para o registro feito por engano — a
   venda de R$ 0,00 que ninguém fez. */
/* Apagar some com o registro: é coisa de quem responde pela loja. A
   vendedora cancela (o registro fica); quem exclui é o administrador. */
function soAdministrador(oQue){
  if(SESSION && SESSION.role === 'admin') return true;
  toast('Só o administrador pode ' + oQue + '.','warn');
  return false;
}
function ehAdmin(){ return !!(SESSION && SESSION.role === 'admin'); }
function excluirVenda(id){
  if(!soAdministrador('excluir uma venda. Para anular, use Cancelar')) return;
  const s = DB.sales.find(x=>x.id===id);
  if(!s) return;
  /* A nota autorizada continua valendo na SEFAZ: apagar a venda daqui
     deixaria um cupom fiscal sem venda nenhuma por trás. */
  if(temCupom(s)){ toast('Esta venda tem cupom fiscal autorizado. Cancele a NFC-e primeiro (botão "Cancelar NFC-e").','warn'); return; }
  if(!s.canceled && devolucoesDaVenda(s.id).length){ toast('Esta venda tem devolução registrada. Exclua a devolução em Perdas e Devoluções antes de excluir a venda.','warn'); return; }
  if(!confirm('EXCLUIR esta venda de ' + money(s.total) + ', de ' + dateBR(s.date) + '?\n\n' +
              'A linha some do histórico e o lançamento no Financeiro sai junto.\n' +
              (s.canceled ? 'O estoque já tinha voltado no cancelamento.\n' : 'O estoque das peças volta.\n') +
              '\nIsto não tem como desfazer. Para apenas anular guardando o registro, use Cancelar.')) return;
  const naoVoltou = s.canceled ? [] : mexerNoEstoqueDaVenda(s.items, +1);
  const lanc = lancamentoDaVenda(s);
  if(lanc){
    DB.finance.entries = DB.finance.entries.filter(e=>e.id !== lanc.id);
    registrarApagado('finance', lanc.id);
  }
  DB.sales = DB.sales.filter(x=>x.id !== id);
  registrarApagado('sales', id);
  if(exigirGravacao('a exclusão da venda')){
    renderVendasTable();
    toast('Venda excluída.' + avisoDeEstoqueQueNaoVoltou(naoVoltou), naoVoltou.length ? 'warn' : 'ok');
  }
}

/* Editar uma venda registrada. O que muda de verdade no balcão: a forma de
   pagamento errada, a quantidade digitada a mais, o desconto esquecido, a
   cliente que não foi anotada. Cada mudança acerta o estoque e o
   Financeiro junto — senão a loja fica com dois números diferentes para a
   mesma venda. */
function openSaleModal(id){
  const s = DB.sales.find(x=>x.id===id);
  if(!s){ toast('Venda não encontrada','error'); return; }
  if(s.canceled){ toast('Venda cancelada não pode ser editada. Exclua ou registre outra.','warn'); return; }
  if(temCupom(s)){ toast('Esta venda tem cupom fiscal autorizado. Cancele a NFC-e antes de editar.','warn'); return; }

  /* Cada linha lembra de qual peça da venda ela veio e quanto dela a
     cliente já devolveu: a peça devolvida não pode sair da venda nem ficar
     com quantidade menor que a devolvida, senão o estoque volta duas vezes. */
  const itens = s.items.map(i=>({ ...i, _origem:i, _devolvido:devolvidoDaVenda(s.id, i) }));
  const dataOriginal = paraDatetimeLocal(s.date);
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  const opcoesCliente = ['<option value="">Consumidor final</option>']
    .concat(DB.customers.map(c=>`<option value="${escapeHtml(c.id)}" ${s.customerId===c.id?'selected':''}>${escapeHtml(c.name)}</option>`))
    .join('');
  /* As mesmas formas do PDV, com a mesma grafia. Aqui estavam em
     minúsculas ("pix"), então a venda em "PIX" nunca casava, o campo caía
     em "dinheiro" e salvar trocava a forma de pagamento sem ninguém pedir
     — e os relatórios passavam a ter "PIX" e "pix" como duas formas. */
  const formas = FORMAS_DE_PAGAMENTO.slice();
  const formaAtual = formas.find(f=>f.toLowerCase() === String(s.payment||'').toLowerCase()) || s.payment || formas[0];
  if(!formas.includes(formaAtual)) formas.push(formaAtual);

  overlay.innerHTML = `<div class="modal">
    <h2>Editar venda de ${dateBR(s.date)}</h2>
    <p class="text-muted" style="font-size:12.5px;margin-bottom:12px">
      Mudou a quantidade? O estoque das peças é acertado na mesma hora, para mais ou para menos.</p>
    <div id="itensDaVenda"></div>
    <div class="form-grid" style="margin-top:14px">
      <div class="field"><label>Cliente</label>
        <select id="v_cliente">${opcoesCliente}</select></div>
      <div class="field"><label>Forma de pagamento</label>
        <select id="v_pagto">${formas.map(f=>`<option value="${escapeHtml(f)}" ${formaAtual===f?'selected':''}>${escapeHtml(f)}</option>`).join('')}</select></div>
      <div class="field"><label>Desconto (R$)</label>
        <input type="number" id="v_desc" step="0.01" min="0" value="${Number(s.discount)||0}"></div>
      <div class="field"><label>Data e hora</label>
        <input type="datetime-local" id="v_data" value="${paraDatetimeLocal(s.date)}"></div>
    </div>
    <div class="lucro-box" id="v_total" style="margin-top:14px"></div>
    <div class="modal-actions">
      <button class="btn" id="v_cancelar">Voltar</button>
      <button class="btn btn-accent" id="v_salvar">Salvar alterações</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);

  const caixaItens = overlay.querySelector('#itensDaVenda');
  function desenharItens(){
    if(!itens.length){
      caixaItens.innerHTML = '<p class="text-muted" style="font-size:12.5px">Sem peças nesta venda. Salvando assim, ela fica zerada — talvez você queira Excluir.</p>';
      return atualizarTotal();
    }
    caixaItens.innerHTML = `<div class="table-wrap"><table><thead><tr>
      <th>Peça</th><th style="width:90px">Qtd</th><th style="width:110px">Preço</th><th>Subtotal</th><th></th>
    </tr></thead><tbody>
      ${itens.map((i,idx)=>`<tr>
        <td>${escapeHtml(i.name)} <span class="text-muted">${escapeHtml(i.size)}/${escapeHtml(i.color)}</span></td>
        <td><input type="number" min="${Math.max(1, i._devolvido)}" step="1" inputmode="numeric" value="${i.qty}" data-qtd="${idx}" style="width:70px">
          ${i._devolvido ? `<div class="text-muted" style="font-size:11.5px">${i._devolvido} já devolvida${i._devolvido > 1 ? 's' : ''}</div>` : ''}</td>
        <td><input type="number" min="0" step="0.01" inputmode="decimal" value="${i.price}" data-preco="${idx}" style="width:95px"></td>
        <td data-subtotal="${idx}">${money(i.qty * i.price)}</td>
        <td>${i._devolvido ? '' : `<button class="btn btn-sm btn-danger" data-tirar="${idx}">Tirar</button>`}</td>
      </tr>`).join('')}
    </tbody></table></div>`;
    caixaItens.querySelectorAll('[data-qtd]').forEach(inp=>inp.addEventListener('input', e=>{
      const i = itens[Number(e.target.dataset.qtd)];
      i.qty = Math.max(1, i._devolvido, Math.floor(Number(e.target.value)||1));
      atualizarSubtotal(Number(e.target.dataset.qtd));
    }));
    caixaItens.querySelectorAll('[data-qtd]').forEach(inp=>inp.addEventListener('change', e=>{
      e.target.value = itens[Number(e.target.dataset.qtd)].qty;
    }));
    caixaItens.querySelectorAll('[data-preco]').forEach(inp=>inp.addEventListener('input', e=>{
      itens[Number(e.target.dataset.preco)].price = centavos(Math.max(0, Number(e.target.value)||0));
      atualizarSubtotal(Number(e.target.dataset.preco));
    }));
    caixaItens.querySelectorAll('[data-tirar]').forEach(b=>b.addEventListener('click', e=>{
      itens.splice(Number(e.target.dataset.tirar), 1);
      desenharItens();
    }));
    atualizarTotal();
  }
  function atualizarSubtotal(idx){
    const celula = caixaItens.querySelector(`[data-subtotal="${idx}"]`);
    if(celula) celula.textContent = money(itens[idx].qty * itens[idx].price);
    atualizarTotal();
  }
  function somaDosItens(){ return itens.reduce((soma,i)=>soma + Number(i.qty)*Number(i.price), 0); }
  /* Desconto negativo viraria acréscimo escondido; maior que a venda, troco. */
  function descontoNovo(){
    return centavos(Math.min(somaDosItens(), Math.max(0, Number(overlay.querySelector('#v_desc').value)||0)));
  }
  function totalNovo(){ return centavos(Math.max(0, somaDosItens() - descontoNovo())); }
  function atualizarTotal(){
    const t = totalNovo();
    overlay.querySelector('#v_total').innerHTML =
      `Total desta venda: <strong>${money(t)}</strong>` +
      (Math.abs(t - s.total) > 0.001 ? ` <span class="text-muted">(era ${money(s.total)})</span>` : '');
  }
  overlay.querySelector('#v_desc').addEventListener('input', atualizarTotal);
  desenharItens();

  overlay.querySelector('#v_cancelar').addEventListener('click', ()=>overlay.remove());
  overlay.querySelector('#v_salvar').addEventListener('click', ()=>{
    /* A devolução pode ter sido registrada em outro aparelho com este
       formulário aberto: confere de novo na hora de gravar. */
    const comDevolucao = s.items.filter(o=>{
      const ja = devolvidoDaVenda(s.id, o);
      if(!ja) return false;
      const linha = itens.find(i=>i._origem === o);
      return !linha || linha.qty < ja;
    });
    if(comDevolucao.length){
      toast('Esta venda tem devolução de ' + comDevolucao.map(o=>o.name).join(', ') + '. A peça devolvida não pode sair da venda nem ficar com quantidade menor que a devolvida.','warn');
      return;
    }
    /* O estoque só muda onde a quantidade mudou. Devolver tudo e tirar de
       novo parecia a mesma conta, mas não era: a venda feita com o sistema
       marcando zero (que não baixou nada) passava a baixar na primeira
       edição, mesmo que só a forma de pagamento tivesse sido trocada. */
    const faltou = [];
    const variacaoDe = variacaoDoItem;
    const baixadoDe = o => o.baixou === undefined ? Number(o.qty)||0 : Math.max(0, Number(o.baixou)||0);
    s.items.forEach(o=>{
      if(itens.some(i=>i._origem === o)) return;
      const v = variacaoDe(o);
      if(v) v.stock = Math.max(0, Number(v.stock)||0) + baixadoDe(o);
    });
    const novos = itens.map(i=>{
      const o = i._origem, antes = Number(o.qty)||0, agora = Number(i.qty)||0;
      const limpo = { ...i };
      delete limpo._origem; delete limpo._devolvido;
      if(agora === antes) return limpo;
      const v = variacaoDe(i);
      let baixou = baixadoDe(o);
      if(v){
        const tem = Math.max(0, Number(v.stock)||0);
        if(agora > antes){
          const sai = Math.min(agora - antes, tem);
          if(sai < agora - antes) faltou.push(`${i.name} ${i.size}/${i.color} (sistema marca ${tem})`);
          v.stock = tem - sai; baixou += sai;
        } else {
          const volta = Math.min(antes - agora, baixou);
          v.stock = tem + volta; baixou -= volta;
        }
      }
      limpo.baixou = baixou;
      return limpo;
    });
    /* Não bloqueia: a venda já aconteceu no balcão. Só avisa. */
    if(faltou.length) toast('Estoque do sistema não cobre: ' + faltou.join('; ') + '. A venda foi salva; confira em Estoque.','warn');

    const data = overlay.querySelector('#v_data').value;
    s.items = novos;
    s.discount = descontoNovo();
    s.payment = overlay.querySelector('#v_pagto').value;
    s.customerId = overlay.querySelector('#v_cliente').value || null;
    s.total = totalNovo();
    /* O campo datetime-local vem sem fuso: new Date() lê como hora local,
       que é o que a pessoa digitou. Só troca a data se ela foi mexida: o
       campo guarda até o minuto, e regravar sempre jogava a venda para o
       começo do minuto — antes da abertura do caixa, às vezes. */
    if(data && data !== dataOriginal && !isNaN(new Date(data))) s.date = new Date(data).toISOString();
    s.editadoEm = todayISO();
    carimbar(s);

    const lanc = lancamentoDaVenda(s);
    if(lanc){ lanc.amount = s.total; lanc.date = s.date; carimbar(lanc); }

    if(exigirGravacao('a alteração da venda')){
      overlay.remove();
      renderVendasTable();
      toast('Venda atualizada');
    }
  });
}
function markSalePaid(id){
  const s = DB.sales.find(x=>x.id===id);
  if(!s || s.canceled) return;
  s.status='pago';
  /* Marcar pago duas vezes (dois aparelhos, dois toques) não pode gerar
     duas receitas. */
  let lanc = lancamentoDaVenda(s);
  if(!lanc){
    lanc = { id:uid(), type:'receita', category:'Venda loja virtual', amount:s.total, date:todayISO(), status:'pago', description:`Pedido online #${id.slice(-6)}` };
    DB.finance.entries.push(lanc);
  }
  s.financeId = lanc.id;
  carimbar(s);
  saveDB(); renderVendasTable(); toast('Pedido marcado como pago');
}
function markSaleDelivered(id){
  const s = DB.sales.find(x=>x.id===id);
  if(!s || s.canceled) return;
  s.status='entregue'; carimbar(s);
  saveDB(); renderVendasTable(); toast('Pedido marcado como entregue');
}
function cancelSale(id){
  const s = DB.sales.find(x=>x.id===id);
  if(!s || s.canceled) return;
  if(temCupom(s)){ toast('Esta venda tem cupom fiscal autorizado. Cancele a NFC-e primeiro (botão "Cancelar NFC-e").','warn'); return; }
  /* A peça devolvida já voltou para o estoque: cancelar a venda por cima
     devolveria a mesma peça duas vezes. */
  if(devolucoesDaVenda(s.id).length){ toast('Esta venda tem devolução registrada. Exclua a devolução em Perdas e Devoluções antes de cancelar.','warn'); return; }
  if(!confirm('Cancelar esta venda? O estoque será devolvido.')) return;
  const naoVoltou = mexerNoEstoqueDaVenda(s.items, +1);
  s.canceled = true;
  carimbar(s);
  /* A receita da venda cancelada continuava no Financeiro, e o "Saldo do
     mês" ficava com dinheiro que não entrou. Sai junto. */
  const lanc = lancamentoDaVenda(s);
  if(lanc){
    DB.finance.entries = DB.finance.entries.filter(e=>e.id !== lanc.id);
    registrarApagado('finance', lanc.id);
  }
  saveDB(); renderVendasTable();
  if(naoVoltou.length) toast('Venda cancelada.' + avisoDeEstoqueQueNaoVoltou(naoVoltou), 'warn');
  else toast('Venda cancelada — estoque devolvido');
}

/* =========================================================
   PERDAS E DEVOLUÇÕES
   Toda peça que sai da loja sem ser vendida (defeito, furto, extravio,
   brinde) e toda peça que volta (a cliente devolveu, trocou) fica
   registrada aqui: dia, horário, peça, quantidade, motivo, valor e quem
   registrou. Cada registro acerta o estoque, o Financeiro e o Caixa na
   mesma hora — e desfaz tudo se for excluído.
   ========================================================= */
const MOTIVOS_PERDA = ['Defeito de fábrica','Peça danificada na loja','Manchada ou suja','Furto','Extravio (não foi encontrada)','Uso interno ou brinde','Outro'];
const MOTIVOS_DEVOLUCAO = ['Não serviu (tamanho)','Defeito na peça','Cliente desistiu','Cor ou modelo diferente','Troca de presente','Outro'];
const REEMBOLSO_TROCA = 'Troca por outra peça (sem devolver dinheiro)';
const FORMAS_DE_REEMBOLSO = ['Dinheiro','PIX','Estorno no cartão', REEMBOLSO_TROCA];
let perdasFiltro = { periodo:'mes', tipo:'todos', busca:'' };

function registrosDePerdas(){
  if(!DB.perdas || typeof DB.perdas !== 'object') DB.perdas = { records: [] };
  if(!Array.isArray(DB.perdas.records)) DB.perdas.records = [];
  return DB.perdas.records;
}
const DIAS_DA_SEMANA = ['dom','seg','ter','qua','qui','sex','sáb'];
function diaBR(iso){ const d = new Date(iso); return isNaN(d) ? '-' : DIAS_DA_SEMANA[d.getDay()] + ', ' + d.toLocaleDateString('pt-BR'); }
function horaBR(iso){ const d = new Date(iso); return isNaN(d) ? '-' : d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }); }

/* Quanto de cada peça de uma venda já foi devolvido. */
function devolvidoDaVenda(saleId, item){
  return registrosDePerdas().filter(r=>r.tipo==='devolucao' && r.saleId===saleId
      && r.productId===item.productId && r.size===item.size && r.color===item.color)
    .reduce((a,r)=>a + (Number(r.qty)||0), 0);
}
function devolucoesDaVenda(saleId){
  return registrosDePerdas().filter(r=>r.tipo==='devolucao' && r.saleId===saleId);
}

/* Aplica (ou desfaz) o registro no estoque. A perda tira; a devolução,
   quando a peça volta em condição de venda, devolve. O registro guarda
   quanto mexeu DE VERDADE, para o desfazer ser exato e para a junção
   entre aparelhos não contar duas vezes. */
function aplicarMovimentoNoEstoque(r, sinal){
  const v = variacaoDoItem(r);
  if(!v) return;
  const tem = Math.max(0, Number(v.stock)||0);
  if(sinal > 0){
    if(r.tipo === 'perda'){ r.baixou = Math.min(Number(r.qty)||0, tem); v.stock = tem - r.baixou; }
    else if(r.voltaAoEstoque){ r.voltou = Number(r.qty)||0; v.stock = tem + r.voltou; }
  } else {
    if(r.tipo === 'perda') v.stock = tem + (Number(r.baixou)||0);
    else if(r.voltou) v.stock = Math.max(0, tem - (Number(r.voltou)||0));
  }
}

/* O dinheiro da devolução. Devolveu dinheiro: vira despesa no Financeiro
   e, se foi em dinheiro com o caixa aberto, sai da gaveta. Troca por
   outra peça não devolve dinheiro: o crédito entra como desconto na venda
   da peça nova. */
function devolveDinheiro(r){
  return r.tipo === 'devolucao' && (Number(r.valor)||0) > 0 && r.reembolso !== REEMBOLSO_TROCA;
}
function sincronizarDevolucaoNoFinanceiro(r, removendo){
  const vale = !removendo && devolveDinheiro(r);
  let lanc = r.financeId ? DB.finance.entries.find(e=>e.id === r.financeId) : DB.finance.entries.find(e=>e.perdaId === r.id);
  if(vale){
    if(!lanc){ lanc = { id:uid(), type:'despesa', origem:'devolucao', perdaId:r.id }; DB.finance.entries.push(lanc); }
    Object.assign(lanc, { type:'despesa', origem:'devolucao', perdaId:r.id, category:'Devolução', amount:Number(r.valor)||0,
      date:r.date, status:'pago', description:`Devolução — ${r.name} ${r.size}/${r.color} (${r.reembolso})` });
    carimbar(lanc);
    r.financeId = lanc.id;
  } else if(lanc){
    DB.finance.entries = DB.finance.entries.filter(e=>e.id !== lanc.id);
    registrarApagado('finance', lanc.id);
    delete r.financeId;
  }
  const cr = DB.cashRegister;
  const naGaveta = vale && r.reembolso === 'Dinheiro' && cr.open && new Date(r.date) >= new Date(cr.openedAt);
  const mov = cr.movements.find(m=>m.devolucaoId === r.id);
  if(naGaveta){
    if(mov){ mov.amount = Number(r.valor)||0; mov.date = r.date; }
    else cr.movements.push({ type:'sangria', amount:Number(r.valor)||0, note:'Devolução — ' + r.name, date:r.date, devolucaoId:r.id });
  } else if(mov){
    cr.movements = cr.movements.filter(m=>m !== mov);
  }
}

/* Os números do período, para a tela, o Painel e o Balanço. */
function resumoPerdas(casa){
  const r = { perdas:0, perdasPecas:0, perdasCusto:0, devolucoes:0, devPecas:0, devValor:0, devVoltaram:0, devCustoVoltou:0, devCustoPerdido:0 };
  registrosDePerdas().forEach(x=>{
    if(!casa(x.date)) return;
    const q = Number(x.qty)||0, custo = (Number(x.custoUnit)||0) * q;
    if(x.tipo === 'perda'){ r.perdas++; r.perdasPecas += q; r.perdasCusto += custo; }
    else {
      r.devolucoes++; r.devPecas += q; r.devValor += devolveDinheiro(x) ? (Number(x.valor)||0) : 0;
      if(x.voltaAoEstoque){ r.devVoltaram += q; r.devCustoVoltou += custo; } else r.devCustoPerdido += custo;
    }
  });
  return r;
}
function periodoDePerdas(){
  const inicioDeHoje = new Date(); inicioDeHoje.setHours(0,0,0,0);
  const mk = monthKey();
  switch(perdasFiltro.periodo){
    case 'hoje':  return { rotulo:'hoje', casa: d => new Date(d) >= inicioDeHoje };
    case '7dias': { const a = new Date(inicioDeHoje); a.setDate(a.getDate() - 6); return { rotulo:'últimos 7 dias', casa: d => new Date(d) >= a }; }
    case 'mes':   return { rotulo: monthLabel(mk), casa: d => chaveMes(d) === mk };
    case 'mesPassado': { const h = new Date(); const m = monthKey(new Date(h.getFullYear(), h.getMonth() - 1, 1));
                         return { rotulo: monthLabel(m), casa: d => chaveMes(d) === m }; }
    default: return { rotulo:'desde o começo', casa: () => true };
  }
}
function perdasFiltradas(){
  const per = periodoDePerdas();
  const f = perdasFiltro.busca.trim().toLowerCase();
  return registrosDePerdas()
    .filter(r=>per.casa(r.date))
    .filter(r=>perdasFiltro.tipo === 'todos' || r.tipo === perdasFiltro.tipo)
    .filter(r=>!f || [r.name, r.size, r.color, r.barcode, r.motivo, r.obs, r.usuario].some(t=>String(t||'').toLowerCase().includes(f)))
    .sort((a,b)=>new Date(b.date) - new Date(a.date));
}

function renderPerdas(el){
  const per = periodoDePerdas();
  const r = resumoPerdas(per.casa);
  el.innerHTML = `
    <div class="toolbar">
      <button class="btn btn-accent" onclick="openPerdaModal('perda')">+ Registrar perda</button>
      <button class="btn btn-gold" onclick="openPerdaModal('devolucao')">↩ Registrar devolução</button>
      <div class="spacer"></div>
      <select id="pdPeriodo">
        ${[['hoje','Hoje'],['7dias','Últimos 7 dias'],['mes','Este mês'],['mesPassado','Mês passado'],['tudo','Desde o começo']]
          .map(([v,t])=>`<option value="${v}" ${perdasFiltro.periodo===v?'selected':''}>${t}</option>`).join('')}
      </select>
      <select id="pdTipo">
        ${[['todos','Perdas e devoluções'],['perda','Só perdas'],['devolucao','Só devoluções']]
          .map(([v,t])=>`<option value="${v}" ${perdasFiltro.tipo===v?'selected':''}>${t}</option>`).join('')}
      </select>
      <input id="pdBusca" placeholder="Buscar peça, motivo, quem registrou..." value="${escapeHtml(perdasFiltro.busca)}">
    </div>
    <div class="cards-row">
      <div class="card"><div class="label">Perdas — ${escapeHtml(per.rotulo)}</div><div class="value ${r.perdasPecas?'text-danger':''}">${r.perdasPecas} <span class="unidade">peça(s)</span></div></div>
      <div class="card"><div class="label">Valor perdido (a custo)</div><div class="value ${r.perdasCusto + r.devCustoPerdido > 0 ? 'text-danger':''}">${money(r.perdasCusto + r.devCustoPerdido)}</div></div>
      <div class="card"><div class="label">Devoluções — ${escapeHtml(per.rotulo)}</div><div class="value">${r.devPecas} <span class="unidade">peça(s)</span></div></div>
      <div class="card"><div class="label">Dinheiro devolvido</div><div class="value">${money(r.devValor)}</div></div>
      <div class="card"><div class="label">Voltaram ao estoque</div><div class="value text-success">${r.devVoltaram} <span class="unidade">peça(s)</span></div></div>
    </div>
    <div id="perdasWrap"></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
      <button class="btn btn-sm" onclick="exportarPerdas()">⬇️ Baixar planilha (CSV)</button>
    </div>`;
  el.querySelector('#pdPeriodo').addEventListener('change', e=>{ perdasFiltro.periodo = e.target.value; renderPerdas(el); });
  el.querySelector('#pdTipo').addEventListener('change', e=>{ perdasFiltro.tipo = e.target.value; renderPerdas(el); });
  el.querySelector('#pdBusca').addEventListener('input', e=>{ perdasFiltro.busca = e.target.value; renderPerdasTable(); });
  renderPerdasTable();
}
function valorDoRegistro(r){
  return r.tipo === 'perda' ? (Number(r.custoUnit)||0) * (Number(r.qty)||0) : (Number(r.valor)||0);
}
function efeitoNoEstoqueTexto(r){
  if(r.tipo === 'perda'){
    return Number(r.baixou) === Number(r.qty) ? `<span class="badge badge-danger">saiu ${r.baixou}</span>`
         : `<span class="badge badge-warning" title="O sistema marcava menos peças do que a perda registrada">saiu ${Number(r.baixou)||0} de ${r.qty}</span>`;
  }
  return r.voltaAoEstoque ? `<span class="badge badge-success">voltou ${Number(r.voltou)||0}</span>`
                          : `<span class="badge badge-muted">não voltou</span>`;
}
function renderPerdasTable(){
  const wrap = document.getElementById('perdasWrap');
  if(!wrap) return;
  const lista = perdasFiltradas();
  if(!lista.length){
    wrap.innerHTML = `<div class="empty-state">${registrosDePerdas().length
      ? 'Nenhum registro neste filtro.'
      : 'Nenhuma perda ou devolução registrada ainda.<br>Use os botões acima: o estoque e o Financeiro são acertados na hora.'}</div>`;
    return;
  }
  wrap.innerHTML = `<div class="table-wrap"><table><thead><tr>
      <th>Dia</th><th>Horário</th><th>Tipo</th><th>Peça</th><th style="text-align:right">Qtd</th><th>Motivo</th>
      <th style="text-align:right">Valor</th><th>Estoque</th><th>Quem registrou</th><th></th>
    </tr></thead><tbody>
    ${lista.map(r=>`<tr>
      <td style="white-space:nowrap">${diaBR(r.date)}</td>
      <td>${horaBR(r.date)}</td>
      <td>${r.tipo==='perda' ? '<span class="badge badge-danger">Perda</span>' : '<span class="badge badge-gold">Devolução</span>'}</td>
      <td><strong>${escapeHtml(r.name)}</strong>
          <div class="text-muted" style="font-size:11.5px">${escapeHtml(r.size)}/${escapeHtml(r.color)}${r.barcode ? ' · ' + escapeHtml(r.barcode) : ''}</div></td>
      <td style="text-align:right">${r.qty}</td>
      <td>${escapeHtml(r.motivo||'-')}${r.obs ? `<div class="text-muted" style="font-size:11.5px">${escapeHtml(r.obs)}</div>` : ''}
          ${r.tipo==='devolucao' ? `<div class="text-muted" style="font-size:11.5px">${escapeHtml(r.reembolso||'')}${r.saleId ? ' · venda de ' + escapeHtml(dataDaVenda(r.saleId)) : ''}</div>` : ''}</td>
      <td style="text-align:right;white-space:nowrap">${money(valorDoRegistro(r))}
          <div class="text-muted" style="font-size:11px">${r.tipo==='perda' ? 'a custo' : (devolveDinheiro(r) ? 'devolvido' : 'crédito')}</div></td>
      <td>${efeitoNoEstoqueTexto(r)}</td>
      <td>${escapeHtml(r.usuario||'-')}</td>
      <td style="white-space:nowrap"><button class="btn btn-sm" onclick="openPerdaModal('${r.tipo}',{id:'${r.id}'})">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="excluirPerda('${r.id}')">Excluir</button></td>
    </tr>`).join('')}
  </tbody></table></div>`;
}
function dataDaVenda(saleId){
  const s = DB.sales.find(x=>x.id === saleId);
  return s ? dateBR(s.date) : 'venda apagada';
}

function excluirPerda(id){
  const r = registrosDePerdas().find(x=>x.id === id);
  if(!r) return;
  const oQue = r.tipo === 'perda' ? 'esta perda' : 'esta devolução';
  if(!confirm('Excluir ' + oQue + ' de ' + r.qty + ' × ' + r.name + '?\n\n' +
      (r.tipo === 'perda' ? (Number(r.baixou) ? 'As ' + r.baixou + ' peça(s) voltam para o estoque.' : 'O estoque não muda.')
                          : (r.voltou ? 'As ' + r.voltou + ' peça(s) saem do estoque de novo.' : 'O estoque não muda.')) +
      (devolveDinheiro(r) ? '\nA despesa de ' + money(r.valor) + ' sai do Financeiro.' : ''))) return;
  aplicarMovimentoNoEstoque(r, -1);
  sincronizarDevolucaoNoFinanceiro(r, true);
  DB.perdas.records = registrosDePerdas().filter(x=>x.id !== id);
  registrarApagado('perdas', id);
  if(exigirGravacao('a exclusão')){ toast('Registro excluído'); redesenhar(currentRoute === 'perdas' ? renderPerdas : null); renderVendasTable(); }
}

/* Planilha: abre no Excel e no Google Planilhas. Ponto e vírgula e
   vírgula decimal, que é como o Excel em português espera. */
/* O Excel executa como fórmula a célula que começa com = + - ou @. Uma
   observação "=1+1" (ou coisa pior) não pode rodar na planilha da loja. */
function textoSeguroNaPlanilha(v){
  const t = String(v == null ? '' : v);
  return /^[=+\-@\t\r]/.test(t) && !/^-?\d+([.,]\d+)?$/.test(t) ? "'" + t : t;
}
function exportarPerdas(){
  const lista = perdasFiltradas();
  if(!lista.length){ toast('Não há registros neste filtro','warn'); return; }
  const n = v => (Number(v)||0).toFixed(2).replace('.', ',');
  const c = v => '"' + textoSeguroNaPlanilha(v).replace(/"/g, '""') + '"';
  const linhas = [['Dia','Horário','Tipo','Peça','Tamanho','Cor','Código','Quantidade','Motivo','Observação','Valor (R$)',
                   'Custo unitário (R$)','Preço unitário (R$)','Estoque','Forma da devolução','Venda de origem','Cliente','Registrado por'].map(c).join(';')];
  lista.forEach(r=>linhas.push([
    new Date(r.date).toLocaleDateString('pt-BR'), horaBR(r.date), r.tipo === 'perda' ? 'Perda' : 'Devolução',
    r.name, r.size, r.color, r.barcode, r.qty, r.motivo, r.obs, n(valorDoRegistro(r)), n(r.custoUnit), n(r.precoUnit),
    r.tipo === 'perda' ? 'saiu ' + (Number(r.baixou)||0) : (r.voltaAoEstoque ? 'voltou ' + (Number(r.voltou)||0) : 'não voltou'),
    r.tipo === 'devolucao' ? r.reembolso : '', r.saleId ? dataDaVenda(r.saleId) : '',
    r.customerId ? customerName(r.customerId) : '', r.usuario
  ].map(c).join(';')));
  const blob = new Blob(['﻿' + linhas.join('\r\n')], { type:'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `perdas-e-devolucoes-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ a.remove(); URL.revokeObjectURL(a.href); }, 4000);
  toast(lista.length + ' registro(s) na planilha');
}

function openPerdaModal(tipo, pre){
  pre = pre || {};
  const editando = pre.id ? registrosDePerdas().find(r=>r.id === pre.id) : null;
  if(pre.id && !editando){ toast('Registro não encontrado','error'); return; }
  if(editando) tipo = editando.tipo;
  const ehDev = tipo === 'devolucao';
  const motivos = ehDev ? MOTIVOS_DEVOLUCAO : MOTIVOS_PERDA;
  /* A peça escolhida. Na edição ela é a do registro e não muda: trocar a
     peça de um registro é excluir e registrar de novo. */
  let escolhida = editando ? { productId:editando.productId, name:editando.name, size:editando.size, color:editando.color,
      barcode:editando.barcode, custoUnit:editando.custoUnit, precoUnit:editando.precoUnit, saleId:editando.saleId, customerId:editando.customerId } : null;
  const vendasRecentes = ehDev && !editando
    ? [...DB.sales].filter(s=>!s.canceled && s.status !== 'pendente').sort((a,b)=>new Date(b.date) - new Date(a.date)).slice(0, 80) : [];
  /* A devolução aberta pelo botão de uma venda antiga (fora das 80 mais
     recentes) abria sem a venda, e o vínculo se perdia sem aviso. */
  if(ehDev && !editando && pre.saleId && !vendasRecentes.some(s=>s.id === pre.saleId)){
    const origem = DB.sales.find(s=>s.id === pre.saleId && !s.canceled);
    if(origem) vendasRecentes.push(origem);
  }
  const dataOriginal = paraDatetimeLocal(editando ? editando.date : null);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal" style="max-width:620px">
    <h2>${editando ? 'Editar' : 'Registrar'} ${ehDev ? 'devolução' : 'perda'}</h2>
    ${editando ? '' : `
      ${ehDev ? `<div class="field"><label>Venda de origem (se souber)</label>
        <select id="pd_venda"><option value="">Não sei / sem venda</option>
          ${vendasRecentes.map(s=>`<option value="${escapeHtml(s.id)}" ${pre.saleId===s.id?'selected':''}>${dateBR(s.date)} — ${money(s.total)} — ${escapeHtml(s.items.map(i=>i.name).join(', ').slice(0, 60))}</option>`).join('')}
        </select></div>
        <div id="pd_itensDaVenda"></div>` : ''}
      <div class="field" style="margin-top:10px"><label>Peça — bipe o código ou digite o nome</label>
        <input id="pd_busca" placeholder="Ex.: 000057 ou conjunto canelado" autocomplete="off"></div>
      <div id="pd_resultados" class="pd-resultados"></div>`}
    <div id="pd_escolhida"></div>
    <div class="form-grid" style="margin-top:12px">
      <div class="field"><label>Quantidade</label>
        <input type="number" id="pd_qtd" min="1" step="1" inputmode="numeric" value="${editando ? editando.qty : 1}" ${editando ? 'disabled' : ''}></div>
      <div class="field"><label>Data e horário</label>
        <input type="datetime-local" id="pd_data" value="${paraDatetimeLocal(editando ? editando.date : todayISO())}"></div>
      <div class="field"><label>Motivo</label>
        <select id="pd_motivo">${motivos.map(m=>`<option ${editando && editando.motivo===m ? 'selected' : ''}>${escapeHtml(m)}</option>`).join('')}
          ${editando && editando.motivo && !motivos.includes(editando.motivo) ? `<option selected>${escapeHtml(editando.motivo)}</option>` : ''}</select></div>
      ${ehDev ? `
      <div class="field"><label>Como a loja devolve</label>
        <select id="pd_reembolso">${FORMAS_DE_REEMBOLSO.map(f=>`<option ${editando && editando.reembolso===f ? 'selected' : ''}>${escapeHtml(f)}</option>`).join('')}</select></div>
      <div class="field"><label id="pd_valorRotulo">Valor devolvido (R$)</label>
        <input type="number" id="pd_valor" min="0" step="0.01" inputmode="decimal" value="${editando ? (Number(editando.valor)||0) : ''}" placeholder="0,00"></div>
      <div class="field"><label><input type="checkbox" id="pd_volta" ${!editando || editando.voltaAoEstoque ? 'checked' : ''} ${editando ? 'disabled' : ''}> A peça volta para o estoque</label></div>` : ''}
      <div class="field full"><label>Observação (opcional)</label>
        <textarea id="pd_obs" rows="2" placeholder="${ehDev ? 'Ex.: cliente trouxe com a etiqueta' : 'Ex.: rasgou no provador'}">${escapeHtml(editando ? editando.obs||'' : '')}</textarea></div>
    </div>
    <div class="lucro-box" id="pd_resumo"></div>
    <div class="modal-actions">
      <button class="btn" id="pd_cancelar">Cancelar</button>
      <button class="btn btn-accent" id="pd_salvar">${editando ? 'Salvar' : 'Registrar'}</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  const q = s => overlay.querySelector(s);
  const fechar = ()=>overlay.remove();
  let valorMexidoNaMao = !!editando;

  function estoqueDaEscolhida(){
    if(!escolhida) return null;
    const p = DB.products.find(x=>x.id === escolhida.productId);
    const v = p && p.variations.find(v=>v.size === escolhida.size && v.color === escolhida.color);
    return v ? Math.max(0, Number(v.stock)||0) : null;
  }
  function atualizar(){
    const caixa = q('#pd_escolhida'), resumo = q('#pd_resumo');
    if(!escolhida){
      caixa.innerHTML = '';
      resumo.className = 'lucro-box'; resumo.innerHTML = '';
      return;
    }
    const tem = estoqueDaEscolhida();
    caixa.innerHTML = `<div class="pd-escolhida">
      <div><strong>${escapeHtml(escolhida.name)}</strong>
        <div class="text-muted" style="font-size:12px">${escapeHtml(escolhida.size)}/${escapeHtml(escolhida.color)}${escolhida.barcode ? ' · código ' + escapeHtml(escolhida.barcode) : ''}
        · ${tem === null ? 'não está mais no cadastro' : tem + ' no estoque'} · preço ${money(escolhida.precoUnit)} · custo ${money(escolhida.custoUnit)}</div></div>
      ${editando ? '' : '<button class="btn btn-sm" id="pd_trocar" type="button">Trocar</button>'}
    </div>`;
    q('#pd_trocar')?.addEventListener('click', ()=>{ escolhida = null; atualizar(); q('#pd_busca')?.focus(); });
    const qtd = Math.max(1, Number(q('#pd_qtd').value)||1);
    if(ehDev){
      const troca = q('#pd_reembolso').value === REEMBOLSO_TROCA;
      q('#pd_valorRotulo').textContent = troca ? 'Crédito para a outra peça (R$)' : 'Valor devolvido (R$)';
      const pagoPorPeca = escolhida.pagoUnit !== undefined ? Number(escolhida.pagoUnit)||0 : Number(escolhida.precoUnit)||0;
      if(!valorMexidoNaMao) q('#pd_valor').value = centavos(pagoPorPeca * qtd) || '';
      const valor = Number(q('#pd_valor').value)||0;
      const volta = q('#pd_volta').checked;
      resumo.className = 'lucro-box ' + (volta ? 'bom' : 'aviso');
      resumo.innerHTML = `<strong>${troca ? 'Crédito de ' + money(valor) + ' para outra peça' : 'Devolve ' + money(valor) + ' em ' + escapeHtml(q('#pd_reembolso').value)}</strong>
        <span>${volta ? (tem === null ? 'A peça não está mais no cadastro: o estoque não muda.' : 'A peça volta para o estoque: de ' + tem + ' para ' + (editando ? tem : tem + qtd) + '.')
                      : 'A peça não volta para o estoque: conta como perda de ' + money((Number(escolhida.custoUnit)||0) * qtd) + ' (custo).'}
        ${troca ? ' Nenhum dinheiro sai do caixa.' : ' Entra como despesa no Financeiro' + (q('#pd_reembolso').value === 'Dinheiro' && DB.cashRegister.open ? ' e sai da gaveta do caixa.' : '.')}</span>`;
    } else {
      const sai = tem === null ? 0 : Math.min(qtd, tem);
      resumo.className = 'lucro-box ruim';
      resumo.innerHTML = `<strong>Perda de ${money((Number(escolhida.custoUnit)||0) * qtd)} (a preço de custo)</strong>
        <span>${tem === null ? 'A peça não está mais no cadastro: o estoque não muda.'
               : editando ? 'O estoque já foi acertado quando a perda foi registrada.'
               : 'Estoque no sistema: de ' + tem + ' para ' + (tem - sai) + '.' + (sai < qtd ? ' O sistema marcava menos peças do que a perda.' : '')}
        ${Number(escolhida.custoUnit) ? '' : ' Esta peça está sem custo cadastrado, por isso o valor aparece zerado.'}</span>`;
    }
  }
  function escolher(p, v, extra){
    escolhida = Object.assign({ productId:p.id, name:p.name, size:v.size, color:v.color, barcode:v.barcode||'',
      custoUnit:Number(p.cost)||0, precoUnit:Number(p.price)||0, saleId:null, customerId:null }, extra || {});
    valorMexidoNaMao = false;
    const busca = q('#pd_busca'); if(busca){ busca.value = ''; }
    const res = q('#pd_resultados'); if(res) res.innerHTML = '';
    somDoBipe(true);
    atualizar();
  }
  function procurar(){
    const texto = q('#pd_busca').value.trim().toLowerCase();
    const res = q('#pd_resultados');
    if(!texto){ res.innerHTML = ''; return; }
    const achados = [];
    DB.products.forEach(p=>p.variations.forEach(v=>{
      if(achados.length >= 8) return;
      if(p.name.toLowerCase().includes(texto) || String(v.barcode||'').toLowerCase().includes(texto)
         || (v.color||'').toLowerCase().includes(texto) || (p.sku||'').toLowerCase().includes(texto)) achados.push({ p, v });
    }));
    res.innerHTML = achados.length ? achados.map((a,i)=>`<button type="button" class="pd-opcao" data-i="${i}">
        <strong>${escapeHtml(a.p.name)}</strong> <span class="text-muted">${escapeHtml(a.v.size)}/${escapeHtml(a.v.color)} · ${escapeHtml(a.v.barcode||'sem código')} · ${a.v.stock} em estoque</span>
      </button>`).join('') : '<div class="text-muted" style="font-size:12.5px;padding:6px 2px">Nenhuma peça com esse nome ou código.</div>';
    res.querySelectorAll('[data-i]').forEach(b=>b.addEventListener('click', e=>{
      const a = achados[Number(e.currentTarget.dataset.i)]; if(a) escolherPelaBusca(a.p, a.v);
    }));
  }
  /* O que a devolução herda da venda: o preço e o custo DAQUELA venda, a
     cliente, o limite (não se devolve mais do que foi vendido) e quanto a
     cliente pagou de verdade por peça — a venda com desconto não devolve
     o preço cheio. */
  function vinculoComAVenda(s, i, p){
    const soma = s.items.reduce((a,x)=>a + (Number(x.qty)||0) * (Number(x.price)||0), 0);
    const fator = soma > 0 ? Math.min(1, (Number(s.total)||0) / soma) : 1;
    return { name:i.name, custoUnit: i.cost !== undefined ? Number(i.cost)||0 : Number((p||{}).cost)||0, precoUnit:Number(i.price)||0,
             pagoUnit: (Number(i.price)||0) * fator,
             saleId:s.id, customerId:s.customerId || null, maximo: Math.max(0, Number(i.qty) - devolvidoDaVenda(s.id, i)) };
  }
  /* 6 — Bipar (ou procurar) a peça com uma venda escolhida: se a peça é
     dessa venda, continua ligada a ela; se não é, a venda sai do campo
     para a tela não mostrar um vínculo que o registro não vai ter. */
  function escolherPelaBusca(p, v){
    const campoVenda = q('#pd_venda');
    const s = campoVenda && campoVenda.value ? DB.sales.find(x=>x.id === campoVenda.value) : null;
    if(s){
      const i = s.items.find(i=>i.productId === p.id && i.size === v.size && i.color === v.color
                                && Number(i.qty) - devolvidoDaVenda(s.id, i) > 0);
      if(i){ escolher(p, v, vinculoComAVenda(s, i, p)); q('#pd_qtd').value = 1; atualizar(); return; }
      campoVenda.value = '';
      mostrarItensDaVenda();
      toast('Esta peça não está na venda escolhida (ou já foi toda devolvida). A devolução fica sem venda de origem.','warn');
    }
    escolher(p, v);
  }
  function mostrarItensDaVenda(){
    const caixa = q('#pd_itensDaVenda');
    if(!caixa) return;
    const s = DB.sales.find(x=>x.id === q('#pd_venda').value);
    if(!s){ caixa.innerHTML = ''; return; }
    caixa.innerHTML = `<div class="pd-resultados" style="margin-top:8px">${s.items.map((i,idx)=>{
      const ja = devolvidoDaVenda(s.id, i), resta = Math.max(0, Number(i.qty) - ja);
      return `<button type="button" class="pd-opcao" data-item="${idx}" ${resta ? '' : 'disabled'}>
        <strong>${escapeHtml(i.name)}</strong> <span class="text-muted">${escapeHtml(i.size)}/${escapeHtml(i.color)} · ${i.qty} × ${money(i.price)}${ja ? ' · já devolvida: ' + ja : ''}</span></button>`;
    }).join('')}</div>`;
    caixa.querySelectorAll('[data-item]').forEach(b=>b.addEventListener('click', e=>{
      const i = s.items[Number(e.currentTarget.dataset.item)];
      const p = DB.products.find(x=>x.id === i.productId) || { id:i.productId, name:i.name, cost:i.cost, price:i.price };
      const v = (p.variations||[]).find(v=>v.size === i.size && v.color === i.color) || { size:i.size, color:i.color, barcode:'' };
      escolher(p, v, vinculoComAVenda(s, i, p));
      q('#pd_qtd').value = 1;
      atualizar();
    }));
    if(s.items.length === 1 && !escolhida) caixa.querySelector('[data-item]:not([disabled])')?.click();
  }

  q('#pd_cancelar').addEventListener('click', fechar);
  q('#pd_busca')?.addEventListener('input', procurar);
  q('#pd_busca')?.addEventListener('keydown', e=>{
    if(e.key !== 'Enter') return;
    e.preventDefault();
    const texto = q('#pd_busca').value.trim();
    const achado = findVariationByBarcode(texto) || acharCodigoNoFim(texto);
    if(achado) escolherPelaBusca(achado.product, achado.variation);
    else { const unica = q('#pd_resultados').querySelectorAll('[data-i]'); if(unica.length === 1) unica[0].click(); else somDoBipe(false); }
  });
  q('#pd_venda')?.addEventListener('change', ()=>{ escolhida = null; mostrarItensDaVenda(); atualizar(); });
  ['#pd_qtd','#pd_reembolso','#pd_volta'].forEach(s=>q(s)?.addEventListener('input', atualizar));
  q('#pd_valor')?.addEventListener('input', ()=>{ valorMexidoNaMao = true; atualizar(); });

  q('#pd_salvar').addEventListener('click', ()=>{
    if(!escolhida){ toast('Escolha a peça: bipe o código ou digite o nome','error'); q('#pd_busca')?.focus(); return; }
    const qtd = Math.floor(Number(q('#pd_qtd').value)||0);
    if(qtd < 1){ toast('A quantidade precisa ser 1 ou mais','error'); return; }
    if(!editando && escolhida.maximo !== undefined && qtd > escolhida.maximo){
      toast('Essa venda só tem ' + escolhida.maximo + ' dessa peça para devolver','error'); return;
    }
    const dataDigitada = q('#pd_data').value;
    const data = dataDigitada && !isNaN(new Date(dataDigitada)) ? new Date(dataDigitada).toISOString() : todayISO();
    if(new Date(data) > new Date(Date.now() + 5 * 60000)){ toast('A data não pode ser no futuro','error'); return; }
    const valor = ehDev ? Math.round((Number(q('#pd_valor').value)||0) * 100) / 100 : 0;
    if(ehDev && valor < 0){ toast('O valor não pode ser negativo','error'); return; }

    if(editando){
      Object.assign(editando, { motivo:q('#pd_motivo').value, obs:q('#pd_obs').value.trim() });
      if(dataDigitada !== dataOriginal) editando.date = data;
      if(ehDev) Object.assign(editando, { valor, reembolso:q('#pd_reembolso').value });
      carimbar(editando);
      sincronizarDevolucaoNoFinanceiro(editando);
      if(exigirGravacao('a alteração')){ fechar(); toast('Registro atualizado'); redesenhar(currentRoute === 'perdas' ? renderPerdas : null); }
      return;
    }

    const r = carimbar({
      id:uid(), tipo, date:data, registradoEm:todayISO(),
      productId:escolhida.productId, name:escolhida.name, size:escolhida.size, color:escolhida.color, barcode:escolhida.barcode,
      qty:qtd, motivo:q('#pd_motivo').value, obs:q('#pd_obs').value.trim(),
      custoUnit:Number(escolhida.custoUnit)||0, precoUnit:Number(escolhida.precoUnit)||0,
      usuario: SESSION ? SESSION.name : '-', usuarioId: SESSION ? SESSION.id : null
    });
    if(ehDev) Object.assign(r, { valor, reembolso:q('#pd_reembolso').value, voltaAoEstoque:q('#pd_volta').checked,
                                 saleId:escolhida.saleId || null, customerId:escolhida.customerId || null });
    const antes = JSON.stringify({ cr: DB.cashRegister.movements, fin: DB.finance.entries.length });
    aplicarMovimentoNoEstoque(r, +1);
    sincronizarDevolucaoNoFinanceiro(r);
    registrosDePerdas().push(r);
    if(!exigirGravacao(ehDev ? 'esta devolução' : 'esta perda')){
      aplicarMovimentoNoEstoque(r, -1);
      sincronizarDevolucaoNoFinanceiro(r, true);
      DB.perdas.records = registrosDePerdas().filter(x=>x.id !== r.id);
      return;
    }
    fechar();
    if(ehDev && r.reembolso === REEMBOLSO_TROCA && valor > 0){
      toast('Devolução registrada. Toque aqui para vender a peça nova com ' + money(valor) + ' de crédito.', 'ok', ()=>{
        pdvDiscount = valor; navigate('pdv');
      });
    } else toast(ehDev ? 'Devolução registrada' : 'Perda registrada');
    redesenhar(currentRoute === 'perdas' ? renderPerdas : null);
    renderVendasTable();
  });

  if(ehDev && !editando) mostrarItensDaVenda();
  atualizar();
  (q('#pd_busca') || q('#pd_motivo')).focus();
}

/* =========================================================
   CAIXA
   ========================================================= */
/* Vendas que passaram pelo caixa desde que ele abriu. O pedido da loja
   virtual não passa pela gaveta: ele é pago por PIX na conta e conferido
   na tela de Vendas. Entrava aqui como se fosse dinheiro do balcão. */
function vendasDoCaixa(cr){
  if(!cr || !cr.open) return [];
  const desde = new Date(cr.openedAt);
  return DB.sales.filter(s=>vendaValida(s) && s.origin !== 'loja' && new Date(s.date) >= desde);
}
function renderCaixa(el){
  const cr = DB.cashRegister;
  const salesInSession = vendasDoCaixa(cr);
  const byPay = {};
  salesInSession.forEach(s=>{ byPay[s.payment]=(byPay[s.payment]||0)+s.total; });
  const dinheiro = salesInSession.filter(s=>/dinheiro/i.test(s.payment)).reduce((a,s)=>a+s.total,0);
  const reforcos = cr.movements.filter(m=>m.type==='reforco').reduce((a,m)=>a+Number(m.amount||0),0);
  const sangrias = cr.movements.filter(m=>m.type==='sangria').reduce((a,m)=>a+Number(m.amount||0),0);
  const naGaveta = Number(cr.openingAmount||0) + dinheiro + reforcos - sangrias;
  el.innerHTML = `
    <div class="panel">
      <h3>Status do caixa</h3>
      ${cr.open ? `
        <p>Caixa <strong class="text-success">aberto</strong> desde ${dateBR(cr.openedAt)} — valor inicial ${money(cr.openingAmount)}</p>
        <div class="cards-row" style="margin-top:14px;margin-bottom:0">
          <div class="card"><div class="label">Vendas nesta sessão</div><div class="value">${salesInSession.length}</div></div>
          <div class="card"><div class="label">Total vendido</div><div class="value">${money(salesInSession.reduce((a,s)=>a+s.total,0))}</div></div>
          <div class="card"><div class="label">Dinheiro na gaveta (esperado)</div><div class="value">${money(naGaveta)}</div></div>
        </div>
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
        ${Object.keys(byPay).length ? Object.entries(byPay).map(([k,v])=>`<tr><td>${escapeHtml(k)}</td><td>${money(v)}</td></tr>`).join('') : '<tr><td colspan="2">Nenhuma venda nesta sessão</td></tr>'}
      </tbody></table></div>
      <h3 style="margin-top:18px">Movimentações</h3>
      <div class="table-wrap"><table><thead><tr><th>Tipo</th><th>Valor</th><th>Obs</th><th>Data</th></tr></thead><tbody>
        ${cr.movements.length ? cr.movements.map(m=>`<tr><td>${m.type==='sangria'?'➖ Sangria':'➕ Reforço'}</td><td>${money(m.amount)}</td><td>${escapeHtml(m.note||'-')}</td><td>${dateBR(m.date)}</td></tr>`).join('') : '<tr><td colspan="4">Nenhuma movimentação</td></tr>'}
      </tbody></table></div>
    </div>` : ''}
    ${cr.closedHistory.length ? `<div class="panel">
      <h3>Últimos fechamentos</h3>
      <div class="table-wrap"><table><thead><tr><th>Aberto em</th><th>Fechado em</th><th>Valor inicial</th><th>Total vendido</th><th>Dinheiro na gaveta</th><th>Fechado por</th></tr></thead><tbody>
        ${[...cr.closedHistory].sort((a,b)=>new Date(b.closedAt) - new Date(a.closedAt)).slice(0, 15).map(h=>`<tr>
          <td>${dateBR(h.openedAt)}</td><td>${dateBR(h.closedAt)}</td><td>${money(h.openingAmount)}</td><td>${money(h.totalSales)}</td>
          <td>${h.naGaveta === undefined ? '-' : money(h.naGaveta)}</td><td>${escapeHtml(h.fechadoPor||'-')}</td></tr>`).join('')}
      </tbody></table></div>
    </div>` : ''}`;
}
function openCashRegister(){
  const amount = Number(document.getElementById('openAmount').value)||0;
  DB.cashRegister = { open:true, openedAt: todayISO(), openingAmount: Math.max(0, centavos(amount)), movements:[], closedHistory: DB.cashRegister.closedHistory };
  saveDB(); renderCaixa(document.getElementById('view')); toast('Caixa aberto');
}
function closeCashRegister(){
  if(!confirm('Fechar o caixa?')) return;
  const cr = DB.cashRegister;
  const salesInSession = vendasDoCaixa(cr);
  const total = centavos(salesInSession.reduce((a,s)=>a+s.total,0));
  const dinheiro = salesInSession.filter(s=>/dinheiro/i.test(s.payment)).reduce((a,s)=>a+s.total,0);
  const reforcos = cr.movements.filter(m=>m.type==='reforco').reduce((a,m)=>a+Number(m.amount||0),0);
  const sangrias = cr.movements.filter(m=>m.type==='sangria').reduce((a,m)=>a+Number(m.amount||0),0);
  const porForma = {};
  salesInSession.forEach(s=>{ porForma[s.payment] = centavos((porForma[s.payment]||0) + s.total); });
  cr.closedHistory.push({ openedAt:cr.openedAt, closedAt: todayISO(), openingAmount:cr.openingAmount, totalSales: total,
    vendas: salesInSession.length, porForma, dinheiro: centavos(dinheiro), reforcos: centavos(reforcos), sangrias: centavos(sangrias),
    naGaveta: centavos(Number(cr.openingAmount||0) + dinheiro + reforcos - sangrias),
    fechadoPor: SESSION ? SESSION.name : '-', movements: cr.movements });
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
    if(type === 'sangria'){
      const cr = DB.cashRegister;
      const dinheiro = vendasDoCaixa(cr).filter(s=>/dinheiro/i.test(s.payment)).reduce((a,s)=>a+s.total,0);
      const naGaveta = Number(cr.openingAmount||0) + dinheiro
        + cr.movements.reduce((a,m)=>a + (m.type==='reforco' ? 1 : -1) * Number(m.amount||0), 0);
      if(amount > naGaveta + 0.004 && !confirm('A sangria (' + money(amount) + ') é maior que o dinheiro que o sistema espera na gaveta (' + money(naGaveta) + ').\n\nRegistrar mesmo assim?')) return;
    }
    DB.cashRegister.movements.push({ id:uid(), type, amount: centavos(amount), note: overlay.querySelector('#m_note').value.trim(), date: todayISO() });
    saveDB(); overlay.remove(); renderCaixa(document.getElementById('view'));
    toast('Movimentação registrada');
  });
}

/* =========================================================
   FINANCEIRO
   ========================================================= */
function renderFinanceiro(el){
  const mk = monthKey();
  const monthEntries = DB.finance.entries.filter(e=>chaveMes(e.date) === mk);
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
  const e = DB.finance.entries.find(x=>x.id===id);
  if(!e) return;
  e.status='pago'; e.date=todayISO(); carimbar(e);
  saveDB(); renderFinanceTable(); toast('Lançamento marcado como pago');
}
function deleteFinanceEntry(id){
  const e = DB.finance.entries.find(x=>x.id===id);
  if(!e) return;
  const venda = e.origem === 'venda' || /^(Venda|Pedido online) #/.test(e.description||'');
  if(!confirm('Excluir este lançamento?' + (venda ? '\n\nEle é a receita de uma venda. A venda continua no histórico; para desfazê-la use Cancelar em Vendas.' : ''))) return;
  DB.finance.entries = DB.finance.entries.filter(x=>x.id!==id);
  registrarApagado('finance', id);
  saveDB(); renderFinanceTable(); toast('Lançamento excluído');
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
    if(editing){ Object.assign(editing, data); carimbar(editing); }
    else DB.finance.entries.push(carimbar({ ...e, ...data, date: todayISO() }));
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
  el.querySelector('#gastosMonthInput').addEventListener('change', e=>{
    /* Campo de mês apagado, ou digitado à mão onde o navegador não tem o
       seletor (10/2026): lançar gasto assim criava registro num mês que
       não existe, e ele sumia de todas as telas. */
    let mes = String(e.target.value||'').trim();
    const br = mes.match(/^(\d{1,2})[\/\-](\d{4})$/);
    if(br) mes = br[2] + '-' + br[1].padStart(2,'0');
    if(/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) gastosMonth = mes;
    else toast('Mês inválido. Escolha o mês no campo (ex.: 2026-10).','warn');
    renderGastos(el);
  });
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
  registrarApagado('fixed', id);
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
  if(!records.length){ wrap.innerHTML = `<div class="empty-state">Nenhum gasto lançado em ${monthLabel(gastosMonth)}. Categorias sugeridas: ${escapeHtml(DB.monthlyExpenses.categories.join(', '))}.</div>`; return; }
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
    const nome = name.trim();
    if(DB.monthlyExpenses.categories.some(c=>c.toLowerCase() === nome.toLowerCase())){ toast('Essa categoria já existe','warn'); return; }
    DB.monthlyExpenses.categories.push(nome);
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
    let alvo = editing;
    if(editing){
      Object.assign(editing, data);
    } else {
      alvo = { ...r, ...data, paidDate: status==='pago'?todayISO():null };
      DB.monthlyExpenses.records.push(alvo);
    }
    carimbar(alvo);
    sincronizarGastoNoFinanceiro(alvo);
    saveDB(); overlay.remove(); renderGastos(document.getElementById('view'));
    toast('Gasto salvo');
  });
}
/* O gasto mensal e o lançamento dele no Financeiro são um só. Antes eles
   se soltavam: editar o valor do gasto deixava o Financeiro com o valor
   velho, voltar para "pendente" mantinha a despesa paga, e excluir o gasto
   deixava o lançamento órfão. Um lugar só acerta os dois. */
function lancamentoDoGasto(r){
  const lista = DB.finance.entries;
  if(r.financeId){ const l = lista.find(e=>e.id === r.financeId); if(l) return l; }
  return lista.find(e=>e.gastoId === r.id) || null;
}
function sincronizarGastoNoFinanceiro(r){
  let lanc = lancamentoDoGasto(r);
  if(r.status === 'pago'){
    if(!r.paidDate) r.paidDate = todayISO();
    if(!lanc){
      lanc = { id:uid(), type:'despesa', origem:'gasto', gastoId:r.id, category:`Gasto mensal — ${r.category}`,
               amount:r.amount, date: r.paidDate, status:'pago', description: r.note||r.category };
      DB.finance.entries.push(lanc);
    } else {
      lanc.category = `Gasto mensal — ${r.category}`; lanc.amount = r.amount;
      lanc.description = r.note||r.category; lanc.status = 'pago'; lanc.origem = 'gasto'; lanc.gastoId = r.id;
    }
    carimbar(lanc);
    r.financeId = lanc.id;
  } else {
    r.paidDate = null;
    if(lanc){
      DB.finance.entries = DB.finance.entries.filter(e=>e.id !== lanc.id);
      registrarApagado('finance', lanc.id);
    }
    delete r.financeId;
  }
}
function markGastoPaid(id){
  const r = DB.monthlyExpenses.records.find(x=>x.id===id);
  if(!r) return;
  r.status='pago'; r.paidDate=todayISO(); carimbar(r);
  sincronizarGastoNoFinanceiro(r);
  saveDB(); redesenhar(renderGastos); toast('Gasto marcado como pago e lançado no Financeiro');
}
function deleteGasto(id){
  const r = DB.monthlyExpenses.records.find(x=>x.id===id);
  if(!r) return;
  if(!confirm('Excluir este gasto?' + (r.status==='pago' ? '\n\nO lançamento dele no Financeiro sai junto.' : ''))) return;
  const lanc = lancamentoDoGasto(r);
  if(lanc){
    DB.finance.entries = DB.finance.entries.filter(e=>e.id !== lanc.id);
    registrarApagado('finance', lanc.id);
  }
  DB.monthlyExpenses.records = DB.monthlyExpenses.records.filter(x=>x.id!==id);
  registrarApagado('records', id);
  saveDB(); redesenhar(renderGastos); toast('Gasto excluído');
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
    if(data.planned < 0 || data.paid < 0){ toast('Valores não podem ser negativos','error'); return; }
    if(editing){ Object.assign(editing, data); carimbar(editing); acertarAberturaNoFinanceiro(editing); }
    else DB.storeSetup.items.push(carimbar({ id:i.id, ...data }));
    saveDB(); overlay.remove(); renderAbrirLoja(document.getElementById('view'));
    toast('Custo salvo');
  });
}
/* As despesas que o "Marcar pago" lançou no Financeiro para este item não
   podem somar mais do que o item diz ter pago. Voltar o "pago" para zero
   e marcar pago de novo lançava a mesma despesa duas vezes. */
function lancamentosDaAbertura(id){
  return DB.finance.entries.filter(e=>e.origem === 'abertura' && e.setupId === id);
}
function acertarAberturaNoFinanceiro(item){
  let sobra = lancamentosDaAbertura(item.id).reduce((a,e)=>a + (Number(e.amount)||0), 0) - (Number(item.paid)||0);
  if(sobra <= 0.004) return;
  lancamentosDaAbertura(item.id).sort((a,b)=>new Date(b.date) - new Date(a.date)).forEach(e=>{
    if(sobra <= 0.004) return;
    const valor = Number(e.amount)||0;
    if(valor <= sobra + 0.004){
      DB.finance.entries = DB.finance.entries.filter(x=>x.id !== e.id);
      registrarApagado('finance', e.id);
      sobra -= valor;
    } else { e.amount = centavos(valor - sobra); carimbar(e); sobra = 0; }
  });
}
function markSetupPaid(id){
  const i = DB.storeSetup.items.find(x=>x.id===id);
  if(!i) return;
  const faltava = Math.max(0, Number(i.planned||0) - Number(i.paid||0));
  i.paid = i.planned; carimbar(i);
  /* O que entra no Financeiro é só o que faltava pagar: o item já
     parcialmente pago lançava o valor cheio de novo. */
  if(faltava > 0){
    DB.finance.entries.push(carimbar({ id:uid(), type:'despesa', origem:'abertura', setupId:i.id, category:`Abertura — ${i.category}`, amount:faltava, date:todayISO(), status:'pago', description:i.name }));
  }
  saveDB(); redesenhar(renderAbrirLoja); toast('Marcado como pago');
}
function deleteSetup(id){
  if(!confirm('Excluir este item?')) return;
  /* A despesa que o item lançou no Financeiro sai junto. */
  lancamentosDaAbertura(id).forEach(e=>{
    DB.finance.entries = DB.finance.entries.filter(x=>x.id !== e.id);
    registrarApagado('finance', e.id);
  });
  DB.storeSetup.items = DB.storeSetup.items.filter(i=>i.id!==id);
  registrarApagado('setup', id);
  saveDB(); redesenhar(renderAbrirLoja);
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
  const valid = DB.sales.filter(vendaValida);
  if(!valid.length) return 0;
  return valid.reduce((a,s)=>a+s.total,0)/valid.length;
}
function topProductsTable(){
  const map={};
  DB.sales.filter(vendaValida).forEach(s=>s.items.forEach(i=>{ map[i.name]=(map[i.name]||0)+i.qty; }));
  const list = Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,6);
  if(!list.length) return `<div class="empty-state">Sem dados</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Produto</th><th>Qtd. vendida</th></tr></thead><tbody>
    ${list.map(([n,q])=>`<tr><td>${escapeHtml(n)}</td><td>${q}</td></tr>`).join('')}
  </tbody></table></div>`;
}
function byPaymentTable(){
  const map={};
  DB.sales.filter(vendaValida).forEach(s=>{ map[s.payment]=(map[s.payment]||0)+s.total; });
  const entries = Object.entries(map);
  if(!entries.length) return `<div class="empty-state">Sem dados</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Forma</th><th>Total</th></tr></thead><tbody>
    ${entries.map(([k,v])=>`<tr><td>${escapeHtml(k)}</td><td>${money(v)}</td></tr>`).join('')}
  </tbody></table></div>`;
}
function bySellerTable(){
  const map={};
  DB.sales.filter(vendaValida).forEach(s=>{ map[s.seller]=(map[s.seller]||0)+s.total; });
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
    const total = DB.sales.filter(s=>vendaValida(s) && new Date(s.date)>=d && new Date(s.date)<next).reduce((a,s)=>a+s.total,0);
    days.push({ label: d.toLocaleDateString('pt-BR',{weekday:'short'}), total });
  }
  return days;
}
function drawBarChart(canvasId, data){
  const canvas = document.getElementById(canvasId);
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  /* Desenha em alta resolução: no celular o gráfico saía borrado. */
  const escala = window.devicePixelRatio || 1;
  /* A largura é a da caixa onde o gráfico mora. Medir o próprio canvas
     devolvia os 300 px de fábrica: gráfico espremido no computador e
     esticado no celular. */
  const caixa = canvas.parentElement;
  const folga = caixa ? (parseFloat(getComputedStyle(caixa).paddingLeft)||0) + (parseFloat(getComputedStyle(caixa).paddingRight)||0) : 0;
  const w = Math.max(240, Math.floor(((caixa && caixa.clientWidth) || canvas.clientWidth || 600) - folga)), h = 180;
  canvas.width = w * escala; canvas.height = h * escala;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(escala, escala);
  ctx.clearRect(0,0,w,h);
  const max = Math.max(...data.map(d=>d.total), 1);
  const barW = w/data.length;
  const topo = 26, base = h - 26, alturaUtil = base - topo;
  ctx.strokeStyle = '#E6E6EB'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, base + .5); ctx.lineTo(w, base + .5); ctx.stroke();
  data.forEach((d,i)=>{
    const bh = Math.max(d.total > 0 ? 3 : 0, (d.total/max)*alturaUtil);
    const x = i*barW + barW*0.22, largura = barW*0.56, y = base - bh;
    const grad = ctx.createLinearGradient(0, y, 0, base);
    grad.addColorStop(0, '#E0668C'); grad.addColorStop(1, '#D3466F');
    ctx.fillStyle = grad;
    const r = Math.min(6, largura/2, bh);
    ctx.beginPath();
    ctx.moveTo(x, base); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.lineTo(x + largura - r, y); ctx.quadraticCurveTo(x + largura, y, x + largura, y + r);
    ctx.lineTo(x + largura, base); ctx.closePath(); ctx.fill();
    ctx.textAlign = 'center';
    if(d.total > 0){
      ctx.fillStyle = '#17171C'; ctx.font = '600 11px Inter, sans-serif';
      ctx.fillText(money(d.total).replace(/\u00a0/g,' '), i*barW+barW/2, y - 7);
    }
    ctx.fillStyle = '#8A8A99'; ctx.font = '500 11px Inter, sans-serif';
    ctx.fillText(d.label.replace('.', ''), i*barW+barW/2, h - 8);
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
        <div class="field" style="margin-top:12px"><label>Recibo ao finalizar a venda</label>
          <select id="cfg_recibo">
            <option value="mostrar" ${reciboAoFinalizar()==='mostrar'?'selected':''}>Mostrar o recibo com o botão Imprimir (padrão)</option>
            <option value="imprimir" ${reciboAoFinalizar()==='imprimir'?'selected':''}>Imprimir o recibo sozinho, em toda venda</option>
            <option value="pdf" ${reciboAoFinalizar()==='pdf'?'selected':''}>Gerar o PDF do recibo sozinho</option>
          </select>
          <div class="text-muted" style="font-size:12px;margin-top:4px">O botão "Finalizar e imprimir recibo" do PDV imprime sempre. O endereço, o telefone (WhatsApp) e o CNPJ do cadastro fiscal saem no cabeçalho.</div></div>
        <button class="btn btn-accent" style="margin-top:14px" id="saveStoreBtn">Salvar</button>
      </div>
      <div class="panel">
        <h3>Loja virtual</h3>
        <div class="field"><label>WhatsApp (com DDD)</label><input id="cfg_whats" value="${escapeHtml(DB.config.whatsapp)}" placeholder="5511999999999"></div>
        <div class="field" style="margin-top:10px"><label>Chave PIX</label><input id="cfg_pix" value="${escapeHtml(DB.config.pixKey)}"></div>
        <div class="field" style="margin-top:10px"><label>Endereço</label><input id="cfg_address" value="${escapeHtml(DB.config.address)}"></div>
        <div class="field" style="margin-top:10px"><label>Frase do topo</label><input id="cfg_phrase" value="${escapeHtml(DB.config.heroPhrase)}"></div>
        <button class="btn btn-accent" style="margin-top:14px" id="saveOnlineBtn">Salvar</button>
        <p class="text-muted" style="font-size:12px;margin-top:10px">${(String(DB.config.pixKey||'').trim() || String(DB.config.whatsapp||'').replace(/\D/g,''))
          ? 'A loja virtual está recebendo pedidos.'
          : 'Sem chave PIX e sem WhatsApp, a loja virtual funciona só como <strong>vitrine</strong>: mostra as peças, mas não aceita pedido. Preencha um dos dois para vender pelo site.'}</p>
      </div>
    </div>
    <div class="panel">
      <h3>🧾 Cupom fiscal (NFC-e)</h3>
      <p class="text-muted" style="font-size:12.5px;margin-bottom:12px">
        O cupom fiscal é emitido pela <strong>Focus NFe</strong> a partir do site publicado. O que é da loja
        (CNPJ, NCM, tributação) fica aqui e vale em todos os aparelhos; a <strong>chave de emissão</strong> fica só
        neste aparelho e precisa ser a mesma que está no Vercel (FISCAL_SENHA).</p>
      <div class="form-grid">
        <div class="field"><label>CNPJ da loja</label><input id="fx_cnpj" value="${escapeHtml(configFiscal().cnpj)}" inputmode="numeric" placeholder="00.000.000/0001-00"></div>
        <div class="field"><label>Chave de emissão (só neste aparelho)</label><input id="fx_chave" type="password" value="${escapeHtml(configFiscal().chave)}" autocomplete="off"></div>
        <div class="field"><label>NCM padrão das peças</label><input id="fx_ncm" value="${escapeHtml(configFiscal().ncmPadrao)}" inputmode="numeric" placeholder="61091000"></div>
        <div class="field"><label>CFOP</label><input id="fx_cfop" value="${escapeHtml(configFiscal().cfop)}" inputmode="numeric"></div>
        <div class="field"><label>CSOSN (Simples Nacional)</label><input id="fx_csosn" value="${escapeHtml(configFiscal().csosn)}" inputmode="numeric"></div>
        <div class="field"><label>CST PIS/COFINS</label><input id="fx_pis" value="${escapeHtml(configFiscal().pisCofins)}" inputmode="numeric"></div>
        <div class="field"><label>Série (vazio = padrão do provedor)</label><input id="fx_serie" value="${escapeHtml(configFiscal().serie)}" inputmode="numeric"></div>
        <div class="field"><label><input type="checkbox" id="fx_ativo" ${configFiscal().ativo?'checked':''}> Ativar cupom fiscal nas vendas</label></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button class="btn btn-accent" id="saveFiscalBtn">Salvar</button>
        <button class="btn" onclick="testarCupomFiscal()">Testar ligação fiscal</button>
      </div>
      <div id="diagnosticoFiscal" style="margin-top:12px"></div>
      <p class="text-muted" style="font-size:12px;margin-top:12px">
        NCM 61091000 é camiseta/regata de malha; vestidos de malha 61044200; blusas de tecido 62063000; calças de malha 61046200.
        Confirme os códigos e a tributação com o contador: eles definem o imposto do cupom. Peça a peça, o NCM pode ser trocado em Produtos → Mais opções.</p>
    </div>

    <div class="panel">
      <h3>Usuários</h3>
      <div id="usersWrap"></div>
      <button class="btn" style="margin-top:10px" onclick="openUserModal()">+ Novo usuário</button>
    </div>
    <div class="panel">
      <h3>Backup</h3>
      <button class="btn btn-accent" onclick="exportBackup()">⬇️ Baixar backup completo (produtos, vendas e fotos)</button>
      <label class="btn" style="display:inline-block;margin-left:8px">⬆️ Importar JSON<input type="file" id="importFile" accept=".json" style="display:none"></label>
      <p class="text-muted" style="font-size:12.5px;margin-top:12px">
        Exporte de vez em quando e guarde o arquivo. É a única cópia que não depende
        deste aparelho nem da internet.</p>
    </div>

    <div class="panel">
      <h3>☁️ Ligação com a nuvem (Supabase)</h3>
      <p class="text-muted" style="font-size:12.5px;margin-bottom:12px">
        É aqui que os dados da loja ficam guardados e são compartilhados entre os aparelhos.
        Para usar um projeto novo, crie-o em supabase.com, rode o SQL abaixo e cole o endereço
        e a chave aqui. Fica guardado só neste aparelho.</p>
      <div class="form-grid">
        <div class="field full"><label>Endereço do projeto</label>
          <input id="nv_url" value="${escapeHtml(configNuvem().url)}" placeholder="https://abcdefgh.supabase.co"></div>
        <div class="field full"><label>Chave publicável (Publishable / anon)</label>
          <input id="nv_key" value="${escapeHtml(configNuvem().key)}" placeholder="sb_publishable_..."></div>
        <div class="field"><label>Nome da tabela</label>
          <input id="nv_tabela" value="${escapeHtml(configNuvem().tabela)}"></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button class="btn btn-accent" onclick="conectarNuvem()">Testar e ligar</button>
        <button class="btn" onclick="testarNuvem()">Testar conexão atual</button>
        <button class="btn" onclick="enviarTudoParaNuvem()">Enviar os dados daqui para a nuvem</button>
      </div>
      <div id="estadoDaNuvem" style="margin-top:12px"></div>
      <div id="resultadoConexao" style="margin-top:12px"></div>
      <div id="diagnosticoNuvem" style="margin-top:12px"></div>

      <h4 style="margin:18px 0 8px;font-size:13px">Instalação da nuvem (um comando só)</h4>
      <div class="aviso-codigo" style="margin-bottom:10px">
        <strong>Antes de colar, DESLIGUE a tradução automática da página do Supabase.</strong>
        Se o navegador estiver traduzindo, ele reescreve o texto dentro do editor
        (<code>create policy</code> vira <code>criar política</code>) e o comando não roda.
        No Chrome, toque no ícone de tradução na barra de endereço e escolha
        "Mostrar sempre no idioma original"; no iPhone, no menu <strong>aA</strong> →
        <strong>Ver original</strong>.
      </div>
      <p class="text-muted" style="font-size:12px;margin-bottom:8px">
        No Supabase: <strong>SQL Editor → New query → colar → Run</strong>. Este comando cria a
        tabela da loja, a pasta das fotos e libera as duas para a chave publicável, que é a que o
        sistema usa. Pode ser rodado de novo quando quiser: não apaga nada.</p>
      <textarea id="sqlTabela" rows="7" readonly
        style="width:100%;font-family:monospace;font-size:11px">${escapeHtml(sqlDaTabela())}</textarea>
      <button class="btn btn-sm" style="margin-top:8px" onclick="copiarSqlDaTabela()">Copiar SQL</button>
    </div>

    <div class="panel">
      <h3>🕓 Histórico na nuvem</h3>
      <p class="text-muted" style="font-size:12.5px;margin-bottom:12px">
        O Supabase guarda sozinho as versões anteriores do cadastro (uma a cada 10 minutos, e sempre que
        algo some). Se um aparelho gravar por cima do que não devia, é aqui que se volta atrás.</p>
      <div id="historicoNuvem"></div>
      <button class="btn btn-sm" style="margin-top:10px" onclick="carregarHistoricoDaNuvem()">Atualizar lista</button>
    </div>

    <div class="panel">
      <h3>💾 Espaço deste aparelho</h3>
      <p class="text-muted" style="font-size:12.5px;margin-bottom:12px">
        Aqui não fica nada de definitivo: o lugar dos dados é o Supabase. O que estiver neste
        aparelho é cópia de trabalho, e as fotos que ainda não subiram vão embora sozinhas
        assim que a nuvem aceitar. Nada aqui precisa ser apagado à mão.</p>
      <div id="espacoDoAparelho"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button class="btn" onclick="renderEspacoDoAparelho()">Recalcular</button>
        <button class="btn" onclick="forcarEnvioDasFotos()">☁️ Mandar as fotos para a nuvem agora</button>
      </div>
    </div>

    <div class="panel" style="border-left:4px solid var(--warning)">
      <h3>🔎 Procurar dados perdidos no Supabase</h3>
      <p class="text-muted" style="font-size:12.5px;margin-bottom:12px">
        Varre todas as tabelas e linhas do seu projeto no Supabase atrás de bancos da loja —
        inclusive de sistemas antigos. Mostra quantos produtos e vendas tem cada um, e você
        escolhe qual trazer de volta. Nada é alterado até você clicar em "Usar este".</p>
      <button class="btn btn-accent" onclick="procurarNaNuvem()">Procurar agora</button>
      <div style="display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap">
        <input id="tabelaExtra" placeholder="Nome de outra tabela (se souber)" style="flex:1;min-width:180px">
        <button class="btn btn-sm" onclick="procurarNaNuvem(document.getElementById('tabelaExtra').value)">Procurar nela</button>
      </div>
      <div id="resultadoBusca" style="margin-top:14px"></div>
    </div>

    <div class="panel">
      <h3>Cópias guardadas neste aparelho</h3>
      <p class="text-muted" style="font-size:12.5px;margin-bottom:12px">
        O sistema guarda as últimas versões antes de cada mudança grande. Se algo
        sumir, dá para voltar por aqui.</p>
      ${(()=>{
        const copias = lerCopiasDeSeguranca();
        if(!copias.length) return `<div class="empty-state">Nenhuma cópia guardada ainda.</div>`;
        return `<div class="table-wrap"><table><thead><tr>
            <th>Quando</th><th>Motivo</th><th style="text-align:right">Produtos</th>
            <th style="text-align:right">Vendas</th><th></th></tr></thead><tbody>
          ${copias.map((c,i)=>`<tr>
            <td>${dateBR(c.quando)}</td>
            <td>${escapeHtml(c.motivo||'-')}</td>
            <td style="text-align:right">${c.produtos}</td>
            <td style="text-align:right">${c.vendas}</td>
            <td><button class="btn btn-sm" onclick="restaurarCopiaDeSeguranca(${i})">Restaurar</button></td>
          </tr>`).join('')}
        </tbody></table></div>`;
      })()}
    </div>`;
  el.querySelector('#saveStoreBtn').addEventListener('click', ()=>{
    DB.storeName = el.querySelector('#cfg_storeName').value.trim() || DB.storeName;
    DB.config.minStock = Math.max(0, Number(el.querySelector('#cfg_minStock').value)||0);
    DB.config.reciboAoFinalizar = el.querySelector('#cfg_recibo').value;
    delete DB.config.reciboAutomatico;
    carimbar(DB.config);
    saveDB(); renderShell(); toast('Configurações salvas');
  });
  el.querySelector('#saveOnlineBtn').addEventListener('click', ()=>{
    DB.config.whatsapp = el.querySelector('#cfg_whats').value.trim();
    DB.config.pixKey = el.querySelector('#cfg_pix').value.trim();
    DB.config.address = el.querySelector('#cfg_address').value.trim();
    DB.config.heroPhrase = el.querySelector('#cfg_phrase').value.trim();
    carimbar(DB.config);
    saveDB(); toast('Configurações da loja virtual salvas');
    redesenhar(renderConfig);
  });
  el.querySelector('#saveFiscalBtn').addEventListener('click', ()=>{
    const cnpj = el.querySelector('#fx_cnpj').value.replace(/\D/g,'');
    if(cnpj && cnpj.length !== 14){ toast('O CNPJ precisa ter 14 números','error'); return; }
    const ncm = el.querySelector('#fx_ncm').value.replace(/\D/g,'');
    if(ncm.length !== 8){ toast('O NCM padrão precisa ter 8 números','error'); return; }
    DB.config.fiscal = Object.assign({}, configFiscal(), {
      cnpj, ncmPadrao: ncm,
      cfop: el.querySelector('#fx_cfop').value.replace(/\D/g,'') || '5102',
      csosn: el.querySelector('#fx_csosn').value.replace(/\D/g,'') || '102',
      pisCofins: el.querySelector('#fx_pis').value.replace(/\D/g,'') || '49',
      serie: el.querySelector('#fx_serie').value.replace(/\D/g,''),
      ativo: el.querySelector('#fx_ativo').checked
    });
    delete DB.config.fiscal.chave;           // a chave não vai para a nuvem
    guardarChaveFiscal(el.querySelector('#fx_chave').value);
    carimbar(DB.config);
    saveDB(); toast('Cupom fiscal: configurações salvas');
    testarCupomFiscal();
  });
  renderEspacoDoAparelho();
  carregarHistoricoDaNuvem();
  el.querySelector('#importFile').addEventListener('change', e=>{
    const file = e.target.files[0]; if(!file) return;
    /* Limpa o campo já: escolher o MESMO arquivo de novo (depois de um
       erro, por exemplo) precisa funcionar. */
    const campoDoArquivo = e.target;
    setTimeout(()=>{ campoDoArquivo.value = ''; }, 0);
    const reader = new FileReader();
    reader.onload = ev=>{
      try{
        const pacote = JSON.parse(ev.target.result);
        const fotos = pacote.__fotosPendentes || {};
        delete pacote.__fotosPendentes;
        /* Aqui havia um `loadDB()`, que RELÊ O APARELHO e jogava fora o
           arquivo que acabou de ser aberto: o lojista importava o backup,
           via "Backup importado" na tela e continuava com os dados
           velhos. O que o banco recém-chegado precisa é só do migrateDB,
           para ganhar os campos que versões novas passaram a ter. */
        if(!pacote || typeof pacote !== 'object' || !(Array.isArray(pacote.products) || Array.isArray(pacote.sales))){
          toast('Esse arquivo não é um backup do sistema','error'); return;
        }
        if(!confirm('Importar este backup?\n\n' + (pacote.products||[]).length + ' produto(s) e ' + (pacote.sales||[]).length + ' venda(s).\n\n' +
                    'O que está no sistema agora será guardado como cópia de segurança antes da troca.')) { e.target.value=''; return; }
        guardarCopiaDeSeguranca('antes de importar backup');
        trocarBancoInteiro(pacote);
        Object.entries(fotos).forEach(([pid, dataUrl])=>guardarFotoPendente(pid, dataUrl));
        if(fotosPendentes.size) enviarFotosPendentes();
        if(!exigirGravacao('o backup importado')) return;
        toast((DB.products||[]).length + ' produto(s) e ' + Object.keys(fotos).length + ' foto(s) importados.');
        entrarDepoisDeTrocarOBanco();
      }
      catch(err){ console.error(err); toast('Arquivo inválido','error'); }
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
      <td><button class="btn btn-sm" onclick="openUserModal('${u.id}')">Editar</button>
          ${SESSION && SESSION.id === u.id ? '' : `<button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}')">Excluir</button>`}</td></tr>`).join('')}
  </tbody></table></div>
  <p class="text-muted" style="font-size:12px;margin-top:8px">Vendedor(a) usa Painel, PDV, Produtos, Estoque, Vendas, Caixa, Etiquetas e Clientes. Balanço, Financeiro, Gastos, Abrir Loja, Relatórios e Configurações são só do Admin.</p>`;
}
/* Não existia como apagar um usuário: a vendedora que saiu continuava
   entrando. O último administrador não sai, senão ninguém mais entra. */
function deleteUser(id){
  if(!soAdministrador('excluir usuários')) return;
  const u = DB.users.find(x=>x.id===id);
  if(!u) return;
  if(SESSION && SESSION.id === id){ toast('Você não pode excluir o próprio usuário','error'); return; }
  if(u.role === 'admin' && DB.users.filter(x=>x.role==='admin').length <= 1){ toast('É o único administrador — cadastre outro antes','error'); return; }
  if(!confirm('Excluir o usuário "' + u.user + '"?\n\nAs vendas feitas por ' + (u.name||u.user) + ' continuam no histórico.')) return;
  DB.users = DB.users.filter(x=>x.id!==id);
  registrarApagado('users', id);
  saveDB(); renderUsersTable(); toast('Usuário excluído');
}
function openUserModal(id){
  const editing = id ? DB.users.find(u=>u.id===id) : null;
  const u = editing || { id:uid(), user:'', pass:'', name:'', role:'vendedor' };
  const overlay = document.createElement('div');
  overlay.className='modal-overlay';
  overlay.innerHTML = `<div class="modal" style="max-width:400px">
    <h2>${editing?'Editar':'Novo'} usuário</h2>
    <div class="field"><label>Nome</label><input id="u_name" value="${escapeHtml(u.name)}"></div>
    <div class="field" style="margin-top:10px"><label>Usuário (login)</label><input id="u_user" value="${escapeHtml(u.user)}" autocomplete="off"></div>
    <div class="field" style="margin-top:10px"><label>${editing ? 'Nova senha (deixe em branco para manter)' : 'Senha'}</label><input id="u_pass" type="password" value="" autocomplete="new-password"></div>
    <div class="field" style="margin-top:10px"><label>Perfil</label>
      <select id="u_role"><option value="vendedor" ${u.role==='vendedor'?'selected':''}>Vendedor(a)</option><option value="admin" ${u.role==='admin'?'selected':''}>Admin</option></select>
    </div>
    <div class="modal-actions"><button class="btn" id="cancelBtn">Cancelar</button><button class="btn btn-accent" id="saveBtn">Salvar</button></div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#cancelBtn').addEventListener('click', ()=>overlay.remove());
  overlay.querySelector('#saveBtn').addEventListener('click', async ()=>{
    const user = overlay.querySelector('#u_user').value.trim();
    if(!user){ toast('Informe o login','error'); return; }
    /* Dois logins iguais: só o primeiro conseguia entrar. */
    if(DB.users.some(x=>x.id !== u.id && x.user.toLowerCase() === user.toLowerCase())){ toast('Já existe um usuário com esse login','error'); return; }
    const senhaDigitada = overlay.querySelector('#u_pass').value;
    if(!editing && !senhaDigitada){ toast('Informe a senha','error'); return; }
    const role = overlay.querySelector('#u_role').value;
    if(editing && editing.role === 'admin' && role !== 'admin' && DB.users.filter(x=>x.role==='admin').length <= 1){
      toast('É o único administrador — cadastre outro antes de rebaixar','error'); return;
    }
    const data = { id:u.id, user, name: overlay.querySelector('#u_name').value.trim(), role };
    if(senhaDigitada) data.pass = await guardarSenha(senhaDigitada);
    carimbar(data);
    if(editing) Object.assign(editing, data); else DB.users.push({ pass:'', ...data });
    if(SESSION && SESSION.id === u.id){ SESSION.name = data.name || data.user; SESSION.role = data.role; localStorage.setItem(SESSION_KEY, JSON.stringify(SESSION)); renderShell(); }
    saveDB(); overlay.remove(); renderUsersTable();
    toast('Usuário salvo');
  });
}
/* O backup leva a loja INTEIRA, fotos incluídas. Desde que as imagens
   saíram de dentro do banco (para não sufocar o Supabase), exportar só o
   DB deixaria de fora justamente as fotos que ainda não subiram — e são
   elas as que existem em um lugar só no mundo. */
function exportBackup(){
  const pacote = JSON.parse(JSON.stringify(DB));
  pacote.__fotosPendentes = {};
  fotosPendentes.forEach((dataUrl, pid)=>{ pacote.__fotosPendentes[pid] = dataUrl; });
  const quantas = Object.keys(pacote.__fotosPendentes).length;
  const blob = new Blob([JSON.stringify(pacote, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `estilo-fashion-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
  toast((DB.products||[]).length + ' produto(s), ' + (DB.sales||[]).length + ' venda(s)' +
        (quantas ? ' e ' + quantas + ' foto(s)' : '') + ' salvos no arquivo.');
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
  if(!SESSION || (currentRoute!=='pdv' && !(currentRoute==='estoque' && estoqueMode))) return;
  const now = Date.now();
  /* Leitor Bluetooth no celular é mais lento que o USB: até ~120 ms entre
     as teclas. Com 80 ms o código chegava picado e nunca era reconhecido. */
  if(now - scanLastTime > 150) scanBuffer = '';
  scanLastTime = now;
  if(e.key==='Enter'){
    if(scanBuffer.length>=3){
      /* O foco pode estar num botão (forma de pagamento, "+"): o Enter do
         leitor não pode clicar nele de novo. */
      e.preventDefault();
      if(temFormularioAberto()){ scanBuffer=''; return; }
      if(currentRoute==='pdv'){
        const found = findVariationByBarcode(scanBuffer) || acharCodigoNoFim(scanBuffer);
        if(found) addToCart(found.product, found.variation);
        else { somDoBipe(false); toast('Código ' + scanBuffer.slice(-12) + ' não encontrado','error'); }
      } else if(currentRoute==='estoque' && estoqueMode){
        handleBipe(scanBuffer);
      }
    }
    scanBuffer='';
  } else if(e.key && e.key.length===1){
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
  /* "Script error." e avisos do ResizeObserver vêm de extensões e do
     próprio navegador, não do sistema: mostrá-los só assustava o caixa. */
  if(!e || !e.message || /^Script error\.?$/i.test(e.message) || /ResizeObserver/i.test(e.message)) return;
  console.error(e.error || e.message);
  toast('Erro: '+e.message, 'error');
});

document.addEventListener('DOMContentLoaded', ()=>{
  loadDB();
  restoreSession();
  cloudPull();

  document.getElementById('loginForm').addEventListener('submit', async e=>{
    e.preventDefault();
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value;
    const erro = document.getElementById('loginError');
    if(!user || !pass){ erro.textContent = !user ? 'Digite o usuário.' : 'Digite a senha.'; return; }
    const btn = document.getElementById('loginBtn');
    if(btn){ btn.disabled = true; btn.textContent = 'Entrando…'; }
    let entrou = false;
    try{ entrou = await tryLogin(user, pass); }catch(err){ console.error(err); }
    if(btn){ btn.disabled = false; btn.textContent = 'Entrar'; }
    if(entrou){ erro.textContent = ''; showApp(); }
    else {
      /* A tela não entrega mais nem os usuários cadastrados: quem está do
         lado de fora não precisa saber quem existe aqui dentro. Para quem
         é da casa e esqueceu a senha, o caminho de volta aparece logo
         abaixo, e ele é que resolve. */
      erro.textContent = 'Usuário ou senha não conferem. Confira letras maiúsculas e o teclado do celular.';
      document.getElementById('loginHelpBtn').style.display = 'block';
      document.getElementById('loginPass').select();
    }
  });
  document.getElementById('loginHelpBtn').addEventListener('click', recuperarAcesso);
  /* Enter em qualquer um dos dois campos envia o formulário — alguns
     teclados de celular mandam o Enter sem disparar o envio do form. */
  ['loginUser','loginPass'].forEach(id=>document.getElementById(id).addEventListener('keydown', e=>{
    if(e.key === 'Enter'){ e.preventDefault(); document.getElementById('loginForm').requestSubmit(); }
  }));
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('navList').addEventListener('click', e=>{
    const a = e.target.closest('a[data-route]');
    if(a){ e.preventDefault(); navigate(a.dataset.route); closeSidebar(); }
  });
  document.getElementById('menuToggle')?.addEventListener('click', toggleSidebar);
  document.getElementById('sidebarBackdrop')?.addEventListener('click', closeSidebar);
  /* O botão Voltar do navegador (e o gesto de voltar no celular) mudava o
     endereço e não mudava a tela. */
  window.addEventListener('hashchange', ()=>{
    const rota = location.hash.replace('#','');
    if(SESSION && rota && rota !== currentRoute && NAV.some(n=>n.id===rota)) navigate(rota);
  });

  conferirVersao();
  ligarGatilhosDeEnvio();
  document.getElementById('seloNuvem')?.addEventListener('click', ()=>{
    if(!SESSION) return;
    /* Configurações é tela do administrador: para a vendedora o selo
       responde ali mesmo, sem tirá-la do balcão. */
    if(!podeAbrir('config')){
      const est = estadoDaNuvem();
      toast(est.tudoSalvo ? 'Tudo o que foi feito aqui já está salvo na nuvem.'
          : est.ok ? 'Salvando na nuvem…'
          : 'Sem ligação com a nuvem agora. O trabalho fica guardado neste aparelho e sobe sozinho quando a ligação voltar.', est.ok ? 'ok' : 'warn');
      sincronizarAgora();
      return;
    }
    navigate('config');
    setTimeout(()=>{ atualizaAvisoDeNuvem(); testarNuvem(); }, 300);
  });
  atualizaAvisoDeNuvem();
  restaurarEscolhaDaEtiqueta();
  migrarFotosAntigas();
  const lv = document.getElementById('loginVersion');
  if(lv) lv.textContent = 'versão ' + APP_VERSION;
  const nomeNoLogin = document.getElementById('loginBrandName');
  if(nomeNoLogin && DB && DB.storeName) nomeNoLogin.textContent = DB.storeName;
  /* Mostrar/esconder a senha: no celular, a senha digitada errada por
     causa do teclado era a causa mais comum de "não entra". */
  const olho = document.getElementById('loginEye');
  if(olho) olho.addEventListener('click', ()=>{
    const campo = document.getElementById('loginPass');
    campo.type = campo.type === 'password' ? 'text' : 'password';
    olho.setAttribute('aria-label', campo.type === 'password' ? 'Mostrar senha' : 'Esconder senha');
    campo.focus();
  });
  if(SESSION){ showApp(); } else { showLogin(); }
});

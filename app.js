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
const APP_VERSION = "40";

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
    barcodeSeq: 0,
    /* O que foi apagado DE PROPÓSITO. Sem esta lista, juntar o banco daqui
       com o da nuvem trazia de volta a peça que o lojista tinha acabado de
       excluir — ele apagava, ela reaparecia, e ninguém entendia. */
    apagados: {}
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

  DB.products = arr(DB.products).filter(Boolean).map((p, i)=>({
    ...p,
    id: p.id || idEstavel(p, i),
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
/* Um aparelho que abre SEM dados locais não pode mandar nada para a nuvem
   antes de ler o que há lá. O iPhone apaga os dados de sites que ficam
   alguns dias sem uso; quando isso acontece o sistema abre vazio, e um
   único salvamento substituía a loja inteira na nuvem por um banco em
   branco. Foi assim que o estoque se perdeu. */
let bancoVeioVazio = false;
let nuvemLida = false;
let nuvemVaziaConfirmada = false;

function loadDB(){
  let raw = null;
  try{ raw = localStorage.getItem(STORAGE_KEY); }catch(e){ raw = null; }
  bancoVeioVazio = !raw;
  try{
    DB = raw ? JSON.parse(raw) : defaultDB();
  }catch(e){ DB = defaultDB(); bancoVeioVazio = true; }
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
  const degraus = [
    ['cópias de segurança antigas', ()=>{
      const copias = lerCopiasDeSeguranca();
      if(copias.length <= 1) return false;
      localStorage.setItem(CHAVE_COPIAS, JSON.stringify(copias.slice(0, 1)));
      return true;
    }],
    ['fotos guardadas dentro do banco', ()=>liberarEspacoDeFotos()],
    ['todas as cópias de segurança', ()=>{
      if(!localStorage.getItem(CHAVE_COPIAS)) return false;
      localStorage.removeItem(CHAVE_COPIAS);
      return true;
    }],
    /* Último degrau, e o único que perde alguma coisa: fotos que ainda não
       subiram para a nuvem. Perder uma foto dói; perder a venda fecha o
       caixa. O lojista é avisado do que foi descartado. */
    ['fotos que ainda não subiram', ()=>{
      const chaves = chavesDeFotosPendentes();
      if(!chaves.length) return false;
      const chave = chaves[0];
      fotosPendentes.delete(chave.slice(PREFIXO_FOTO.length));
      localStorage.removeItem(chave);
      fotosDescartadas++;
      return true;
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
   e a guarda numa chave própria do aparelho, na fila para subir. A foto
   não some da peça e não some do aparelho — antes ela ia só para a
   memória, e fechar o sistema apagava tudo. */
function liberarEspacoDeFotos(){
  const p = DB.products.find(x=>x.photo && x.photo.startsWith('data:'));
  if(!p) return false;
  guardarFotoPendente(p.id, p.photo);
  p.photo = '';
  p.photoPendente = true;
  enviarFotosPendentes();
  return true;
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
    if(anterior && anterior.produtos === produtos && anterior.vendas === vendas) return;
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

function restaurarCopiaDeSeguranca(indice){
  const copia = lerCopiasDeSeguranca()[indice];
  if(!copia) return;
  if(!confirm('Voltar para a cópia de ' + dateBR(copia.quando) + '?\n\n' +
              copia.produtos + ' produto(s) e ' + copia.vendas + ' venda(s).\n\n' +
              'O que está no sistema agora será guardado como cópia antes da troca.')) return;
  guardarCopiaDeSeguranca('antes de restaurar');
  DB = JSON.parse(copia.dados);
  migrateDB();
  restaurarEscolhaDaEtiqueta();
  if(exigirGravacao('a restauração')){
    toast('Cópia restaurada: ' + copia.produtos + ' produto(s).');
    renderShell(); navigate('painel');
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
  if(!est.ok && !jaAvisouDaNuvem && document.getElementById('app')
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
    return 'A nuvem respondeu, mas não encontrou a tabela "' + configNuvem().tabela + '" (404). O nome da tabela pode ter mudado.';
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
      atualizaAvisoDeNuvem();
      return;
    }
    ultimoErroNuvem = null;
    const rows = await res.json();
    nuvemLida = true;                       // conseguimos ler: já sabemos o que há lá
    ultimoCarimboDaNuvem = rows && rows[0] ? rows[0].updated_at : null;
    /* O aviso é atualizado AQUI, e não só no fim. Havia um caminho — o mais
       comum de todos, o aparelho que reabre já com os dados em dia — que
       saía por um `return` no meio e deixava na tela o aviso de que a nuvem
       não respondia, com a nuvem respondendo. Nesta loja, que já perdeu
       dados, alarme falso custa caro: o lojista para de acreditar no aviso
       justamente quando ele for verdade. */
    atualizaAvisoDeNuvem();
    if(rows && rows[0] && rows[0].data){
      const cloudTs = rows[0].updated_at ? new Date(rows[0].updated_at).getTime() : 0;
      const localTs = Number(localStorage.getItem(LOCAL_TS_KEY)) || 0;
      /* Se este aparelho abriu sem dados, o que está aqui não é a verdade
         da loja — é um banco em branco. A nuvem vence, custe o que custar
         ao carimbo de hora. */
      if(cloudTs <= localTs && !bancoVeioVazio && !temPendencia) return;
      guardarCopiaDeSeguranca('antes de trazer da nuvem');
      /* Se ainda há coisa daqui esperando para subir, o que vem da nuvem
         entra JUNTO, não por cima: senão o aparelho perderia a alteração
         que ele mesmo acabou de fazer. */
      DB = temPendencia ? juntarBancos(DB, rows[0].data) : rows[0].data;
      bancoVeioVazio = false;
      migrateDB(); // preenche campos novos sem sobrescrever com o localStorage
      restaurarEscolhaDaEtiqueta();   // o rolo da impressora também vem da nuvem
      saveDB(true);
      if(document.getElementById('app') && !document.getElementById('app').classList.contains('hidden')){ renderShell(); navigate(currentRoute); }
    } else {
      nuvemVaziaConfirmada = true;          // loja nova: não há o que preservar
      bancoVeioVazio = false;
    }
    atualizaAvisoDeNuvem();
  }catch(e){
    ultimoErroNuvem = { status: 0, detalhe: String(e && e.message || e) };
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
/* Chamado por saveDB: a alteração acabou de acontecer, vai agora. */
function marcarParaEnviar(){
  temPendencia = true;
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
  if(!id) return;
  DB.apagados = DB.apagados || {};
  DB.apagados[colecao] = DB.apagados[colecao] || [];
  if(!DB.apagados[colecao].includes(id)) DB.apagados[colecao].push(id);
}
function juntarPorId(daqui, deLa, apagados){
  const fora = new Set(apagados || []);
  const lista = (Array.isArray(daqui) ? daqui : []).filter(x=>!(x && fora.has(x.id)));
  const tenho = new Set(lista.map(x=>x && x.id).filter(Boolean));
  (Array.isArray(deLa) ? deLa : []).forEach(x=>{
    if(x && x.id && !tenho.has(x.id) && !fora.has(x.id)){ lista.push(x); tenho.add(x.id); }
  });
  return lista;
}
function juntarBancos(daqui, deLa){
  if(!deLa || typeof deLa !== 'object') return daqui;
  const junto = { ...daqui };
  /* As lápides dos dois aparelhos valem juntas: o que um apagou fica
     apagado no outro. */
  const lapides = {};
  ['products','customers','sales','users','fixed'].forEach(k=>{
    lapides[k] = [ ...(((daqui.apagados||{})[k])||[]), ...(((deLa.apagados||{})[k])||[]) ];
  });
  junto.apagados = lapides;
  junto.products  = juntarPorId(daqui.products,  deLa.products,  lapides.products);
  junto.customers = juntarPorId(daqui.customers, deLa.customers, lapides.customers);
  junto.sales     = juntarPorId(daqui.sales,     deLa.sales,     lapides.sales);
  junto.users     = juntarPorId(daqui.users,     deLa.users,     lapides.users);
  junto.finance   = { ...(daqui.finance||{}),
                      entries: juntarPorId((daqui.finance||{}).entries, (deLa.finance||{}).entries) };
  junto.monthlyExpenses = { ...(daqui.monthlyExpenses||{}),
    records: juntarPorId((daqui.monthlyExpenses||{}).records, (deLa.monthlyExpenses||{}).records),
    fixed:   juntarPorId((daqui.monthlyExpenses||{}).fixed,   (deLa.monthlyExpenses||{}).fixed, lapides.fixed) };
  junto.storeSetup = { ...(daqui.storeSetup||{}),
    items: juntarPorId((daqui.storeSetup||{}).items, (deLa.storeSetup||{}).items) };
  /* O número do próximo código de barras nunca anda para trás: dois
     aparelhos gerando código não podem chegar ao mesmo número. */
  junto.barcodeSeq = Math.max(Number(daqui.barcodeSeq)||0, Number(deLa.barcodeSeq)||0);
  return junto;
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
  try{
    const c = configNuvem();

    /* Alguém mexeu na nuvem depois da última vez que lemos? Então tem
       trabalho de outro aparelho lá, e ele entra junto em vez de ser
       apagado por este envio. */
    try{
      const olhada = await fetch(`${c.url}/rest/v1/${c.tabela}?id=eq.main&select=data,updated_at`,
                                 { headers: cabecalhosNuvem() });
      if(olhada.ok){
        const linhas = await olhada.json();
        const carimbo = linhas && linhas[0] ? linhas[0].updated_at : null;
        if(carimbo && ultimoCarimboDaNuvem && carimbo !== ultimoCarimboDaNuvem && linhas[0].data){
          DB = juntarBancos(DB, linhas[0].data);
          gravarLocal();
        }
      }
    }catch(e){ /* não deu para olhar: segue o envio, que é o que importa */ }

    const carimboNovo = todayISO();
    const res = await fetch(`${c.url}/rest/v1/${c.tabela}`, {
      method:'POST',
      headers:{
        ...cabecalhosNuvem({ 'Content-Type':'application/json' }),
        'Prefer':'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify({ id:'main', data: DB, updated_at: carimboNovo })
    });

    /* A resposta AGORA é conferida. Sem isto, um 401 ou um 404 passava por
       gravação bem-sucedida e a loja não ficava sabendo de nada. */
    if(!res.ok){
      let detalhe = '';
      try{ detalhe = (await res.text()).slice(0, 200); }catch(e){}
      ultimoErroNuvem = { status: res.status, detalhe };
      falhouAoEnviar = true;
      tentativasDeEnvio++;
      agendarEnvio(esperaDoReenvio());
      atualizaAvisoDeNuvem();
      return;
    }

    ultimoErroNuvem = null;
    falhouAoEnviar = false;
    ultimoCarimboDaNuvem = carimboNovo;
    horaDoUltimoEnvioOk = Date.now();
    temPendencia = false;
    tentativasDeEnvio = 0;
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
const fotosPendentes = new Map();
let enviandoFotos = false;
const PREFIXO_FOTO = 'estiloCiaFoto_';

function guardarFotoPendente(pid, dataUrl){
  fotosPendentes.set(pid, dataUrl);
  try{ localStorage.setItem(PREFIXO_FOTO + pid, dataUrl); }
  catch(e){ /* aparelho cheio: fica na memória desta sessão, e avisamos */ }
}
function esquecerFotoPendente(pid){
  fotosPendentes.delete(pid);
  try{ localStorage.removeItem(PREFIXO_FOTO + pid); }catch(e){}
}
function carregarFotosPendentes(){
  try{
    Object.keys(localStorage).forEach(k=>{
      if(k.indexOf(PREFIXO_FOTO) === 0){
        const valor = localStorage.getItem(k);
        if(valor) fotosPendentes.set(k.slice(PREFIXO_FOTO.length), valor);
      }
    });
  }catch(e){}
}
function chavesDeFotosPendentes(){
  try{ return Object.keys(localStorage).filter(k=>k.indexOf(PREFIXO_FOTO) === 0); }
  catch(e){ return []; }
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
      if(!prod){ esquecerFotoPendente(pid); continue; }
      try{
        prod.photo = await subirFoto(dataUrl, pid);
        delete prod.photoPendente;
        esquecerFotoPendente(pid);
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
  carregarFotosPendentes();          // o que ficou de sessões anteriores
  DB.products.forEach(p=>{
    if(p.photo && p.photo.startsWith('data:')) guardarFotoPendente(p.id, p.photo);
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
  /* O Painel abre o menu e o sistema. Ele é o resumo do dia: quem chega na
     loja de manhã quer ver como está antes de vender. */
  { id:'painel', label:'Painel', icon:'🏠', group:'dia' },
  { id:'pdv', label:'Vender (PDV)', icon:'🛒', group:'dia' },
  { id:'produtos', label:'Produtos', icon:'👗', group:'dia' },
  { id:'estoque', label:'Estoque', icon:'📦', group:'dia' },
  { id:'vendas', label:'Vendas', icon:'🧾', group:'dia' },

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
const SQL_CRIAR_TABELA = `-- Cole no SQL Editor do Supabase e clique em Run
create table if not exists public.TABELA (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.TABELA enable row level security;

-- A loja usa a chave publicável, que entra como "anon".
create policy "loja le" on public.TABELA
  for select to anon using (true);
create policy "loja grava" on public.TABELA
  for insert to anon with check (true);
create policy "loja atualiza" on public.TABELA
  for update to anon using (true) with check (true);`;

function sqlDaTabela(){
  return SQL_CRIAR_TABELA.replaceAll('TABELA', configNuvem().tabela);
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
  temPendencia = true;
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

  await tentar('3. Pasta das fotos', `${cfg.url}/storage/v1/object/list/${cfg.bucket}`, {
    method:'POST',
    headers: cabecalhosNuvem({ 'Content-Type':'application/json' }),
    body: JSON.stringify({ prefix:'', limit:1 })
  });

  const leitura = linhas[0], gravacao = linhas[1], fotos = linhas[2];
  const tudoBem = leitura.ok && gravacao.ok;

  let recado, comoResolver = '';
  if(tudoBem){
    recado = 'A nuvem está lendo e GRAVANDO. O trabalho da loja está sendo salvo.';
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
    'Fotos: ' + (fotos && fotos.ok ? 'pasta encontrada' : 'pasta não encontrada (' + (fotos ? fotos.status : '-') + ')')
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
  'loja_roupas_db', 'lumina_db', 'loja_db', 'sistema_db', 'estilo_db',
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
  DB = JSON.parse(JSON.stringify(a.banco));
  migrateDB();
  restaurarEscolhaDaEtiqueta();
  if(exigirGravacao('os dados recuperados')){
    toast(a.produtos + ' produto(s) recuperados.');
    renderShell(); navigate('painel');
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
  if(m.medido) return { ...m, w: Math.min(62, Number(etiquetaCustom.w)||29),
                              h: Math.min(200, Number(etiquetaCustom.h)||40) };
  if(m.continua) return { ...m, h: Math.min(200, Math.max(12, Number(etiquetaComprimento)||m.h)) };
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
function guardarEscolhaDaEtiqueta(){
  DB.config.etiqueta = { midia: etiquetaMidia, comp: etiquetaComprimento,
                         w: etiquetaCustom.w, h: etiquetaCustom.h };
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
    const mm = espessuraDaBarraMM(midia.w, v.barcode);
    if(mm < piorMM){ piorMM = mm; pior = v.barcode; }
  }));
  const mm = piorMM === Infinity ? espessuraDaBarraMM(midia.w, '000001') : piorMM;
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
        <td><input type="checkbox" data-check="${key}" ${checked?'checked':''}></td>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(v.size)}/${escapeHtml(v.color)}</td>
        <td class="col-codigo">${escapeHtml(v.barcode||'(será gerado)')}</td>
        <td class="col-estoque">${v.stock}</td>
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
  /* A prévia procura uma peça COM nome e preço. Mostrar "Produto sem nome
     · R$ 0,00" fazia parecer que a etiqueta estava quebrada, quando o que
     faltava era o cadastro da peça. */
  let alvo = null;
  const serve = (p,v) => v.barcode && p.name && !/sem nome/i.test(p.name) && Number(p.price) > 0;
  DB.products.some(p=>p.variations.some(v=>{ if(serve(p,v)){ alvo={p,v}; return true; } }));
  if(!alvo) DB.products.some(p=>p.variations.some(v=>{ if(v.barcode){ alvo={p,v}; return true; } }));
  if(!alvo){
    box.innerHTML = '<p class="text-muted" style="font-size:12.5px">Cadastre uma peça para ver a prévia da etiqueta.</p>';
    return;
  }
  const midia = midiaAtual();
  const baixa = midia.h <= 20;
  const utilMM = Math.max(6, midia.w - 3);            // as bordas que a QL-800 não imprime
  const alturaBarrasMM = Math.max(4, midia.h * (baixa ? 0.34 : 0.40));
  box.innerHTML = `
    <div class="preview-titulo">Como vai sair — ${midia.w} × ${midia.h} mm, tamanho real</div>
    <div class="label preview-label${baixa?' label-compacta':''}" style="width:${midia.w}mm;height:${midia.h}mm">
      ${baixa ? '' : `<div class="label-store">${escapeHtml(DB.storeName)}</div>`}
      <div class="label-name">${escapeHtml(alvo.p.name)} ${escapeHtml(alvo.v.size)}/${escapeHtml(alvo.v.color)}</div>
      ${desenhoSvgDoCodigo(alvo.v.barcode, utilMM, alturaBarrasMM)}
      <div class="label-code">${escapeHtml(alvo.v.barcode)}</div>
      <div class="label-price">${money(alvo.p.price)}</div>
    </div>`;
}

function gerarPdfEtiquetas(itensForcados){
  const items = itensForcados || itensSelecionados();
  if(!items.length){ pedirSelecao(); return; }
  generateMissingBarcodes();
  saveDB();

  const layout = layoutAtual();
  let blob;
  try{
    blob = criarPdfEtiquetas(items, layout, DB.storeName, money);
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
    <div id="reciboDaVenda"></div>
    <div id="linkDoPdf"></div>`;

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
  cart=[]; pdvDiscount=0; pdvCustomer='';
  renderPDV(document.getElementById('view'));
  mostrarOfertaDeRecibo(sale);
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
function gerarReciboPdf(sale){
  let blob;
  try{
    blob = criarPdfRecibo(sale, DB.storeName, money, dateBR);
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
/* Depois de finalizar, o recibo fica à mão sem atrapalhar o caixa: um
   botão só, que some quando a próxima venda começa. */
function mostrarOfertaDeRecibo(sale){
  const box = document.getElementById('reciboDaVenda');
  if(!box) return;
  box.className = 'pdf-pronto';
  box.innerHTML = `<strong>Venda de ${escapeHtml(money(sale.total))} registrada</strong>
    <a href="#" onclick="event.preventDefault();imprimirReciboDaVenda('${sale.id}')">🧾 Gerar recibo desta venda</a>
    <span>Só se a cliente pedir — a venda já está salva.</span>`;
}

function imprimirReciboDaVenda(id){
  const sale = DB.sales.find(x=>x.id===id);
  if(!sale){ toast('Venda não encontrada','error'); return; }
  gerarReciboPdf(sale);
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
  btns += `<button class="btn btn-sm" onclick="imprimirReciboDaVenda('${s.id}')">🧾 Recibo</button> `;
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

      <h4 style="margin:18px 0 8px;font-size:13px">SQL para criar a tabela no projeto novo</h4>
      <p class="text-muted" style="font-size:12px;margin-bottom:8px">
        No Supabase: SQL Editor → cole → Run. Cria a tabela e libera a leitura e a gravação
        para a chave publicável, que é a que o sistema usa.</p>
      <textarea id="sqlTabela" rows="7" readonly
        style="width:100%;font-family:monospace;font-size:11px">${escapeHtml(sqlDaTabela())}</textarea>
      <button class="btn btn-sm" style="margin-top:8px" onclick="copiarSqlDaTabela()">Copiar SQL</button>
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
      try{ DB = JSON.parse(ev.target.result); loadDB(); restaurarEscolhaDaEtiqueta();
           saveDB(); toast('Backup importado'); navigate('painel'); }
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
      /* A tela não entrega mais nem os usuários cadastrados: quem está do
         lado de fora não precisa saber quem existe aqui dentro. Para quem
         é da casa e esqueceu a senha, o caminho de volta aparece logo
         abaixo, e ele é que resolve. */
      document.getElementById('loginError').textContent = 'Usuário ou senha inválidos.';
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

  conferirVersao();
  ligarGatilhosDeEnvio();
  document.getElementById('seloNuvem')?.addEventListener('click', ()=>{
    if(!SESSION) return;
    navigate('config');
    setTimeout(()=>{ atualizaAvisoDeNuvem(); testarNuvem(); }, 300);
  });
  atualizaAvisoDeNuvem();
  restaurarEscolhaDaEtiqueta();
  migrarFotosAntigas();
  const lv = document.getElementById('loginVersion');
  if(lv) lv.textContent = 'versão ' + APP_VERSION;
  if(SESSION){ showApp(); } else { showLogin(); }
});

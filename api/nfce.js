/* =========================================================
   CUPOM FISCAL (NFC-e) — função no servidor (Vercel)
   =========================================================
   O site é HTML puro e não pode falar com a SEFAZ: emitir NFC-e exige
   certificado digital, XML assinado e um canal com o estado. Quem faz
   isso é um provedor fiscal (aqui, a Focus NFe). Esta função fica entre
   o sistema e o provedor:

     sistema da loja  ->  /api/nfce  ->  Focus NFe  ->  SEFAZ

   Ela lê a venda direto da nuvem (Supabase), monta o cupom a partir do
   que está lá — e não do que o navegador mandou — e só emite se a chave
   de emissão conferir. O token do provedor mora nas variáveis de
   ambiente do Vercel e nunca chega ao navegador.

   Variáveis de ambiente (Vercel → Settings → Environment Variables):
     FOCUS_NFE_TOKEN      token da conta na Focus NFe
     FOCUS_NFE_AMBIENTE   "homologacao" (testes) ou "producao"
     FISCAL_SENHA         chave de emissão; a mesma é digitada em
                          Configurações → Cupom fiscal, em cada aparelho
     SUPABASE_URL / SUPABASE_KEY / SUPABASE_TABELA   (opcionais; o padrão
                          é o projeto da loja)
   ========================================================= */

const PROVEDOR = {
  homologacao: 'https://homologacao.focusnfe.com.br',
  producao:    'https://api.focusnfe.com.br'
};

const NUVEM = {
  url:    process.env.SUPABASE_URL    || 'https://mfywchoecdhbzuiskpwx.supabase.co',
  key:    process.env.SUPABASE_KEY    || 'sb_publishable_aHss5Ke_FyBqGAdoXsM9ZA_OWv9iNER',
  tabela: process.env.SUPABASE_TABELA || 'loja_roupas_db'
};

/* Código de pagamento da NFC-e (tPag) para cada forma usada no PDV. */
const FORMAS = { dinheiro:'01', pix:'17', 'crédito':'03', credito:'03', 'débito':'04', debito:'04', cheque:'02', boleto:'15' };
function codigoDaForma(forma){
  const f = String(forma||'').trim().toLowerCase();
  if(FORMAS[f]) return FORMAS[f];
  for(const k of Object.keys(FORMAS)) if(f.includes(k)) return FORMAS[k];
  return '99';
}

const arred = v => Math.round((Number(v)||0) * 100) / 100;
const dig = v => String(v||'').replace(/\D/g,'');
function agoraBrasil(){
  /* A SEFAZ exige a hora da emissão, no fuso da loja. */
  const s = new Date().toLocaleString('sv-SE', { timeZone:'America/Sao_Paulo', hour12:false });
  return s.replace(' ', 'T') + '-03:00';
}

/* Monta o corpo da NFC-e para a Focus NFe a partir da venda e do
   cadastro. Puro: não fala com ninguém, e por isso é testável. */
function montarNfce(db, venda, opcoes){
  const cfg = Object.assign({
    cnpj:'', naturezaOperacao:'Venda ao consumidor', ncmPadrao:'61091000', cfop:'5102',
    csosn:'102', origem:'0', pisCofins:'49', unidade:'UN'
  }, (db.config && db.config.fiscal) || {});
  opcoes = opcoes || {};
  const cnpj = dig(cfg.cnpj);
  if(cnpj.length !== 14) throw new Error('Preencha o CNPJ da loja em Configurações → Cupom fiscal.');
  const itens = (venda.items||[]).filter(i=>Number(i.qty) > 0);
  if(!itens.length) throw new Error('A venda não tem peças.');

  /* O desconto da venda é rateado pelas peças, proporcional ao valor.
     A última peça leva a sobra do arredondamento, para a soma fechar. */
  const bruto = arred(itens.reduce((a,i)=>a + arred(i.price) * Number(i.qty), 0));
  const descontoTotal = Math.min(bruto, arred(venda.discount));
  let descontoDistribuido = 0;
  const linhas = itens.map((i, idx)=>{
    const produto = (db.products||[]).find(p=>String(p.id)===String(i.productId)) || {};
    const valorBruto = arred(arred(i.price) * Number(i.qty));
    let desconto = idx === itens.length - 1
      ? arred(descontoTotal - descontoDistribuido)
      : arred(descontoTotal * (bruto ? valorBruto / bruto : 0));
    if(desconto > valorBruto) desconto = valorBruto;
    descontoDistribuido = arred(descontoDistribuido + desconto);
    const ncm = dig(produto.ncm || cfg.ncmPadrao);
    if(ncm.length !== 8) throw new Error('NCM inválido em "' + (produto.name||i.name) + '": precisa de 8 dígitos.');
    const nome = [i.name, i.size && i.size !== 'Único' ? i.size : '', i.color && i.color !== 'Padrão' ? i.color : '']
      .filter(Boolean).join(' ').slice(0, 120);
    const linha = {
      numero_item: idx + 1,
      codigo_produto: String(i.barcode || produto.sku || (produto.variations||[]).find(v=>v.size===i.size && v.color===i.color)?.barcode || i.productId || idx+1).slice(0, 60),
      descricao: nome,
      codigo_ncm: ncm,
      cfop: String(cfg.cfop || '5102'),
      unidade_comercial: cfg.unidade || 'UN',
      quantidade_comercial: Number(i.qty),
      valor_unitario_comercial: arred(i.price),
      unidade_tributavel: cfg.unidade || 'UN',
      quantidade_tributavel: Number(i.qty),
      valor_unitario_tributavel: arred(i.price),
      valor_bruto: valorBruto,
      icms_origem: String(cfg.origem || '0'),
      icms_situacao_tributaria: String(cfg.csosn || '102'),
      pis_situacao_tributaria: String(cfg.pisCofins || '49'),
      cofins_situacao_tributaria: String(cfg.pisCofins || '49')
    };
    if(desconto > 0) linha.valor_desconto = desconto;
    return linha;
  });

  const total = arred(bruto - descontoTotal);
  const formas = [{ forma_pagamento: codigoDaForma(venda.payment), valor_pagamento: total }];

  const nota = {
    natureza_operacao: cfg.naturezaOperacao || 'Venda ao consumidor',
    data_emissao: opcoes.dataEmissao || agoraBrasil(),
    presenca_comprador: '1',
    cnpj_emitente: cnpj,
    modalidade_frete: '9',
    local_destino: '1',
    itens: linhas,
    formas_pagamento: formas,
    informacoes_adicionais_contribuinte: 'Venda #' + String(venda.id).slice(-6) + ' de ' + String(venda.date||'').slice(0,10)
  };
  const cpf = dig(opcoes.cpf || venda.cpfNota);
  if(cpf.length === 11){
    nota.cpf_destinatario = cpf;
    if(opcoes.nomeCliente) nota.nome_destinatario = String(opcoes.nomeCliente).slice(0, 60);
  }
  if(cfg.serie) nota.serie = String(cfg.serie);
  return { nota, total };
}

/* ---------- conversas com o provedor ---------- */
function ambiente(){ return process.env.FOCUS_NFE_AMBIENTE === 'producao' ? 'producao' : 'homologacao'; }
function baseDoProvedor(){ return PROVEDOR[ambiente()]; }
function cabecalhoDoProvedor(extra){
  const token = process.env.FOCUS_NFE_TOKEN || '';
  return Object.assign({ Authorization: 'Basic ' + Buffer.from(token + ':').toString('base64') }, extra || {});
}
async function lerJson(res){
  const t = await res.text();
  try{ return JSON.parse(t); }catch(e){ return { texto: t }; }
}
function resumoDaNota(j, ref){
  const base = baseDoProvedor();
  const caminho = p => p ? (String(p).startsWith('http') ? p : base + p) : '';
  return {
    ref, provedor:'focus', ambiente: ambiente(),
    status: j.status || '',
    statusSefaz: j.status_sefaz || '',
    mensagem: j.mensagem_sefaz || j.mensagem || '',
    chave: j.chave_nfe || '',
    numero: j.numero || '',
    serie: j.serie || '',
    danfe: caminho(j.caminho_danfe),
    xml: caminho(j.caminho_xml_nota_fiscal),
    qrcode: j.qrcode_url || '',
    consulta: j.url_consulta_nf || '',
    protocolo: j.protocolo || '',
    atualizadoEm: new Date().toISOString()
  };
}

async function lerBancoDaLoja(){
  const r = await fetch(`${NUVEM.url}/rest/v1/${NUVEM.tabela}?id=eq.main&select=data`, {
    headers: { apikey: NUVEM.key, Authorization: 'Bearer ' + NUVEM.key }
  });
  if(!r.ok) throw new Error('A nuvem da loja não respondeu (' + r.status + ').');
  const rows = await r.json();
  if(!rows[0] || !rows[0].data) throw new Error('A nuvem da loja está vazia.');
  return rows[0].data;
}

async function consultar(ref){
  const r = await fetch(`${baseDoProvedor()}/v2/nfce/${encodeURIComponent(ref)}`, { headers: cabecalhoDoProvedor() });
  if(r.status === 404) return null;
  const j = await lerJson(r);
  if(!r.ok) throw new Error(j.mensagem || ('O provedor respondeu ' + r.status));
  return resumoDaNota(j, ref);
}

async function emitir(db, venda, opcoes){
  const ref = 'venda-' + String(venda.id);
  /* Mesma venda, mesma nota: se ela já existe no provedor, devolve a que
     está lá em vez de emitir de novo. */
  const existente = await consultar(ref);
  if(existente && existente.status && existente.status !== 'erro_autorizacao' && existente.status !== 'cancelado'){
    return existente;
  }
  const { nota } = montarNfce(db, venda, opcoes);
  const r = await fetch(`${baseDoProvedor()}/v2/nfce?ref=${encodeURIComponent(ref)}`, {
    method:'POST', headers: cabecalhoDoProvedor({ 'Content-Type':'application/json' }), body: JSON.stringify(nota)
  });
  const j = await lerJson(r);
  if(!r.ok && !j.status){
    const detalhe = j.mensagem || (Array.isArray(j.erros) ? j.erros.map(e=>e.mensagem||e).join('; ') : '') || j.texto || ('resposta ' + r.status);
    throw new Error('O provedor recusou a nota: ' + String(detalhe).slice(0, 300));
  }
  let resumo = resumoDaNota(j, ref);
  /* Quase sempre a NFC-e sai autorizada na hora. Se ficou "processando",
     espera um pouco e consulta. */
  for(let i = 0; i < 6 && resumo.status === 'processando_autorizacao'; i++){
    await new Promise(r=>setTimeout(r, 1500));
    const de = await consultar(ref);
    if(de) resumo = de;
  }
  return resumo;
}

async function cancelar(venda, justificativa){
  const ref = 'venda-' + String(venda.id);
  const just = String(justificativa||'').trim();
  if(just.length < 15) throw new Error('A justificativa precisa ter pelo menos 15 letras.');
  const r = await fetch(`${baseDoProvedor()}/v2/nfce/${encodeURIComponent(ref)}`, {
    method:'DELETE', headers: cabecalhoDoProvedor({ 'Content-Type':'application/json' }), body: JSON.stringify({ justificativa: just })
  });
  const j = await lerJson(r);
  if(!r.ok && j.status !== 'cancelado'){
    throw new Error('Não foi possível cancelar: ' + String(j.mensagem_sefaz || j.mensagem || j.texto || r.status).slice(0, 300));
  }
  const de = await consultar(ref);
  return de || resumoDaNota(Object.assign({ status:'cancelado' }, j), ref);
}

async function baixarDanfe(ref){
  const nota = await consultar(ref);
  if(!nota || !nota.danfe) throw new Error('Esta venda não tem cupom emitido.');
  const r = await fetch(nota.danfe, { headers: cabecalhoDoProvedor() });
  if(!r.ok) throw new Error('Não foi possível baixar o cupom (' + r.status + ').');
  return { tipo: r.headers.get('content-type') || 'text/html', corpo: Buffer.from(await r.arrayBuffer()) };
}

/* ---------- a função em si ---------- */
function lerCorpo(req){
  if(req.body && typeof req.body === 'object') return Promise.resolve(req.body);
  return new Promise(resolve=>{
    let s = ''; req.on('data', c=>{ s += c; }); req.on('end', ()=>{ try{ resolve(JSON.parse(s||'{}')); }catch(e){ resolve({}); } });
  });
}
function responder(res, codigo, obj){
  res.statusCode = codigo;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

async function handler(req, res){
  if(req.method === 'GET'){
    return responder(res, 200, {
      ok: true, provedor:'focus', ambiente: ambiente(),
      tokenConfigurado: !!process.env.FOCUS_NFE_TOKEN,
      chaveConfigurada: !!process.env.FISCAL_SENHA
    });
  }
  if(req.method !== 'POST') return responder(res, 405, { ok:false, erro:'Use POST.' });
  const corpo = await lerCorpo(req);
  try{
    if(!process.env.FISCAL_SENHA) throw new Error('A chave de emissão (FISCAL_SENHA) não está configurada no Vercel.');
    if(String(corpo.chave||'') !== String(process.env.FISCAL_SENHA)) return responder(res, 401, { ok:false, erro:'Chave de emissão errada. Confira em Configurações → Cupom fiscal.' });
    if(!process.env.FOCUS_NFE_TOKEN) throw new Error('O token do provedor (FOCUS_NFE_TOKEN) não está configurado no Vercel.');

    const db = await lerBancoDaLoja();
    const venda = (db.sales||[]).find(s=>String(s.id) === String(corpo.vendaId));
    if(!venda) throw new Error('Venda não encontrada na nuvem. Espere o selo ficar "salvo" e tente de novo.');

    if(corpo.acao === 'emitir'){
      if(venda.canceled) throw new Error('Esta venda está cancelada.');
      if(venda.status === 'pendente') throw new Error('Pedido ainda não pago: marque como pago antes de emitir.');
      const cliente = venda.customerId ? (db.customers||[]).find(c=>String(c.id)===String(venda.customerId)) : null;
      const nota = await emitir(db, venda, { cpf: corpo.cpf, nomeCliente: cliente && cliente.name });
      return responder(res, 200, { ok:true, nfce: nota });
    }
    if(corpo.acao === 'consultar'){
      const nota = await consultar('venda-' + String(venda.id));
      return responder(res, 200, { ok:true, nfce: nota });
    }
    if(corpo.acao === 'cancelar'){
      const nota = await cancelar(venda, corpo.justificativa);
      return responder(res, 200, { ok:true, nfce: nota });
    }
    if(corpo.acao === 'danfe'){
      const arq = await baixarDanfe('venda-' + String(venda.id));
      res.statusCode = 200;
      res.setHeader('Content-Type', arq.tipo);
      res.setHeader('Cache-Control', 'no-store');
      return res.end(arq.corpo);
    }
    return responder(res, 400, { ok:false, erro:'Ação desconhecida.' });
  }catch(err){
    return responder(res, 400, { ok:false, erro: String(err && err.message || err) });
  }
}

module.exports = handler;
module.exports.montarNfce = montarNfce;
module.exports.codigoDaForma = codigoDaForma;

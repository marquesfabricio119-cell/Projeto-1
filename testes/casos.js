/* Casos de teste. Cada `caso` é uma situação da loja; `verifica` é uma
   afirmação que precisa continuar verdadeira. Rode: node testes/rodar.js */
const resultados = { ok: 0, falhou: 0, verificacoes: 0 };
const filaDeCasos = [];
function caso(nome, fn){ filaDeCasos.push({ nome, fn }); }
function verifica(cond, msg){ resultados.verificacoes++; assert.ok(cond, msg); }
function igual(a, b, msg){ resultados.verificacoes++; assert.deepStrictEqual(a, b, msg); }

/* Banco pequeno e conhecido, para os testes não dependerem do backup. */
function bancoDeTeste(){
  const d = defaultDB();
  d.products = [
    { id:'p1', name:'Blusa', cost:10, price:30, variations:[{ size:'P', color:'Preto', stock:5, barcode:'000001' }, { size:'M', color:'Preto', stock:2, barcode:'000002' }] },
    { id:'p2', name:'Saia',  cost:20, price:50, variations:[{ size:'Único', color:'Padrão', stock:1, barcode:'000003' }] }
  ];
  d.users = [{ id:'u1', user:'admin', pass:'1234', role:'admin', name:'Administrador' }];
  d.seedV1AbrirLoja = true;
  return d;
}

/* ============ ids e reparo do banco ============ */
caso('id numérico do sistema antigo vira texto, e a peça apagada some de vez', ()=>{
  DB = backupDaLoja();
  const antes = DB.products.length;
  migrateDB();
  verifica(DB.products.every(p=>typeof p.id === 'string'), 'todo id é texto');
  verifica(!DB.products.some(p=>p.id === '1' || p.id === 1), 'o "Produto sem nome" (id 1, na lista de apagados) saiu');
  igual(DB.products.length, antes - 1, 'só ele saiu');
  verifica(DB.products.every(p=>p.variations.length > 0), 'toda peça tem variação');
});

caso('backup do sistema antigo (nome/precoVenda/variacoes) é lido', ()=>{
  DB = { products:[{ id: 7, nome:'T-shirt', marca:'Grupo', precoCusto: 10, precoVenda: 35, categoria:'Blusa',
                    variacoes:[{ tam:'M', cor:'Marrom', qtd: 2, bar:'EC1' }] }] };
  migrateDB();
  const p = DB.products[0];
  igual(p.id, '7'); igual(p.name, 'T-shirt'); igual(p.price, 35); igual(p.cost, 10); igual(p.category, 'Blusa');
  igual(p.variations, [{ size:'M', color:'Marrom', stock:2, barcode:'EC1' }]);
  verifica(DB.users.some(u=>u.role==='admin'), 'admin garantido');
  verifica(DB.config.minStock !== undefined, 'config completado');
  igual(DB.storeSetup.items.length, 0, 'a lista padrão de custos não é mais plantada');
});

caso('lista de apagados repetida é enxugada e gravada', ()=>{
  DB = bancoDeTeste();
  DB.apagados = { products: Array(5000).fill('x') };
  migrateDB();
  igual(DB.apagados.products, ['x']);
  verifica(JSON.parse(localStorage.getItem(STORAGE_KEY)).apagados.products.length === 1, 'reparo foi gravado no aparelho');
});

caso('custos de abertura repetidos viram um só, o mesmo em qualquer aparelho', ()=>{
  DB = bancoDeTeste();
  DB.storeSetup.items = [
    { id:'mts9', category:'Ponto/Aluguel', name:'Aluguel', planned:1410, paid:1410 },      // plantado depois
    { id:'mt9a', category:'Ponto/Aluguel', name:'Aluguel', planned:1410, paid:1410 },      // o da loja
    { id:'mts8', category:'Marketing/Fachada', name:'Fachada em acm + Logotipo', planned:2500, paid:2500 },
    { id:'mt9b', category:'Marketing/Fachada', name:'Fachada em acm + Logotipo', planned:3150, paid:3150 },  // corrigido à mão
    { id:'mt9c', category:'Material para reforma', name:'Fio, Tomada e interruptor', planned:859, paid:859 },
  ];
  migrateDB();
  igual(DB.storeSetup.items.map(i=>i.id), ['mt9a','mt9b','mt9c'], 'fica o de id menor no empate, e o de maior valor na fachada');
  igual(DB.apagados.setup.sort(), ['mts8','mts9']);
  igual(DB.storeSetup.items.reduce((a,i)=>a+i.planned,0), 5419);
  // e um aparelho novo não planta a lista padrão de novo
  DB = defaultDB(); migrateDB();
  igual(DB.storeSetup.items.length, 0, 'sem semeadura');
});

/* ============ junção entre aparelhos ============ */
caso('junção: lançamento excluído num aparelho não volta do outro', ()=>{
  const daqui = bancoDeTeste();
  const deLa = bancoDeTeste();
  deLa.finance.entries = [{ id:'f1', type:'despesa', amount: 10 }];
  daqui.apagados = { finance:['f1'] };
  const junto = juntarBancos(daqui, deLa);
  igual(junto.finance.entries, [], 'lápide do financeiro vale');
  igual(junto.apagados.finance, ['f1']);
});

caso('junção: registro mexido por último vence, sem carimbo vale o daqui', ()=>{
  const daqui = bancoDeTeste();
  const deLa = bancoDeTeste();
  daqui.sales = [{ id:'s1', total: 10, atualizadoEm:'2026-09-01T10:00:00Z' }, { id:'s2', total: 1 }];
  deLa.sales  = [{ id:'s1', total: 99, atualizadoEm:'2026-09-02T10:00:00Z' }, { id:'s2', total: 2 }, { id:'s3', total: 3 }];
  const junto = juntarBancos(daqui, deLa);
  igual(junto.sales.map(s=>[s.id, s.total]), [['s1', 99], ['s2', 1], ['s3', 3]]);
});

caso('junção: ids de tipos diferentes (1 e "1") são o mesmo registro', ()=>{
  const daqui = bancoDeTeste(); daqui.customers = [{ id: 1, name:'A' }];
  const deLa = bancoDeTeste();  deLa.customers = [{ id:'1', name:'B' }];
  const junto = juntarBancos(daqui, deLa);
  igual(junto.customers.length, 1);
});

caso('junção: categorias de gasto criadas em qualquer aparelho ficam', ()=>{
  const daqui = bancoDeTeste(); daqui.monthlyExpenses.categories = ['Aluguel','Nova daqui'];
  const deLa = bancoDeTeste();  deLa.monthlyExpenses.categories = ['Aluguel','Nova de lá'];
  const junto = juntarBancos(daqui, deLa);
  igual(junto.monthlyExpenses.categories, ['Aluguel','Nova daqui','Nova de lá']);
});

/* ============ pedidos da loja virtual ============ */
caso('pedido do site baixa o estoque UMA vez, e congela o custo', ()=>{
  DB = bancoDeTeste();
  DB.sales = [{ id:'w1', origin:'loja', status:'pendente', canceled:false,
                items:[{ productId:'p1', size:'P', color:'Preto', qty: 2, price: 30 }] }];
  migrateDB();
  igual(DB.products[0].variations[0].stock, 3, 'baixou 2');
  igual(DB.sales[0].estoqueBaixado, true);
  igual(DB.sales[0].items[0].cost, 10, 'custo congelado');
  migrateDB();
  igual(DB.products[0].variations[0].stock, 3, 'não baixa de novo');
});

caso('pedido do site já cancelado não baixa estoque', ()=>{
  DB = bancoDeTeste();
  DB.sales = [{ id:'w2', origin:'loja', status:'pendente', canceled:true, items:[{ productId:'p2', size:'Único', color:'Padrão', qty: 1 }] }];
  migrateDB();
  igual(DB.products[1].variations[0].stock, 1);
  igual(DB.sales[0].estoqueBaixado, true);
});

caso('pedido do site que chega pela junção também é baixado', ()=>{
  DB = bancoDeTeste();
  const deLa = bancoDeTeste();
  deLa.sales = [{ id:'w3', origin:'loja', status:'pendente', canceled:false, items:[{ productId:'p1', size:'M', color:'Preto', qty: 1 }] }];
  DB = juntarBancos(DB, deLa);
  aplicarPedidosDaLoja();
  igual(DB.products[0].variations[1].stock, 1);
});


/* ============ dois aparelhos vendendo ao mesmo tempo ============ */
function comVenda(banco, id, productId, size, color, qty){
  const p = banco.products.find(x=>x.id===productId);
  const v = p.variations.find(v=>v.size===size && v.color===color);
  v.stock -= qty;
  banco.sales.push({ id, origin:'pdv', status:'concluida', canceled:false, total: 1, items:[{ productId, size, color, qty, price: 1 }] });
  return banco;
}
caso('dois aparelhos vendem peças diferentes ao mesmo tempo: as duas baixas ficam', ()=>{
  const A = comVenda(bancoDeTeste(), 'vA', 'p1', 'P', 'Preto', 1);   // A vende Blusa P (5 -> 4)
  const B = comVenda(bancoDeTeste(), 'vB', 'p2', 'Único', 'Padrão', 1); // B vende Saia (1 -> 0)
  const juntoEmA = juntarBancos(A, B);
  igual(juntoEmA.sales.length, 2);
  igual(juntoEmA.products[0].variations[0].stock, 4, 'em A: a Blusa continua baixada');
  igual(juntoEmA.products[1].variations[0].stock, 0, 'em A: a Saia vendida por B também baixou');
  const juntoEmB = juntarBancos(B, A);
  igual(juntoEmB.products[0].variations[0].stock, 4, 'em B: a Blusa vendida por A baixou');
  igual(juntoEmB.products[1].variations[0].stock, 0, 'em B: a Saia continua baixada');
});
caso('dois aparelhos vendem a MESMA peça ao mesmo tempo: baixa duas vezes', ()=>{
  const A = comVenda(bancoDeTeste(), 'vA', 'p1', 'P', 'Preto', 2);
  const B = comVenda(bancoDeTeste(), 'vB', 'p1', 'P', 'Preto', 1);
  igual(juntarBancos(A, B).products[0].variations[0].stock, 2, '5 - 2 - 1');
  igual(juntarBancos(B, A).products[0].variations[0].stock, 2);
});
caso('venda cancelada num aparelho devolve o estoque no outro', ()=>{
  const base = comVenda(bancoDeTeste(), 'v1', 'p1', 'P', 'Preto', 1);           // os dois têm a venda (estoque 4)
  const A = JSON.parse(JSON.stringify(base));
  const B = JSON.parse(JSON.stringify(base));
  B.sales[0].canceled = true; B.sales[0].atualizadoEm = '2026-09-08T10:00:00Z';   // B cancelou e devolveu
  B.products[0].variations[0].stock = 5;
  const juntoEmA = juntarBancos(A, B);
  igual(juntoEmA.sales[0].canceled, true);
  igual(juntoEmA.products[0].variations[0].stock, 5, 'A também devolve');
});
caso('ajuste manual de estoque com carimbo mais novo continua valendo', ()=>{
  const A = bancoDeTeste();
  const B = bancoDeTeste();
  B.products[0].variations[0].stock = 20; B.products[0].atualizadoEm = '2026-09-08T10:00:00Z';   // B contou 20 na arara
  comVenda(A, 'vA', 'p1', 'P', 'Preto', 1);                                                          // A vendeu 1 (5 -> 4)
  igual(juntarBancos(A, B).products[0].variations[0].stock, 19, 'contagem de B menos a venda de A');
});
caso('pedido do site aplicado num aparelho não baixa de novo no outro', ()=>{
  const A = bancoDeTeste();
  A.sales = [{ id:'w1', origin:'loja', status:'pendente', canceled:false, estoqueBaixado:false, items:[{ productId:'p1', size:'P', color:'Preto', qty:2 }] }];
  const B = JSON.parse(JSON.stringify(A));
  DB = B; aplicarPedidosDaLoja();                    // B aplicou: 5 -> 3, flag true, carimbo
  const juntoEmA = juntarBancos(A, DB);
  igual(juntoEmA.sales[0].estoqueBaixado, true, 'vale a versão já baixada');
  igual(juntoEmA.products[0].variations[0].stock, 3, 'A fica com 3');
  DB = juntoEmA; aplicarPedidosDaLoja();
  igual(DB.products[0].variations[0].stock, 3, 'e não baixa de novo');
});

/* ============ vendas: o que conta como dinheiro ============ */
caso('pedido pendente do site não é faturamento; pago é', ()=>{
  verifica(!vendaValida({ canceled:false, status:'pendente', origin:'loja' }));
  verifica(vendaValida({ canceled:false, status:'pago', origin:'loja' }));
  verifica(vendaValida({ canceled:false, status:'concluida', origin:'pdv' }));
  verifica(!vendaValida({ canceled:true, status:'concluida' }));
});

caso('cancelar venda devolve estoque e tira a receita do Financeiro', ()=>{
  DB = bancoDeTeste();
  DB.sales = [{ id:'v1', origin:'pdv', status:'concluida', canceled:false, total: 30, financeId:'f9',
                items:[{ productId:'p1', size:'P', color:'Preto', qty: 1, price: 30 }] }];
  DB.finance.entries = [{ id:'f9', type:'receita', amount: 30, description:'Venda #v1' }];
  migrateDB();
  cancelSale('v1');
  igual(DB.products[0].variations[0].stock, 6);
  igual(DB.sales[0].canceled, true);
  igual(DB.finance.entries.length, 0, 'receita saiu');
  igual(DB.apagados.finance, ['f9'], 'e deixou lápide');
});

caso('marcar pedido pago duas vezes gera uma receita só', ()=>{
  DB = bancoDeTeste();
  DB.sales = [{ id:'abcdef123456', origin:'loja', status:'pendente', canceled:false, total: 50, items:[] }];
  migrateDB();
  markSalePaid('abcdef123456'); markSalePaid('abcdef123456');
  igual(DB.finance.entries.length, 1);
  igual(DB.sales[0].financeId, DB.finance.entries[0].id);
});

/* ============ balanço: gasto não conta duas vezes ============ */
caso('gasto mensal pago não é somado duas vezes no Balanço', ()=>{
  DB = bancoDeTeste();
  migrateDB();
  gastosMonth = monthKey();
  DB.monthlyExpenses.records = [{ id:'g1', month: monthKey(), category:'Aluguel', amount: 1000, status:'pendente' }];
  markGastoPaid('g1');
  igual(DB.finance.entries.length, 1, 'lançou no Financeiro');
  balancoPeriodo = 'mes';
  const g = resumoGastos(periodoBalanco());
  igual(g.mensais, 1000); igual(g.despesas, 0); igual(g.total, 1000);
  // editar o gasto para pendente tira o lançamento
  DB.monthlyExpenses.records[0].status = 'pendente';
  sincronizarGastoNoFinanceiro(DB.monthlyExpenses.records[0]);
  igual(DB.finance.entries.length, 0);
  // excluir tira junto
  DB.monthlyExpenses.records[0].status = 'pago';
  sincronizarGastoNoFinanceiro(DB.monthlyExpenses.records[0]);
  deleteGasto('g1');
  igual(DB.finance.entries.length, 0);
  igual(DB.monthlyExpenses.records.length, 0);
});

caso('custo de abertura parcialmente pago só lança o que faltava', ()=>{
  DB = bancoDeTeste(); migrateDB();
  DB.storeSetup.items = [{ id:'a1', category:'Outros', name:'Placa', planned: 500, paid: 200 }];
  markSetupPaid('a1');
  igual(DB.finance.entries[0].amount, 300);
  verifica(lancamentoEspelhado(DB.finance.entries[0]), 'é espelho: o Balanço não soma de novo');
});

/* ============ fuso horário ============ */
caso('venda das 23h do último dia fica no mês certo (fuso da loja)', ()=>{
  const d = new Date(2026, 8, 30, 23, 30);          // 30/09 23:30 no fuso local
  igual(chaveMes(d.toISOString()), '2026-09');
  igual(chaveDia(d.toISOString()), '2026-09-30');
  igual(chaveMes(''), '');
});

caso('data e hora da venda vão e voltam do campo sem deslocar', ()=>{
  const d = new Date(2026, 8, 4, 19, 5);
  const campo = paraDatetimeLocal(d.toISOString());
  igual(campo, '2026-09-04T19:05');
  igual(new Date(campo).toISOString(), d.toISOString());
});

/* ============ código de barras ============ */
caso('código de 6 dígitos sai no Code 128-C com 68 módulos', ()=>{
  const c = code128Barras('000010');
  igual(c.modulos, 68);
  const s = code128Simbolos('000010');
  igual(s[0], 105, 'começa em C');
  igual(s[s.length-1], 106, 'termina na parada');
  igual(s.slice(1,4), [0, 0, 10]);
});

caso('código com letras continua válido, dígito verificador confere', ()=>{
  const s = code128Simbolos('EC000008');
  let soma = s[0]; for(let k = 1; k < s.length - 2; k++) soma += s[k] * k;
  igual(s[s.length-2], soma % 103);
  igual(code128Simbolos('ção'), null, 'fora da tabela não gera código');
});

caso('etiqueta de 29 mm dá barra de 0,25 mm para código numérico', ()=>{
  const mm = espessuraDaBarraMM(29, '000010');
  verifica(Math.abs(mm - 0.254) < 0.001, 'três pontos da QL-800: ' + mm);
  verifica(espessuraDaBarraMM(29, 'EC000008') < BARRA_MINIMA_MM, 'o código antigo, comprido, não cabe');
});

caso('PDF das etiquetas e do recibo são gerados sem erro', ()=>{
  DB = bancoDeTeste(); migrateDB();
  const items = [{ p: DB.products[0], v: DB.products[0].variations[0] }];
  const pdf = criarPdfEtiquetas(items, midiaAtual(), DB.storeName, money);
  verifica(pdf && pdf.size > 500, 'PDF das etiquetas tem conteúdo');
  const recibo = criarPdfRecibo({ id:'v1', date: todayISO(), total: 30, discount: 0, payment:'PIX', seller:'Ana',
                                  items:[{ name:'Blusa', size:'P', color:'Preto', qty: 1, price: 30 }] }, DB.storeName, money, dateBR);
  verifica(recibo && recibo.size > 300, 'PDF do recibo tem conteúdo');
});

/* ============ senha ============ */
caso('senha em texto entra, continua em texto (compatível com a versão publicada)', async ()=>{
  DB = bancoDeTeste(); migrateDB();
  verifica(await tryLogin('admin', '1234'), 'entra com a senha de fábrica');
  igual(DB.users[0].pass, '1234', 'a senha continua em texto: um aparelho na versão 48 também entra');
  verifica(await tryLogin('ADMIN', '1234'), 'login não diferencia maiúsculas');
  verifica(await tryLogin('  admin ', '1234'), 'espaços em volta do usuário não atrapalham');
  verifica(!(await tryLogin('admin', '12345')), 'senha errada não entra');
  verifica(!(await tryLogin('ninguem', '1234')), 'usuário inexistente não entra');
  igual(await guardarSenha('segredo'), 'segredo');
  verifica(await senhaConfere({ pass: 'segredo' }, 'segredo'));
  verifica(!(await senhaConfere({ pass: 'segredo' }, 'segred')));
});
caso('senha que ficou como impressão digital (versões 49 a 53) entra e volta a texto', async ()=>{
  DB = bancoDeTeste(); migrateDB();
  DB.users[0].pass = await impressaoDaSenha('1234');
  verifica(await tryLogin('admin', '1234'), 'entra pela impressão digital');
  igual(DB.users[0].pass, '1234', 'e volta a texto para as outras versões');
});

caso('sessão de usuário apagado deixa de valer', ()=>{
  DB = bancoDeTeste(); migrateDB();
  SESSION = { id:'u1', user:'admin', role:'admin' };
  validarSessao(); verifica(SESSION, 'usuário existe: sessão fica');
  DB.users[0].role = 'vendedor';
  validarSessao(); igual(SESSION.role, 'vendedor', 'perfil acompanha o cadastro');
  verifica(!podeAbrir('config'), 'vendedora não abre Configurações');
  verifica(podeAbrir('pdv'), 'mas abre o PDV');
  DB.users = []; validarSessao(); igual(SESSION, null);
});


caso('dois usuários com o mesmo login viram um só, o mesmo em qualquer aparelho', ()=>{
  DB = bancoDeTeste();
  DB.users = [{ id:'zz', user:'admin', pass:'1234', role:'admin' }, { id:'aa', user:'Admin', pass:'sha256:abc', role:'admin' }];
  migrateDB();
  igual(DB.users.map(u=>u.id), ['aa'], 'fica o que não tem a senha de fábrica');
  igual(DB.apagados.users, ['zz']);
  DB = bancoDeTeste();
  DB.users = [{ id:'zz', user:'ana', pass:'x', role:'vendedor' }, { id:'aa', user:'ana', pass:'y', role:'vendedor' }];
  migrateDB();
  igual(DB.users.filter(u=>u.user==='ana').map(u=>u.id), ['aa'], 'empate: id menor');
  verifica(DB.users.some(u=>u.role==='admin'), 'e o admin de fábrica volta, porque não sobrou nenhum');
});

/* ============ envio à nuvem ============ */
caso('envio condicional: a linha mudou por baixo → junta e tenta de novo', async ()=>{
  DB = bancoDeTeste(); migrateDB();
  nuvemLida = true; nuvemVaziaConfirmada = false; ultimoCarimboDaNuvem = 'T1'; temPendencia = true;
  const deLa = bancoDeTeste(); deLa.sales = [{ id:'sx', total: 7, origin:'pdv', items:[] }];
  /* A primeira olhada ainda vê T1; logo depois outro aparelho grava (T2).
     O PATCH condicionado a T1 é recusado, a segunda olhada traz T2 com a
     venda do outro, e o PATCH condicionado a T2 entra. */
  let carimboAtual = 'T1', olhadas = 0;
  limparFetch();
  definirFetch(async (url, opts)=>{
    if(opts.method === 'PATCH'){
      const cond = decodeURIComponent(url.split('updated_at=eq.')[1].split('&')[0]);
      if(cond === carimboAtual){ carimboAtual = 'T3'; return resposta(200, [{ updated_at: 'T3' }]); }
      return resposta(200, []);
    }
    if(!opts.method){
      olhadas++;
      const r = resposta(200, [{ data: deLa, updated_at: carimboAtual }]);
      if(olhadas === 1) carimboAtual = 'T2';        // alguém grava logo depois da olhada
      return r;
    }
    return resposta(500, {});
  });
  await cloudPush();
  igual(temPendencia, false, 'gravou');
  igual(ultimoCarimboDaNuvem, 'T3');
  verifica(DB.sales.some(s=>s.id==='sx'), 'a venda do outro aparelho entrou junto');
  const patches = chamadasFetch().filter(c=>c.opts.method==='PATCH');
  igual(patches.length, 2, 'um PATCH recusado, um aceito');
});

caso('alteração feita DURANTE o envio continua pendente', async ()=>{
  DB = bancoDeTeste(); migrateDB();
  nuvemLida = true; ultimoCarimboDaNuvem = null; temPendencia = true;
  definirFetch(async (url, opts)=>{
    if(opts.method === 'POST'){ marcarParaEnviar(); return resposta(201, {}); }
    return resposta(200, []);
  });
  await cloudPush();
  igual(temPendencia, true, 'ainda há coisa para subir');
  igual(falhouAoEnviar, false);
});

caso('nuvem recusando (401) não passa por gravado', async ()=>{
  DB = bancoDeTeste(); migrateDB();
  nuvemLida = true; ultimoCarimboDaNuvem = null; temPendencia = true;
  definirFetch(async ()=>resposta(401, { message:'nope' }));
  await cloudPush();
  igual(temPendencia, true); igual(falhouAoEnviar, true); igual(ultimoErroNuvem.status, 401);
});

/* ============ vender com o estoque do sistema zerado ============ */
caso('peça na mão manda: vende com estoque 0 no sistema, sem negativo e sem inventar estoque no cancelamento', ()=>{
  DB = bancoDeTeste(); migrateDB();
  SESSION = { id:'u1', user:'admin', name:'Administrador', role:'admin' };
  DB.products[1].variations[0].stock = 0;                       // a Saia está "zerada" no sistema
  cart = []; pdvDiscount = 0; pdvCpf = ''; pdvCustomer = ''; pdvPayment = 'PIX';
  addToCart(DB.products[1], DB.products[1].variations[0]);      // bipou a Saia
  addToCart(DB.products[0], DB.products[0].variations[1]);      // e uma Blusa M (tem 2)
  igual(cart.map(i=>i.qty), [1, 1], 'as duas entraram no carrinho');
  finalizeSale();
  const v = DB.sales[DB.sales.length-1];
  igual(v.items.map(i=>i.baixou), [0, 1], 'a Saia não baixou nada, a Blusa baixou 1');
  igual(DB.products[1].variations[0].stock, 0, 'estoque nunca fica negativo');
  igual(DB.products[0].variations[1].stock, 1);
  igual(v.total, 80);
  cancelSale(v.id);
  igual(DB.products[1].variations[0].stock, 0, 'cancelar não inventa uma Saia que o sistema não tinha');
  igual(DB.products[0].variations[1].stock, 2, 'a Blusa volta');
});
caso('junção de aparelhos respeita o que cada venda baixou de verdade', ()=>{
  const A = bancoDeTeste(); A.products[1].variations[0].stock = 0;
  A.sales.push({ id:'vA', origin:'pdv', status:'concluida', canceled:false, total:50, items:[{ productId:'p2', size:'Único', color:'Padrão', qty:1, price:50, baixou:0 }] });
  const B = bancoDeTeste(); B.products[1].variations[0].stock = 0;
  igual(juntarBancos(B, A).products[1].variations[0].stock, 0);
  const C = bancoDeTeste();                                       // C ainda via 1 em estoque
  igual(juntarBancos(C, A).products[1].variations[0].stock, 1, 'a venda que não baixou nada não tira estoque de ninguém');
});

caso('preço mudado no carrinho vale só na venda, e a venda guarda o do cadastro', ()=>{
  DB = bancoDeTeste(); migrateDB();
  SESSION = { id:'u1', user:'admin', name:'Administrador', role:'admin' };
  cart = []; pdvDiscount = 0; pdvCpf = ''; pdvCustomer = ''; pdvPayment = 'Dinheiro';
  addToCart(DB.products[0], DB.products[0].variations[0]);      // Blusa, R$ 30 no cadastro
  addToCart(DB.products[1], DB.products[1].variations[0]);      // Saia, R$ 50
  igual(precoMudou(cart[0]), false);
  cart[0].price = 25;                                           // o que o botão do carrinho faz
  igual(precoMudou(cart[0]), true);
  igual(cartSubtotal(), 75);
  finalizeSale();
  const v = DB.sales[DB.sales.length-1];
  igual(v.total, 75);
  igual(v.items[0].price, 25); igual(v.items[0].precoCadastro, 30, 'a venda lembra o preço do cadastro');
  verifica(!('precoCadastro' in v.items[1]), 'peça sem mudança não carrega o campo');
  igual(DB.products[0].price, 30, 'o cadastro não muda');
  igual(DB.finance.entries[DB.finance.entries.length-1].amount, 75, 'o Financeiro recebe o valor cobrado');
});

/* ============ perdas e devoluções ============ */
function registrarMovimento(r){
  r = carimbar(Object.assign({ id: uid(), date: todayISO(), qty: 1, usuario:'Teste' }, r));
  aplicarMovimentoNoEstoque(r, +1); sincronizarDevolucaoNoFinanceiro(r); registrosDePerdas().push(r);
  return r;
}
caso('perda: tira do estoque, guarda quanto tirou, e excluir devolve', ()=>{
  DB = bancoDeTeste(); migrateDB();
  const r = registrarMovimento({ tipo:'perda', productId:'p1', name:'Blusa', size:'P', color:'Preto', qty:2, custoUnit:10, precoUnit:30, motivo:'Furto' });
  igual(DB.products[0].variations[0].stock, 3); igual(r.baixou, 2);
  igual(DB.finance.entries.length, 0, 'perda não é despesa de caixa');
  const resumo = resumoPerdas(()=>true);
  igual([resumo.perdas, resumo.perdasPecas, resumo.perdasCusto], [1, 2, 20]);
  excluirPerda(r.id);
  igual(DB.products[0].variations[0].stock, 5, 'voltou');
  igual(registrosDePerdas().length, 0); igual(DB.apagados.perdas, [r.id]);
  // perda de peça que o sistema já marcava zerada: não fica negativo, e excluir não inventa estoque
  DB.products[1].variations[0].stock = 0;
  const z = registrarMovimento({ tipo:'perda', productId:'p2', name:'Saia', size:'Único', color:'Padrão', qty:1, custoUnit:20 });
  igual(z.baixou, 0); igual(DB.products[1].variations[0].stock, 0);
  excluirPerda(z.id); igual(DB.products[1].variations[0].stock, 0);
});
caso('devolução em dinheiro: peça volta, despesa no Financeiro, sai da gaveta; excluir desfaz tudo', ()=>{
  DB = bancoDeTeste(); migrateDB();
  DB.cashRegister = { open:true, openedAt:'2026-01-01T00:00:00.000Z', openingAmount:100, movements:[], closedHistory:[] };
  DB.sales = [{ id:'v1', date: todayISO(), origin:'pdv', status:'concluida', canceled:false, total:30, payment:'Dinheiro',
                items:[{ productId:'p1', name:'Blusa', size:'P', color:'Preto', qty:1, price:30, cost:10, baixou:1 }] }];
  DB.products[0].variations[0].stock = 4;
  const r = registrarMovimento({ tipo:'devolucao', productId:'p1', name:'Blusa', size:'P', color:'Preto', qty:1, custoUnit:10, precoUnit:30,
                                 valor:30, reembolso:'Dinheiro', voltaAoEstoque:true, saleId:'v1', motivo:'Não serviu (tamanho)' });
  igual(DB.products[0].variations[0].stock, 5, 'voltou para o estoque');
  igual(DB.finance.entries.map(e=>[e.type, e.category, e.amount, e.origem]), [['despesa','Devolução',30,'devolucao']]);
  igual(DB.cashRegister.movements.map(m=>[m.type, m.amount]), [['sangria', 30]]);
  igual(devolvidoDaVenda('v1', DB.sales[0].items[0]), 1);
  verifica(lancamentoEspelhado(DB.finance.entries[0]), 'o Balanço não soma a devolução duas vezes');
  // venda com devolução não pode ser cancelada por cima
  cancelSale('v1'); igual(DB.sales[0].canceled, false);
  igual(DB.products[0].variations[0].stock, 5);
  // mudar para troca tira a despesa e a sangria
  r.reembolso = REEMBOLSO_TROCA; sincronizarDevolucaoNoFinanceiro(r);
  igual(DB.finance.entries.length, 0); igual(DB.cashRegister.movements.length, 0);
  r.reembolso = 'PIX'; sincronizarDevolucaoNoFinanceiro(r);
  igual(DB.finance.entries.length, 1); igual(DB.cashRegister.movements.length, 0, 'PIX não mexe na gaveta');
  excluirPerda(r.id);
  igual(DB.products[0].variations[0].stock, 4); igual(DB.finance.entries.length, 0);
  cancelSale('v1'); igual(DB.sales[0].canceled, true, 'sem devolução, cancela');
});
caso('Balanço: devolução desfaz a venda e perda entra a custo', ()=>{
  DB = bancoDeTeste(); migrateDB();
  DB.sales = [{ id:'v1', date: todayISO(), origin:'pdv', status:'concluida', canceled:false, total:30, payment:'PIX',
                items:[{ productId:'p1', name:'Blusa', size:'P', color:'Preto', qty:1, price:30, cost:10, baixou:1 }] },
              { id:'v2', date: todayISO(), origin:'pdv', status:'concluida', canceled:false, total:50, payment:'PIX',
                items:[{ productId:'p2', name:'Saia', size:'Único', color:'Padrão', qty:1, price:50, cost:20, baixou:1 }] }];
  registrarMovimento({ tipo:'devolucao', productId:'p1', name:'Blusa', size:'P', color:'Preto', qty:1, custoUnit:10, valor:30, reembolso:'PIX', voltaAoEstoque:true, saleId:'v1' });
  registrarMovimento({ tipo:'perda', productId:'p1', name:'Blusa', size:'M', color:'Preto', qty:1, custoUnit:10 });
  balancoPeriodo = 'mes';
  const per = periodoBalanco(), ven = resumoVendas(per), gas = resumoGastos(per), pd = resumoPerdas(per.casa);
  igual([ven.total, ven.custoVendido], [80, 30]);
  igual(gas.despesas, 0, 'a despesa da devolução não entra de novo em "outras despesas"');
  igual([pd.devValor, pd.devCustoVoltou, pd.perdasCusto], [30, 10, 10]);
  igual(ven.total - pd.devValor - (ven.custoVendido - pd.devCustoVoltou) - gas.total - pd.perdasCusto, 20, 'sobrou: a Saia (50−20) menos a perda (10)');
});
caso('junção: perda num aparelho e venda da mesma peça no outro, as duas baixam', ()=>{
  const A = bancoDeTeste(), B = bancoDeTeste();
  DB = A; migrateDB();
  registrarMovimento({ id:'m1', tipo:'perda', productId:'p1', name:'Blusa', size:'P', color:'Preto', qty:1, custoUnit:10 });   // A: 5 -> 4
  comVenda(B, 'vB', 'p1', 'P', 'Preto', 1);                                                                                    // B: 5 -> 4
  B.products[0].atualizadoEm = '2099-01-01T00:00:00.000Z';            // o registro de B é o mais novo
  B.perdas = { records: [] };
  const emA = juntarBancos(DB, B), emB = juntarBancos(B, DB);
  igual(emA.products[0].variations[0].stock, 3, 'em A');
  igual(emB.products[0].variations[0].stock, 3, 'em B');
  igual(emB.perdas.records.length, 1, 'a perda chega no outro aparelho');
  // excluída em A, não volta de B
  DB = emA; excluirPerda('m1');
  igual(juntarBancos(DB, emB).perdas.records.length, 0);
  igual(juntarBancos(DB, emB).products[0].variations[0].stock, 4, 'e o estoque volta nos dois');
});

/* ============ etiqueta ============ */
caso('etiqueta: tudo dentro da área que a QL-800 imprime, em todos os rolos', ()=>{
  const margem = 1.5 * 72 / 25.4;
  const pecas = [
    { p:{ name:'Conjunto Canelado Manga Longa Feminino', price:120 }, v:{ size:'G', color:'Bege', barcode:'000057' } },
    { p:{ name:'Blusa Teddy ✨', price:39.99 }, v:{ size:'unico ate 42', color:'Verde Escuro Musgo', barcode:'000207' } },
    { p:{ name:'TOP', price:1299.9 }, v:{ size:'Único', color:'Padrão', barcode:'000046' } } ];
  Object.values(MIDIAS_QL800).concat([{ w:29, h:22 }, { w:29, h:30 }, { w:62, h:30 }]).forEach(m=>pecas.forEach(item=>{
    ['auto','pe','deitada'].forEach(posicao=>{
    const d = desenharEtiqueta(item, { w:m.w, h:m.h }, 'Estilo Fashion', money, { posicao });
    d.prims.forEach(p=>{
      const x0 = p.x, x1 = p.t === 'texto' ? p.x + p.largura : p.t === 'barras' ? p.x + Math.max(...p.barras.map(b=>(b.x + b.w) * p.modulo)) : p.x + p.w;
      const y0 = p.t === 'texto' ? p.y - p.pt * 0.22 : p.y, y1 = p.t === 'texto' ? p.y + p.pt * 0.75 : p.y + p.h;
      assert.ok(x0 >= margem - 0.1 && x1 <= d.largura - margem + 0.1, `${m.w}x${m.h} "${item.p.name}": ${p.t} "${p.texto||''}" sai pelos lados`);
      assert.ok(y0 >= margem - 0.1 && y1 <= d.altura - margem + 0.1, `${m.w}x${m.h} "${item.p.name}": ${p.t} "${p.texto||''}" sai por cima ou por baixo`);
    });
    resultados.verificacoes++;
    verifica(d.prims.some(p=>p.t === 'barras'), 'tem código de barras');
    });
  }));
});
caso('etiqueta: hierarquia, medidas da fonte e fita estreita deitada', ()=>{
  igual(Math.round(larguraTexto('Estilo', 10, false) * 100) / 100, 24.45, 'Helvetica de verdade, letra a letra');
  verifica(larguraTexto('iiii', 10, false) < larguraTexto('MMMM', 10, false) / 3, 'i estreito, M largo');
  igual(larguraTexto('ção', 10, false), larguraTexto('cao', 10, false), 'acento não muda a largura');
  igual(limparTexto('Blusa ✨ Teddy  '), 'Blusa Teddy');
  const item = { p:{ name:'Conjunto Canelado Manga Longa Feminino', price:120 }, v:{ size:'G', color:'Bege', barcode:'000057' } };
  const d = desenharEtiqueta(item, { w:29, h:40 }, 'Estilo Fashion', money);
  const textos = d.prims.filter(p=>p.t === 'texto');
  igual(textos.map(p=>p.texto), ['ESTILO FASHION','Conjunto Canelado Manga','Longa Feminino','G','Bege','000057','R$','120,00']);
  const preco = textos.find(p=>p.texto === '120,00'), nome = textos.find(p=>p.texto === 'Longa Feminino');
  verifica(preco.negrito && preco.pt > nome.pt * 1.8, 'o preço é o maior texto da etiqueta');
  igual(textos.find(p=>p.texto === 'G').cor, 1, 'tamanho em branco sobre a tarja preta');
  verifica(d.prims.some(p=>p.t === 'ret' && p.raio), 'a tarja');
  igual(Math.round(barraDaEtiquetaMM({ w:29, h:40 }, '000057') * 1000), 254, 'barra de 3 pontos na fita de 29 mm');
  const fina = desenharEtiqueta(item, { w:17, h:54 }, 'Estilo Fashion', money);
  igual(fina.girar, true);
  igual(desenharEtiqueta(item, { w:29, h:90 }, 'Estilo Fashion', money).girar, true, 'a 29 × 90 da loja sai deitada');
  igual(desenharEtiqueta(item, { w:29, h:90 }, 'Estilo Fashion', money, { posicao:'pe' }).girar, false, 'a loja pode pedir em pé');
  igual(desenharEtiqueta(item, { w:29, h:40 }, 'Estilo Fashion', money).girar, false, 'a 29 × 40 continua em pé');
  igual(desenharEtiqueta(item, { w:29, h:40 }, 'Estilo Fashion', money, { posicao:'deitada' }).girar, true);
  verifica(barraDaEtiquetaMM({ w:17, h:54 }, '000057') >= BARRA_MINIMA_MM, 'deitada, a fita de 17 mm passa a ser lida');
  const semNada = desenharEtiqueta(item, { w:29, h:40 }, 'Estilo Fashion', money, { semLoja:true, semPreco:true, semVariante:true });
  igual(semNada.prims.filter(p=>p.t === 'texto').map(p=>p.texto), ['Conjunto Canelado Manga','Longa Feminino','000057']);
  const baixa = desenharEtiqueta(item, { w:29, h:22 }, 'Estilo Fashion', money);
  verifica(baixa.prims.some(p=>p.t === 'texto' && /G\/Bege$/.test(p.texto)), 'na etiqueta baixa, quem é cortado é o nome, não o tamanho');
  const svg = desenhoParaSvg(fina, 17, 54, 2);
  verifica(/width="34.00mm"/.test(svg) && /matrix\(0 -1 1 0 0/.test(svg), 'a prévia gira junto');
  verifica(criarPdfEtiquetas([item, item], { w:17, h:54 }, 'Estilo Fashion', money).size > 1500);
});

/* ============ leitor de código de barras ============ */
caso('bipe: código exato, com Caps Lock, e código no fim de um campo sujo', ()=>{
  DB = bancoDeTeste(); DB.products[0].variations[0].barcode = 'EC000007'; migrateDB();
  igual(findVariationByBarcode('000002').variation.size, 'M');
  igual(findVariationByBarcode(' 000002 ').variation.size, 'M', 'espaços em volta');
  igual(findVariationByBarcode('ec000007').variation.size, 'P', 'leitor com Caps Lock trocado');
  igual(findVariationByBarcode('999999'), null);
  igual(findVariationByBarcode(''), null);
  igual(acharCodigoNoFim('999999000003').product.name, 'Saia', 'sobra de um bipe errado + bipe novo');
  igual(acharCodigoNoFim('999999000002000003').product.name, 'Saia', 'vale o último lido');
  igual(acharCodigoNoFim('000003'), null, 'código exato não é "no fim"');
  igual(acharCodigoNoFim('blusa'), null);
});

/* ============ cupom fiscal (NFC-e) ============ */
const nfce = requireNode(raizDoProjeto + '/api/nfce.js');
function bancoFiscal(){
  const d = bancoDeTeste();
  d.config.fiscal = Object.assign({}, defaultDB().config.fiscal, { ativo:true, cnpj:'12.345.678/0001-90' });
  d.products[0].ncm = '61044200';
  d.sales = [{ id:'v123456', date:'2026-09-14T13:00:00.000Z', payment:'PIX', discount: 5, total: 85, status:'concluida', origin:'pdv', canceled:false,
               items:[{ productId:'p1', name:'Blusa', size:'P', color:'Preto', qty:2, price:30, barcode:'000001' },
                      { productId:'p2', name:'Saia', size:'Único', color:'Padrão', qty:1, price:30 }] }];
  return d;
}
caso('NFC-e: itens, NCM, desconto rateado e forma de pagamento saem certos', ()=>{
  const d = bancoFiscal();
  const { nota, total } = nfce.montarNfce(d, d.sales[0], { dataEmissao:'2026-09-14T10:00:00-03:00', cpf:'123.456.789-09', nomeCliente:'Ana' });
  igual(nota.cnpj_emitente, '12345678000190');
  igual(nota.itens.length, 2);
  igual(nota.itens[0].codigo_ncm, '61044200', 'NCM da peça');
  igual(nota.itens[1].codigo_ncm, '61091000', 'NCM padrão quando a peça não tem');
  igual(nota.itens[0].descricao, 'Blusa P Preto'); igual(nota.itens[1].descricao, 'Saia', 'Único/Padrão não vai na descrição');
  igual(nota.itens[0].valor_bruto, 60); igual(nota.itens[1].valor_bruto, 30);
  igual(nota.itens[0].valor_desconto, 3.33); igual(nota.itens[1].valor_desconto, 1.67, 'a última peça fecha a conta');
  igual(nota.itens[0].icms_situacao_tributaria, '102'); igual(nota.itens[0].pis_situacao_tributaria, '49'); igual(nota.itens[0].cfop, '5102');
  igual(nota.formas_pagamento, [{ forma_pagamento:'17', valor_pagamento: 85 }]);
  igual(total, 85);
  igual(nota.cpf_destinatario, '12345678909'); igual(nota.nome_destinatario, 'Ana');
  igual(nota.presenca_comprador, '1'); igual(nota.data_emissao, '2026-09-14T10:00:00-03:00');
});
caso('NFC-e: códigos de pagamento e erros de cadastro', ()=>{
  igual(['Dinheiro','PIX','Crédito','Débito','Cartão de crédito','outra'].map(nfce.codigoDaForma), ['01','17','03','04','03','99']);
  const semCnpj = bancoFiscal(); semCnpj.config.fiscal.cnpj = '';
  assert.throws(()=>nfce.montarNfce(semCnpj, semCnpj.sales[0]), /CNPJ/);
  const ncmRuim = bancoFiscal(); ncmRuim.products[0].ncm = '123';
  assert.throws(()=>nfce.montarNfce(ncmRuim, ncmRuim.sales[0]), /NCM/);
  const semCpf = bancoFiscal();
  verifica(!('cpf_destinatario' in nfce.montarNfce(semCpf, semCpf.sales[0]).nota), 'sem CPF não identifica');
});
caso('NFC-e: a função recusa chave errada e emite com a certa (provedor simulado)', async ()=>{
  process.env.FISCAL_SENHA = 'segredo'; process.env.FOCUS_NFE_TOKEN = 'tok'; process.env.FOCUS_NFE_AMBIENTE = 'homologacao';
  const d = bancoFiscal();
  const chamadas = [];
  definirFetch(async (url, opts)=>{
    chamadas.push([opts.method||'GET', String(url)]);
    if(String(url).includes('/rest/v1/')) return resposta(200, [{ data: d }]);
    if(String(url).includes('/v2/nfce/venda-v123456') && !opts.method) return resposta(404, {});
    if(String(url).includes('/v2/nfce?ref=') && opts.method === 'POST'){
      const corpo = JSON.parse(opts.body);
      igual(corpo.itens.length, 2); igual(corpo.formas_pagamento[0].valor_pagamento, 85);
      verifica(opts.headers.Authorization.startsWith('Basic '), 'token vai em Basic');
      return resposta(201, { status:'autorizado', status_sefaz:'100', mensagem_sefaz:'Autorizado o uso da NF-e', chave_nfe:'NFe3526', numero:'42', serie:'1', caminho_danfe:'/arquivos/x.html', qrcode_url:'https://q' });
    }
    return resposta(500, {});
  });
  const roda = corpo => new Promise(res=>{ const out = { headers:{}, setHeader(k,v){ this.headers[k]=v; }, end(b){ res({ status: this.statusCode, corpo: JSON.parse(b) }); } };
    nfce({ method:'POST', body: corpo }, out); });
  const errada = await roda({ acao:'emitir', vendaId:'v123456', chave:'x' });
  igual(errada.status, 401);
  const certa = await roda({ acao:'emitir', vendaId:'v123456', chave:'segredo' });
  igual(certa.status, 200); igual(certa.corpo.nfce.status, 'autorizado'); igual(certa.corpo.nfce.numero, '42');
  igual(certa.corpo.nfce.danfe, 'https://homologacao.focusnfe.com.br/arquivos/x.html', 'link do cupom completo');
  igual(certa.corpo.nfce.ambiente, 'homologacao');
  const semVenda = await roda({ acao:'emitir', vendaId:'nao-existe', chave:'segredo' });
  igual(semVenda.status, 400); verifica(/não encontrada/.test(semVenda.corpo.erro));
  const info = await new Promise(res=>{ nfce({ method:'GET' }, { headers:{}, setHeader(){}, end(b){ res(JSON.parse(b)); } }); });
  igual(info.tokenConfigurado, true); igual(info.chaveConfigurada, true);
});

/* ============ versão 62: o que a auditoria achou ============ */
function aparelhoNovo(){
  ['estiloCiaDB','estiloCiaDB_ts','estiloCiaDB_pendente','estiloCiaDB_carimboNuvem','estiloCiaDB_semNuvem','estiloCiaDB_substituir','estiloCiaDB_copias']
    .forEach(k=>localStorage.removeItem(k));
  clearTimeout(pushTimer);
  nuvemLida = false; nuvemVaziaConfirmada = false; falhouAoEnviar = false; enviandoAgora = false; SESSION = null;
}
function nuvemDeMentira(estado){
  /* estado = { data, updated_at }: uma linha só, com gravação condicional. */
  estado.patches = 0;
  definirFetch(async (url, opts)=>{
    if(!opts.method) return resposta(200, estado.data ? [{ data: JSON.parse(JSON.stringify(estado.data)), updated_at: estado.updated_at }] : []);
    const corpo = JSON.parse(opts.body);
    if(opts.method === 'PATCH'){
      const cond = decodeURIComponent(url.split('updated_at=eq.')[1].split('&')[0]);
      if(cond !== estado.updated_at) return resposta(200, []);
      estado.data = corpo.data; estado.updated_at = corpo.updated_at; estado.patches++;
      return resposta(200, [{ updated_at: estado.updated_at }]);
    }
    if(opts.method === 'POST'){ estado.data = corpo.data; estado.updated_at = corpo.updated_at; return resposta(201, {}); }
    return resposta(500, {});
  });
  return estado;
}
const vendaDeTeste = (id, extra) => Object.assign({ id, date: todayISO(), total: 30, origin:'pdv', status:'concluida', payment:'PIX',
  items:[{ productId:'p1', name:'Blusa', size:'P', color:'Preto', qty:1, price:30, baixou:1 }] }, extra || {});

caso('venda feita sem internet sobrevive a fechar a página e sobe junto com o que os outros fizeram', async ()=>{
  aparelhoNovo();
  DB = bancoDeTeste(); migrateDB(); gravarLocal();
  lembrarBancoVazio(false); lembrarCarimbo('T1'); lembrarPendencia(false);
  /* o celular vende sem internet */
  DB.products[0].variations[0].stock = 4;
  DB.sales.push(vendaDeTeste('v-celular'));
  saveDB(); clearTimeout(pushTimer);
  /* a página é fechada e reaberta */
  DB = null; temPendencia = false; ultimoCarimboDaNuvem = null;
  loadDB(); clearTimeout(pushTimer);
  igual(temPendencia, true, 'o aparelho lembra que tem venda para subir');
  igual(ultimoCarimboDaNuvem, 'T1', 'e de qual versão da nuvem ele partiu');
  /* enquanto isso o computador vendeu outra peça e gravou (T2) */
  const deLa = bancoDeTeste();
  deLa.products[1].variations[0].stock = 0;
  deLa.sales = [vendaDeTeste('v-computador', { items:[{ productId:'p2', name:'Saia', size:'Único', color:'Padrão', qty:1, price:50, baixou:1 }] })];
  const nuvem = nuvemDeMentira({ data: deLa, updated_at: 'T2' });
  await cloudPull(); clearTimeout(pushTimer);
  verifica(DB.sales.some(v=>v.id === 'v-celular'), 'a venda do celular não foi trocada pelo que estava na nuvem');
  verifica(DB.sales.some(v=>v.id === 'v-computador'), 'a venda do computador entrou');
  igual(DB.products[0].variations[0].stock, 4, 'baixa do celular');
  igual(DB.products[1].variations[0].stock, 0, 'baixa do computador');
  await cloudPush(); clearTimeout(pushTimer);
  igual(temPendencia, false, 'subiu');
  igual(lerRecado(CHAVE_PENDENTE), null, 'e o recado de pendência saiu do aparelho');
  verifica(nuvem.data.sales.length === 2, 'a nuvem ficou com as duas vendas');
});

caso('relógio errado não decide nada: nuvem com carimbo diferente é trazida, com carimbo igual não', async ()=>{
  aparelhoNovo();
  DB = bancoDeTeste(); migrateDB(); gravarLocal();
  lembrarBancoVazio(false); lembrarCarimbo('2026-01-01T10:00:00.000Z'); lembrarPendencia(false);
  localStorage.setItem(LOCAL_TS_KEY, String(Date.parse('2030-01-01T00:00:00Z')));   // aparelho com a hora lá na frente
  const deLa = bancoDeTeste(); deLa.products.push({ id:'p3', name:'Vestido', cost:1, price:2, variations:[{ size:'U', color:'X', stock:1, barcode:'000009' }] });
  nuvemDeMentira({ data: deLa, updated_at: '2026-01-01T09:59:00.000Z' });          // pedido do site, celular da cliente atrasado
  await cloudPull(); clearTimeout(pushTimer);
  verifica(DB.products.some(p=>p.id === 'p3'), 'a versão nova da nuvem entrou, mesmo com "hora" mais velha');
  igual(ultimoCarimboDaNuvem, '2026-01-01T09:59:00.000Z');
  DB.products = DB.products.filter(p=>p.id !== 'p3');
  await cloudPull(); clearTimeout(pushTimer);
  verifica(!DB.products.some(p=>p.id === 'p3'), 'mesma versão: nada é trazido de novo');
});

caso('aparelho que abriu vazio não impõe caixa, configurações nem nome de fábrica à loja', async ()=>{
  aparelhoNovo();
  loadDB(); clearTimeout(pushTimer);
  igual(bancoVeioVazio, true);
  saveDB(); clearTimeout(pushTimer);                 // alguém mexeu antes de a nuvem responder
  DB = null; loadDB(); clearTimeout(pushTimer);      // fechou e abriu de novo
  igual(bancoVeioVazio, true, 'continua sabendo que nasceu vazio');
  const deLa = bancoDeTeste(); migrateDB.call(null);
  deLa.storeName = 'Loja da Maria'; deLa.config = Object.assign({}, defaultDB().config, { pixKey:'chave-da-loja', whatsapp:'11999990000' });
  deLa.cashRegister = { open:true, openedAt:'2026-09-04T10:00:00.000Z', openingAmount:1000, movements:[], closedHistory:[] };
  const nuvem = nuvemDeMentira({ data: deLa, updated_at: 'T9' });
  await cloudPull(); clearTimeout(pushTimer);
  igual(DB.config.pixKey, 'chave-da-loja'); igual(DB.storeName, 'Loja da Maria');
  igual(DB.cashRegister.openingAmount, 1000, 'o caixa da loja continua aberto com o troco');
  igual(DB.products.length, 2);
  igual(bancoVeioVazio, false);
  await cloudPush(); clearTimeout(pushTimer);
  igual(nuvem.data.config.pixKey, 'chave-da-loja', 'e o que subiu não apagou o PIX da loja');
});

caso('sem conseguir ler a nuvem, nada é gravado nela', async ()=>{
  aparelhoNovo();
  DB = bancoDeTeste(); migrateDB();
  nuvemLida = true; lembrarCarimbo('T1'); lembrarPendencia(true);
  limparFetch();
  definirFetch(async (url, opts)=> opts.method ? resposta(200, [{ updated_at:'T2' }]) : resposta(503, {}));
  await cloudPush(); clearTimeout(pushTimer);
  igual(chamadasFetch().filter(c=>c.opts.method).length, 0, 'nenhum PATCH nem POST saiu');
  igual(temPendencia, true); igual(falhouAoEnviar, true);
});

caso('caixa na junção: abertura, troco e sangria do computador sobrevivem à venda do celular', ()=>{
  const computador = bancoDeTeste(), celular = bancoDeTeste();
  computador.cashRegister = { open:true, openedAt:'2026-09-28T12:00:00.000Z', openingAmount:100,
    movements:[{ id:'m1', type:'sangria', amount:50, note:'banco', date:'2026-09-28T13:00:00.000Z' }], closedHistory:[] };
  celular.cashRegister = { open:true, automatica:true, openedAt:'2026-09-28T14:00:00.000Z', openingAmount:0, movements:[], closedHistory:[] };
  const j = juntarBancos(celular, computador);
  igual(j.cashRegister.openingAmount, 100); igual(j.cashRegister.openedAt, '2026-09-28T12:00:00.000Z');
  igual(j.cashRegister.movements.length, 1, 'a sangria ficou');
  verifica(!j.cashRegister.automatica);
  /* o computador fecha; o celular, que ainda via aberto, grava depois */
  const fechado = bancoDeTeste();
  fechado.cashRegister = { open:false, openedAt:null, openingAmount:0, movements:[],
    closedHistory:[{ openedAt:'2026-09-28T12:00:00.000Z', closedAt:'2026-09-28T20:00:00.000Z', openingAmount:100, totalSales:300, movements:[] }] };
  const j2 = juntarBancos(j, fechado);
  igual(j2.cashRegister.open, false, 'sessão fechada num aparelho fica fechada');
  igual(j2.cashRegister.closedHistory.length, 1);
  igual(j2.cashRegister.closedHistory[0].movements.length, 1, 'a sangria entra no histórico da sessão');
  igual(juntarBancos(j2, j).cashRegister.closedHistory.length, 1, 'juntar de novo não dobra o histórico');
});

caso('configurações: vale o lado mexido por último', ()=>{
  const a = bancoDeTeste(), b = bancoDeTeste();
  a.config = Object.assign({}, a.config, { pixKey:'velha', atualizadoEm:'2026-09-01T00:00:00.000Z' });
  b.config = Object.assign({}, b.config, { pixKey:'nova', atualizadoEm:'2026-09-02T00:00:00.000Z' }); b.storeName = 'Nome Novo';
  igual(juntarBancos(a, b).config.pixKey, 'nova'); igual(juntarBancos(a, b).storeName, 'Nome Novo');
  igual(juntarBancos(b, a).config.pixKey, 'nova');
  delete a.config.atualizadoEm; delete b.config.atualizadoEm;
  igual(juntarBancos(a, b).config.pixKey, 'velha', 'sem carimbo vale o daqui');
});

caso('entrada de mercadoria e preço novo do computador não se perdem com a venda do celular', ()=>{
  aparelhoNovo();
  SESSION = { id:'u1', name:'Ana', role:'admin' };
  const base = bancoDeTeste(); base.products[0].variations[0].stock = 10;
  const computador = JSON.parse(JSON.stringify(base));
  computador.products[0].variations[0].stock = 20; computador.products[0].price = 60;
  computador.products[0].atualizadoEm = '2026-09-28T10:00:00.000Z';
  DB = JSON.parse(JSON.stringify(base)); migrateDB();
  cart = [{ productId:'p1', name:'Blusa', size:'P', color:'Preto', price:30, qty:1 }];
  pdvDiscount = 0; pdvPayment = 'PIX'; pdvCustomer = ''; pdvCpf = '';
  finalizeSale(); clearTimeout(pushTimer);
  igual(DB.products[0].variations[0].stock, 9);
  verifica(!DB.products[0].atualizadoEm, 'a venda não carimba a peça');
  const j = juntarBancos(DB, computador);
  igual(j.products[0].variations[0].stock, 19, '20 da entrada menos 1 da venda');
  igual(j.products[0].price, 60);
  SESSION = null;
});

caso('formulário aberto continua segurando o registro certo depois de a nuvem trazer novidade', ()=>{
  DB = bancoDeTeste(); migrateDB();
  const editando = DB.products[0];
  const deLa = JSON.parse(JSON.stringify(DB));
  deLa.products[0].price = 99; deLa.products[0].atualizadoEm = todayISO();
  const antigo = DB;
  DB = juntarBancos(DB, deLa); manterReferencias(antigo, DB);
  verifica(DB.products[0] === editando, 'é o mesmo objeto');
  igual(editando.price, 99, 'com o conteúdo novo');
});

caso('restaurar backup TROCA a loja: o que foi desfeito não volta pela nuvem', async ()=>{
  aparelhoNovo();
  DB = bancoDeTeste(); migrateDB(); gravarLocal(); lembrarBancoVazio(false); lembrarCarimbo('T1');
  nuvemLida = true;
  const deLa = bancoDeTeste(); deLa.sales = [vendaDeTeste('venda-errada', { atualizadoEm: todayISO() })];
  const nuvem = nuvemDeMentira({ data: deLa, updated_at: 'T5' });
  trocarBancoInteiro(bancoDeTeste());
  saveDB(); clearTimeout(pushTimer);
  igual(substituirNaNuvem, true);
  await cloudPull(); clearTimeout(pushTimer);
  verifica(!DB.sales.some(v=>v.id === 'venda-errada'), 'a leitura não juntou');
  await cloudPush(); clearTimeout(pushTimer);
  igual(temPendencia, false); igual(substituirNaNuvem, false);
  verifica(!nuvem.data.sales.some(v=>v.id === 'venda-errada'), 'a nuvem ficou igual ao backup');
  igual(nuvem.patches, 1);
});

caso('peça do sistema antigo vendida até zerar não ressuscita com o estoque velho', ()=>{
  DB = { products:[{ id: 7, nome:'T-shirt', precoVenda: 35, variacoes:[{ tam:'M', cor:'Marrom', qtd: 2 }] }] };
  migrateDB();
  verifica(!('variacoes' in DB.products[0]) && !('nome' in DB.products[0]), 'os campos antigos saem depois de aproveitados');
  DB.products[0].variations[0].stock = 0; DB.products[0].variations[0].barcode = '';
  DB.products[0].price = 0;
  igual(normalizeDB(), false, 'nada mais para reparar');
  igual(DB.products[0].variations[0].stock, 0); igual(DB.products[0].price, 0, 'preço zerado de propósito fica zerado');
});

caso('backup do sistema antigo: clientes e custos de abertura entram antes de a sobra sair', ()=>{
  DB = { products:[], clients:[{ id:1, nome:'Gisele', tel:'11999' }],
         abertura:[{ id:1, cat:'Ponto/Aluguel', desc:'Aluguel', pago:true, previsto:1410 }, { id:2, cat:'Outros', desc:'Tinta', pago:false, previsto:80 }],
         settings:{ storeName:'LÚMINA' }, seq:{}, cash:[] };
  migrateDB();
  igual(DB.customers.map(c=>[c.name, c.phone]), [['Gisele','11999']]);
  igual(DB.storeSetup.items.map(i=>[i.name, i.planned, i.paid]), [['Aluguel',1410,1410],['Tinta',80,0]]);
  verifica(!('clients' in DB) && !('abertura' in DB) && !('settings' in DB));
});

caso('dois custos de abertura iguais lançados pela loja são duas compras', ()=>{
  DB = bancoDeTeste();
  DB.storeSetup.items = [
    { id:'a', category:'Móveis', name:'Manequim', planned:300, paid:300, atualizadoEm:'2026-09-01T00:00:00.000Z' },
    { id:'b', category:'Móveis', name:'Manequim', planned:250, paid:250, atualizadoEm:'2026-09-02T00:00:00.000Z' },
    { id:'c', category:'Móveis', name:'Arara', planned:100, paid:0 },
    { id:'d', category:'Móveis', name:'Arara', planned:100, paid:0 } ];
  migrateDB();
  igual(DB.storeSetup.items.map(i=>i.id).sort(), ['a','b','c'], 'só a cópia sem carimbo sai');
});

caso('cancelar venda de peça que ganhou cor depois devolve o estoque (e avisa quando não acha)', ()=>{
  DB = bancoDeTeste(); migrateDB();
  DB.sales.push(vendaDeTeste('va', { items:[{ productId:'p2', name:'Saia', size:'Único', color:'Padrão', qty:1, price:50, baixou:1 }] }));
  DB.products[1].variations[0].stock = 0;
  DB.products[1].variations[0].color = 'Preto';                       // o lojista completou o cadastro
  igual(mexerNoEstoqueDaVenda(DB.sales[0].items, +1), [], 'achou a peça mesmo com a cor trocada');
  igual(DB.products[1].variations[0].stock, 1);
  const sumiu = mexerNoEstoqueDaVenda([{ productId:'p1', name:'Blusa', size:'GG', color:'Rosa', qty:1, baixou:1 }], +1);
  igual(sumiu.length, 1, 'peça com várias combinações e nenhuma igual: avisa em vez de dizer que devolveu');
});

caso('excluir venda e peça é do administrador; venda com cupom fiscal não se exclui', ()=>{
  DB = bancoDeTeste(); migrateDB();
  DB.sales.push(vendaDeTeste('v1'), vendaDeTeste('v2', { nfce:{ status:'autorizado', chave:'35...' } }));
  SESSION = { id:'u9', name:'Bia', role:'vendedor' };
  excluirVenda('v1'); deleteProduct('p1');
  igual(DB.sales.length, 2); igual(DB.products.length, 2);
  SESSION = { id:'u1', name:'Ana', role:'admin' };
  excluirVenda('v2');
  igual(DB.sales.length, 2, 'cupom autorizado segura a venda');
  excluirVenda('v1'); clearTimeout(pushTimer);
  igual(DB.sales.map(v=>v.id), ['v2']);
  SESSION = null;
});

caso('Abrir Loja: pago voltou a zero e foi marcado de novo → uma despesa só; excluir leva a despesa junto', ()=>{
  DB = bancoDeTeste(); migrateDB();
  DB.storeSetup.items = [{ id:'s1', category:'Móveis', name:'Balcão', planned:1000, paid:0, atualizadoEm: todayISO() }];
  markSetupPaid('s1');
  igual(lancamentosDaAbertura('s1').length, 1);
  DB.storeSetup.items[0].paid = 0; acertarAberturaNoFinanceiro(DB.storeSetup.items[0]);
  igual(lancamentosDaAbertura('s1').length, 0, 'voltou a zero: a despesa sai');
  markSetupPaid('s1');
  igual(lancamentosDaAbertura('s1').reduce((a,e)=>a + e.amount, 0), 1000);
  DB.storeSetup.items[0].paid = 400; acertarAberturaNoFinanceiro(DB.storeSetup.items[0]);
  igual(lancamentosDaAbertura('s1').reduce((a,e)=>a + e.amount, 0), 400);
  deleteSetup('s1'); clearTimeout(pushTimer);
  igual(lancamentosDaAbertura('s1').length, 0);
});

caso('planilha: célula que começa com = + - @ não vira fórmula; número negativo continua número', ()=>{
  igual(textoSeguroNaPlanilha('=1+1'), "'=1+1"); igual(textoSeguroNaPlanilha('@SUM(A1)'), "'@SUM(A1)");
  igual(textoSeguroNaPlanilha('-12,50'), '-12,50'); igual(textoSeguroNaPlanilha('Rasgou'), 'Rasgou'); igual(textoSeguroNaPlanilha(null), '');
});

caso('bipe em campo de dinheiro é reconhecido como bipe', ()=>{
  DB = bancoDeTeste(); migrateDB();
  verifica(codigoBipadoEmCampoDeValor('000001'), 'código do cadastro');
  igual(codigoBipadoEmCampoDeValor('29.90'), null); igual(codigoBipadoEmCampoDeValor('150'), null);
  igual(codigoBipadoEmCampoDeValor('999999'), null, 'número grande que não é código continua sendo valor');
});

caso('NFC-e: desconto rateado em centavos fecha sempre, e o pagamento bate com as peças', ()=>{
  const nfce = requireNode(raizDoProjeto + '/api/nfce.js');
  igual(nfce.ratearDesconto([10,10,10,10], 0.02).reduce((a,v)=>a + v, 0).toFixed(2), '0.02');
  igual(nfce.ratearDesconto([29.9,29.9,29.9,0], 10), [3.33,3.33,3.34,0], 'brinde de R$ 0,00 não recebe desconto');
  igual(nfce.ratearDesconto([10,5], -3), [0,0], 'desconto negativo não existe');
  const db = { config:{ fiscal:{ cnpj:'12345678000199' } }, products:[] };
  const venda = { id:'v1', date:'2026-09-28', discount:0.02, payment:'Crédito',
    items:[1,2,3,4].map(n=>({ productId:'p'+n, name:'Peça '+n, size:'U', color:'X', qty:1, price:10 })) };
  const { nota, total } = nfce.montarNfce(db, venda, {});
  const liquido = nota.itens.reduce((a,i)=>a + i.valor_bruto - (i.valor_desconto||0), 0);
  igual(Math.round(liquido * 100), Math.round(nota.formas_pagamento[0].valor_pagamento * 100));
  igual(total, 39.98); igual(nota.formas_pagamento[0].tipo_integracao, '2');
  igual(nfce.codigoDaForma('Crédito da loja'), '05'); igual(nfce.proximaRef('venda-v1'), 'venda-v1-r2'); igual(nfce.proximaRef('venda-v1-r2'), 'venda-v1-r3');
  let erro = ''; try{ nfce.montarNfce(db, Object.assign({}, venda, { discount: 40 }), {}); }catch(e){ erro = e.message; }
  verifica(/0,00/.test(erro), 'venda zerada não gera cupom');
});

caso('recibo: pedido sem tamanho/cor e nome de uma palavra só gigante não vazam', async ()=>{
  const pdf = criarPdfRecibo({ id:'v1', date: todayISO(), total: 10, payment:'PIX', seller:'Loja virtual', discount:0,
    items:[{ name:'Cinto', qty:1, price:10 }, { name:'Supercalifragilisticoexpialidocesupercalifragilistico', size:'', color:'', qty:1, price:0 }] }, 'Estilo Fashion', money, dateBR);
  const texto = requireNode('buffer').Buffer.from(await pdf.arrayBuffer()).toString('latin1');
  verifica(!/undefined/.test(texto), 'sem "undefined" no recibo');
  verifica(/Cinto/.test(texto));
});

caso('recibo automático: cabeçalho da loja, número da venda e dados da cliente saem no PDF', async ()=>{
  DB = bancoDeTeste(); migrateDB();
  DB.config.address = 'Rua das Flores, 123'; DB.config.whatsapp = '11999990000'; DB.config.fiscal = Object.assign({}, DB.config.fiscal, { cnpj:'12345678000199' });
  DB.customers.push({ id:'c1', name:'Maria Teste', phone:'11988887777' });
  const venda = { id:'abc123xyz', date: todayISO(), total: 30, discount:0, payment:'PIX', seller:'Ana', customerId:'c1', cpfNota:'12345678901',
    items:[{ name:'Blusa', size:'P', color:'Preto', qty:1, price:30 }] };
  const dados = dadosDoRecibo(venda);
  igual(dados, { endereco:'Rua das Flores, 123', telefone:'(11) 99999-0000', cnpj:'12.345.678/0001-99', cliente:'Maria Teste', clienteFone:'(11) 98888-7777', cpf:'123.456.789-01' });
  const pdf = criarPdfRecibo(venda, DB.storeName, money, dateBR, dados);
  const texto = requireNode('buffer').Buffer.from(await pdf.arrayBuffer()).toString('latin1');
  ['Rua das Flores', 'CNPJ 12.345.678/0001-99', 'RECIBO DE VENDA N', '23XYZ', 'Cliente: Maria Teste', 'CPF: 123.456.789-01', 'Telefone: ', '98888-7777'].forEach(t=>verifica(new RegExp(t).test(texto), 'tem ' + t));
  igual(reciboAutomatico(), true, 'ligado por padrão');
  verifica(/Maria Teste/.test(textoDoRecibo(venda)) && /Total: R\$/.test(textoDoRecibo(venda)), 'texto do WhatsApp');
});

/* ============ roda tudo ============ */
(async ()=>{
  for(const c of filaDeCasos){
    try{ await c.fn(); resultados.ok++; console.log('  ✓ ' + c.nome); }
    catch(err){ resultados.falhou++; console.log('  ✗ ' + c.nome + '\n      ' + (err && err.message || err)); }
  }
  console.log(`\n${resultados.ok} caso(s) ok, ${resultados.falhou} falhando, ${resultados.verificacoes} verificações.`);
  process.exit(resultados.falhou ? 1 : 0);
})();

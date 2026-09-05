/* =========================================================
   Anamnese de pele — perguntas e leitura do resultado
   Usado por anamnese.html (responder) e admin.html (ler)
   ========================================================= */

const QUIZ_ETAPAS = [
  {
    id: 'pele',
    titulo: 'Sua pele hoje',
    desc: 'Responda pensando na sua pele nos últimos 30 dias.',
    perguntas: [
      {
        id: 'fim_do_dia', tipo: 'unica', obrigatoria: true,
        label: 'Como sua pele fica no fim do dia, sem retocar nada?',
        opcoes: [
          { v: 'oleosa_toda',  label: 'Brilhando no rosto inteiro' },
          { v: 'zona_t',       label: 'Brilhando só na zona T (testa, nariz e queixo)' },
          { v: 'confortavel',  label: 'Confortável, sem brilho e sem repuxar' },
          { v: 'repuxando',    label: 'Repuxando, áspera ou descamando' }
        ]
      },
      {
        id: 'apos_lavar', tipo: 'unica', obrigatoria: true,
        label: 'E logo depois de lavar o rosto, antes de passar qualquer coisa?',
        opcoes: [
          { v: 'repuxa_muito', label: 'Repuxa muito, incomoda' },
          { v: 'repuxa_pouco', label: 'Repuxa um pouco e passa' },
          { v: 'normal',       label: 'Fica normal' },
          { v: 'oleosa_rapido',label: 'Em pouco tempo já volta a brilhar' }
        ]
      },
      {
        id: 'sensibilidade', tipo: 'unica', obrigatoria: true,
        label: 'Sua pele fica vermelha, arde ou coça com facilidade?',
        opcoes: [
          { v: 'nunca',     label: 'Nunca' },
          { v: 'as_vezes',  label: 'Às vezes, com produto novo ou sol forte' },
          { v: 'frequente', label: 'Com frequência' },
          { v: 'sempre',    label: 'Quase sempre — reajo a quase tudo' }
        ]
      },
      {
        id: 'poros', tipo: 'unica', obrigatoria: true,
        label: 'Como você descreveria seus poros e a textura da pele?',
        opcoes: [
          { v: 'imperceptiveis', label: 'Quase não aparecem' },
          { v: 'zona_t',         label: 'Aparecem na zona T' },
          { v: 'dilatados',      label: 'Dilatados na maior parte do rosto' },
          { v: 'textura',        label: 'Pele áspera, com textura irregular' }
        ]
      },
      {
        id: 'hidratacao', tipo: 'escala', obrigatoria: true,
        label: 'De 0 a 10, o quanto você sente sua pele confortável e hidratada?',
        ajuda: '0 = repuxando o tempo todo · 10 = confortável o dia inteiro'
      }
    ]
  },

  {
    id: 'queixas',
    titulo: 'Suas queixas',
    desc: 'O que te incomoda quando você olha no espelho.',
    perguntas: [
      {
        id: 'queixas', tipo: 'multipla', obrigatoria: true, max: 4,
        label: 'O que mais te incomoda hoje? (escolha até 4)',
        ajuda: 'Vou priorizar o protocolo pelo que você marcar aqui.',
        opcoes: [
          { v: 'acne',        label: 'Acne / espinhas' },
          { v: 'cravos',      label: 'Cravos e poros entupidos' },
          { v: 'oleosidade',  label: 'Oleosidade / brilho' },
          { v: 'manchas',     label: 'Manchas escuras' },
          { v: 'melasma',     label: 'Melasma' },
          { v: 'vermelhidao', label: 'Vermelhidão / sensibilidade' },
          { v: 'ressecamento',label: 'Ressecamento / descamação' },
          { v: 'textura',     label: 'Textura irregular' },
          { v: 'linhas',      label: 'Linhas finas e rugas' },
          { v: 'flacidez',    label: 'Flacidez' },
          { v: 'olheiras',    label: 'Olheiras' },
          { v: 'opacidade',   label: 'Pele opaca, sem viço' }
        ]
      },
      {
        id: 'acne_grau', tipo: 'unica', obrigatoria: true,
        showIf: r => (r.queixas || []).includes('acne') || (r.queixas || []).includes('cravos'),
        label: 'Como está sua acne hoje?',
        opcoes: [
          { v: 'leve',      label: 'Poucas lesões, de vez em quando' },
          { v: 'moderada',  label: 'Várias espinhas com frequência' },
          { v: 'inflamada', label: 'Lesões inflamadas, doloridas ou com nódulos' },
          { v: 'ciclica',   label: 'Aparece principalmente perto da menstruação' }
        ]
      },
      {
        id: 'acne_local', tipo: 'multipla',
        showIf: r => (r.queixas || []).includes('acne'),
        label: 'Onde costuma aparecer?',
        opcoes: [
          { v: 'testa',    label: 'Testa' },
          { v: 'nariz',    label: 'Nariz' },
          { v: 'bochecha', label: 'Bochechas' },
          { v: 'queixo',   label: 'Queixo e mandíbula' },
          { v: 'costas',   label: 'Costas / colo' }
        ]
      },
      {
        id: 'manchas_origem', tipo: 'unica',
        showIf: r => (r.queixas || []).includes('manchas') || (r.queixas || []).includes('melasma'),
        label: 'Suas manchas apareceram principalmente por quê?',
        opcoes: [
          { v: 'pos_acne',   label: 'Depois de espinhas que cicatrizaram' },
          { v: 'sol',        label: 'Exposição ao sol' },
          { v: 'gravidez',   label: 'Gravidez ou anticoncepcional' },
          { v: 'nao_sei',    label: 'Não sei dizer' }
        ]
      },
      {
        id: 'tempo_queixa', tipo: 'unica', obrigatoria: true,
        label: 'Há quanto tempo isso te incomoda?',
        opcoes: [
          { v: 'meses',   label: 'Alguns meses' },
          { v: 'um_ano',  label: 'Cerca de 1 ano' },
          { v: 'anos',    label: 'Vários anos' },
          { v: 'sempre',  label: 'Desde sempre' }
        ]
      }
    ]
  },

  {
    id: 'rotina',
    titulo: 'Sua rotina atual',
    desc: 'Sem julgamento — preciso saber o ponto de partida real.',
    perguntas: [
      {
        id: 'produtos_atuais', tipo: 'multipla', obrigatoria: true,
        label: 'O que você usa hoje, mesmo que não seja todo dia?',
        opcoes: [
          { v: 'nada',        label: 'Nada / só água' },
          { v: 'sabonete',    label: 'Sabonete facial' },
          { v: 'hidratante',  label: 'Hidratante facial' },
          { v: 'protetor',    label: 'Protetor solar' },
          { v: 'vitc',        label: 'Vitamina C' },
          { v: 'acido',       label: 'Ácidos (glicólico, salicílico, mandélico...)' },
          { v: 'retinol',     label: 'Retinol / tretinoína' },
          { v: 'niacinamida', label: 'Niacinamida' },
          { v: 'esfoliante',  label: 'Esfoliante físico' },
          { v: 'agua_micelar',label: 'Água micelar / demaquilante' },
          { v: 'mascaras',    label: 'Máscaras' },
          { v: 'sabonete_corpo', label: 'Sabonete de corpo no rosto' }
        ]
      },
      {
        id: 'protetor_freq', tipo: 'unica', obrigatoria: true,
        label: 'Com que frequência você usa protetor solar no rosto?',
        opcoes: [
          { v: 'todo_dia_reaplica', label: 'Todo dia e reaplico durante o dia' },
          { v: 'todo_dia',          label: 'Todo dia, só de manhã' },
          { v: 'as_vezes',          label: 'Só quando vou pegar sol' },
          { v: 'nunca',             label: 'Não uso' }
        ]
      },
      {
        id: 'lavagens', tipo: 'unica', obrigatoria: true,
        label: 'Quantas vezes por dia você lava o rosto?',
        opcoes: [
          { v: '0', label: 'Nenhuma / só no banho' },
          { v: '1', label: '1 vez' },
          { v: '2', label: '2 vezes' },
          { v: '3', label: '3 vezes ou mais' }
        ]
      },
      {
        id: 'reacao_ativos', tipo: 'unica', obrigatoria: true,
        label: 'Você já usou ácidos ou retinol? Como sua pele reagiu?',
        opcoes: [
          { v: 'nunca_usei',  label: 'Nunca usei' },
          { v: 'bem',         label: 'Usei e a pele reagiu bem' },
          { v: 'ardencia',    label: 'Usei e deu ardência / descamação forte' },
          { v: 'piorou',      label: 'Usei e a pele piorou' }
        ]
      },
      {
        id: 'troca_produtos', tipo: 'unica', obrigatoria: true,
        label: 'Como você escolhe seus produtos hoje?',
        opcoes: [
          { v: 'internet',  label: 'Indicação de vídeos e redes sociais' },
          { v: 'balconista',label: 'Indicação na farmácia / loja' },
          { v: 'dermato',   label: 'Prescrição de dermatologista' },
          { v: 'aleatorio', label: 'Compro pelo que estiver em promoção' }
        ]
      },
      {
        id: 'maquiagem', tipo: 'unica', obrigatoria: true,
        label: 'Você usa maquiagem com que frequência?',
        opcoes: [
          { v: 'nao',     label: 'Não uso' },
          { v: 'eventos', label: 'Só em eventos' },
          { v: 'as_vezes',label: 'Algumas vezes por semana' },
          { v: 'diaria',  label: 'Todos os dias' }
        ]
      }
    ]
  },

  {
    id: 'saude',
    titulo: 'Saúde e segurança',
    desc: 'Essa parte define o que eu posso ou não indicar para você. Nada aqui é julgamento — é segurança.',
    perguntas: [
      {
        id: 'gestante', tipo: 'unica', obrigatoria: true,
        label: 'Você está grávida ou amamentando?',
        opcoes: [
          { v: 'nao',       label: 'Não' },
          { v: 'gravida',   label: 'Grávida' },
          { v: 'amamenta',  label: 'Amamentando' },
          { v: 'tentando',  label: 'Tentando engravidar' }
        ]
      },
      {
        id: 'isotretinoina', tipo: 'unica', obrigatoria: true,
        label: 'Você usa ou usou isotretinoína (Roacutan) nos últimos 6 meses?',
        opcoes: [
          { v: 'nao',      label: 'Não' },
          { v: 'usando',   label: 'Estou usando agora' },
          { v: 'recente',  label: 'Parei há menos de 6 meses' }
        ]
      },
      {
        id: 'condicoes', tipo: 'multipla',
        label: 'Você tem algum diagnóstico dermatológico?',
        ajuda: 'Se não tiver nenhum, pode seguir sem marcar nada.',
        opcoes: [
          { v: 'rosacea',    label: 'Rosácea' },
          { v: 'dermatite',  label: 'Dermatite seborreica' },
          { v: 'eczema',     label: 'Eczema / dermatite atópica' },
          { v: 'psoriase',   label: 'Psoríase' },
          { v: 'melasma',    label: 'Melasma diagnosticado' },
          { v: 'vitiligo',   label: 'Vitiligo' },
          { v: 'urticaria',  label: 'Urticária' }
        ]
      },
      {
        id: 'procedimentos', tipo: 'multipla',
        label: 'Fez algum procedimento estético nos últimos 3 meses?',
        opcoes: [
          { v: 'peeling',        label: 'Peeling químico' },
          { v: 'laser',          label: 'Laser / luz pulsada' },
          { v: 'microagulhamento', label: 'Microagulhamento' },
          { v: 'botox',          label: 'Toxina botulínica' },
          { v: 'preenchimento',  label: 'Preenchimento' },
          { v: 'limpeza',        label: 'Limpeza de pele' }
        ]
      },
      {
        id: 'alergias', tipo: 'textarea',
        label: 'Você tem alergia a algum cosmético, ativo ou fragrância?',
        placeholder: 'Ex.: fragrância, ácido salicílico, esparadrapo... Se não tiver, escreva "não".'
      },
      {
        id: 'medicamentos', tipo: 'textarea',
        label: 'Usa algum medicamento contínuo? (inclusive anticoncepcional)',
        placeholder: 'Nome do medicamento e há quanto tempo. Se não usar, escreva "não".'
      },
      {
        id: 'hormonal', tipo: 'unica', obrigatoria: true,
        label: 'Sua pele piora em alguma fase do ciclo menstrual?',
        opcoes: [
          { v: 'sim_muito', label: 'Sim, piora bastante' },
          { v: 'sim_pouco', label: 'Sim, um pouco' },
          { v: 'nao',       label: 'Não percebo diferença' },
          { v: 'na',        label: 'Não se aplica' }
        ]
      }
    ]
  },

  {
    id: 'vida',
    titulo: 'Rotina e estilo de vida',
    desc: 'A pele responde ao que acontece fora dela também.',
    perguntas: [
      {
        id: 'sol', tipo: 'unica', obrigatoria: true,
        label: 'Quanto tempo por dia você fica exposta ao sol?',
        opcoes: [
          { v: 'quase_nada', label: 'Quase nada, fico em ambiente fechado' },
          { v: 'pouco',      label: 'Até 30 minutos (trajeto)' },
          { v: 'medio',      label: 'De 30 min a 2 horas' },
          { v: 'muito',      label: 'Mais de 2 horas' }
        ]
      },
      {
        id: 'sono', tipo: 'unica', obrigatoria: true,
        label: 'Quantas horas você dorme, em média?',
        opcoes: [
          { v: 'menos5', label: 'Menos de 5h' },
          { v: '5a6',    label: '5 a 6h' },
          { v: '7a8',    label: '7 a 8h' },
          { v: 'mais8',  label: 'Mais de 8h' }
        ]
      },
      {
        id: 'agua', tipo: 'unica', obrigatoria: true,
        label: 'Quanta água você bebe por dia?',
        opcoes: [
          { v: 'menos1', label: 'Menos de 1 litro' },
          { v: '1a2',    label: '1 a 2 litros' },
          { v: 'mais2',  label: 'Mais de 2 litros' }
        ]
      },
      {
        id: 'estresse', tipo: 'escala', obrigatoria: true,
        label: 'De 0 a 10, qual seu nível de estresse hoje?',
        ajuda: '0 = tranquila · 10 = no limite'
      },
      {
        id: 'habitos', tipo: 'multipla',
        label: 'Algum desses faz parte da sua rotina?',
        opcoes: [
          { v: 'fumo',       label: 'Fumo' },
          { v: 'alcool',     label: 'Bebo com frequência' },
          { v: 'acucar',     label: 'Como muito doce / ultraprocessado' },
          { v: 'leite',      label: 'Consumo bastante leite e derivados' },
          { v: 'exercicio',  label: 'Faço exercício regularmente' },
          { v: 'suplemento', label: 'Tomo suplementos' }
        ]
      }
    ]
  },

  {
    id: 'objetivo',
    titulo: 'Seus objetivos',
    desc: 'Para eu montar um protocolo que cabe na sua vida de verdade.',
    perguntas: [
      {
        id: 'objetivo', tipo: 'unica', obrigatoria: true,
        label: 'Se a consultoria resolvesse uma coisa só, qual seria?',
        opcoes: [
          { v: 'acne',       label: 'Controlar a acne' },
          { v: 'manchas',    label: 'Clarear manchas' },
          { v: 'oleosidade', label: 'Controlar a oleosidade' },
          { v: 'hidratacao', label: 'Recuperar a hidratação e o conforto' },
          { v: 'viço',       label: 'Devolver viço e uniformidade' },
          { v: 'antiidade',  label: 'Prevenir e tratar sinais de idade' },
          { v: 'rotina',     label: 'Ter enfim uma rotina simples que eu consiga seguir' }
        ]
      },
      {
        id: 'tempo_rotina', tipo: 'unica', obrigatoria: true,
        label: 'Quanto tempo por dia você consegue dedicar à pele?',
        opcoes: [
          { v: '3min',  label: 'Até 3 minutos — preciso do básico bem feito' },
          { v: '5a10',  label: '5 a 10 minutos' },
          { v: 'mais10',label: 'Mais de 10 minutos, gosto do ritual' }
        ]
      },
      {
        id: 'investimento', tipo: 'unica', obrigatoria: true,
        label: 'Quanto você consegue investir por mês em produtos?',
        ajuda: 'Vou indicar dentro dessa faixa — dá para ter resultado em qualquer uma delas.',
        opcoes: [
          { v: 'ate100',  label: 'Até R$ 100' },
          { v: '100a250', label: 'R$ 100 a R$ 250' },
          { v: '250a500', label: 'R$ 250 a R$ 500' },
          { v: 'mais500', label: 'Acima de R$ 500' }
        ]
      },
      {
        id: 'produtos_tem', tipo: 'textarea',
        label: 'Quais produtos você já tem em casa?',
        placeholder: 'Marca e nome, se lembrar. Vou aproveitar o que der antes de indicar compra nova.'
      },
      {
        id: 'observacoes', tipo: 'textarea',
        label: 'Quer me contar mais alguma coisa?',
        placeholder: 'Qualquer detalhe que você acha importante eu saber sobre a sua pele.'
      }
    ]
  }
];

/* ---------------- helpers de leitura ---------------- */
function todasPerguntas(){
  return QUIZ_ETAPAS.flatMap(e => e.perguntas.map(p => ({ ...p, etapa: e.titulo })));
}
function perguntaPorId(id){
  return todasPerguntas().find(p => p.id === id) || null;
}
function labelOpcao(perguntaId, valor){
  const p = perguntaPorId(perguntaId);
  if(!p || !p.opcoes) return String(valor ?? '');
  const o = p.opcoes.find(x => x.v === valor);
  return o ? o.label : String(valor ?? '');
}
function respostaLegivel(perguntaId, valor){
  const p = perguntaPorId(perguntaId);
  if(valor === undefined || valor === null || valor === '') return '—';
  if(!p) return String(valor);
  if(p.tipo === 'multipla') return (Array.isArray(valor) ? valor : [valor]).map(v => labelOpcao(perguntaId, v)).join(', ') || '—';
  if(p.tipo === 'unica')    return labelOpcao(perguntaId, valor);
  if(p.tipo === 'escala')   return `${valor}/10`;
  return String(valor);
}
/* Perguntas visíveis dada as respostas atuais (respeita showIf). */
function perguntasVisiveis(etapa, respostas){
  return etapa.perguntas.filter(p => typeof p.showIf !== 'function' || p.showIf(respostas));
}

/* ---------------- leitura do resultado ----------------
   Isso NÃO é diagnóstico: é uma primeira leitura do perfil,
   que a consultora revisa antes de montar o protocolo final. */
function calcularResultado(r){
  const q = Array.isArray(r.queixas) ? r.queixas : [];
  const usa = Array.isArray(r.produtos_atuais) ? r.produtos_atuais : [];
  const cond = Array.isArray(r.condicoes) ? r.condicoes : [];
  const proc = Array.isArray(r.procedimentos) ? r.procedimentos : [];

  /* --- tipo de pele --- */
  let oleo = 0, seco = 0;
  if(r.fim_do_dia === 'oleosa_toda') oleo += 2;
  if(r.fim_do_dia === 'zona_t')      oleo += 1;
  if(r.fim_do_dia === 'repuxando')   seco += 2;
  if(r.apos_lavar === 'oleosa_rapido') oleo += 1;
  if(r.apos_lavar === 'repuxa_muito')  seco += 2;
  if(r.apos_lavar === 'repuxa_pouco')  seco += 1;
  if(r.poros === 'dilatados') oleo += 1;
  if(q.includes('oleosidade')) oleo += 1;
  if(q.includes('ressecamento')) seco += 1;

  let tipoPele;
  if(oleo >= 3 && seco <= 1)        tipoPele = 'Oleosa';
  else if(oleo >= 2 && seco >= 2)   tipoPele = 'Mista com desidratação';
  else if(oleo >= 2)                tipoPele = 'Mista';
  else if(seco >= 3)                tipoPele = 'Seca';
  else if(seco >= 2)                tipoPele = 'Normal a seca';
  else                              tipoPele = 'Normal';

  /* --- sensibilidade --- */
  let sens = { nunca: 0, as_vezes: 1, frequente: 2, sempre: 3 }[r.sensibilidade] ?? 0;
  if(q.includes('vermelhidao')) sens += 1;
  if(r.reacao_ativos === 'ardencia' || r.reacao_ativos === 'piorou') sens += 1;
  if(cond.some(c => ['rosacea','eczema','dermatite','psoriase','urticaria'].includes(c))) sens += 2;
  if(String(r.alergias || '').trim() && !/^n[ãa]o/i.test(String(r.alergias).trim())) sens += 1;
  const sensLabel = sens >= 4 ? 'Alta' : sens >= 2 ? 'Moderada' : 'Baixa';

  /* --- barreira cutânea --- */
  let barreira = 0;
  if(Number(r.hidratacao) <= 4) barreira += 2;
  if(r.lavagens === '3') barreira += 1;
  if(usa.includes('esfoliante')) barreira += 1;
  if(usa.includes('sabonete_corpo')) barreira += 2;
  if(!usa.includes('hidratante')) barreira += 1;
  if(r.reacao_ativos === 'ardencia' || r.reacao_ativos === 'piorou') barreira += 1;
  const barreiraLabel = barreira >= 4 ? 'Comprometida' : barreira >= 2 ? 'Em atenção' : 'Íntegra';

  /* --- maturidade da rotina --- */
  const ativos = usa.filter(p => !['nada','sabonete_corpo','esfoliante','agua_micelar','mascaras'].includes(p)).length;
  const rotinaLabel = usa.includes('nada') || ativos === 0 ? 'Iniciante'
                    : ativos <= 3 ? 'Básica'
                    : ativos <= 5 ? 'Intermediária' : 'Avançada';

  /* --- fotoproteção --- */
  const fps = { todo_dia_reaplica: 'Adequada', todo_dia: 'Boa, falta reaplicar', as_vezes: 'Insuficiente', nunca: 'Ausente' }[r.protetor_freq] || '—';

  /* --- prioridades --- */
  const nomeQueixa = {
    acne:'Acne', cravos:'Cravos e poros', oleosidade:'Oleosidade', manchas:'Manchas',
    melasma:'Melasma', vermelhidao:'Sensibilidade', ressecamento:'Ressecamento',
    textura:'Textura', linhas:'Linhas finas', flacidez:'Flacidez', olheiras:'Olheiras', opacidade:'Falta de viço'
  };
  const prioridades = [];
  if(barreiraLabel === 'Comprometida') prioridades.push('Recuperar a barreira cutânea antes de qualquer ativo');
  if(fps === 'Ausente' || fps === 'Insuficiente') prioridades.push('Estabelecer fotoproteção diária');
  q.slice(0, 3).forEach(c => prioridades.push('Tratar: ' + (nomeQueixa[c] || c)));
  if(!prioridades.length) prioridades.push('Manutenção e prevenção');

  /* --- alertas de segurança (para a consultora) --- */
  const alertas = [];
  if(r.gestante === 'gravida')  alertas.push('Gestante — sem retinoides, sem ácido salicílico em alta concentração, sem hidroquinona.');
  if(r.gestante === 'amamenta') alertas.push('Amamentando — evitar retinoides e clareadores despigmentantes.');
  if(r.gestante === 'tentando') alertas.push('Tentando engravidar — considerar protocolo já compatível com gestação.');
  if(r.isotretinoina === 'usando')  alertas.push('Em uso de isotretinoína — sem ácidos, esfoliação ou procedimentos; foco em barreira e fotoproteção.');
  if(r.isotretinoina === 'recente') alertas.push('Isotretinoína há menos de 6 meses — introduzir ativos com cautela extra.');
  if(cond.includes('rosacea'))   alertas.push('Rosácea — evitar irritantes, álcool, fragrância e esfoliação física.');
  if(cond.includes('melasma'))   alertas.push('Melasma — fotoproteção rigorosa com cor; cuidado com calor e luz visível.');
  if(cond.includes('dermatite')) alertas.push('Dermatite seborreica — avaliar antifúngico tópico e sabonete adequado.');
  if(cond.includes('eczema') || cond.includes('psoriase')) alertas.push('Condição inflamatória crônica — protocolo de barreira, encaminhar ao dermatologista.');
  if(proc.length) alertas.push('Procedimento recente (' + proc.map(p => labelOpcao('procedimentos', p)).join(', ') + ') — respeitar janela de recuperação.');
  if(r.acne_grau === 'inflamada') alertas.push('Acne inflamatória/nodular — indicar avaliação com dermatologista; skin care é suporte.');
  if(usa.includes('sabonete_corpo')) alertas.push('Usa sabonete de corpo no rosto — trocar já na primeira orientação.');
  if(sensLabel === 'Alta') alertas.push('Sensibilidade alta — introduzir um ativo por vez, com teste de contato.');

  /* --- esqueleto de rotina (a consultora fecha os produtos) --- */
  const gestacaoRestrita = r.gestante === 'gravida' || r.gestante === 'amamenta';
  const semAtivos = r.isotretinoina === 'usando' || barreiraLabel === 'Comprometida';

  const manha = ['Higienização suave', 'Hidratante compatível com o tipo de pele', 'Protetor solar FPS 30+ (reaplicar)'];
  if(!semAtivos && !gestacaoRestrita) manha.splice(1, 0, 'Antioxidante (vitamina C) pela manhã');
  else if(!semAtivos) manha.splice(1, 0, 'Antioxidante seguro na gestação (vitamina C)');

  const noite = ['Remoção de maquiagem/protetor', 'Higienização', 'Hidratante / reparador de barreira'];
  if(semAtivos){
    noite.splice(2, 0, 'Sem ativos por enquanto — foco em recuperar a barreira');
  }else if(gestacaoRestrita){
    noite.splice(2, 0, 'Ativo compatível com gestação (niacinamida, azelaico)');
  }else if(sensLabel === 'Alta'){
    noite.splice(2, 0, 'Ativo em baixa concentração, 2x por semana, com progressão lenta');
  }else{
    noite.splice(2, 0, 'Ativo principal conforme a queixa (retinoide ou ácido), em dias alternados');
  }

  return {
    tipoPele, sensibilidade: sensLabel, barreira: barreiraLabel,
    rotina: rotinaLabel, fotoprotecao: fps,
    prioridades, alertas,
    sugestao: { manha, noite },
    calculadoEm: new Date().toISOString()
  };
}

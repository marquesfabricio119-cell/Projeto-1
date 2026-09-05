/**
 * Função serverless que conversa com o modelo.
 *
 * O navegador chama SEMPRE este endereço (/api/chat) e nunca o provedor
 * direto. A chave da API vive apenas aqui, no servidor, lida de uma variável
 * de ambiente. Nada de chave no código do site.
 */
import { registrarMensagem } from './_lib/limite';
import { blocoDePerfil, limparTextoDoPerfil, PROMPT_DO_SISTEMA } from './_lib/prompt';
import { conversarComOProfessor, type MensagemDoChat } from './_lib/provedor';

export const config = { runtime: 'edge' };

const MENSAGEM_DE_ERRO = 'O professor não conseguiu responder agora. Tente de novo daqui a pouco.';
const MAXIMO_DE_MENSAGENS = 40;
const MAXIMO_DE_CARACTERES = 6000;

export default async function handler(requisicao: Request): Promise<Response> {
  if (requisicao.method !== 'POST') {
    return respostaEmJson({ erro: MENSAGEM_DE_ERRO }, 405);
  }

  let corpo: {
    mensagens?: unknown;
    perfil?: Record<string, unknown> | null;
    sessao?: unknown;
  };
  try {
    corpo = await requisicao.json();
  } catch {
    return respostaEmJson({ erro: MENSAGEM_DE_ERRO }, 400);
  }

  const mensagens = normalizarMensagens(corpo.mensagens);
  if (mensagens.length === 0) {
    return respostaEmJson({ erro: 'Escreva alguma coisa para o professor responder.' }, 400);
  }

  const sessao = identificarSessao(requisicao, corpo.sessao);
  const limite = registrarMensagem(sessao);
  if (!limite.liberado) {
    return respostaEmJson(
      {
        erro:
          `Você já conversou bastante nesta hora. O professor precisa de um respiro: ` +
          `volte em ${limite.minutosParaLiberar} minuto${limite.minutosParaLiberar === 1 ? '' : 's'}. ` +
          `Enquanto isso, dá para revisar um mapa do kit.`,
      },
      429,
    );
  }

  const promptCompleto = PROMPT_DO_SISTEMA + blocoDePerfil(normalizarPerfil(corpo.perfil));

  try {
    const pedacos = conversarComOProfessor(promptCompleto, mensagens, requisicao.signal);
    return new Response(montarStream(pedacos), {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (erro) {
    console.error('Falha ao falar com o provedor:', erro);
    return respostaEmJson({ erro: MENSAGEM_DE_ERRO }, 502);
  }
}

/**
 * Converte os pedaços de texto em Server-Sent Events.
 * Se algo quebrar no meio do caminho, mandamos o erro pelo próprio stream,
 * porque os cabeçalhos já foram enviados e não dá mais para mudar o status.
 */
function montarStream(pedacos: AsyncGenerator<string>): ReadableStream<Uint8Array> {
  const codificador = new TextEncoder();
  return new ReadableStream({
    async start(controlador) {
      const enviar = (dado: unknown) => {
        controlador.enqueue(codificador.encode(`data: ${JSON.stringify(dado)}\n\n`));
      };
      try {
        for await (const pedaco of pedacos) {
          enviar({ texto: pedaco });
        }
        enviar({ fim: true });
      } catch (erro) {
        console.error('Falha durante a resposta do professor:', erro);
        enviar({ erro: MENSAGEM_DE_ERRO });
      } finally {
        controlador.close();
      }
    },
  });
}

function normalizarMensagens(bruto: unknown): MensagemDoChat[] {
  if (!Array.isArray(bruto)) return [];
  const mensagens: MensagemDoChat[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== 'object') continue;
    const registro = item as { papel?: unknown; texto?: unknown };
    const papel = registro.papel === 'professor' ? 'professor' : 'aluno';
    if (typeof registro.texto !== 'string') continue;
    const texto = registro.texto.trim().slice(0, MAXIMO_DE_CARACTERES);
    if (!texto) continue;
    mensagens.push({ papel, texto });
  }
  // Só as últimas mensagens vão para o modelo: conversa longa custa caro
  // e a Anthropic exige que a última mensagem seja do aluno.
  const recentes = mensagens.slice(-MAXIMO_DE_MENSAGENS);
  while (recentes.length > 0 && recentes[0].papel === 'professor') recentes.shift();
  while (recentes.length > 0 && recentes[recentes.length - 1].papel === 'professor') recentes.pop();
  return recentes;
}

function normalizarPerfil(bruto: Record<string, unknown> | null | undefined) {
  if (!bruto || typeof bruto !== 'object') return null;
  return {
    nivel: limparTextoDoPerfil(bruto.nivel),
    objetivo: limparTextoDoPerfil(bruto.objetivo),
    tempo: limparTextoDoPerfil(bruto.tempo),
    dificuldade: limparTextoDoPerfil(bruto.dificuldade),
  };
}

function identificarSessao(requisicao: Request, doCorpo: unknown): string {
  if (typeof doCorpo === 'string' && doCorpo.trim()) return doCorpo.trim().slice(0, 80);
  const cabecalho = requisicao.headers.get('x-sessao');
  if (cabecalho) return cabecalho.slice(0, 80);
  return requisicao.headers.get('x-forwarded-for') || 'sessao-sem-identificacao';
}

function respostaEmJson(dado: unknown, status: number): Response {
  return new Response(JSON.stringify(dado), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/**
 * Único ponto do código que conhece o provedor do modelo.
 * Para trocar de provedor, reescreva só este arquivo: o resto do app
 * conversa apenas com `conversarComOProfessor`.
 *
 * A chave da API é lida de `process.env` — ou seja, existe somente aqui,
 * no servidor. Ela nunca é enviada ao navegador nem entra no pacote do site.
 */

export type MensagemDoChat = {
  papel: 'aluno' | 'professor';
  texto: string;
};

export const MODELO_PADRAO = 'claude-sonnet-5';
export const LIMITE_DE_TOKENS_POR_RESPOSTA = 4000;

const VERSAO_DA_API = '2023-06-01';

export class ErroDeConfiguracao extends Error {}

function lerVariavel(nome: string): string | undefined {
  const ambiente = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return ambiente?.[nome];
}

function chaveDaApi(): string {
  const chave = lerVariavel('ANTHROPIC_API_KEY');
  if (!chave) {
    throw new ErroDeConfiguracao(
      'A variável de ambiente ANTHROPIC_API_KEY não está configurada no servidor.',
    );
  }
  return chave;
}

function enderecoBase(): string {
  return lerVariavel('ANTHROPIC_BASE_URL') || 'https://api.anthropic.com';
}

export function modeloEmUso(): string {
  return lerVariavel('TUTOR_MODELO') || MODELO_PADRAO;
}

/**
 * Envia a conversa ao modelo e devolve os pedaços de texto conforme chegam.
 * O `AsyncGenerator` é o que permite ao chat "digitar" a resposta na tela.
 */
export async function* conversarComOProfessor(
  promptDoSistema: string,
  mensagens: MensagemDoChat[],
  sinal?: AbortSignal,
): AsyncGenerator<string> {
  const resposta = await fetch(`${enderecoBase()}/v1/messages`, {
    method: 'POST',
    signal: sinal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': chaveDaApi(),
      'anthropic-version': VERSAO_DA_API,
    },
    body: JSON.stringify({
      model: modeloEmUso(),
      max_tokens: LIMITE_DE_TOKENS_POR_RESPOSTA,
      stream: true,
      system: promptDoSistema,
      messages: mensagens.map((mensagem) => ({
        role: mensagem.papel === 'aluno' ? 'user' : 'assistant',
        content: mensagem.texto,
      })),
    }),
  });

  if (!resposta.ok || !resposta.body) {
    const detalhe = await resposta.text().catch(() => '');
    throw new Error(`Provedor respondeu ${resposta.status}: ${detalhe.slice(0, 500)}`);
  }

  yield* lerEventosDoProvedor(resposta.body);
}

/** Interpreta o SSE do provedor e entrega só o texto novo de cada evento. */
async function* lerEventosDoProvedor(corpo: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const leitor = corpo.getReader();
  const decodificador = new TextDecoder();
  let acumulado = '';

  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    acumulado += decodificador.decode(value, { stream: true });

    let quebra = acumulado.indexOf('\n');
    while (quebra !== -1) {
      const linha = acumulado.slice(0, quebra).trim();
      acumulado = acumulado.slice(quebra + 1);
      quebra = acumulado.indexOf('\n');

      if (!linha.startsWith('data:')) continue;
      const conteudo = linha.slice(5).trim();
      if (!conteudo || conteudo === '[DONE]') continue;

      let evento: {
        type?: string;
        delta?: { type?: string; text?: string };
        error?: { message?: string };
      };
      try {
        evento = JSON.parse(conteudo);
      } catch {
        continue;
      }

      if (evento.type === 'error') {
        throw new Error(evento.error?.message || 'Erro informado pelo provedor.');
      }
      if (evento.type === 'content_block_delta' && evento.delta?.type === 'text_delta') {
        if (evento.delta.text) yield evento.delta.text;
      }
    }
  }
}

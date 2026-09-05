/**
 * Conversa com a nossa própria função /api/chat.
 * O navegador nunca fala com o provedor do modelo nem conhece chave nenhuma.
 */
import { idDaSessao } from './armazenamento';
import type { Mensagem, Perfil } from './tipos';

const ERRO_PADRAO = 'O professor não conseguiu responder agora. Tente de novo daqui a pouco.';

export class ErroDoProfessor extends Error {}

type Opcoes = {
  mensagens: Mensagem[];
  perfil: Perfil | null;
  aoReceberTexto: (pedaco: string) => void;
  sinal?: AbortSignal;
};

/** Envia a conversa e chama `aoReceberTexto` a cada pedaço que chega. */
export async function pedirRespostaAoProfessor({
  mensagens,
  perfil,
  aoReceberTexto,
  sinal,
}: Opcoes): Promise<void> {
  let resposta: Response;
  try {
    resposta = await fetch('/api/chat', {
      method: 'POST',
      signal: sinal,
      headers: { 'Content-Type': 'application/json', 'x-sessao': idDaSessao() },
      body: JSON.stringify({
        sessao: idDaSessao(),
        perfil,
        mensagens: mensagens.map(({ papel, texto }) => ({ papel, texto })),
      }),
    });
  } catch (erro) {
    if (foiCancelado(erro)) return;
    throw new ErroDoProfessor(ERRO_PADRAO);
  }

  if (!resposta.ok) {
    throw new ErroDoProfessor(await lerMensagemDeErro(resposta));
  }
  if (!resposta.body) {
    throw new ErroDoProfessor(ERRO_PADRAO);
  }

  const leitor = resposta.body.getReader();
  const decodificador = new TextDecoder();
  let acumulado = '';

  try {
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      acumulado += decodificador.decode(value, { stream: true });

      let corte = acumulado.indexOf('\n\n');
      while (corte !== -1) {
        const bloco = acumulado.slice(0, corte);
        acumulado = acumulado.slice(corte + 2);
        corte = acumulado.indexOf('\n\n');

        const linha = bloco.split('\n').find((item) => item.startsWith('data:'));
        if (!linha) continue;

        let evento: { texto?: string; fim?: boolean; erro?: string };
        try {
          evento = JSON.parse(linha.slice(5).trim());
        } catch {
          continue;
        }

        if (evento.erro) throw new ErroDoProfessor(evento.erro);
        if (evento.texto) aoReceberTexto(evento.texto);
        if (evento.fim) return;
      }
    }
  } catch (erro) {
    if (foiCancelado(erro)) return;
    if (erro instanceof ErroDoProfessor) throw erro;
    throw new ErroDoProfessor(ERRO_PADRAO);
  } finally {
    leitor.cancel().catch(() => undefined);
  }
}

async function lerMensagemDeErro(resposta: Response): Promise<string> {
  try {
    const dado = (await resposta.json()) as { erro?: string };
    if (dado?.erro) return dado.erro;
  } catch {
    /* corpo vazio ou não era JSON */
  }
  return ERRO_PADRAO;
}

function foiCancelado(erro: unknown): boolean {
  return erro instanceof DOMException && erro.name === 'AbortError';
}

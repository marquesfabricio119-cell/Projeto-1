import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AssistenteDePerfil from '../components/AssistenteDePerfil';
import FolhaDeComandos from '../components/FolhaDeComandos';
import BotaoDeTema from '../components/BotaoDeTema';
import { ErroDoProfessor, pedirRespostaAoProfessor } from '../lib/clienteDoChat';
import {
  contarMaisUmaConversa,
  gravarConversa,
  gravarPerfil,
  lerConversa,
  lerPerfil,
  limparConversa,
  pegarRascunho,
} from '../lib/armazenamento';
import type { Mensagem, Perfil } from '../lib/tipos';

const SUGESTOES = [
  'Quero praticar uma conversa de nível iniciante',
  'Corrija este texto que eu escrevi em inglês',
  'Me explique quando eu uso do e quando eu uso does',
  'Me faça uma entrevista de emprego em inglês',
];

function novoId() {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function Chat() {
  const local = useLocation();
  const [perfil, setPerfil] = useState<Perfil | null>(() => lerPerfil());
  const [editandoPerfil, setEditandoPerfil] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>(() => lerConversa());
  const [texto, setTexto] = useState('');
  const [respondendo, setRespondendo] = useState(false);
  const [erro, setErro] = useState('');
  const [folhaAberta, setFolhaAberta] = useState(false);
  const [confirmandoLimpeza, setConfirmandoLimpeza] = useState(false);

  const areaDeRolagem = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  const cancelador = useRef<AbortController | null>(null);

  /* Texto vindo da tela de comandos ("Usar no chat"): entra no campo, sem enviar. */
  useEffect(() => {
    const doEstado = (local.state as { comando?: string } | null)?.comando;
    const guardado = pegarRascunho();
    const inicial = doEstado || guardado;
    if (inicial) {
      setTexto(inicial);
      window.setTimeout(() => {
        campo.current?.focus();
        campo.current?.setSelectionRange(inicial.length, inicial.length);
      }, 60);
    }
    // Roda só na montagem: depois disso o campo pertence ao aluno.
  }, []);

  useEffect(() => {
    gravarConversa(mensagens);
  }, [mensagens]);

  useLayoutEffect(() => {
    const area = areaDeRolagem.current;
    if (area) area.scrollTop = area.scrollHeight;
  }, [mensagens, respondendo]);

  useEffect(() => () => cancelador.current?.abort(), []);

  const ajustarAltura = useCallback(() => {
    const elemento = campo.current;
    if (!elemento) return;
    elemento.style.height = 'auto';
    elemento.style.height = `${Math.min(elemento.scrollHeight, 160)}px`;
  }, []);

  useEffect(ajustarAltura, [texto, ajustarAltura]);

  async function enviar(conteudo: string) {
    const limpo = conteudo.trim();
    if (!limpo || respondendo) return;

    if (mensagens.length === 0) contarMaisUmaConversa();

    const doAluno: Mensagem = { id: novoId(), papel: 'aluno', texto: limpo };
    const daResposta: Mensagem = { id: novoId(), papel: 'professor', texto: '' };
    const conversa = [...mensagens, doAluno];

    setMensagens([...conversa, daResposta]);
    setTexto('');
    setErro('');
    setRespondendo(true);

    const controle = new AbortController();
    cancelador.current = controle;

    try {
      await pedirRespostaAoProfessor({
        mensagens: conversa,
        perfil,
        sinal: controle.signal,
        aoReceberTexto: (pedaco) => {
          setMensagens((atuais) =>
            atuais.map((mensagem) =>
              mensagem.id === daResposta.id
                ? { ...mensagem, texto: mensagem.texto + pedaco }
                : mensagem,
            ),
          );
        },
      });
    } catch (falha) {
      const recado =
        falha instanceof ErroDoProfessor
          ? falha.message
          : 'O professor não conseguiu responder agora. Tente de novo daqui a pouco.';
      setErro(recado);
      // Tira a bolha vazia do professor para a tela não ficar com um buraco.
      setMensagens((atuais) => atuais.filter((mensagem) => !(mensagem.id === daResposta.id && !mensagem.texto)));
      setTexto(limpo);
    } finally {
      setRespondendo(false);
      cancelador.current = null;
    }
  }

  function comecarDeNovo() {
    cancelador.current?.abort();
    limparConversa();
    setMensagens([]);
    setErro('');
    setConfirmandoLimpeza(false);
    setRespondendo(false);
  }

  function salvarPerfil(novo: Perfil) {
    gravarPerfil(novo);
    setPerfil(novo);
    setEditandoPerfil(false);
  }

  /* Primeira visita: as 4 perguntas antes de qualquer conversa. */
  if (!perfil || editandoPerfil) {
    return (
      <div className="flex min-h-[100dvh] flex-col">
        <CabecalhoDoChat
          subtitulo={perfil ? 'Editando o seu perfil' : 'Vamos nos conhecer primeiro'}
          acoes={null}
        />
        <AssistenteDePerfil
          perfilInicial={perfil}
          aoConcluir={salvarPerfil}
          aoCancelar={perfil ? () => setEditandoPerfil(false) : undefined}
        />
      </div>
    );
  }

  const vazia = mensagens.length === 0;

  return (
    <div className="flex h-[100dvh] flex-col">
      <CabecalhoDoChat
        subtitulo="Explica em português, corrige com jeito"
        acoes={
          <>
            <button
              type="button"
              onClick={() => setEditandoPerfil(true)}
              className="botao-secundario hidden px-3 text-sm sm:inline-flex"
            >
              Editar meu perfil
            </button>
            <button
              type="button"
              onClick={() => setEditandoPerfil(true)}
              className="grid h-11 w-11 place-items-center rounded-full bg-muted sm:hidden"
              aria-label="Editar meu perfil"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="8" r="3.5" />
                <path strokeLinecap="round" d="M5 20c1.6-3.2 4-4.8 7-4.8s5.4 1.6 7 4.8" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setConfirmandoLimpeza(true)}
              className="grid h-11 w-11 place-items-center rounded-full bg-muted"
              aria-label="Nova conversa"
              title="Nova conversa"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 5v5h5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10a7.5 7.5 0 1 1 .8 6" />
              </svg>
            </button>
          </>
        }
      />

      <div ref={areaDeRolagem} className="rolagem-suave flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-4">
          {vazia ? (
            <BoasVindas aoEscolher={(sugestao) => enviar(sugestao)} />
          ) : (
            <ul
              className="grid gap-3"
              aria-live="polite"
              aria-relevant="additions text"
              aria-label="Conversa com o professor"
            >
              {mensagens.map((mensagem) => (
                <li
                  key={mensagem.id}
                  className={mensagem.papel === 'aluno' ? 'flex justify-end' : 'flex justify-start'}
                >
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-4 py-3 text-[0.95rem] leading-relaxed shadow-soft sm:max-w-[78%] ${
                      mensagem.papel === 'aluno'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card text-card-foreground'
                    }`}
                  >
                    <span className="sr-only">
                      {mensagem.papel === 'aluno' ? 'Você disse: ' : 'Professor: '}
                    </span>
                    {mensagem.texto || (respondendo ? <PontinhosDigitando /> : null)}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {erro ? (
            <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
              {erro}
            </p>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-3 py-3">
          <form
            onSubmit={(evento) => {
              evento.preventDefault();
              enviar(texto);
            }}
            className="flex items-end gap-1.5 sm:gap-2"
          >
            <button
              type="button"
              onClick={() => setFolhaAberta(true)}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-muted text-lg font-bold transition hover:bg-accent"
              aria-label="Abrir os comandos prontos"
              title="Comandos"
            >
              +
            </button>

            <label htmlFor="mensagem" className="sr-only">
              Sua mensagem para o professor
            </label>
            <textarea
              id="mensagem"
              ref={campo}
              rows={1}
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              onKeyDown={(evento) => {
                if (evento.key === 'Enter' && !evento.shiftKey) {
                  evento.preventDefault();
                  enviar(texto);
                }
              }}
              placeholder="Escreva em inglês ou em português…"
              className="campo max-h-40 min-h-[3.75rem] flex-1 resize-none px-3 py-2.5 text-sm leading-snug sm:min-h-[3rem] sm:py-3 sm:text-base"
              maxLength={4000}
            />

            <button
              type="submit"
              disabled={!texto.trim() || respondendo}
              className="botao-primario h-12 w-12 shrink-0 px-0"
              aria-label="Enviar mensagem"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h13M12 5l7 7-7 7" />
              </svg>
            </button>
          </form>

          <p className="mt-2 text-center text-xs text-muted-foreground sm:hidden">
            Toque no + para usar um comando pronto.
          </p>
        </div>
      </div>

      <FolhaDeComandos
        aberta={folhaAberta}
        aoFechar={() => setFolhaAberta(false)}
        aoEscolher={(comando) => {
          setTexto(comando);
          window.setTimeout(() => campo.current?.focus(), 60);
        }}
      />

      {confirmandoLimpeza ? (
        <ConfirmacaoDeLimpeza
          aoConfirmar={comecarDeNovo}
          aoCancelar={() => setConfirmandoLimpeza(false)}
        />
      ) : null}
    </div>
  );
}

function CabecalhoDoChat({ subtitulo, acoes }: { subtitulo: string; acoes: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-3 py-3">
        <Link
          to="/"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted transition hover:bg-accent"
          aria-label="Voltar para o início"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 5l-7 7 7 7" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold leading-tight sm:text-lg">Alex, seu professor</h1>
          <p className="truncate text-xs text-muted-foreground">{subtitulo}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {acoes}
          {/* No celular o espaço é curto: o tema fica no Início. */}
          <span className="hidden sm:block">
            <BotaoDeTema />
          </span>
        </div>
      </div>
    </header>
  );
}

function BoasVindas({ aoEscolher }: { aoEscolher: (texto: string) => void }) {
  return (
    <div className="animate-entrada-suave py-6">
      <div className="cartao p-5">
        <h2 className="font-display text-xl font-bold">Pode começar por onde quiser</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Escreva em português mesmo. O professor responde sempre em português e só usa o inglês nos
          exemplos e na prática.
        </p>
      </div>

      <ul className="mt-4 grid gap-2">
        {SUGESTOES.map((sugestao) => (
          <li key={sugestao}>
            <button
              type="button"
              onClick={() => aoEscolher(sugestao)}
              className="w-full rounded-lg bg-muted px-4 py-3 text-left text-sm font-medium transition hover:bg-accent"
            >
              {sugestao}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PontinhosDigitando() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="O professor está escrevendo">
      {[0, 1, 2].map((indice) => (
        <span
          key={indice}
          className="h-2 w-2 animate-ponto-digitando rounded-full bg-muted-foreground"
          style={{ animationDelay: `${indice * 0.16}s` }}
        />
      ))}
    </span>
  );
}

function ConfirmacaoDeLimpeza({
  aoConfirmar,
  aoCancelar,
}: {
  aoConfirmar: () => void;
  aoCancelar: () => void;
}) {
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') aoCancelar();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [aoCancelar]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4">
      <button
        type="button"
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
        onClick={aoCancelar}
        aria-label="Fechar"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="titulo-limpeza"
        className="cartao relative w-full max-w-sm animate-entrada-suave p-6"
      >
        <h2 id="titulo-limpeza" className="font-display text-lg font-bold">
          Começar do zero?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">Esta conversa será apagada.</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
          <button type="button" onClick={aoConfirmar} className="botao-primario flex-1">
            Sim, apagar
          </button>
          <button type="button" onClick={aoCancelar} className="botao-secundario flex-1">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Tudo o que o aluno tem fica no localStorage do próprio aparelho.
 * Não existe banco de dados nem conta de usuário neste produto.
 *
 * Todo acesso passa por aqui e é protegido: navegador anônimo, armazenamento
 * cheio ou cookies bloqueados não podem derrubar a tela.
 */
import type { Mensagem, Perfil } from './tipos';

const PREFIXO = 'professor-ingles:';

export const CHAVES = {
  acesso: `${PREFIXO}acesso`,
  nome: `${PREFIXO}nome`,
  perfil: `${PREFIXO}perfil`,
  conversa: `${PREFIXO}conversa`,
  totalDeConversas: `${PREFIXO}total-conversas`,
  rascunho: `${PREFIXO}rascunho`,
  sessao: `${PREFIXO}sessao`,
  tema: `${PREFIXO}tema`,
} as const;

function ler(chave: string): string | null {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravar(chave: string, valor: string) {
  try {
    window.localStorage.setItem(chave, valor);
  } catch {
    /* sem espaço ou armazenamento bloqueado: o app segue funcionando na memória */
  }
}

function apagar(chave: string) {
  try {
    window.localStorage.removeItem(chave);
  } catch {
    /* nada a fazer */
  }
}

function lerJson<T>(chave: string): T | null {
  const bruto = ler(chave);
  if (!bruto) return null;
  try {
    return JSON.parse(bruto) as T;
  } catch {
    apagar(chave);
    return null;
  }
}

/* ----- acesso ----- */

export function temAcesso(): boolean {
  return ler(CHAVES.acesso) === 'liberado';
}

export function liberarAcesso(nome: string) {
  gravar(CHAVES.acesso, 'liberado');
  if (nome.trim()) gravar(CHAVES.nome, nome.trim());
  else apagar(CHAVES.nome);
}

export function encerrarAcesso() {
  apagar(CHAVES.acesso);
}

export function lerNome(): string {
  return ler(CHAVES.nome) ?? '';
}

/* ----- perfil ----- */

export function lerPerfil(): Perfil | null {
  const perfil = lerJson<Partial<Perfil>>(CHAVES.perfil);
  if (!perfil || !perfil.nivel) return null;
  return {
    nivel: perfil.nivel,
    objetivo: perfil.objetivo ?? '',
    tempo: perfil.tempo ?? '',
    dificuldade: perfil.dificuldade ?? '',
  };
}

export function gravarPerfil(perfil: Perfil) {
  gravar(CHAVES.perfil, JSON.stringify(perfil));
}

/* ----- conversa ----- */

export function lerConversa(): Mensagem[] {
  const conversa = lerJson<Mensagem[]>(CHAVES.conversa);
  if (!Array.isArray(conversa)) return [];
  return conversa.filter(
    (mensagem) =>
      mensagem &&
      typeof mensagem.texto === 'string' &&
      (mensagem.papel === 'aluno' || mensagem.papel === 'professor'),
  );
}

export function gravarConversa(mensagens: Mensagem[]) {
  gravar(CHAVES.conversa, JSON.stringify(mensagens));
}

export function limparConversa() {
  apagar(CHAVES.conversa);
}

export function lerTotalDeConversas(): number {
  const total = Number(ler(CHAVES.totalDeConversas));
  return Number.isFinite(total) && total > 0 ? Math.floor(total) : 0;
}

export function contarMaisUmaConversa() {
  gravar(CHAVES.totalDeConversas, String(lerTotalDeConversas() + 1));
}

/* ----- rascunho vindo da tela de comandos ----- */

export function guardarRascunho(texto: string) {
  gravar(CHAVES.rascunho, texto);
}

export function pegarRascunho(): string {
  const texto = ler(CHAVES.rascunho);
  if (texto) apagar(CHAVES.rascunho);
  return texto ?? '';
}

/* ----- identificação da sessão (usada só para o limite por hora) ----- */

export function idDaSessao(): string {
  let id = ler(CHAVES.sessao);
  if (!id) {
    id = `s-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
    gravar(CHAVES.sessao, id);
  }
  return id;
}

/* ----- tema ----- */

export type Tema = 'claro' | 'escuro';

export function lerTema(): Tema | null {
  const tema = ler(CHAVES.tema);
  return tema === 'claro' || tema === 'escuro' ? tema : null;
}

export function gravarTema(tema: Tema) {
  gravar(CHAVES.tema, tema);
  document.documentElement.classList.toggle('dark', tema === 'escuro');
}

export function temaEmUso(): Tema {
  return document.documentElement.classList.contains('dark') ? 'escuro' : 'claro';
}

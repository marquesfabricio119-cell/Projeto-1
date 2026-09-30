/**
 * Código único de acesso, igual ao da área de membros que o cliente já usa.
 *
 * Para trocar o código, mude a linha abaixo e publique de novo.
 *
 * Aviso honesto: como é um código compartilhado e conferido no navegador,
 * ele não é um segredo de verdade — quem abrir o código-fonte do site vê.
 * Ele serve para o mesmo que a senha da área de membros: manter a porta
 * fechada para quem não comprou. A chave da API, essa sim, fica só no
 * servidor e nunca aparece aqui.
 */
export const CODIGO_DE_ACESSO = 'PROFESSOR17';

export function codigoConfere(digitado: string): boolean {
  return digitado.trim().toUpperCase() === CODIGO_DE_ACESSO;
}

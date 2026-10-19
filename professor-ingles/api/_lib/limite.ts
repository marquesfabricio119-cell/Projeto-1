/**
 * Limite simples de mensagens por sessão (memória da instância).
 * Não é um antifraude: serve para uma sessão sozinha não gastar a conta toda.
 * Como a Vercel pode manter várias instâncias, o número real por sessão pode
 * passar um pouco do limite. Para um controle exato seria preciso um Redis,
 * e este projeto foi pedido sem banco de dados.
 */

const UMA_HORA = 60 * 60 * 1000;

type Registro = { contagem: number; reiniciaEm: number };

const registros = new Map<string, Registro>();

function limiteConfigurado(): number {
  const ambiente = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const bruto = Number(ambiente?.TUTOR_LIMITE_MENSAGENS_HORA);
  return Number.isFinite(bruto) && bruto > 0 ? Math.floor(bruto) : 30;
}

export type ResultadoDoLimite = {
  liberado: boolean;
  restantes: number;
  minutosParaLiberar: number;
};

export function registrarMensagem(sessao: string): ResultadoDoLimite {
  const limite = limiteConfigurado();
  const agora = Date.now();

  limparAntigos(agora);

  const registro = registros.get(sessao);
  if (!registro || registro.reiniciaEm <= agora) {
    registros.set(sessao, { contagem: 1, reiniciaEm: agora + UMA_HORA });
    return { liberado: true, restantes: limite - 1, minutosParaLiberar: 60 };
  }

  const minutosParaLiberar = Math.max(1, Math.ceil((registro.reiniciaEm - agora) / 60000));
  if (registro.contagem >= limite) {
    return { liberado: false, restantes: 0, minutosParaLiberar };
  }

  registro.contagem += 1;
  return { liberado: true, restantes: limite - registro.contagem, minutosParaLiberar };
}

function limparAntigos(agora: number) {
  if (registros.size < 500) return;
  for (const [chave, registro] of registros) {
    if (registro.reiniciaEm <= agora) registros.delete(chave);
  }
}

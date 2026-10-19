import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { codigoConfere } from '../lib/acesso';
import { liberarAcesso, lerNome } from '../lib/armazenamento';
import BotaoDeTema from '../components/BotaoDeTema';

export default function Entrar() {
  const navegar = useNavigate();
  const [nome, setNome] = useState(lerNome);
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!codigoConfere(codigo)) {
      setErro('Esse código não está certo. Confira o e-mail da sua compra.');
      return;
    }
    setErro('');
    liberarAcesso(nome);
    navegar('/', { replace: true });
  }

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <BotaoDeTema />
      </div>

      <div className="cartao w-full max-w-sm animate-entrada-suave p-6 sm:p-8">
        <div className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-primary text-2xl font-extrabold text-primary-foreground shadow-soft">
            IV
          </div>
          <p className="mt-4 font-display text-xl font-extrabold tracking-tight">Idioma Visual</p>
          <p className="mt-1 text-sm text-muted-foreground">Seu Professor com IA</p>
        </div>

        <form onSubmit={enviar} className="mt-7 grid gap-4" noValidate>
          <div>
            <label htmlFor="nome" className="mb-2 block text-sm font-medium">
              Seu nome (opcional)
            </label>
            <input
              id="nome"
              name="nome"
              type="text"
              autoComplete="given-name"
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              className="campo bg-muted"
              maxLength={40}
              placeholder="Como o professor deve te chamar"
            />
          </div>

          <div>
            <label
              htmlFor="codigo"
              className="mb-2 block text-sm font-semibold uppercase tracking-wide"
            >
              Código de acesso
            </label>
            <input
              id="codigo"
              name="codigo"
              type="password"
              autoComplete="current-password"
              value={codigo}
              onChange={(evento) => {
                setCodigo(evento.target.value);
                if (erro) setErro('');
              }}
              className="campo bg-muted tracking-widest"
              aria-invalid={erro ? true : undefined}
              aria-describedby={erro ? 'erro-codigo' : undefined}
              placeholder="••••••••"
              required
            />
          </div>

          {erro ? (
            <p
              id="erro-codigo"
              role="alert"
              className="rounded-md bg-danger/10 px-3 py-2 text-sm font-medium text-danger"
            >
              {erro}
            </p>
          ) : null}

          <button type="submit" className="botao-primario mt-1 w-full">
            Entrar
          </button>
        </form>
      </div>

      <p className="mt-6 max-w-xs text-center text-xs text-muted-foreground">
        O código veio no e-mail da sua compra, junto com o link do kit de mapas mentais.
      </p>
    </main>
  );
}

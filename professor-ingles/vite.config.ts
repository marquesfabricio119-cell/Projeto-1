import { defineConfig, type Connect, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Em produção a Vercel serve /api/chat.ts como função serverless.
 * No `npm run dev` quem serve é este plugin: ele converte a requisição do
 * Node em uma Request padrão, chama o mesmo handler e devolve o corpo em
 * streaming — assim o desenvolvimento local se comporta igual à produção.
 */
function apiEmDesenvolvimento(): Plugin {
  return {
    name: 'api-em-desenvolvimento',
    configureServer(server: ViteDevServer) {
      const rota: Connect.NextHandleFunction = async (req, res, next) => {
        if (!req.url?.startsWith('/api/chat')) return next();
        try {
          const modulo = await server.ssrLoadModule('/api/chat.ts');
          const handler = modulo.default as (r: Request) => Promise<Response>;
          const resposta = await handler(await paraRequestWeb(req));
          await escreverResposta(res, resposta);
        } catch (erro) {
          server.config.logger.error(String(erro));
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(
            JSON.stringify({
              erro: 'O professor não conseguiu responder agora. Tente de novo daqui a pouco.',
            }),
          );
        }
      };
      server.middlewares.use(rota);
    },
  };
}

async function paraRequestWeb(req: IncomingMessage): Promise<Request> {
  const corpo = await new Promise<Buffer>((resolve, reject) => {
    const partes: Buffer[] = [];
    req.on('data', (parte: Buffer) => partes.push(parte));
    req.on('end', () => resolve(Buffer.concat(partes)));
    req.on('error', reject);
  });
  const cabecalhos = new Headers();
  for (const [chave, valor] of Object.entries(req.headers)) {
    if (typeof valor === 'string') cabecalhos.set(chave, valor);
    else if (Array.isArray(valor)) cabecalhos.set(chave, valor.join(', '));
  }
  const metodo = req.method ?? 'GET';
  return new Request(`http://localhost${req.url}`, {
    method: metodo,
    headers: cabecalhos,
    body: metodo === 'GET' || metodo === 'HEAD' ? undefined : corpo,
  });
}

async function escreverResposta(res: ServerResponse, resposta: Response) {
  res.statusCode = resposta.status;
  resposta.headers.forEach((valor, chave) => res.setHeader(chave, valor));
  if (!resposta.body) return res.end();
  const leitor = resposta.body.getReader();
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    res.write(Buffer.from(value));
  }
  res.end();
}

export default defineConfig({
  plugins: [react(), apiEmDesenvolvimento()],
  server: { host: true, port: 5173 },
});

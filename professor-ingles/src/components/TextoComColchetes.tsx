import { Fragment } from 'react';

/**
 * Mostra o texto de um comando destacando os [trechos entre colchetes] na cor
 * do app, para o aluno perceber que aquilo ali é ele quem tem que trocar.
 */
export default function TextoComColchetes({ texto }: { texto: string }) {
  const pedacos = texto.split(/(\[[^\]]+\])/g);
  return (
    <>
      {pedacos.map((pedaco, indice) =>
        pedaco.startsWith('[') && pedaco.endsWith(']') ? (
          <strong key={indice} className="font-semibold text-primary">
            {pedaco}
          </strong>
        ) : (
          <Fragment key={indice}>{pedaco}</Fragment>
        ),
      )}
    </>
  );
}

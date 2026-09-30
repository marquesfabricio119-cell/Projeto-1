export type Perfil = {
  nivel: string;
  objetivo: string;
  tempo: string;
  dificuldade: string;
};

export type PapelDaMensagem = 'aluno' | 'professor';

export type Mensagem = {
  id: string;
  papel: PapelDaMensagem;
  texto: string;
};

export type Comando = {
  id: number;
  categoria: string;
  texto: string;
};

export type MapaInfantil = {
  arquivo: string;
  titulo: string;
  bloco: string;
};

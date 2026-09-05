import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, useState, type ReactElement } from 'react';
import { temAcesso } from './lib/armazenamento';
import Entrar from './pages/Entrar';
import Inicio from './pages/Inicio';
import Chat from './pages/Chat';
import Comandos from './pages/Comandos';
import Criancas from './pages/Criancas';
import Guia from './pages/Guia';

/** Só entra quem digitou o código de acesso. */
function Protegida({ children }: { children: ReactElement }) {
  const local = useLocation();
  if (!temAcesso()) return <Navigate to="/entrar" replace state={{ de: local.pathname }} />;
  return children;
}

export default function App() {
  const local = useLocation();
  const [liberado, setLiberado] = useState(temAcesso());

  // Ao trocar de tela, revalida o acesso (o aluno pode ter saído em outra aba).
  useEffect(() => {
    setLiberado(temAcesso());
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [local.pathname]);

  return (
    <Routes>
      <Route path="/entrar" element={liberado ? <Navigate to="/" replace /> : <Entrar />} />
      <Route
        path="/"
        element={
          <Protegida>
            <Inicio />
          </Protegida>
        }
      />
      <Route
        path="/chat"
        element={
          <Protegida>
            <Chat />
          </Protegida>
        }
      />
      <Route
        path="/comandos"
        element={
          <Protegida>
            <Comandos />
          </Protegida>
        }
      />
      <Route
        path="/criancas"
        element={
          <Protegida>
            <Criancas />
          </Protegida>
        }
      />
      <Route
        path="/guia"
        element={
          <Protegida>
            <Guia />
          </Protegida>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

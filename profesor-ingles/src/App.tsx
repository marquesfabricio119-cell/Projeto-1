import { useCallback, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Login from './pages/Login'
import Home from './pages/Home'
import Chat from './pages/Chat'
import Comandos from './pages/Comandos'
import Ninos from './pages/Ninos'
import Guia from './pages/Guia'
import { cerrarSesion, obtenerNombre, tieneAcceso } from './lib/almacenamiento'

export default function App() {
  const [autenticado, setAutenticado] = useState(() => tieneAcceso())
  const [nombre, setNombre] = useState(() => obtenerNombre())
  const ubicacion = useLocation()

  const entrar = useCallback((nombreIngresado: string) => {
    setNombre(nombreIngresado)
    setAutenticado(true)
  }, [])

  const salir = useCallback(() => {
    cerrarSesion()
    setAutenticado(false)
  }, [])

  if (!autenticado) {
    return (
      <Routes>
        <Route path="/login" element={<Login alEntrar={entrar} />} />
        <Route path="*" element={<Navigate to="/login" replace state={{ desde: ubicacion.pathname }} />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Home nombre={nombre} alSalir={salir} />} />
      <Route path="/chat" element={<Chat alSalir={salir} />} />
      <Route path="/comandos" element={<Comandos alSalir={salir} />} />
      <Route path="/ninos" element={<Ninos alSalir={salir} />} />
      <Route path="/guia" element={<Guia alSalir={salir} />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

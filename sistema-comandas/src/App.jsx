import { Routes, Route, Navigate } from 'react-router-dom'

import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'

import { useAuth } from './contexts/AuthContext'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Comandas from './pages/Comandas'
import Caixa from './pages/Caixa'
import Produtos from './pages/Produtos'
import Financeiro from './pages/Financeiro'
import Estoque from './pages/Estoque'
import RelatorioCaixa from './pages/RelatorioCaixa'

import MainLayout from './layouts/MainLayout'

function RotasProtegidas() {
  const { usuario, carregando, login, isAdmin } = useAuth()

  if (carregando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amber-50">
        <p className="text-amber-900 font-semibold">Carregando...</p>
      </div>
    )
  }

  if (!usuario) {
    return <Login onLogin={(nome, senha) => login(nome, senha)} />
  }

  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={isAdmin ? <Dashboard /> : <Navigate to="/comandas" replace />} />
        <Route path="comandas" element={<Comandas />} />

        <Route
          path="caixa"
          element={isAdmin ? <Caixa /> : <Navigate to="/comandas" replace />}
        />

        <Route
          path="produtos"
          element={isAdmin ? <Produtos /> : <Navigate to="/comandas" replace />}
        />
        <Route
          path="estoque"
          element={isAdmin ? <Estoque /> : <Navigate to="/comandas" replace />}
        />
        <Route
          path="financeiro"
          element={isAdmin ? <Financeiro /> : <Navigate to="/comandas" replace />}
        />
        <Route
          path="relatorio-caixa"
          element={isAdmin ? <RelatorioCaixa /> : <Navigate to="/comandas" replace />}
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/*" element={<RotasProtegidas />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  )
}
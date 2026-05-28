import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'

import { useAuth } from './contexts/AuthContext'

import Login from './pages/Login'
import MainLayout from './layouts/MainLayout'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Comandas = lazy(() => import('./pages/Comandas'))
const Caixa = lazy(() => import('./pages/Caixa'))
const Produtos = lazy(() => import('./pages/Produtos'))
const Financeiro = lazy(() => import('./pages/Financeiro'))
const Estoque = lazy(() => import('./pages/Estoque'))
const RelatorioCaixa = lazy(() => import('./pages/RelatorioCaixa'))

function CarregandoPagina() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="font-semibold text-amber-900">Carregando...</p>
    </div>
  )
}

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
    <Suspense fallback={<CarregandoPagina />}>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={isAdmin ? <Dashboard /> : <Navigate to="/comandas" replace />} />
          <Route path="comandas" element={<Comandas />} />
          <Route path="caixa" element={isAdmin ? <Caixa /> : <Navigate to="/comandas" replace />} />
          <Route path="produtos" element={isAdmin ? <Produtos /> : <Navigate to="/comandas" replace />} />
          <Route path="estoque" element={isAdmin ? <Estoque /> : <Navigate to="/comandas" replace />} />
          <Route path="financeiro" element={isAdmin ? <Financeiro /> : <Navigate to="/comandas" replace />} />
          <Route
            path="relatorio-caixa"
            element={isAdmin ? <RelatorioCaixa /> : <Navigate to="/comandas" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
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

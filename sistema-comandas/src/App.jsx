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

/** Suspense por página — evita desmontar MainLayout ao trocar de rota (erro removeChild). */
function PaginaSuspensa({ children }) {
  return <Suspense fallback={<CarregandoPagina />}>{children}</Suspense>
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
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route
          index
          element={
            isAdmin ? (
              <PaginaSuspensa>
                <Dashboard />
              </PaginaSuspensa>
            ) : (
              <Navigate to="/comandas" replace />
            )
          }
        />
        <Route
          path="comandas"
          element={
            <PaginaSuspensa>
              <Comandas />
            </PaginaSuspensa>
          }
        />
        <Route
          path="caixa"
          element={
            isAdmin ? (
              <PaginaSuspensa>
                <Caixa />
              </PaginaSuspensa>
            ) : (
              <Navigate to="/comandas" replace />
            )
          }
        />
        <Route
          path="produtos"
          element={
            isAdmin ? (
              <PaginaSuspensa>
                <Produtos />
              </PaginaSuspensa>
            ) : (
              <Navigate to="/comandas" replace />
            )
          }
        />
        <Route
          path="estoque"
          element={
            isAdmin ? (
              <PaginaSuspensa>
                <Estoque />
              </PaginaSuspensa>
            ) : (
              <Navigate to="/comandas" replace />
            )
          }
        />
        <Route
          path="financeiro"
          element={
            isAdmin ? (
              <PaginaSuspensa>
                <Financeiro />
              </PaginaSuspensa>
            ) : (
              <Navigate to="/comandas" replace />
            )
          }
        />
        <Route
          path="relatorio-caixa"
          element={
            isAdmin ? (
              <PaginaSuspensa>
                <RelatorioCaixa />
              </PaginaSuspensa>
            ) : (
              <Navigate to="/comandas" replace />
            )
          }
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

import { Outlet } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import Comandas from '../pages/Comandas'
import { useResponsive } from '../hooks/useResponsive'
import { useAuth } from '../contexts/AuthContext'

export default function MainLayout() {
  const { isMobile } = useResponsive()
  const { logout } = useAuth()

  if (isMobile) {
    return (
      <div className="h-screen bg-amber-50/80 overflow-hidden flex flex-col">
        <header className="h-14 bg-amber-800 text-white px-4 flex items-center justify-between shrink-0">
          <h1 className="text-lg font-bold">Comandas</h1>
          <button
            type="button"
            onClick={logout}
            className="px-3 py-2 rounded-lg text-amber-200 hover:bg-amber-700 text-sm"
          >
            Sair
          </button>
        </header>
        <main className="flex-1 overflow-auto min-h-0">
          <Comandas />
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-amber-50/80 overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar />
        <main className="flex-1 overflow-auto p-6 bg-stone-100/50">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

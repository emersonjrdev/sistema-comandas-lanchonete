import { useEffect, useMemo, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import Sidebar, { navItems } from '../components/Sidebar'
import Topbar from '../components/Topbar'
import { useResponsive } from '../hooks/useResponsive'
import { useAuth } from '../contexts/AuthContext'

export default function MainLayout() {
  const { isMobile } = useResponsive()
  const { isAdmin, logout } = useAuth()
  const location = useLocation()
  const [menuAberto, setMenuAberto] = useState(false)

  const itensVisiveis = useMemo(
    () => navItems.filter((item) => !item.adminOnly || isAdmin),
    [isAdmin]
  )

  const tituloAtual = useMemo(() => {
    const atual = itensVisiveis.find((item) => item.to === location.pathname)
    return atual?.label || 'Sistema'
  }, [itensVisiveis, location.pathname])

  useEffect(() => {
    setMenuAberto(false)
  }, [location.pathname])

  if (isMobile) {
    return (
      <div className="h-screen bg-amber-50/80 overflow-hidden flex flex-col">
        <header className="h-14 bg-amber-800 text-white px-3 flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMenuAberto(true)}
            className="px-3 py-2 rounded-lg bg-amber-900/60 text-amber-100 text-sm font-semibold"
          >
            Menu
          </button>
          <h1 className="text-base font-bold truncate">{tituloAtual}</h1>
          <button
            type="button"
            onClick={logout}
            className="px-3 py-2 rounded-lg text-amber-100 bg-amber-900/60 text-sm font-semibold"
          >
            Sair
          </button>
        </header>
        {menuAberto && (
          <div className="fixed inset-0 z-50">
            <button
              type="button"
              aria-label="Fechar menu"
              className="absolute inset-0 bg-black/40"
              onClick={() => setMenuAberto(false)}
            />
            <aside className="relative h-full w-72 max-w-[85vw] bg-amber-900 text-amber-50 p-4 shadow-xl">
              <p className="text-sm text-amber-200 mb-3">Navegação</p>
              <nav className="space-y-2">
                {itensVisiveis.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all ${
                        isActive
                          ? 'bg-amber-600 text-white shadow-lg'
                          : 'text-amber-100 hover:bg-amber-800/70 hover:text-white'
                      }`
                    }
                  >
                    <span aria-hidden>{item.icon}</span>
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </aside>
          </div>
        )}
        <main className="flex-1 overflow-auto min-h-0">
          <div className="p-4 pb-24">
            <Outlet />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-amber-50/80 overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar />
        <main className="flex-1 overflow-auto p-4 md:p-6 bg-stone-100/50">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

import { NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { to: '/', label: 'Dashboard', icon: '📊', adminOnly: true },
  { to: '/comandas', label: 'Comandas', icon: '📋', adminOnly: false },
  { to: '/caixa', label: 'Caixa', icon: '💰', adminOnly: false },
  { to: '/caixa', label: 'Caixa', icon: '💰', adminOnly: true },
  { to: '/produtos', label: 'Produtos', icon: '🍔', adminOnly: true },
  { to: '/estoque', label: 'Estoque', icon: '📦', adminOnly: true },
  { to: '/financeiro', label: 'Financeiro', icon: '📈', adminOnly: true },
  { to: '/relatorio-caixa', label: 'Relatório Caixa', icon: '📑', adminOnly: true },
]

export default function Sidebar() {
  const { isAdmin } = useAuth()

  const itensVisiveis = navItems.filter((item) => !item.adminOnly || isAdmin)

  return (
    <aside className="w-64 bg-amber-900 text-amber-50 flex flex-col shrink-0 shadow-xl">
      <nav className="flex-1 p-4 space-y-2">
        {itensVisiveis.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-4 px-5 py-4 rounded-xl text-lg font-semibold transition-all min-h-[56px] touch-manipulation active:scale-[0.98] ${
                isActive
                  ? 'bg-amber-600 text-white shadow-lg'
                  : 'text-amber-100 hover:bg-amber-800/70 hover:text-white'
              }`
            }
          >
            <span className="text-2xl" aria-hidden>
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

function formatTime(date) {
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function Topbar() {
  const [time, setTime] = useState(() => formatTime(new Date()))
  const { usuario, logout } = useAuth()

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(formatTime(new Date()))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <header className="min-h-16 bg-amber-800 text-white px-4 md:px-6 py-2 flex items-center justify-between gap-3 shrink-0 shadow-md">
      <div className="flex items-center gap-3 min-w-0">
        <img
          src="/logo-padaria.png"
          alt="Logo Padaria Grande Família"
          className="h-10 w-10 md:h-12 md:w-12 object-contain"
        />
        <h1 className="text-base md:text-xl font-bold tracking-tight truncate">
          Padaria Grande Família
        </h1>
      </div>
      <div className="flex items-center gap-2 md:gap-4 flex-wrap justify-end">
        <span className="text-xs md:text-sm text-amber-200 max-w-40 truncate">{usuario?.nome}</span>
        <div className="text-sm md:text-lg font-mono tabular-nums bg-amber-900/50 px-3 md:px-4 py-2 rounded-lg">
          {time}
        </div>
        <button
          type="button"
          onClick={logout}
          className="px-3 py-2 rounded-lg bg-amber-900/70 hover:bg-amber-900 text-xs md:text-sm font-semibold"
        >
          Sair
        </button>
      </div>
    </header>
  )
}

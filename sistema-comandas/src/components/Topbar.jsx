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
    <header className="h-16 bg-amber-800 text-white px-6 flex items-center justify-between shrink-0 shadow-md">
      <h1 className="text-xl font-bold tracking-tight">
        Padaria Grande Familia
      </h1>
      <div className="flex items-center gap-4">
        <span className="text-sm text-amber-200">{usuario?.nome}</span>
        <div className="text-lg font-mono tabular-nums bg-amber-900/50 px-4 py-2 rounded-lg">
          {time}
        </div>
        <button
          type="button"
          onClick={logout}
          className="px-3 py-2 rounded-lg bg-amber-900/70 hover:bg-amber-900 text-sm font-semibold"
        >
          Sair
        </button>
      </div>
    </header>
  )
}

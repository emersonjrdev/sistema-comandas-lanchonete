import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const show = useCallback((message, type = 'success') => {
    const id = ++idRef.current
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }, [])

  const value = { show }

  const toastUi =
    toasts.length > 0 ? (
      <div
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2"
        role="region"
        aria-label="Notificações"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={`px-4 py-3 rounded-xl shadow-lg font-semibold ${
              t.type === 'error'
                ? 'bg-red-500 text-white'
                : t.type === 'warning'
                  ? 'bg-amber-500 text-white'
                  : 'bg-green-600 text-white'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    ) : null

  return (
    <ToastContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined' ? createPortal(toastUi, document.body) : null}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) return { show: () => {} }
  return ctx
}

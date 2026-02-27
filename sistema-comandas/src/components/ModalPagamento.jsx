import { useState, useEffect, useRef } from 'react'

const METODOS = {
  D: { label: 'Dinheiro', key: 'D' },
  C: { label: 'Cartão', key: 'C' },
  P: { label: 'PIX', key: 'P' },
}

export default function ModalPagamento({ total, onConfirmar, onCancelar }) {
  const [metodo, setMetodo] = useState(null)
  const [valorRecebido, setValorRecebido] = useState('')
  const [erro, setErro] = useState('')
  const inputRef = useRef(null)

  const troco =
    metodo === 'D' && valorRecebido
      ? Math.max(0, (parseFloat(valorRecebido.replace(',', '.')) || 0) - total)
      : 0

  useEffect(() => {
    if (metodo === 'D') {
      inputRef.current?.focus()
    }
  }, [metodo])

  function handleConfirmar() {
    setErro('')
    if (!metodo) {
      setErro('Selecione o método de pagamento')
      return
    }

    const metodoLabel = METODOS[metodo]?.label || metodo

    if (metodo === 'D') {
      const v = parseFloat(valorRecebido.replace(',', '.')) || 0
      if (v < total) {
        setErro('Valor recebido menor que o total')
        return
      }
      onConfirmar(metodoLabel, v, troco)
    } else {
      onConfirmar(metodoLabel, 0, 0)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancelar()
    }
    if (e.key === 'Enter' && metodo) {
      if (metodo === 'D' && !valorRecebido) return
      e.preventDefault()
      handleConfirmar()
    }
    if (['d', 'D', 'c', 'C', 'p', 'P'].includes(e.key)) {
      e.preventDefault()
      if (!metodo) setMetodo(e.key.toUpperCase())
    }
  }

  const overlayRef = useRef(null)
  useEffect(() => {
    overlayRef.current?.focus()
  }, [])

  return (
    <div
      ref={overlayRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 outline-none"
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-pagamento-titulo"
    >
      <div className="bg-white rounded-2xl shadow-2xl border-2 border-amber-200 w-full max-w-md p-6">
        <h2 id="modal-pagamento-titulo" className="text-xl font-bold text-amber-900 mb-4">
          Pagamento
        </h2>

        <p className="text-2xl font-bold text-amber-800 mb-6 tabular-nums">
          Total: R$ {total.toFixed(2)}
        </p>

        <p className="text-sm text-stone-500 mb-3">
          Atalhos: <kbd className="px-1.5 py-0.5 bg-amber-100 rounded">D</kbd> Dinheiro{' '}
          <kbd className="px-1.5 py-0.5 bg-amber-100 rounded">C</kbd> Cartão{' '}
          <kbd className="px-1.5 py-0.5 bg-amber-100 rounded">P</kbd> PIX
        </p>

        <div className="flex gap-2 mb-4">
          {Object.entries(METODOS).map(([key, m]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMetodo(key)}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all ${
                metodo === key
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {metodo === 'D' && (
          <div className="space-y-2 mb-4">
            <label className="block text-sm font-medium text-amber-900">
              Valor recebido (R$)
            </label>
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              value={valorRecebido}
              onChange={(e) => setValorRecebido(e.target.value.replace(/[^\d,.]/g, ''))}
              placeholder="0,00"
              className="w-full px-4 py-3 rounded-lg border-2 border-amber-200 focus:border-amber-500 outline-none text-amber-900 font-mono text-xl"
            />
            {valorRecebido && (
              <p className="text-lg font-bold text-green-700 tabular-nums">
                Troco: R$ {troco.toFixed(2)}
              </p>
            )}
          </div>
        )}

        {erro && (
          <p role="alert" className="mb-4 p-3 rounded-lg bg-red-100 text-red-700">
            {erro}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={metodo === 'D' && !valorRecebido}
            className="flex-1 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirmar
          </button>
          <button
            type="button"
            onClick={onCancelar}
            className="px-4 py-3 rounded-xl bg-stone-200 text-stone-700 font-semibold hover:bg-stone-300"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}

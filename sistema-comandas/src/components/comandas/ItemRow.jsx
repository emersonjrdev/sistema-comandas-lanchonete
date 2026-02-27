export default function ItemRow({ item, onQuantidadeChange, onRemover }) {
  const subtotal = item.subtotal ?? item.preco * item.quantidade

  return (
    <div className="flex items-center gap-4 py-3 px-4 bg-white rounded-lg border border-amber-200/60 hover:border-amber-300 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-amber-900 truncate">{item.nome}</p>
        <p className="text-sm text-stone-500">
          R$ {item.preco.toFixed(2)} cada
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onQuantidadeChange(item.id, item.quantidade - 1)}
          disabled={item.quantidade <= 1}
          className="w-10 h-10 rounded-lg bg-amber-100 text-amber-800 font-bold text-lg disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation hover:bg-amber-200 transition-colors"
          aria-label="Diminuir quantidade"
        >
          −
        </button>
        <span className="w-12 text-center font-mono font-bold text-amber-900 tabular-nums">
          {item.quantidade}
        </span>
        <button
          type="button"
          onClick={() => onQuantidadeChange(item.id, item.quantidade + 1)}
          className="w-10 h-10 rounded-lg bg-amber-100 text-amber-800 font-bold text-lg touch-manipulation hover:bg-amber-200 transition-colors"
          aria-label="Aumentar quantidade"
        >
          +
        </button>
      </div>
      <p className="w-24 text-right font-bold text-amber-900 tabular-nums">
        R$ {subtotal.toFixed(2)}
      </p>
      <button
        type="button"
        onClick={() => onRemover(item.id)}
        className="w-10 h-10 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors touch-manipulation shrink-0"
        aria-label="Remover item"
      >
        ×
      </button>
    </div>
  )
}

export default function ComandaCard({ comanda, onClick, isMobile }) {
  const total = comanda.total ?? (comanda.itens || []).reduce(
    (acc, item) => acc + (item.subtotal ?? item.preco * item.quantidade),
    0
  )
  const qtdItens = (comanda.itens || []).reduce((acc, item) => acc + (item.quantidade || 0), 0)

  return (
    <button
      type="button"
      onClick={() => onClick(comanda)}
      className={`w-full text-left rounded-xl bg-white border-2 border-amber-200 hover:border-amber-400 hover:shadow-lg transition-all touch-manipulation active:scale-[0.99] ${
        isMobile ? 'p-6 text-left' : 'p-5'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={isMobile ? 'text-4xl' : 'text-3xl'}>🍽️</span>
            <h3 className={`font-bold text-amber-900 ${isMobile ? 'text-2xl' : 'text-xl'}`}>
              {comanda.identificacao}
            </h3>
          </div>
          <p className="text-sm text-stone-500">
            {qtdItens} {qtdItens === 1 ? 'item' : 'itens'}
          </p>
        </div>
        <div className="text-right">
          <p className={`font-bold text-amber-800 tabular-nums ${isMobile ? 'text-xl' : 'text-lg'}`}>
            R$ {total.toFixed(2)}
          </p>
        </div>
      </div>
    </button>
  )
}

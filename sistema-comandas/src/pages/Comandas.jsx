import { useState, useRef, useEffect } from 'react'
import ComandaCard from '../components/comandas/ComandaCard'
import ComandaDetalhe from '../components/comandas/ComandaDetalhe'
import { criarComanda } from '../services/storage'
import { useComandas, useProdutos } from '../hooks/usePDV'
import { useIsMobile } from '../hooks/useResponsive'

export default function ComandasPage() {
  const [comandas, refreshComandas] = useComandas()
  const [produtos] = useProdutos()
  const [comandaSelecionada, setComandaSelecionada] = useState(null)
  const [busca, setBusca] = useState('')
  const bipadorRef = useRef(null)
  const isMobile = useIsMobile()

  const comandasFiltradas = busca.trim()
    ? comandas.filter((c) =>
        c.identificacao?.toLowerCase().includes(busca.toLowerCase().trim())
      )
    : comandas

  useEffect(() => {
    if (isMobile) bipadorRef.current?.focus()
  }, [isMobile])

  function handleNovaComanda() {
    const numeroComanda = window.prompt('Número da comanda (deixe vazio para gerar sem número):', '')
    const cliente = window.prompt(
      'Nome do cliente ou identificação (ex: Balcão, João, Viagem):',
      'Balcão'
    )
    if (cliente === null) return

    const nova = criarComanda(numeroComanda?.trim() || null, cliente?.trim() || 'Balcão')
    refreshComandas()
    setComandaSelecionada(nova)
  }

  function handleAbrirComanda(comanda) {
    setComandaSelecionada(comanda)
  }

  function handleAtualizarComanda(comandaAtualizada) {
    if (comandaAtualizada) setComandaSelecionada(comandaAtualizada)
    refreshComandas()
  }

  function handleEnviada() {
    refreshComandas()
    setComandaSelecionada(null)
  }

  function handleVoltar() {
    setComandaSelecionada(null)
  }


  const paddingClass = isMobile ? 'p-4 pb-24' : 'p-6'

  if (comandaSelecionada) {
    const comandaAtual = comandas.find((c) => c.id === comandaSelecionada.id) || comandaSelecionada
    return (
      <div className={paddingClass}>
        {!isMobile && <h2 className="text-2xl font-bold text-amber-900 mb-6">Comandas</h2>}
        <ComandaDetalhe
          comanda={comandaAtual}
          produtos={produtos}
          onComandaAtualizada={handleAtualizarComanda}
          onEnviada={handleEnviada}
          onVoltar={handleVoltar}
          isMobile={isMobile}
        />
      </div>
    )
  }

  return (
    <div className={paddingClass}>
      <div
        className={`flex flex-col gap-4 mb-6 ${isMobile ? 'gap-6' : ''}`}
      >
        {!isMobile && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-2xl font-bold text-amber-900">Comandas</h2>
          </div>
        )}

        {isMobile && (
          <input
            type="search"
            placeholder="Buscar comanda..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full px-4 py-4 rounded-xl border-2 border-amber-200 text-lg focus:border-amber-500 outline-none"
          />
        )}

        <button
          type="button"
          onClick={handleNovaComanda}
          className={`w-full rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 transition-colors touch-manipulation shadow-lg ${
            isMobile
              ? 'py-6 text-2xl min-h-[72px]'
              : 'px-6 py-4 text-lg min-h-[56px]'
          }`}
        >
          + Nova Comanda
        </button>
      </div>

      {comandasFiltradas.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-xl border-2 border-dashed border-amber-200">
          <p className="text-stone-500 text-lg mb-4">
            {busca.trim() ? 'Nenhuma comanda encontrada.' : 'Nenhuma comanda aberta.'}
          </p>
          {!busca.trim() && (
            <button
              type="button"
              onClick={handleNovaComanda}
              className={`rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-colors touch-manipulation ${
                isMobile ? 'px-8 py-4 text-xl' : 'px-6 py-3'
              }`}
            >
              Abrir primeira comanda
            </button>
          )}
        </div>
      ) : (
        <div
          className={`grid gap-4 ${
            isMobile ? 'grid-cols-1 gap-5' : 'sm:grid-cols-2 lg:grid-cols-3'
          }`}
        >
          {comandasFiltradas.map((comanda) => (
            <ComandaCard
              key={comanda.id}
              comanda={comanda}
              onClick={handleAbrirComanda}
              isMobile={isMobile}
            />
          ))}
        </div>
      )}

      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-amber-100/95 border-t-2 border-amber-200 safe-area-pb">
          <input
            ref={bipadorRef}
            type="text"
            inputMode="search"
            placeholder="Bipador / Busca rápida..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full px-4 py-4 rounded-xl border-2 border-amber-300 text-lg focus:border-amber-500 outline-none"
          />
        </div>
      )}
    </div>
  )
}
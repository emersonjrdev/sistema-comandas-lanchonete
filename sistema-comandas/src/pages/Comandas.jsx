import { useState, useRef, useEffect } from 'react'
import ComandaCard from '../components/comandas/ComandaCard'
import ComandaDetalhe from '../components/comandas/ComandaDetalhe'
import { criarComanda, excluirComandasAbertas } from '../services/storage'
import { useComandas, useProdutos } from '../hooks/usePDV'
import { useIsMobile } from '../hooks/useResponsive'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { playSomAcao, playSomErro } from '../utils/sons'

export default function ComandasPage() {
  const [comandas, refreshComandas] = useComandas()
  const [produtos] = useProdutos()
  const { usuario, isAdmin } = useAuth()
  const toast = useToast()
  const [comandaSelecionada, setComandaSelecionada] = useState(null)
  const [mostrarModalNovaComanda, setMostrarModalNovaComanda] = useState(false)
  const [numeroNovaComanda, setNumeroNovaComanda] = useState('')
  const [busca, setBusca] = useState('')
  const bipadorRef = useRef(null)
  const isMobile = useIsMobile()

  function normalizarTexto(valor) {
    return String(valor || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
  }

  const termoBusca = normalizarTexto(busca)
  const comandasFiltradas = termoBusca
    ? comandas.filter((c) => {
        const camposBusca = [
          c.identificacao,
          c.cliente,
          c.numero_comanda,
          c.numeroComanda,
          c.id,
        ]

        return camposBusca.some((campo) => normalizarTexto(campo).includes(termoBusca))
      })
    : comandas

  useEffect(() => {
    if (isMobile) bipadorRef.current?.focus()
  }, [isMobile])

  async function handleCriarNovaComanda() {
    const numeroComanda = String(numeroNovaComanda || '').trim()
    if (!numeroComanda) {
      playSomErro()
      return
    }
    if (!/^\d+$/.test(numeroComanda)) {
      playSomErro()
      return
    }

    const nova = await criarComanda(numeroComanda)
    if (!nova) {
      playSomErro()
      return
    }
    playSomAcao()
    setMostrarModalNovaComanda(false)
    setNumeroNovaComanda('')
    setComandaSelecionada(nova)
    try {
      await refreshComandas()
    } catch {
      // Mantém abertura da comanda mesmo se o refresh falhar.
    }
  }

  function abrirModalNovaComanda() {
    setNumeroNovaComanda('')
    setMostrarModalNovaComanda(true)
  }

  function fecharModalNovaComanda() {
    setMostrarModalNovaComanda(false)
    setNumeroNovaComanda('')
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

  async function handleExcluirComandasAbertas() {
    if (!isAdmin) return

    const confirmou = window.confirm('Excluir TODAS as comandas abertas agora?')
    if (!confirmou) return
    const confirmouNovamente = window.confirm('Confirma esta exclusão? Esta ação não pode ser desfeita.')
    if (!confirmouNovamente) return

    try {
      const result = await excluirComandasAbertas(usuario?.id)
      if (result?.sucesso) {
        playSomAcao()
        setComandaSelecionada(null)
        await refreshComandas()
        toast.show(`Comandas abertas removidas: ${Number(result.removidas || 0)}`)
      } else {
        playSomErro()
        toast.show('Não foi possível excluir as comandas abertas', 'error')
      }
    } catch (error) {
      playSomErro()
      toast.show(error?.message || 'Erro ao excluir comandas abertas', 'error')
    }
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

        <input
          type="search"
          placeholder="Buscar comanda..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full px-4 py-4 rounded-xl border-2 border-amber-200 text-lg focus:border-amber-500 outline-none"
        />

        <button
          type="button"
          onClick={abrirModalNovaComanda}
          className={`w-full rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 transition-colors touch-manipulation shadow-lg ${
            isMobile
              ? 'py-6 text-2xl min-h-[72px]'
              : 'px-6 py-4 text-lg min-h-[56px]'
          }`}
        >
          + Nova Comanda
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={handleExcluirComandasAbertas}
            className={`w-full rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors touch-manipulation shadow-lg ${
              isMobile
                ? 'py-5 text-xl min-h-[64px]'
                : 'px-6 py-3 text-base min-h-[48px]'
            }`}
          >
            Excluir comandas abertas (admin)
          </button>
        )}
      </div>

      {comandasFiltradas.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-xl border-2 border-dashed border-amber-200">
          <p className="text-stone-500 text-lg mb-4">
            {busca.trim() ? 'Nenhuma comanda encontrada.' : 'Nenhuma comanda aberta.'}
          </p>
          {!busca.trim() && (
            <button
              type="button"
              onClick={abrirModalNovaComanda}
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

      {mostrarModalNovaComanda && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white border-2 border-amber-200 p-6 shadow-xl">
            <h3 className="text-xl font-bold text-amber-900 mb-4">Nova comanda</h3>
            <label className="block text-sm font-medium text-amber-900 mb-2">
              Número da comanda
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoFocus
              value={numeroNovaComanda}
              onChange={(e) => setNumeroNovaComanda(e.target.value.replace(/\D/g, ''))}
              placeholder="Somente números"
              className="w-full px-4 py-3 rounded-lg border-2 border-amber-200 focus:border-amber-500 outline-none"
            />
            <p className="text-xs text-stone-500 mt-2">Aceita apenas números.</p>
            <div className="mt-5 flex gap-2 justify-end">
              <button
                type="button"
                onClick={fecharModalNovaComanda}
                className="px-4 py-2 rounded-lg bg-stone-200 text-stone-700 font-semibold hover:bg-stone-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleCriarNovaComanda}
                disabled={!numeroNovaComanda.trim()}
                className="px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-50"
              >
                Criar
              </button>
            </div>
          </div>
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
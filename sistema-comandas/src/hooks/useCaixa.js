import { useState, useEffect, useCallback, useMemo } from 'react'
import { getComandasPainelCaixa } from '../services/storage'
import { listarSangrias, getTotalSangrias, registrarSangria } from '../services/sangriaService'
import {
  getTotaisHoje,
  getCaixaAtual,
  abrirCaixa,
  fecharCaixa,
  limparDadosCaixa,
  getRelatoriosCaixa,
} from '../services/caixaService'
import { subscribePdvStorageUpdate } from '../utils/pdvEvents'
import { createRefreshRunner } from '../utils/refreshQueue'

function mesclarComandasPainelCaixa(payload) {
  const abertas = payload?.abertas || []
  const aguardando = payload?.aguardando || []
  const porId = new Map()
  for (const comanda of [...aguardando, ...abertas]) {
    if (comanda?.id) porId.set(comanda.id, comanda)
  }
  return Array.from(porId.values())
}

export function useCaixa() {
  const [vendas, setVendas] = useState([])
  const [sangrias, setSangrias] = useState([])
  const [comandasPendentes, setComandasPendentes] = useState([])
  const [caixaAberto, setCaixaAberto] = useState(false)
  const [caixaAtual, setCaixaAtual] = useState({ aberto: false, valorInicial: 0, aberturaEm: null })
  const [totalSangrias, setTotalSangrias] = useState(0)
  const [totais, setTotais] = useState({
    totalDinheiro: 0,
    totalCartao: 0,
    totalPix: 0,
    totalHoje: 0,
  })

  const load = useCallback(async () => {
    const [painelComandas, totaisHoje, caixa] = await Promise.all([
      getComandasPainelCaixa(),
      getTotaisHoje(),
      getCaixaAtual(),
    ])
    setVendas(totaisHoje?.vendasHoje || [])
    setComandasPendentes(mesclarComandasPainelCaixa(painelComandas))
    setCaixaAberto(caixa?.aberto === true)
    setTotais(totaisHoje)
    setCaixaAtual(caixa)

    if (caixa?.caixaId) {
      const [rows, total] = await Promise.all([
        listarSangrias(caixa.caixaId),
        getTotalSangrias(caixa.caixaId),
      ])
      setSangrias(rows)
      setTotalSangrias(total)
    } else {
      setSangrias([])
      setTotalSangrias(0)
    }
  }, [])

  const refresh = useMemo(() => createRefreshRunner(load), [load])

  useEffect(() => {
    refresh().catch(() => {
      setVendas([])
      setSangrias([])
      setComandasPendentes([])
      setCaixaAberto(false)
      setTotalSangrias(0)
      setTotais({ totalDinheiro: 0, totalCartao: 0, totalPix: 0, totalHoje: 0 })
      setCaixaAtual({ aberto: false, valorInicial: 0, aberturaEm: null })
    })
  }, [refresh])

  useEffect(() => subscribePdvStorageUpdate(refresh), [refresh])

  useEffect(() => {
    const intervaloMs = 45000
    let intervalId = null

    function iniciarPolling() {
      if (intervalId != null) return
      intervalId = window.setInterval(() => {
        if (document.visibilityState === 'visible') {
          refresh().catch(() => {})
        }
      }, intervaloMs)
    }

    function pararPolling() {
      if (intervalId != null) {
        window.clearInterval(intervalId)
        intervalId = null
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh().catch(() => {})
        iniciarPolling()
      } else {
        pararPolling()
      }
    }

    if (document.visibilityState === 'visible') {
      iniciarPolling()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      pararPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refresh])

  const patchComandaPendente = useCallback((comandaAtualizada) => {
    if (!comandaAtualizada?.id) return
    setComandasPendentes((prev) => {
      const idx = prev.findIndex((c) => String(c.id) === String(comandaAtualizada.id))
      if (idx < 0) return [...prev, comandaAtualizada]
      const next = [...prev]
      next[idx] = comandaAtualizada
      return next
    })
  }, [])

  const removeComandaPendente = useCallback((comandaId) => {
    if (!comandaId) return
    setComandasPendentes((prev) => prev.filter((c) => String(c.id) !== String(comandaId)))
  }, [])

  return [
    vendas,
    refresh,
    {
      sangrias,
      totalSangrias,
      comandasPendentes,
      caixaAberto,
      caixaAtual,
      totais,
      abrirCaixa,
      fecharCaixa,
      registrarSangria,
      limparDadosCaixa,
      getRelatoriosCaixa,
      patchComandaPendente,
      removeComandaPendente,
    },
  ]
}

import { useState, useEffect, useCallback } from 'react'
import { getComandasAguardandoPagamento } from '../services/storage'
import { listarSangrias, getTotalSangrias, registrarSangria } from '../services/sangriaService'
import {
  isCaixaAberto,
  getTotaisHoje,
  getCaixaAtual,
  abrirCaixa,
  fecharCaixa,
  limparDadosCaixa,
  getRelatoriosCaixa,
} from '../services/caixaService'

function useRefreshOnStorageUpdate(refresh) {
  useEffect(() => {
    const handler = () => refresh()
    window.addEventListener('pdv:storage-update', handler)
    return () => window.removeEventListener('pdv:storage-update', handler)
  }, [refresh])
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

  const refresh = useCallback(async () => {
    const [pendentes, aberto, totaisHoje, caixa] = await Promise.all([
      getComandasAguardandoPagamento(),
      isCaixaAberto(),
      getTotaisHoje(),
      getCaixaAtual(),
    ])
    setVendas(totaisHoje?.vendasHoje || [])
    setComandasPendentes(pendentes)
    setCaixaAberto(aberto)
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

  useRefreshOnStorageUpdate(refresh)

  useEffect(() => {
    const intervaloMs = 2000
    const intervalId = window.setInterval(() => {
      refresh().catch(() => {})
    }, intervaloMs)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh().catch(() => {})
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refresh])

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
    },
  ]
}

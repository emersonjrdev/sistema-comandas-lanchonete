import { useState, useEffect, useCallback } from 'react'
import { getCaixaHistorico, getComandasAguardandoPagamento } from '../services/storage'
import {
  isCaixaAberto,
  getTotaisHoje,
  getCaixaAtual,
  abrirCaixa,
  fecharCaixa,
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
  const [comandasPendentes, setComandasPendentes] = useState([])
  const [caixaAberto, setCaixaAberto] = useState(false)
  const [caixaAtual, setCaixaAtual] = useState({ aberto: false, valorInicial: 0, aberturaEm: null })
  const [totais, setTotais] = useState({
    totalDinheiro: 0,
    totalCartao: 0,
    totalPix: 0,
    totalHoje: 0,
  })

  const refresh = useCallback(async () => {
    const [historico, pendentes, aberto, totaisHoje, caixa] = await Promise.all([
      getCaixaHistorico(),
      getComandasAguardandoPagamento(),
      isCaixaAberto(),
      getTotaisHoje(),
      getCaixaAtual(),
    ])
    setVendas(historico)
    setComandasPendentes(pendentes)
    setCaixaAberto(aberto)
    setTotais(totaisHoje)
    setCaixaAtual(caixa)
  }, [])

  useEffect(() => {
    refresh().catch(() => {
      setVendas([])
      setComandasPendentes([])
      setCaixaAberto(false)
      setTotais({ totalDinheiro: 0, totalCartao: 0, totalPix: 0, totalHoje: 0 })
      setCaixaAtual({ aberto: false, valorInicial: 0, aberturaEm: null })
    })
  }, [refresh])

  useRefreshOnStorageUpdate(refresh)

  return [
    vendas,
    refresh,
    {
      comandasPendentes,
      caixaAberto,
      caixaAtual,
      totais,
      abrirCaixa,
      fecharCaixa,
      getRelatoriosCaixa,
    },
  ]
}

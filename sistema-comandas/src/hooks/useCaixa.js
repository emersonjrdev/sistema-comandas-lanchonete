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
  const [caixaAberto, setCaixaAberto] = useState(true)
  const [totais, setTotais] = useState({
    totalDinheiro: 0,
    totalCartao: 0,
    totalPix: 0,
    totalHoje: 0,
  })

  const refresh = useCallback(() => {
    setVendas(getCaixaHistorico())
    setComandasPendentes(getComandasAguardandoPagamento())
    setCaixaAberto(isCaixaAberto())
    setTotais(getTotaisHoje())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useRefreshOnStorageUpdate(refresh)

  return [
    vendas,
    refresh,
    {
      comandasPendentes,
      caixaAberto,
      totais,
      abrirCaixa,
      fecharCaixa,
      getCaixaAtual,
      getRelatoriosCaixa,
    },
  ]
}

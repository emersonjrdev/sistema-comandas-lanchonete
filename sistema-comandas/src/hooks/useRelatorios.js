import { useState, useEffect, useCallback } from 'react'
import { getRelatoriosCaixa, getTotaisHoje } from '../services/caixaService'
import { sessaoFinanceiroValida } from '../services/financeiroAccess'

function useRefreshOnStorageUpdate(refresh) {
  useEffect(() => {
    const handler = () => refresh()
    window.addEventListener('pdv:storage-update', handler)
    return () => window.removeEventListener('pdv:storage-update', handler)
  }, [refresh])
}

export function useRelatorios({ habilitado = false } = {}) {
  const [relatorios, setRelatorios] = useState([])
  const [totaisHoje, setTotaisHoje] = useState({
    totalDinheiro: 0,
    totalCartao: 0,
    totalPix: 0,
  })

  const refresh = useCallback(async () => {
    if (!sessaoFinanceiroValida()) {
      setRelatorios([])
      setTotaisHoje({ totalDinheiro: 0, totalCartao: 0, totalPix: 0 })
      return
    }
    const [relatoriosData, totais] = await Promise.all([
      getRelatoriosCaixa(),
      getTotaisHoje(),
    ])
    setRelatorios(relatoriosData)
    setTotaisHoje(totais)
  }, [])

  useEffect(() => {
    if (!habilitado || !sessaoFinanceiroValida()) {
      setRelatorios([])
      setTotaisHoje({ totalDinheiro: 0, totalCartao: 0, totalPix: 0 })
      return undefined
    }
    refresh().catch(() => {
      setRelatorios([])
      setTotaisHoje({ totalDinheiro: 0, totalCartao: 0, totalPix: 0 })
    })
    return undefined
  }, [habilitado, refresh])

  useRefreshOnStorageUpdate(refresh)

  return [relatorios, totaisHoje, refresh]
}

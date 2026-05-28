import { useState, useEffect, useCallback, useMemo } from 'react'
import { getRelatoriosCaixa, getTotaisHoje } from '../services/caixaService'
import { sessaoFinanceiroValida } from '../services/financeiroAccess'
import { subscribePdvStorageUpdate } from '../utils/pdvEvents'
import { createRefreshRunner } from '../utils/refreshQueue'

export function useRelatorios({ habilitado = false } = {}) {
  const [relatorios, setRelatorios] = useState([])
  const [totaisHoje, setTotaisHoje] = useState({
    totalDinheiro: 0,
    totalCartao: 0,
    totalPix: 0,
  })

  const load = useCallback(async () => {
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

  const refresh = useMemo(() => createRefreshRunner(load), [load])

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

  useEffect(() => subscribePdvStorageUpdate(refresh), [refresh])

  return [relatorios, totaisHoje, refresh]
}

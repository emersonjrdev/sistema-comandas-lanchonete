import { useState, useEffect, useCallback } from 'react'
import { getProdutos, getComandas, getResumoDashboard } from '../services/storage'

function useRefreshOnStorageUpdate(refresh) {
  useEffect(() => {
    const handler = () => refresh()
    window.addEventListener('pdv:storage-update', handler)
    return () => window.removeEventListener('pdv:storage-update', handler)
  }, [refresh])
}

export { useCaixa } from './useCaixa'

export function useProdutos() {
  const [produtos, setProdutos] = useState([])

  const refresh = useCallback(async () => {
    const data = await getProdutos()
    setProdutos(data)
  }, [])

  useEffect(() => {
    refresh().catch(() => setProdutos([]))
  }, [refresh])

  useRefreshOnStorageUpdate(refresh)
  return [produtos, refresh]
}

export function useComandas() {
  const [comandas, setComandas] = useState([])

  const refresh = useCallback(async () => {
    const data = await getComandas()
    setComandas(data)
  }, [])

  useEffect(() => {
    refresh().catch(() => setComandas([]))
  }, [refresh])

  useRefreshOnStorageUpdate(refresh)
  return [comandas, refresh]
}

export function useDashboard() {
  const [resumo, setResumo] = useState({
    totalHoje: 0,
    comandasAbertas: 0,
    vendasFinalizadasHoje: 0,
    totalHistorico: 0,
    totalVendas: 0,
  })

  const refresh = useCallback(async () => {
    const data = await getResumoDashboard()
    setResumo(data)
  }, [])

  useEffect(() => {
    refresh().catch(() => {
      setResumo({
        totalHoje: 0,
        comandasAbertas: 0,
        vendasFinalizadasHoje: 0,
        totalHistorico: 0,
        totalVendas: 0,
      })
    })
  }, [refresh])

  useRefreshOnStorageUpdate(refresh)
  return [resumo, refresh]
}

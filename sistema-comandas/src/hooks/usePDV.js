import { useState, useEffect, useCallback, useRef } from 'react'
import { getProdutos, getComandas, getResumoDashboard } from '../services/storage'
import { useToast } from '../contexts/ToastContext'

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
  const { show: toastShow } = useToast()
  const toastRef = useRef(toastShow)
  toastRef.current = toastShow

  const refresh = useCallback(async () => {
    try {
      const data = await getProdutos()
      setProdutos(data)
    } catch (err) {
      setProdutos([])
      toastRef.current(err?.message || 'Não foi possível carregar produtos. Verifique a conexão.', 'error')
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useRefreshOnStorageUpdate(refresh)
  return [produtos, refresh]
}

export function useComandas() {
  const [comandas, setComandas] = useState([])
  const { show: toastShow } = useToast()
  const toastRef = useRef(toastShow)
  toastRef.current = toastShow

  const refresh = useCallback(async () => {
    try {
      const data = await getComandas()
      setComandas(data)
    } catch (err) {
      setComandas([])
      toastRef.current(err?.message || 'Não foi possível carregar comandas. Verifique a conexão.', 'error')
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useRefreshOnStorageUpdate(refresh)
  return [comandas, refresh]
}

export function useDashboard() {
  const [resumo, setResumo] = useState({
    totalHoje: 0,
    totalDinheiro: 0,
    totalCartao: 0,
    totalPix: 0,
    totalSangrias: 0,
    dinheiroLiquido: 0,
    comandasAbertas: 0,
    vendasFinalizadasHoje: 0,
    totalHistorico: 0,
    totalVendas: 0,
    produtosEstoqueBaixo: [],
  })

  const refresh = useCallback(async () => {
    const data = await getResumoDashboard()
    setResumo(data)
  }, [])

  useEffect(() => {
    refresh().catch(() => {
      setResumo({
        totalHoje: 0,
        totalDinheiro: 0,
        totalCartao: 0,
        totalPix: 0,
        totalSangrias: 0,
        dinheiroLiquido: 0,
        comandasAbertas: 0,
        vendasFinalizadasHoje: 0,
        totalHistorico: 0,
        totalVendas: 0,
        produtosEstoqueBaixo: [],
      })
    })
  }, [refresh])

  useRefreshOnStorageUpdate(refresh)
  return [resumo, refresh]
}

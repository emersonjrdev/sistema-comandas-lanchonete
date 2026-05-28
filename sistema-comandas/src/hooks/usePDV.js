import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { getProdutos, getComandas, getResumoDashboard } from '../services/storage'
import { useToast } from '../contexts/ToastContext'
import { subscribePdvStorageUpdate } from '../utils/pdvEvents'
import { createRefreshRunner } from '../utils/refreshQueue'

function useRefreshOnStorageUpdate(refresh) {
  useEffect(() => subscribePdvStorageUpdate(refresh), [refresh])
}

export { useCaixa } from './useCaixa'

export function useProdutos() {
  const [produtos, setProdutos] = useState([])
  const { show: toastShow } = useToast()
  const toastRef = useRef(toastShow)
  useEffect(() => {
    toastRef.current = toastShow
  }, [toastShow])

  const load = useCallback(async () => {
    try {
      const data = await getProdutos()
      setProdutos(data)
    } catch (err) {
      setProdutos([])
      toastRef.current(err?.message || 'Não foi possível carregar produtos. Verifique a conexão.', 'error')
    }
  }, [])

  const refresh = useMemo(() => createRefreshRunner(load), [load])

  useEffect(() => {
    refresh()
  }, [refresh])

  useRefreshOnStorageUpdate(refresh)

  const patchProduto = useCallback((produtoAtualizado) => {
    if (!produtoAtualizado?.id) return
    setProdutos((prev) =>
      prev.map((p) => (String(p.id) === String(produtoAtualizado.id) ? produtoAtualizado : p))
    )
  }, [])

  return [produtos, refresh, { patchProduto }]
}

export function useComandas() {
  const [comandas, setComandas] = useState([])
  const { show: toastShow } = useToast()
  const toastRef = useRef(toastShow)
  useEffect(() => {
    toastRef.current = toastShow
  }, [toastShow])

  const load = useCallback(async () => {
    try {
      const data = await getComandas()
      setComandas(data)
    } catch (err) {
      setComandas([])
      toastRef.current(err?.message || 'Não foi possível carregar comandas. Verifique a conexão.', 'error')
    }
  }, [])

  const refresh = useMemo(() => createRefreshRunner(load), [load])

  useEffect(() => {
    refresh()
  }, [refresh])

  useRefreshOnStorageUpdate(refresh)

  const patchComanda = useCallback((comandaAtualizada) => {
    if (!comandaAtualizada?.id) return
    setComandas((prev) => {
      const idx = prev.findIndex((c) => String(c.id) === String(comandaAtualizada.id))
      if (idx < 0) return [...prev, comandaAtualizada]
      const next = [...prev]
      next[idx] = comandaAtualizada
      return next
    })
  }, [])

  const removeComanda = useCallback((comandaId) => {
    if (!comandaId) return
    setComandas((prev) => prev.filter((c) => String(c.id) !== String(comandaId)))
  }, [])

  return [comandas, refresh, { patchComanda, removeComanda }]
}

export function useDashboard() {
  const [resumo, setResumo] = useState({
    comandasAbertas: 0,
    comandasAguardandoPagamento: 0,
    vendasFinalizadasHoje: 0,
    caixaAberto: false,
    estoqueBaixo: 0,
    produtosEstoqueBaixo: [],
    vendasAmostra: [],
  })

  const load = useCallback(async () => {
    const data = await getResumoDashboard()
    setResumo(data)
  }, [])

  const refresh = useMemo(() => createRefreshRunner(load), [load])

  useEffect(() => {
    refresh().catch(() => {
      setResumo({
        comandasAbertas: 0,
        comandasAguardandoPagamento: 0,
        vendasFinalizadasHoje: 0,
        caixaAberto: false,
        estoqueBaixo: 0,
        produtosEstoqueBaixo: [],
        vendasAmostra: [],
      })
    })
  }, [refresh])

  useRefreshOnStorageUpdate(refresh)
  return [resumo, refresh]
}

import { useState, useEffect, useCallback } from 'react'
import {
  getProdutosComEstoque,
  getProdutosEstoqueBaixo,
  setEstoque,
  incrementarEstoque,
} from '../services/estoqueService'

function useRefreshOnStorageUpdate(refresh) {
  useEffect(() => {
    const handler = () => refresh()
    window.addEventListener('pdv:storage-update', handler)
    return () => window.removeEventListener('pdv:storage-update', handler)
  }, [refresh])
}

export function useEstoque() {
  const [produtos, setProdutos] = useState([])
  const [estoqueBaixo, setEstoqueBaixo] = useState([])

  const refresh = useCallback(async () => {
    const [produtosData, baixo] = await Promise.all([
      getProdutosComEstoque(),
      getProdutosEstoqueBaixo(5),
    ])
    setProdutos(produtosData)
    setEstoqueBaixo(baixo)
  }, [])

  useEffect(() => {
    refresh().catch(() => {
      setProdutos([])
      setEstoqueBaixo([])
    })
  }, [refresh])

  useRefreshOnStorageUpdate(refresh)

  return [produtos, estoqueBaixo, refresh, { setEstoque, incrementarEstoque }]
}

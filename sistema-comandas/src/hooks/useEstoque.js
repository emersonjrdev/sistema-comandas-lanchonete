import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  getProdutosComEstoque,
  getProdutosEstoqueBaixo,
  setEstoque,
  incrementarEstoque,
  limparEstoqueNaoFixos,
} from '../services/estoqueService'
import { subscribePdvStorageUpdate } from '../utils/pdvEvents'
import { createRefreshRunner } from '../utils/refreshQueue'

export function useEstoque() {
  const [produtos, setProdutos] = useState([])
  const [estoqueBaixo, setEstoqueBaixo] = useState([])

  const load = useCallback(async () => {
    const [produtosData, baixo] = await Promise.all([
      getProdutosComEstoque(),
      getProdutosEstoqueBaixo(5),
    ])
    setProdutos(produtosData)
    setEstoqueBaixo(baixo)
  }, [])

  const refresh = useMemo(() => createRefreshRunner(load), [load])

  useEffect(() => {
    refresh().catch(() => {
      setProdutos([])
      setEstoqueBaixo([])
    })
  }, [refresh])

  useEffect(() => subscribePdvStorageUpdate(refresh), [refresh])

  return [produtos, estoqueBaixo, refresh, { setEstoque, incrementarEstoque, limparEstoqueNaoFixos }]
}

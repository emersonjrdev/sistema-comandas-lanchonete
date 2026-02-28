import { useState, useEffect, useCallback } from 'react'
import { getRelatoriosCaixa, getTotaisHoje } from '../services/caixaService'

function useRefreshOnStorageUpdate(refresh) {
  useEffect(() => {
    const handler = () => refresh()
    window.addEventListener('pdv:storage-update', handler)
    return () => window.removeEventListener('pdv:storage-update', handler)
  }, [refresh])
}

export function useRelatorios() {
  const [relatorios, setRelatorios] = useState([])
  const [totaisHoje, setTotaisHoje] = useState({
    totalDinheiro: 0,
    totalCartao: 0,
    totalPix: 0,
  })

  const refresh = useCallback(async () => {
    const [relatoriosData, totais] = await Promise.all([
      getRelatoriosCaixa(),
      getTotaisHoje(),
    ])
    setRelatorios(relatoriosData)
    setTotaisHoje(totais)
  }, [])

  useEffect(() => {
    refresh().catch(() => {
      setRelatorios([])
      setTotaisHoje({ totalDinheiro: 0, totalCartao: 0, totalPix: 0 })
    })
  }, [refresh])

  useRefreshOnStorageUpdate(refresh)

  return [relatorios, totaisHoje, refresh]
}

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

  const refresh = useCallback(() => {
    setRelatorios(getRelatoriosCaixa())
    const t = getTotaisHoje()
    setTotaisHoje(t)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useRefreshOnStorageUpdate(refresh)

  return [relatorios, totaisHoje, refresh]
}

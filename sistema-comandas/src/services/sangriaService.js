import { apiRequest } from './api'

function emitUpdate() {
  window.dispatchEvent(new CustomEvent('pdv:storage-update'))
}

export async function registrarSangria(caixaId, valor, motivo, operadorId) {
  try {
    const result = await apiRequest('/caixa/sangrias', {
      method: 'POST',
      body: {
        caixaId,
        valor,
        motivo,
        operadorId,
      },
    })
    emitUpdate()
    return result
  } catch (error) {
    return { sucesso: false, erro: error.message }
  }
}

export async function listarSangrias(caixaId) {
  if (!caixaId) return []
  return apiRequest(`/caixa/sangrias?caixaId=${encodeURIComponent(caixaId)}`)
}

export async function getTotalSangrias(caixaId) {
  if (!caixaId) return 0
  const payload = await apiRequest(`/caixa/sangrias/total?caixaId=${encodeURIComponent(caixaId)}`)
  return Number(payload?.totalSangrias || 0)
}

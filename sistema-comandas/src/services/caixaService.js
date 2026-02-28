import { apiRequest } from './api'

function emitUpdate() {
  window.dispatchEvent(new CustomEvent('pdv:storage-update'))
}

export async function isCaixaAberto() {
  const status = await apiRequest('/caixa/status')
  return status.aberto === true
}

export async function getCaixaAtual() {
  return apiRequest('/caixa/status')
}

export async function abrirCaixa(valorInicial) {
  try {
    const result = await apiRequest('/caixa/abrir', {
      method: 'POST',
      body: { valorInicial },
    })
    emitUpdate()
    return result
  } catch (error) {
    return { sucesso: false, erro: error.message }
  }
}

export async function fecharCaixa(valorContado) {
  try {
    const result = await apiRequest('/caixa/fechar', {
      method: 'POST',
      body: { valorContado },
    })
    emitUpdate()
    return result
  } catch (error) {
    return { sucesso: false, erro: error.message }
  }
}

export async function getTotaisHoje() {
  return apiRequest('/caixa/totais-hoje')
}

export async function getRelatoriosCaixa() {
  return apiRequest('/caixa/relatorios')
}

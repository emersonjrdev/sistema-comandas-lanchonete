import { apiRequest } from './api'
import { obterCabecalhoFinanceiroOuNull } from './financeiroAccess'
import { emitPdvStorageUpdate } from '../utils/pdvEvents'

function cabecalhoFinanceiroObrigatorio() {
  const headers = obterCabecalhoFinanceiroOuNull()
  if (!headers) throw new Error('Relatório de caixa não desbloqueado neste dispositivo.')
  return headers
}

function emitUpdate() {
  emitPdvStorageUpdate()
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
  return apiRequest('/caixa/relatorios', { headers: cabecalhoFinanceiroObrigatorio() })
}

export async function limparDadosCaixa() {
  try {
    const result = await apiRequest('/caixa/dados', {
      method: 'DELETE',
      headers: cabecalhoFinanceiroObrigatorio(),
    })
    emitUpdate()
    return result
  } catch (error) {
    return { sucesso: false, erro: error.message }
  }
}

import { apiRequest } from './api'

const TOKEN_KEY = 'sistema-comandas:financeiro-token'
const EXP_KEY = 'sistema-comandas:financeiro-exp-ms'

export function limparSessaoFinanceiro() {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(EXP_KEY)
  } catch {
    // noop
  }
}

export function armazenarSessaoFinanceiro(token, expiresAtMs) {
  sessionStorage.setItem(TOKEN_KEY, String(token || ''))
  sessionStorage.setItem(EXP_KEY, String(Number(expiresAtMs)))
}

/** Cabeçalho para chamadas ao histórico financeiro ou null se expirado/sem sessão */
export function obterCabecalhoFinanceiroOuNull() {
  const token = sessionStorage.getItem(TOKEN_KEY)
  const expMs = Number(sessionStorage.getItem(EXP_KEY))
  if (!token || !Number.isFinite(expMs) || Date.now() >= expMs) {
    limparSessaoFinanceiro()
    return null
  }
  return { 'X-Sessao-Financeiro': token }
}

export function sessaoFinanceiroValida() {
  return obterCabecalhoFinanceiroOuNull() !== null
}

/** Abre sessão usando a senha da Maria no servidor */
export async function solicitarSessaoFinanceiro(senha) {
  const data = await apiRequest('/financeiro/sessao', {
    method: 'POST',
    body: { senha: String(senha ?? '') },
  })
  if (!data?.token || !Number.isFinite(Number(data?.expiresAt))) {
    throw new Error('Resposta inválida do servidor.')
  }
  armazenarSessaoFinanceiro(data.token, Number(data.expiresAt))
}

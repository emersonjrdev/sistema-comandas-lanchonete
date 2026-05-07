export function formatarCentavosInput(valor) {
  const digitos = String(valor || '').replace(/\D/g, '')
  if (!digitos) return ''
  const numero = Number(digitos) / 100
  return numero.toFixed(2).replace('.', ',')
}

export function moedaInputParaNumero(valor) {
  const digitos = String(valor || '').replace(/\D/g, '')
  if (digitos) return Number(digitos) / 100
  return Number.parseFloat(String(valor || '').replace(',', '.')) || 0
}

export function numeroParaMoedaInput(valor) {
  const numero = Number(valor || 0)
  if (!Number.isFinite(numero)) return ''
  return numero.toFixed(2).replace('.', ',')
}

function parseNumeroFinanceiroParaExibir(valor) {
  if (valor == null || valor === '') return Number.NaN
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : Number.NaN
  const s = String(valor)
    .trim()
    .replace(/^\s*R\$\s*/i, '')
    .replace(/\s/g, '')
  if (!s) return Number.NaN
  if (/\d,\d/.test(s) && /\./.test(s)) return Number(s.replace(/\./g, '').replace(',', '.'))
  if (/\d,\d*$/.test(s) && !/\./.test(s)) return Number(s.replace(',', '.'))
  return Number(s)
}

/**
 * Valor monetário apenas em pt-BR (milhar com ponto, decimais com vírgula).
 * Implementação manual: não depende de Intl (alguns ambientes ignoram locale).
 */
export function formatarMoedaBRL(valor) {
  const numero = parseNumeroFinanceiroParaExibir(valor ?? 0)
  if (!Number.isFinite(numero)) return 'R$ 0,00'

  const negativo = numero < 0
  const abs = Math.abs(numero)
  const [parteInteira, frac] = abs.toFixed(2).split('.')
  const comMilhar = parteInteira.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const corpo = `${comMilhar},${frac}`
  return negativo ? `R$ -${corpo}` : `R$ ${corpo}`
}

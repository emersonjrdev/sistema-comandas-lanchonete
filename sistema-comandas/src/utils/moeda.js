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

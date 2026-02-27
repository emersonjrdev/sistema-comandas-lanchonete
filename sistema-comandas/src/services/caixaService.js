import { getDB, saveDB } from './storage'

function gerarId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function isHoje(dataStr) {
  if (!dataStr) return false
  const data = new Date(dataStr)
  const hoje = new Date()
  return (
    data.getDate() === hoje.getDate() &&
    data.getMonth() === hoje.getMonth() &&
    data.getFullYear() === hoje.getFullYear()
  )
}

export function isCaixaAberto() {
  const db = getDB()
  return db.caixa?.aberto === true
}

export function getCaixaAtual() {
  const db = getDB()
  return db.caixa || { aberto: false, historico: [], fechamentos: [] }
}

export function abrirCaixa(valorInicial) {
  const db = getDB()
  db.caixa = db.caixa || { historico: [], fechamentos: [] }
  if (db.caixa.aberto) return { sucesso: false, erro: 'Caixa já está aberto' }

  db.caixa.aberto = true
  db.caixa.valorInicial = Number(valorInicial) || 0
  db.caixa.aberturaEm = new Date().toISOString()
  saveDB(db)
  return { sucesso: true }
}

export function fecharCaixa(valorContado) {
  const db = getDB()
  if (!db.caixa?.aberto) return { sucesso: false, erro: 'Caixa já está fechado' }

  const historico = db.caixa.historico || []
  const vendasHoje = historico.filter((v) => isHoje(v.data))

  const totalDinheiro = vendasHoje
    .filter((v) => (v.metodoPagamento || '').toLowerCase().includes('dinheiro'))
    .reduce((acc, v) => acc + (v.total || 0), 0)

  const totalCartao = vendasHoje
    .filter((v) => (v.metodoPagamento || '').toLowerCase().includes('cartão'))
    .reduce((acc, v) => acc + (v.total || 0), 0)

  const totalPix = vendasHoje
    .filter((v) => (v.metodoPagamento || '').toLowerCase().includes('pix'))
    .reduce((acc, v) => acc + (v.total || 0), 0)

  const valorInicial = db.caixa.valorInicial || 0
  const totalEsperado = valorInicial + totalDinheiro
  const contado = Number(valorContado) || 0
  const diferenca = contado - totalEsperado

  const fechamento = {
    id: gerarId(),
    data: new Date().toISOString(),
    valorInicial,
    totalDinheiro,
    totalCartao,
    totalPix,
    valorContado: contado,
    diferenca,
  }

  db.caixa.fechamentos = db.caixa.fechamentos || []
  db.caixa.fechamentos.push(fechamento)
  db.caixa.aberto = false
  db.caixa.valorInicial = undefined
  db.caixa.aberturaEm = undefined
  saveDB(db)

  return { sucesso: true, fechamento }
}

export function getTotaisHoje() {
  const db = getDB()
  const historico = db.caixa?.historico || db.vendas || []
  const vendasHoje = historico.filter((v) => isHoje(v.data))

  const totalDinheiro = vendasHoje
    .filter((v) => (v.metodoPagamento || '').toLowerCase().includes('dinheiro'))
    .reduce((acc, v) => acc + (v.total || 0), 0)

  const totalCartao = vendasHoje
    .filter((v) => (v.metodoPagamento || '').toLowerCase().includes('cartão'))
    .reduce((acc, v) => acc + (v.total || 0), 0)

  const totalPix = vendasHoje
    .filter((v) => (v.metodoPagamento || '').toLowerCase().includes('pix'))
    .reduce((acc, v) => acc + (v.total || 0), 0)

  return {
    totalDinheiro,
    totalCartao,
    totalPix,
    totalHoje: totalDinheiro + totalCartao + totalPix,
    vendasHoje,
  }
}

export function getRelatoriosCaixa() {
  const db = getDB()
  return db.caixa?.fechamentos || []
}

const DB_KEY = 'sistema-comandas:db'

const DB_INICIAL = {
  produtos: [],
  comandas: [],
  vendas: [],
  caixa: {
    aberto: false,
    historico: [],
    fechamentos: [],
  },
}

export function getDB() {
  try {
    const data = localStorage.getItem(DB_KEY)
    return data ? JSON.parse(data) : JSON.parse(JSON.stringify(DB_INICIAL))
  } catch {
    return JSON.parse(JSON.stringify(DB_INICIAL))
  }
}

export function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db))
  window.dispatchEvent(new CustomEvent('pdv:storage-update'))
}

function gerarId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// --- Produtos ---

export function getProdutos() {
  return getDB().produtos || []
}

export function addProduto(produto) {
  const db = getDB()
  const novo = {
    id: gerarId(),
    nome: produto.nome || 'Produto',
    preco: Number(produto.preco) || 0,
    estoque: Number(produto.estoque ?? 0) || 0,
  }
  db.produtos.push(novo)
  saveDB(db)
  return novo
}

export function editarProduto(id, nome, preco, estoque) {
  const db = getDB()
  const idx = db.produtos.findIndex((p) => String(p.id) === String(id))
  if (idx === -1) return null
  const p = db.produtos[idx]
  db.produtos[idx] = {
    ...p,
    nome: nome ?? p.nome,
    preco: Number(preco ?? p.preco),
    estoque: estoque !== undefined ? Math.max(0, Number(estoque) || 0) : (p.estoque ?? 0),
  }
  saveDB(db)
  return db.produtos[idx]
}

export function excluirProduto(id) {
  const db = getDB()
  db.produtos = db.produtos.filter((p) => String(p.id) !== String(id))
  saveDB(db)
}

// --- Comandas ---

export function getComandas() {
  const db = getDB()
  return (db.comandas || []).filter((c) => c.status === 'aberta')
}

export function criarComanda(numeroComanda, cliente) {
  const db = getDB()
  const partes = []
  if (numeroComanda) partes.push(`Comanda ${numeroComanda}`)
  partes.push(cliente || 'Balcão')
  const identificacao = partes.join(' - ')

  const nova = {
    id: gerarId(),
    numeroComanda: numeroComanda || null,
    cliente: cliente || 'Balcão',
    identificacao,
    status: 'aberta',
    itens: [],
    total: 0,
    criadaEm: new Date().toISOString(),
  }

  db.comandas = db.comandas || []
  db.comandas.push(nova)
  saveDB(db)
  return nova
}

function calcularTotal(itens) {
  return itens.reduce(
    (acc, item) => acc + (item.subtotal ?? item.preco * item.quantidade),
    0
  )
}

function migrarProdutosEstoque(db) {
  const produtos = db.produtos || []
  let alterou = false
  produtos.forEach((p) => {
    if (p.estoque === undefined) {
      p.estoque = 0
      alterou = true
    }
  })
  return alterou
}

export function adicionarItem(comandaId, produtoId, quantidade) {
  const db = getDB()
  migrarProdutosEstoque(db)

  const produto = (db.produtos || []).find((p) => String(p.id) === String(produtoId))
  if (!produto) return null

  const estoqueAtual = produto.estoque ?? 0
  if (estoqueAtual < quantidade) return null

  const comanda = (db.comandas || []).find((c) => String(c.id) === String(comandaId))
  if (!comanda || comanda.status !== 'aberta') return null

  const subtotal = produto.preco * quantidade
  const novoItem = {
    id: gerarId(),
    produtoId: produto.id,
    nome: produto.nome,
    preco: produto.preco,
    quantidade,
    subtotal,
  }

  comanda.itens = comanda.itens || []
  comanda.itens.push(novoItem)
  comanda.total = calcularTotal(comanda.itens)

  saveDB(db)
  return comanda
}

export function removerItem(comandaId, itemId) {
  const db = getDB()
  const comanda = (db.comandas || []).find((c) => String(c.id) === String(comandaId))
  if (!comanda) return null

  comanda.itens = (comanda.itens || []).filter((item) => String(item.id) !== String(itemId))
  comanda.total = calcularTotal(comanda.itens)
  saveDB(db)
  return comanda
}

export function alterarQtd(comandaId, itemId, quantidade) {
  if (quantidade < 1) return removerItem(comandaId, itemId)

  const db = getDB()
  const comanda = (db.comandas || []).find((c) => String(c.id) === String(comandaId))
  if (!comanda) return null

  const item = (comanda.itens || []).find((i) => String(i.id) === String(itemId))
  if (!item) return null

  item.quantidade = quantidade
  item.subtotal = item.preco * quantidade
  comanda.total = calcularTotal(comanda.itens)
  saveDB(db)
  return comanda
}

export function enviarParaCaixa(comandaId) {
  const db = getDB()
  const comanda = (db.comandas || []).find((c) => String(c.id) === String(comandaId))
  if (!comanda || comanda.status !== 'aberta') return null

  comanda.status = 'aguardando_pagamento'
  comanda.enviadaEm = new Date().toISOString()
  saveDB(db)
  return comanda
}

export function getComandasAguardandoPagamento() {
  const db = getDB()
  return (db.comandas || []).filter((c) => c.status === 'aguardando_pagamento')
}

export function confirmarPagamento(comandaId, metodoPagamento, valorRecebido, troco) {
  const db = getDB()
  migrarProdutosEstoque(db)

  const comanda = (db.comandas || []).find((c) => String(c.id) === String(comandaId))
  if (!comanda || comanda.status !== 'aguardando_pagamento') return null

  for (const item of comanda.itens || []) {
    const prod = (db.produtos || []).find((p) => String(p.id) === String(item.produtoId))
    if (prod && (prod.estoque ?? 0) < item.quantidade) return null
  }

  for (const item of comanda.itens || []) {
    const prod = (db.produtos || []).find((p) => String(p.id) === String(item.produtoId))
    if (prod) {
      const est = prod.estoque ?? 0
      prod.estoque = Math.max(0, est - item.quantidade)
    }
  }

  const venda = {
    id: gerarId(),
    comandaId: comanda.id,
    identificacao: comanda.identificacao,
    itens: [...(comanda.itens || [])],
    total: comanda.total || 0,
    metodoPagamento: metodoPagamento || 'Dinheiro',
    valorRecebido: metodoPagamento?.toLowerCase().includes('dinheiro') ? Number(valorRecebido) || 0 : 0,
    troco: metodoPagamento?.toLowerCase().includes('dinheiro') ? Number(troco) || 0 : 0,
    data: new Date().toISOString(),
  }

  db.caixa = db.caixa || { aberto: true, historico: [], fechamentos: [] }
  db.caixa.historico = db.caixa.historico || []
  db.caixa.historico.push(venda)

  db.vendas = db.vendas || []
  db.vendas.push(venda)

  db.comandas = (db.comandas || []).filter((c) => String(c.id) !== String(comandaId))
  saveDB(db)
  return venda
}

// --- Vendas e Dashboard ---

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

export function getVendasHoje() {
  const db = getDB()
  const historico = db.caixa?.historico || db.vendas || []
  return historico.filter((v) => isHoje(v.data))
}

export function getResumoDashboard() {
  const db = getDB()
  const comandasAbertas = (db.comandas || []).filter((c) => c.status === 'aberta')
  const comandasAguardando = (db.comandas || []).filter((c) => c.status === 'aguardando_pagamento')
  const historico = db.caixa?.historico || db.vendas || []
  const vendasHoje = historico.filter((v) => isHoje(v.data))
  const totalHoje = vendasHoje.reduce((acc, v) => acc + (v.total || 0), 0)
  const totalHistorico = historico.reduce((acc, v) => acc + (v.total || 0), 0)

  const totalDinheiro = vendasHoje
    .filter((v) => (v.metodoPagamento || '').toLowerCase().includes('dinheiro'))
    .reduce((acc, v) => acc + (v.total || 0), 0)
  const totalCartao = vendasHoje
    .filter((v) => (v.metodoPagamento || '').toLowerCase().includes('cartão'))
    .reduce((acc, v) => acc + (v.total || 0), 0)
  const totalPix = vendasHoje
    .filter((v) => (v.metodoPagamento || '').toLowerCase().includes('pix'))
    .reduce((acc, v) => acc + (v.total || 0), 0)

  const caixaAberto = db.caixa?.aberto === true

  const produtos = db.produtos || []
  const estoqueBaixo = produtos.filter((p) => (p.estoque ?? 0) < 5).length

  return {
    totalHoje,
    comandasAbertas: comandasAbertas.length,
    comandasAguardandoPagamento: comandasAguardando.length,
    vendasFinalizadasHoje: vendasHoje.length,
    totalHistorico,
    totalVendas: historico.length,
    totalDinheiro,
    totalCartao,
    totalPix,
    caixaAberto,
    estoqueBaixo,
  }
}

export function getCaixaHistorico() {
  const db = getDB()
  return db.caixa?.historico || db.vendas || []
}

// --- Adicionar item em venda já fechada (no Caixa) ---

export function adicionarItemAVenda(vendaId, produtoId, quantidade) {
  const db = getDB()
  migrarProdutosEstoque(db)

  const produto = (db.produtos || []).find((p) => String(p.id) === String(produtoId))
  if (!produto) return null

  const estoqueAtual = produto.estoque ?? 0
  if (estoqueAtual < quantidade) return null

  const historico = db.caixa?.historico || []
  const venda = historico.find((v) => String(v.id) === String(vendaId))
  if (!venda) return null

  const subtotal = produto.preco * quantidade
  const novoItem = {
    id: gerarId(),
    produtoId: produto.id,
    nome: produto.nome,
    preco: produto.preco,
    quantidade,
    subtotal,
  }

  venda.itens = venda.itens || []
  venda.itens.push(novoItem)
  venda.total = calcularTotal(venda.itens)

  if (venda.metodoPagamento?.toLowerCase().includes('dinheiro') && venda.valorRecebido != null) {
    venda.troco = (venda.valorRecebido || 0) - venda.total
  }

  const vendasIdx = db.vendas?.findIndex((v) => String(v.id) === String(vendaId))
  if (vendasIdx !== undefined && vendasIdx >= 0) {
    db.vendas[vendasIdx] = { ...venda }
  }

  produto.estoque = estoqueAtual - quantidade
  saveDB(db)
  return venda
}

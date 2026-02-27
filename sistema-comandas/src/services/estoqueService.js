import { getDB, saveDB } from './storage'

export function getProdutosComEstoque() {
  const db = getDB()
  return (db.produtos || []).map((p) => ({
    ...p,
    estoque: p.estoque ?? 0,
  }))
}

export function getProdutosEstoqueBaixo(limite = 5) {
  return getProdutosComEstoque().filter((p) => (p.estoque ?? 0) < limite)
}

export function decrementarEstoque(produtoId, quantidade) {
  const db = getDB()
  const idx = (db.produtos || []).findIndex((p) => String(p.id) === String(produtoId))
  if (idx === -1) return { sucesso: false, erro: 'Produto não encontrado' }

  const p = db.produtos[idx]
  const estoqueAtual = p.estoque ?? 0
  if (estoqueAtual < quantidade) {
    return { sucesso: false, erro: `Estoque insuficiente. Disponível: ${estoqueAtual}` }
  }

  db.produtos[idx] = { ...p, estoque: estoqueAtual - quantidade }
  saveDB(db)
  return { sucesso: true }
}

export function incrementarEstoque(produtoId, quantidade) {
  const db = getDB()
  const idx = (db.produtos || []).findIndex((p) => String(p.id) === String(produtoId))
  if (idx === -1) return { sucesso: false, erro: 'Produto não encontrado' }

  const p = db.produtos[idx]
  const estoqueAtual = p.estoque ?? 0
  db.produtos[idx] = { ...p, estoque: estoqueAtual + quantidade }
  saveDB(db)
  return { sucesso: true }
}

export function setEstoque(produtoId, quantidade) {
  const db = getDB()
  const idx = (db.produtos || []).findIndex((p) => String(p.id) === String(produtoId))
  if (idx === -1) return { sucesso: false, erro: 'Produto não encontrado' }

  const valor = Math.max(0, parseInt(quantidade, 10) || 0)
  db.produtos[idx] = { ...db.produtos[idx], estoque: valor }
  saveDB(db)
  return { sucesso: true }
}

export function temEstoque(produtoId, quantidade = 1) {
  const produtos = getProdutosComEstoque()
  const p = produtos.find((x) => String(x.id) === String(produtoId))
  return (p?.estoque ?? 0) >= quantidade
}

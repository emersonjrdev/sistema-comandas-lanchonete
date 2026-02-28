import { apiRequest } from './api'
import { getProdutos } from './storage'

export async function getProdutosComEstoque() {
  const produtos = await getProdutos()
  return (produtos || []).map((p) => ({
    ...p,
    estoque: p.estoque ?? 0,
  }))
}

export async function getProdutosEstoqueBaixo(limite = 5) {
  const produtos = await getProdutosComEstoque()
  return produtos.filter((p) => (p.estoque ?? 0) < limite)
}

export async function decrementarEstoque(produtoId, quantidade) {
  try {
    await apiRequest(`/produtos/${produtoId}/estoque`, {
      method: 'PATCH',
      body: { operacao: 'decrementar', quantidade },
    })
    window.dispatchEvent(new CustomEvent('pdv:storage-update'))
    return { sucesso: true }
  } catch (error) {
    return { sucesso: false, erro: error.message }
  }
}

export async function incrementarEstoque(produtoId, quantidade) {
  try {
    await apiRequest(`/produtos/${produtoId}/estoque`, {
      method: 'PATCH',
      body: { operacao: 'incrementar', quantidade },
    })
    window.dispatchEvent(new CustomEvent('pdv:storage-update'))
    return { sucesso: true }
  } catch (error) {
    return { sucesso: false, erro: error.message }
  }
}

export async function setEstoque(produtoId, quantidade) {
  try {
    await apiRequest(`/produtos/${produtoId}/estoque`, {
      method: 'PATCH',
      body: { operacao: 'set', quantidade },
    })
    window.dispatchEvent(new CustomEvent('pdv:storage-update'))
    return { sucesso: true }
  } catch (error) {
    return { sucesso: false, erro: error.message }
  }
}

export async function temEstoque(produtoId, quantidade = 1) {
  const produtos = await getProdutosComEstoque()
  const p = produtos.find((x) => String(x.id) === String(produtoId))
  return (p?.estoque ?? 0) >= quantidade
}

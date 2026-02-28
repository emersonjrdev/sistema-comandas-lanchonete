import { apiRequest } from './api'

function emitUpdate() {
  window.dispatchEvent(new CustomEvent('pdv:storage-update'))
}

// --- Produtos ---

export async function getProdutos() {
  return apiRequest('/produtos')
}

export async function addProduto(produto) {
  const result = await apiRequest('/produtos', {
    method: 'POST',
    body: produto,
  })
  emitUpdate()
  return result
}

export async function editarProduto(id, nome, preco, estoque) {
  const result = await apiRequest(`/produtos/${id}`, {
    method: 'PUT',
    body: { nome, preco, estoque },
  })
  emitUpdate()
  return result
}

export async function excluirProduto(id) {
  await apiRequest(`/produtos/${id}`, { method: 'DELETE' })
  emitUpdate()
}

// --- Comandas ---

export async function getComandas() {
  return apiRequest('/comandas')
}

export async function criarComanda(numeroComanda, cliente) {
  const result = await apiRequest('/comandas', {
    method: 'POST',
    body: { numeroComanda, cliente },
  })
  emitUpdate()
  return result
}

export async function adicionarItem(comandaId, produtoId, quantidade) {
  const result = await apiRequest(`/comandas/${comandaId}/itens`, {
    method: 'POST',
    body: { produtoId, quantidade },
  })
  emitUpdate()
  return result
}

export async function removerItem(comandaId, itemId) {
  const result = await apiRequest(`/comandas/${comandaId}/itens/${itemId}`, {
    method: 'DELETE',
  })
  emitUpdate()
  return result
}

export async function alterarQtd(comandaId, itemId, quantidade) {
  const result = await apiRequest(`/comandas/${comandaId}/itens/${itemId}`, {
    method: 'PATCH',
    body: { quantidade },
  })
  emitUpdate()
  return result
}

export async function enviarParaCaixa(comandaId) {
  const result = await apiRequest(`/comandas/${comandaId}/enviar-caixa`, {
    method: 'POST',
  })
  emitUpdate()
  return result
}

export async function getComandasAguardandoPagamento() {
  return apiRequest('/comandas/aguardando-pagamento')
}

export async function confirmarPagamento(comandaId, metodoPagamento, valorRecebido, troco) {
  const result = await apiRequest(`/comandas/${comandaId}/confirmar-pagamento`, {
    method: 'POST',
    body: { metodoPagamento, valorRecebido, troco },
  })
  emitUpdate()
  return result
}

// --- Vendas, caixa e dashboard ---

export async function getVendasHoje() {
  const payload = await apiRequest('/caixa/totais-hoje')
  return payload.vendasHoje || []
}

export async function getResumoDashboard() {
  return apiRequest('/dashboard/resumo')
}

export async function getCaixaHistorico() {
  return apiRequest('/caixa/historico')
}

export async function adicionarItemAVenda(vendaId, produtoId, quantidade) {
  const result = await apiRequest(`/vendas/${vendaId}/itens`, {
    method: 'POST',
    body: { produtoId, quantidade },
  })
  emitUpdate()
  return result
}

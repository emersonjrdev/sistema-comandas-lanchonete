import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

function normalizarPrivateKey(rawKey) {
  if (!rawKey) return ''
  let key = String(rawKey).trim()

  // Suporta valor salvo com aspas externas no painel de env.
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1)
  }

  // Suporta chave em linha única com \n escapado.
  return key.replace(/\\n/g, '\n')
}

function getFirebaseApp() {
  if (getApps().length > 0) return getApps()[0]

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = normalizarPrivateKey(process.env.FIREBASE_PRIVATE_KEY)

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Config Firebase ausente. Defina FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY.'
    )
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  })
}

const firebaseApp = getFirebaseApp()
const db = getFirestore(firebaseApp)
const usuariosCol = db.collection('usuarios')
const produtosCol = db.collection('produtos')
const comandasCol = db.collection('comandas')
const vendasCol = db.collection('vendas')
const fechamentosCol = db.collection('caixa_fechamentos')
const caixaConfigRef = db.collection('config').doc('caixa')

function gerarId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function docToEntity(doc) {
  return { id: doc.id, ...doc.data() }
}

function calcularTotal(itens = []) {
  return (itens || []).reduce(
    (acc, item) => acc + Number(item.subtotal ?? Number(item.preco || 0) * Number(item.quantidade || 0)),
    0
  )
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

function somarTotais(vendas = []) {
  const totalDinheiro = vendas
    .filter((v) => String(v.metodoPagamento || '').toLowerCase().includes('dinheiro'))
    .reduce((acc, v) => acc + Number(v.total || 0), 0)

  const totalCartao = vendas
    .filter((v) => String(v.metodoPagamento || '').toLowerCase().includes('cart'))
    .reduce((acc, v) => acc + Number(v.total || 0), 0)

  const totalPix = vendas
    .filter((v) => String(v.metodoPagamento || '').toLowerCase().includes('pix'))
    .reduce((acc, v) => acc + Number(v.total || 0), 0)

  return {
    totalDinheiro,
    totalCartao,
    totalPix,
    totalHoje: totalDinheiro + totalCartao + totalPix,
  }
}

async function apagarColecao(colRef) {
  const tamanhoLote = 400

  while (true) {
    const snap = await colRef.limit(tamanhoLote).get()
    if (snap.empty) break

    const lote = db.batch()
    for (const doc of snap.docs) {
      lote.delete(doc.ref)
    }
    await lote.commit()
  }
}

async function getCaixaStatus() {
  const snap = await caixaConfigRef.get()
  if (!snap.exists) {
    return { aberto: false, valorInicial: 0, aberturaEm: null }
  }
  const data = snap.data() || {}
  return {
    aberto: data.aberto === true,
    valorInicial: Number(data.valorInicial || 0),
    aberturaEm: data.aberturaEm || null,
  }
}

async function listarVendasHistorico() {
  const snap = await vendasCol.orderBy('data', 'desc').get()
  return snap.docs.map((doc) => docToEntity(doc))
}

async function seedUsuarios() {
  const snap = await usuariosCol.limit(1).get()
  if (!snap.empty) return

  const now = new Date().toISOString()
  await usuariosCol.add({
    nome: 'admin',
    senha: 'admin123',
    perfil: 'admin',
    created_at: now,
  })
  await usuariosCol.add({
    nome: 'funcionario',
    senha: 'func123',
    perfil: 'funcionario',
    created_at: now,
  })
}

await seedUsuarios()

const app = express()
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || '*' }))
app.use(express.json())

app.get('/health', async (_, res) => {
  try {
    await db.collection('healthcheck').limit(1).get()
    res.json({ status: 'ok', database: 'firestore' })
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'firestore', error: error.message })
  }
})

app.post('/auth/login', async (req, res) => {
  const { nome, senha } = req.body || {}
  if (!nome || !senha) return res.status(400).json({ error: 'nome e senha são obrigatórios' })

  const nomeNormalizado = String(nome).trim().toLowerCase()
  const senhaInformada = String(senha)
  const snap = await usuariosCol.get()
  const userDoc = snap.docs.find((doc) => {
    const data = doc.data()
    return String(data.nome || '').toLowerCase() === nomeNormalizado && String(data.senha) === senhaInformada
  })

  if (!userDoc) return res.status(401).json({ error: 'Usuário ou senha inválidos' })
  const user = docToEntity(userDoc)
  return res.json({ id: user.id, nome: user.nome, perfil: user.perfil })
})

app.get('/usuarios', async (_, res) => {
  const snap = await usuariosCol.orderBy('created_at', 'desc').get()
  const rows = snap.docs.map((doc) => {
    const u = docToEntity(doc)
    return {
      id: u.id,
      nome: u.nome,
      perfil: u.perfil,
      created_at: u.created_at || null,
    }
  })
  res.json(rows)
})

app.post('/usuarios', async (req, res) => {
  const { nome, senha, perfil } = req.body || {}
  if (!nome || !senha) return res.status(400).json({ error: 'nome e senha são obrigatórios' })

  const nomeNormalizado = String(nome).trim()
  const perfilNormalizado = perfil === 'admin' ? 'admin' : 'funcionario'
  const existente = await usuariosCol.where('nome', '==', nomeNormalizado).limit(1).get()
  if (!existente.empty) return res.status(409).json({ error: 'Usuário já existe' })

  const created_at = new Date().toISOString()
  const ref = await usuariosCol.add({
    nome: nomeNormalizado,
    senha: String(senha),
    perfil: perfilNormalizado,
    created_at,
  })
  return res.status(201).json({ id: ref.id, nome: nomeNormalizado, perfil: perfilNormalizado })
})

app.get('/produtos', async (_, res) => {
  const snap = await produtosCol.orderBy('created_at', 'desc').get()
  const rows = snap.docs.map((doc) => docToEntity(doc))
  res.json(rows)
})

app.post('/produtos', async (req, res) => {
  const { nome, preco = 0, estoque = 0 } = req.body || {}
  if (!nome) return res.status(400).json({ error: 'nome é obrigatório' })

  const novo = {
    nome: String(nome).trim(),
    preco: Number(preco) || 0,
    estoque: Math.max(0, Number(estoque) || 0),
    created_at: new Date().toISOString(),
  }
  const ref = await produtosCol.add(novo)
  const novoDoc = await ref.get()
  res.status(201).json(docToEntity(novoDoc))
})

app.put('/produtos/:id', async (req, res) => {
  const { id } = req.params
  const { nome, preco, estoque } = req.body || {}

  const ref = produtosCol.doc(String(id))
  const snap = await ref.get()
  if (!snap.exists) return res.status(404).json({ error: 'Produto não encontrado' })
  const atual = snap.data() || {}

  await ref.update({
    nome: nome !== undefined ? String(nome).trim() : atual.nome,
    preco: preco !== undefined ? Number(preco) || 0 : Number(atual.preco || 0),
    estoque:
      estoque !== undefined
        ? Math.max(0, Number(estoque) || 0)
        : Math.max(0, Number(atual.estoque || 0)),
    updated_at: new Date().toISOString(),
  })

  const atualizado = await ref.get()
  res.json(docToEntity(atualizado))
})

app.patch('/produtos/:id/estoque', async (req, res) => {
  const { id } = req.params
  const { operacao = 'set', quantidade = 0 } = req.body || {}

  const ref = produtosCol.doc(String(id))
  const snap = await ref.get()
  if (!snap.exists) return res.status(404).json({ error: 'Produto não encontrado' })
  const atual = snap.data() || {}
  const estoqueAtual = Number(atual.estoque || 0)
  const qtd = Number(quantidade) || 0
  let novoEstoque = estoqueAtual

  if (operacao === 'incrementar') {
    novoEstoque = estoqueAtual + Math.max(0, qtd)
  } else if (operacao === 'decrementar') {
    novoEstoque = estoqueAtual - Math.max(0, qtd)
  } else {
    novoEstoque = Math.max(0, qtd)
  }

  if (novoEstoque < 0) {
    return res.status(400).json({ error: 'Estoque insuficiente' })
  }

  await ref.update({
    estoque: novoEstoque,
    updated_at: new Date().toISOString(),
  })

  const atualizado = await ref.get()
  res.json(docToEntity(atualizado))
})

app.delete('/produtos/:id', async (req, res) => {
  const { id } = req.params
  const ref = produtosCol.doc(String(id))
  const snap = await ref.get()
  if (!snap.exists) return res.status(404).json({ error: 'Produto não encontrado' })
  await ref.delete()
  res.status(204).send()
})

app.get('/comandas', async (_, res) => {
  const snap = await comandasCol.where('status', '==', 'aberta').get()
  const payload = snap.docs.map((doc) => {
    const comanda = docToEntity(doc)
    return { ...comanda, itens: comanda.itens || [], total: Number(comanda.total || 0) }
  }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  res.json(payload)
})

app.get('/comandas/aguardando-pagamento', async (_, res) => {
  const snap = await comandasCol
    .where('status', '==', 'aguardando_pagamento')
    .get()
  const payload = snap.docs.map((doc) => {
    const comanda = docToEntity(doc)
    return { ...comanda, itens: comanda.itens || [], total: Number(comanda.total || 0) }
  }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  res.json(payload)
})

app.post('/comandas', async (req, res) => {
  const { numeroComanda = null, cliente = 'Balcão' } = req.body || {}
  const clienteNome = String(cliente)
  const identificacao = numeroComanda ? `Comanda ${numeroComanda} - ${clienteNome}` : clienteNome

  const nova = {
    numero_comanda: numeroComanda ? String(numeroComanda) : null,
    cliente: clienteNome,
    identificacao,
    status: 'aberta',
    total: 0,
    itens: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  const ref = await comandasCol.add(nova)
  res.status(201).json({ id: ref.id, ...nova })
})

app.post('/comandas/:id/itens', async (req, res) => {
  const comandaId = String(req.params.id)
  const { produtoId, quantidade = 1 } = req.body || {}

  const comandaRef = comandasCol.doc(comandaId)
  const comandaDoc = await comandaRef.get()
  if (!comandaDoc.exists) return res.status(404).json({ error: 'Comanda não encontrada ou fechada' })
  const comanda = docToEntity(comandaDoc)
  if (!['aberta', 'aguardando_pagamento'].includes(comanda.status)) {
    return res.status(404).json({ error: 'Comanda não encontrada ou fechada' })
  }

  const produtoDoc = await produtosCol.doc(String(produtoId)).get()
  if (!produtoDoc.exists) return res.status(404).json({ error: 'Produto não encontrado' })
  const produto = docToEntity(produtoDoc)

  const qtd = Math.max(1, Number(quantidade) || 1)
  if ((produto.estoque ?? 0) < qtd) return res.status(400).json({ error: 'Estoque insuficiente' })

  const subtotal = Number(produto.preco) * qtd
  const item = {
    id: gerarId(),
    produto_id: produto.id,
    produtoId: produto.id,
    nome: produto.nome,
    preco: Number(produto.preco),
    quantidade: qtd,
    subtotal,
    created_at: new Date().toISOString(),
  }

  const itens = [...(comanda.itens || []), item]
  const total = calcularTotal(itens)
  await comandaRef.update({
    itens,
    total,
    updated_at: new Date().toISOString(),
  })

  const atualizadaDoc = await comandaRef.get()
  return res.json(docToEntity(atualizadaDoc))
})

app.patch('/comandas/:id/itens/:itemId', async (req, res) => {
  const { id, itemId } = req.params
  const { quantidade } = req.body || {}
  const qtd = Math.max(0, Number(quantidade) || 0)

  const comandaRef = comandasCol.doc(String(id))
  const comandaDoc = await comandaRef.get()
  if (!comandaDoc.exists) return res.status(404).json({ error: 'Comanda não encontrada' })
  const comanda = docToEntity(comandaDoc)
  const itens = [...(comanda.itens || [])]
  const idx = itens.findIndex((i) => String(i.id) === String(itemId))
  if (idx < 0) return res.status(404).json({ error: 'Item não encontrado' })

  if (qtd < 1) {
    itens.splice(idx, 1)
  } else {
    const item = itens[idx]
    itens[idx] = {
      ...item,
      quantidade: qtd,
      subtotal: Number(item.preco || 0) * qtd,
    }
  }

  await comandaRef.update({
    itens,
    total: calcularTotal(itens),
    updated_at: new Date().toISOString(),
  })

  const atualizado = await comandaRef.get()
  res.json(docToEntity(atualizado))
})

app.delete('/comandas/:id/itens/:itemId', async (req, res) => {
  const { id, itemId } = req.params
  const comandaRef = comandasCol.doc(String(id))
  const comandaDoc = await comandaRef.get()
  if (!comandaDoc.exists) return res.status(404).json({ error: 'Comanda não encontrada' })
  const comanda = docToEntity(comandaDoc)
  const itens = (comanda.itens || []).filter((i) => String(i.id) !== String(itemId))

  await comandaRef.update({
    itens,
    total: calcularTotal(itens),
    updated_at: new Date().toISOString(),
  })

  const atualizado = await comandaRef.get()
  res.json(docToEntity(atualizado))
})

app.post('/comandas/:id/enviar-caixa', async (req, res) => {
  const { id } = req.params
  const comandaRef = comandasCol.doc(String(id))
  const comandaDoc = await comandaRef.get()
  if (!comandaDoc.exists) return res.status(404).json({ error: 'Comanda não encontrada' })
  const comanda = docToEntity(comandaDoc)
  if (comanda.status !== 'aberta') return res.status(400).json({ error: 'Comanda não está aberta' })

  await comandaRef.update({
    status: 'aguardando_pagamento',
    enviadaEm: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  const atualizada = await comandaRef.get()
  res.json(docToEntity(atualizada))
})

app.post('/comandas/:id/confirmar-pagamento', async (req, res) => {
  const { id } = req.params
  const { metodoPagamento, valorRecebido, troco } = req.body || {}
  const comandaRef = comandasCol.doc(String(id))
  const comandaDoc = await comandaRef.get()
  if (!comandaDoc.exists) return res.status(404).json({ error: 'Comanda não encontrada' })
  const comanda = docToEntity(comandaDoc)
  if (comanda.status !== 'aguardando_pagamento') {
    return res.status(400).json({ error: 'Comanda não está aguardando pagamento' })
  }

  // Valida estoque antes de confirmar.
  for (const item of comanda.itens || []) {
    const produtoId = item.produtoId || item.produto_id
    const produtoDoc = await produtosCol.doc(String(produtoId)).get()
    if (!produtoDoc.exists) return res.status(404).json({ error: `Produto ${produtoId} não encontrado` })
    const produto = docToEntity(produtoDoc)
    if (Number(produto.estoque || 0) < Number(item.quantidade || 0)) {
      return res.status(400).json({ error: 'Estoque insuficiente para confirmar pagamento' })
    }
  }

  // Debita estoque.
  for (const item of comanda.itens || []) {
    const produtoId = item.produtoId || item.produto_id
    const produtoRef = produtosCol.doc(String(produtoId))
    const produtoDoc = await produtoRef.get()
    const produto = docToEntity(produtoDoc)
    const novoEstoque = Number(produto.estoque || 0) - Number(item.quantidade || 0)
    await produtoRef.update({
      estoque: Math.max(0, novoEstoque),
      updated_at: new Date().toISOString(),
    })
  }

  const venda = {
    comandaId: comanda.id,
    identificacao: comanda.identificacao,
    itens: [...(comanda.itens || [])],
    total: Number(comanda.total || 0),
    metodoPagamento: metodoPagamento || 'Dinheiro',
    valorRecebido: Number(valorRecebido) || 0,
    troco: Number(troco) || 0,
    data: new Date().toISOString(),
  }

  const vendaRef = await vendasCol.add(venda)
  await comandaRef.update({
    status: 'aberta',
    itens: [],
    total: 0,
    enviadaEm: null,
    updated_at: new Date().toISOString(),
  })

  const vendaDoc = await vendaRef.get()
  res.json(docToEntity(vendaDoc))
})

app.get('/caixa/historico', async (_, res) => {
  const vendas = await listarVendasHistorico()
  res.json(vendas)
})

app.get('/caixa/status', async (_, res) => {
  const status = await getCaixaStatus()
  res.json(status)
})

app.get('/caixa/totais-hoje', async (_, res) => {
  const vendas = await listarVendasHistorico()
  const vendasHoje = vendas.filter((v) => isHoje(v.data))
  const totais = somarTotais(vendasHoje)
  res.json({ ...totais, vendasHoje })
})

app.post('/caixa/abrir', async (req, res) => {
  const { valorInicial } = req.body || {}
  const caixaAtual = await getCaixaStatus()
  if (caixaAtual.aberto) return res.status(400).json({ error: 'Caixa já está aberto' })

  await caixaConfigRef.set({
    aberto: true,
    valorInicial: Number(valorInicial) || 0,
    aberturaEm: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  res.json({ sucesso: true })
})

app.post('/caixa/fechar', async (req, res) => {
  const { valorContado } = req.body || {}
  const caixaAtual = await getCaixaStatus()
  if (!caixaAtual.aberto) return res.status(400).json({ error: 'Caixa já está fechado' })

  const vendas = await listarVendasHistorico()
  const vendasHoje = vendas.filter((v) => isHoje(v.data))
  const totais = somarTotais(vendasHoje)
  const totalEsperado = Number(caixaAtual.valorInicial || 0) + Number(totais.totalDinheiro || 0)
  const valorContadoNum = Number(valorContado) || 0
  const diferenca = valorContadoNum - totalEsperado

  const fechamento = {
    data: new Date().toISOString(),
    valorInicial: Number(caixaAtual.valorInicial || 0),
    totalDinheiro: totais.totalDinheiro,
    totalCartao: totais.totalCartao,
    totalPix: totais.totalPix,
    valorContado: valorContadoNum,
    diferenca,
  }

  const fechamentoRef = await fechamentosCol.add(fechamento)

  await caixaConfigRef.set(
    {
      aberto: false,
      valorInicial: 0,
      aberturaEm: null,
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  )

  const fechamentoDoc = await fechamentoRef.get()
  res.json({ sucesso: true, fechamento: docToEntity(fechamentoDoc) })
})

app.get('/caixa/relatorios', async (_, res) => {
  const snap = await fechamentosCol.orderBy('data', 'desc').get()
  res.json(snap.docs.map((doc) => docToEntity(doc)))
})

app.delete('/caixa/dados', async (_, res) => {
  try {
    await apagarColecao(vendasCol)
    await apagarColecao(fechamentosCol)
    await caixaConfigRef.set(
      {
        aberto: false,
        valorInicial: 0,
        aberturaEm: null,
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    )

    res.json({ sucesso: true })
  } catch (error) {
    res.status(500).json({ sucesso: false, error: error.message || 'Falha ao limpar caixa' })
  }
})

app.post('/vendas/:id/itens', async (req, res) => {
  const { id } = req.params
  const { produtoId, quantidade = 1 } = req.body || {}

  const vendaRef = vendasCol.doc(String(id))
  const vendaDoc = await vendaRef.get()
  if (!vendaDoc.exists) return res.status(404).json({ error: 'Venda não encontrada' })
  const venda = docToEntity(vendaDoc)

  const produtoRef = produtosCol.doc(String(produtoId))
  const produtoDoc = await produtoRef.get()
  if (!produtoDoc.exists) return res.status(404).json({ error: 'Produto não encontrado' })
  const produto = docToEntity(produtoDoc)

  const qtd = Math.max(1, Number(quantidade) || 1)
  if (Number(produto.estoque || 0) < qtd) {
    return res.status(400).json({ error: 'Estoque insuficiente' })
  }

  const item = {
    id: gerarId(),
    produto_id: produto.id,
    produtoId: produto.id,
    nome: produto.nome,
    preco: Number(produto.preco || 0),
    quantidade: qtd,
    subtotal: Number(produto.preco || 0) * qtd,
    created_at: new Date().toISOString(),
  }

  const itens = [...(venda.itens || []), item]
  const total = calcularTotal(itens)
  const novoTroco =
    String(venda.metodoPagamento || '').toLowerCase().includes('dinheiro') &&
    venda.valorRecebido != null
      ? Number(venda.valorRecebido || 0) - total
      : Number(venda.troco || 0)

  await vendaRef.update({
    itens,
    total,
    troco: novoTroco,
    updated_at: new Date().toISOString(),
  })

  await produtoRef.update({
    estoque: Math.max(0, Number(produto.estoque || 0) - qtd),
    updated_at: new Date().toISOString(),
  })

  const atualizada = await vendaRef.get()
  res.json(docToEntity(atualizada))
})

app.get('/dashboard/resumo', async (_, res) => {
  const produtosSnap = await produtosCol.get()
  const comandasAbertasSnap = await comandasCol.where('status', '==', 'aberta').get()
  const comandasAguardandoSnap = await comandasCol.where('status', '==', 'aguardando_pagamento').get()
  const vendas = await listarVendasHistorico()
  const vendasHoje = vendas.filter((v) => isHoje(v.data))
  const totaisHoje = somarTotais(vendasHoje)
  const totalHistorico = vendas.reduce((acc, v) => acc + Number(v.total || 0), 0)
  const caixaAtual = await getCaixaStatus()

  const estoqueBaixo = produtosSnap.docs
    .map((doc) => docToEntity(doc))
    .filter((p) => Number(p.estoque || 0) < 5).length

  res.json({
    totalHoje: totaisHoje.totalHoje,
    totalDinheiro: totaisHoje.totalDinheiro,
    totalCartao: totaisHoje.totalCartao,
    totalPix: totaisHoje.totalPix,
    comandasAbertas: comandasAbertasSnap.size,
    comandasAguardandoPagamento: comandasAguardandoSnap.size,
    vendasFinalizadasHoje: vendasHoje.length,
    totalHistorico,
    totalVendas: vendas.length,
    caixaAberto: caixaAtual.aberto,
    estoqueBaixo,
  })
})

const port = Number(process.env.PORT || 3001)
app.listen(port, () => {
  console.log(`API rodando na porta ${port}`)
  console.log('Banco: Firestore')
})

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

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
const caixasCol = db.collection('caixas')
const PRODUTOS_FIXOS = ['Pão Francês', 'Frios', 'Bolos']

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

function toIsoString(value) {
  if (!value) return null
  if (typeof value === 'string') return value
  if (typeof value.toDate === 'function') return value.toDate().toISOString()
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function normalizarNomeProduto(valor) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function produtoEhFrios(produto) {
  return normalizarNomeProduto(produto?.nome) === normalizarNomeProduto('Frios')
}

function produtoEhFixo(produto) {
  return produto?.fixo === true
}

function estoqueDisponivelParaVenda(produto) {
  if (produtoEhFixo(produto)) return Number.MAX_SAFE_INTEGER
  return Number(produto?.estoque ?? 0)
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

async function listarVendasDoCaixa(caixaId) {
  if (!caixaId) return []
  const snap = await vendasCol.where('caixaId', '==', String(caixaId)).get()
  return snap.docs
    .map((doc) => docToEntity(doc))
    .sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0))
}

async function listarSangriasDoCaixa(caixaId) {
  if (!caixaId) return []
  const snap = await caixasCol.doc(String(caixaId)).collection('sangrias').get()
  return snap.docs
    .map((doc) => {
      const data = docToEntity(doc)
      const createdAt = toIsoString(data.createdAt) || data.createdAtIso || null
      return {
        ...data,
        createdAt,
      }
    })
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
}

async function getTotalSangriasDoCaixa(caixaId) {
  const rows = await listarSangriasDoCaixa(caixaId)
  return rows.reduce((acc, item) => acc + Number(item.valor || 0), 0)
}

async function reabrirComandasAguardandoPagamento() {
  const tamanhoLote = 400
  let totalAtualizadas = 0

  while (true) {
    const snap = await comandasCol
      .where('status', '==', 'aguardando_pagamento')
      .limit(tamanhoLote)
      .get()

    if (snap.empty) break

    const lote = db.batch()
    for (const doc of snap.docs) {
      lote.update(doc.ref, {
        status: 'aberta',
        enviadaEm: null,
        updated_at: new Date().toISOString(),
      })
    }
    await lote.commit()
    totalAtualizadas += snap.size
  }

  return totalAtualizadas
}

async function apagarCaixasComSangrias() {
  const snap = await caixasCol.get()
  for (const caixaDoc of snap.docs) {
    await apagarColecao(caixaDoc.ref.collection('sangrias'))
    await caixaDoc.ref.delete()
  }
}

async function resetarComandasParaNovoDia() {
  const tamanhoLote = 400
  let totalResetadas = 0

  while (true) {
    const snap = await comandasCol.limit(tamanhoLote).get()
    if (snap.empty) break

    const lote = db.batch()
    for (const doc of snap.docs) {
      lote.set(
        doc.ref,
        {
          status: 'aberta',
          itens: [],
          total: 0,
          enviadaEm: null,
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      )
    }
    await lote.commit()
    totalResetadas += snap.size
  }

  return totalResetadas
}

async function getCaixaStatus() {
  const snap = await caixaConfigRef.get()
  if (!snap.exists) {
    return { aberto: false, valorInicial: 0, aberturaEm: null, caixaId: null }
  }
  const data = snap.data() || {}
  return {
    aberto: data.aberto === true,
    valorInicial: Number(data.valorInicial || 0),
    aberturaEm: data.aberturaEm || null,
    caixaId: data.caixaId || null,
  }
}

async function listarVendasHistorico() {
  const snap = await vendasCol.orderBy('data', 'desc').get()
  return snap.docs.map((doc) => docToEntity(doc))
}

async function seedProdutosFixos() {
  const snap = await produtosCol.get()
  const existentes = snap.docs.map((doc) => ({ ref: doc.ref, data: doc.data() || {} }))
  const mapaPorNome = new Map(
    existentes.map((item) => [normalizarNomeProduto(item.data.nome), item])
  )

  const chavePaoAntigo = normalizarNomeProduto('Pão')
  const chavePaoNovo = normalizarNomeProduto('Pão Francês')
  const paoAntigo = mapaPorNome.get(chavePaoAntigo)
  const paoNovo = mapaPorNome.get(chavePaoNovo)
  if (paoAntigo && !paoNovo) {
    await paoAntigo.ref.set(
      {
        nome: 'Pão Francês',
        fixo: true,
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    )
    mapaPorNome.delete(chavePaoAntigo)
    mapaPorNome.set(chavePaoNovo, {
      ref: paoAntigo.ref,
      data: { ...(paoAntigo.data || {}), nome: 'Pão Francês', fixo: true },
    })
  }

  for (const nomeFixo of PRODUTOS_FIXOS) {
    const chave = normalizarNomeProduto(nomeFixo)
    const existente = mapaPorNome.get(chave)
    if (existente) {
      if (existente.data.fixo !== true || Number(existente.data.estoque || 0) < 999999) {
        await existente.ref.set(
          {
            fixo: true,
            estoque: Math.max(999999, Number(existente.data.estoque || 0)),
            updated_at: new Date().toISOString(),
          },
          { merge: true }
        )
      }
      continue
    }

    await produtosCol.add({
      nome: nomeFixo,
      preco: 0,
      estoque: 999999,
      fixo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }
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
await seedProdutosFixos()

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
  const snap = await produtosCol.get()
  const rows = snap.docs
    .map((doc) => docToEntity(doc))
    .sort((a, b) => {
      const aFixo = a.fixo === true
      const bFixo = b.fixo === true
      if (aFixo !== bFixo) return aFixo ? -1 : 1

      if (aFixo && bFixo) {
        const idxA = PRODUTOS_FIXOS.findIndex(
          (nome) => normalizarNomeProduto(nome) === normalizarNomeProduto(a.nome)
        )
        const idxB = PRODUTOS_FIXOS.findIndex(
          (nome) => normalizarNomeProduto(nome) === normalizarNomeProduto(b.nome)
        )
        if (idxA !== idxB) return idxA - idxB
      }

      return new Date(b.created_at || 0) - new Date(a.created_at || 0)
    })
  res.json(rows)
})

app.post('/produtos', async (req, res) => {
  const { nome, preco = 0, estoque = 0 } = req.body || {}
  if (!nome) return res.status(400).json({ error: 'nome é obrigatório' })
  const nomeFinal = String(nome).trim()
  const fixo = PRODUTOS_FIXOS.some(
    (item) => normalizarNomeProduto(item) === normalizarNomeProduto(nomeFinal)
  )

  const novo = {
    nome: nomeFinal,
    preco: Number(preco) || 0,
    estoque: Math.max(0, Number(estoque) || 0),
    fixo,
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
  const nomeAtual = String(atual.nome || '').trim()
  const nomeNovo = nome !== undefined ? String(nome).trim() : nomeAtual
  if (atual.fixo === true && normalizarNomeProduto(nomeNovo) !== normalizarNomeProduto(nomeAtual)) {
    return res.status(400).json({ error: 'Produto fixo não pode ter o nome alterado' })
  }

  await ref.update({
    nome: nomeNovo,
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
  const atual = snap.data() || {}
  if (atual.fixo === true) {
    return res.status(400).json({ error: 'Produto fixo não pode ser excluído' })
  }
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

app.delete('/comandas/abertas', async (req, res) => {
  try {
    const operadorIdRaw =
      req.body?.operadorId ||
      req.query?.operadorId ||
      req.headers['x-operador-id']
    const operadorIdNorm = String(operadorIdRaw || '').trim()
    if (!operadorIdNorm) return res.status(400).json({ error: 'operadorId é obrigatório' })

    const operadorDoc = await usuariosCol.doc(operadorIdNorm).get()
    if (!operadorDoc.exists) return res.status(403).json({ error: 'Operador inválido' })
    const operador = docToEntity(operadorDoc)
    if (String(operador.perfil || '') !== 'admin') {
      return res.status(403).json({ error: 'Apenas admin pode excluir comandas abertas' })
    }

    const snap = await comandasCol.where('status', '==', 'aberta').get()
    if (snap.empty) return res.json({ sucesso: true, removidas: 0 })

    const lote = db.batch()
    for (const doc of snap.docs) {
      lote.delete(doc.ref)
    }
    await lote.commit()

    return res.json({ sucesso: true, removidas: snap.size })
  } catch (error) {
    return res.status(500).json({ sucesso: false, error: error.message || 'Falha ao excluir comandas abertas' })
  }
})

app.post('/comandas', async (req, res) => {
  const payload = req.body || {}
  const numeroBruto =
    payload.numeroComanda ??
    payload.numero ??
    payload.comanda ??
    payload.nome ??
    payload.cliente
  const numero = numeroBruto != null ? String(numeroBruto).trim() : ''
  if (!numero) return res.status(400).json({ error: 'numeroComanda é obrigatório' })
  if (!/^\d+$/.test(numero)) {
    return res.status(400).json({ error: 'numeroComanda deve conter apenas números' })
  }
  const identificacao = `Comanda ${numero}`

  const nova = {
    numero_comanda: numero,
    cliente: null,
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
  const { produtoId, quantidade = 1, pesoGramas, tipoFrio } = req.body || {}

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

  const isFrios = produtoEhFrios(produto)
  const qtd = Math.max(1, Number(quantidade) || 1)
  const pesoNum = Math.max(1, Number(pesoGramas) || 0)
  const tipoFrioFinal = String(tipoFrio || '').trim()
  const estoqueNecessario = isFrios ? pesoNum : qtd
  if (isFrios && !tipoFrioFinal) {
    return res.status(400).json({ error: 'tipoFrio é obrigatório para produto Frios' })
  }
  if (estoqueDisponivelParaVenda(produto) < estoqueNecessario) {
    return res.status(400).json({ error: 'Estoque insuficiente' })
  }

  const subtotal = isFrios ? Number(produto.preco) * (pesoNum / 100) : Number(produto.preco) * qtd
  const item = {
    id: gerarId(),
    produto_id: produto.id,
    produtoId: produto.id,
    nome: isFrios ? `${produto.nome} - ${tipoFrioFinal}` : produto.nome,
    preco: Number(produto.preco),
    quantidade: isFrios ? 1 : qtd,
    unidadeMedida: isFrios ? 'gramas' : 'unidade',
    pesoGramas: isFrios ? pesoNum : null,
    tipoFrio: isFrios ? tipoFrioFinal : null,
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
    const qtdNecessaria =
      item.unidadeMedida === 'gramas' ? Number(item.pesoGramas || 0) : Number(item.quantidade || 0)
    if (estoqueDisponivelParaVenda(produto) < qtdNecessaria) {
      return res.status(400).json({ error: 'Estoque insuficiente para confirmar pagamento' })
    }
  }

  // Debita estoque.
  for (const item of comanda.itens || []) {
    const produtoId = item.produtoId || item.produto_id
    const produtoRef = produtosCol.doc(String(produtoId))
    const produtoDoc = await produtoRef.get()
    const produto = docToEntity(produtoDoc)
    if (!produtoEhFixo(produto)) {
      const qtdNecessaria =
        item.unidadeMedida === 'gramas' ? Number(item.pesoGramas || 0) : Number(item.quantidade || 0)
      const novoEstoque = Number(produto.estoque || 0) - qtdNecessaria
      await produtoRef.update({
        estoque: Math.max(0, novoEstoque),
        updated_at: new Date().toISOString(),
      })
    }
  }

  const caixaAtual = await getCaixaStatus()
  const venda = {
    comandaId: comanda.id,
    caixaId: caixaAtual.aberto ? caixaAtual.caixaId || null : null,
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
    status: 'fechada',
    itens: [],
    total: 0,
    enviadaEm: null,
    fechamentoEm: new Date().toISOString(),
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
  const caixaAtual = await getCaixaStatus()
  const vendasBase =
    caixaAtual.aberto && caixaAtual.caixaId
      ? await listarVendasDoCaixa(caixaAtual.caixaId)
      : (await listarVendasHistorico()).filter((v) => isHoje(v.data))
  const totais = somarTotais(vendasBase)
  const totalSangrias = caixaAtual.caixaId ? await getTotalSangriasDoCaixa(caixaAtual.caixaId) : 0
  const dinheiroLiquido = Number(totais.totalDinheiro || 0) - Number(totalSangrias || 0)
  res.json({ ...totais, totalSangrias, dinheiroLiquido, caixaId: caixaAtual.caixaId || null, vendasHoje: vendasBase })
})

app.post('/caixa/abrir', async (req, res) => {
  const { valorInicial } = req.body || {}
  const caixaAtual = await getCaixaStatus()
  if (caixaAtual.aberto) return res.status(400).json({ error: 'Caixa já está aberto' })

  const now = new Date().toISOString()
  const caixaRef = caixasCol.doc()
  await caixaRef.set({
    status: 'aberto',
    abertoEm: now,
    fechadoEm: null,
    valorInicial: Number(valorInicial) || 0,
    totalSangrias: 0,
    created_at: now,
    updated_at: now,
  })

  await caixaConfigRef.set({
    aberto: true,
    valorInicial: Number(valorInicial) || 0,
    aberturaEm: now,
    caixaId: caixaRef.id,
    updated_at: now,
  })

  res.json({ sucesso: true, caixaId: caixaRef.id })
})

app.post('/caixa/fechar', async (req, res) => {
  const { valorContado } = req.body || {}
  const caixaAtual = await getCaixaStatus()
  if (!caixaAtual.aberto) return res.status(400).json({ error: 'Caixa já está fechado' })

  const caixaId = caixaAtual.caixaId || null
  const vendasBase = caixaId
    ? await listarVendasDoCaixa(caixaId)
    : (await listarVendasHistorico()).filter((v) => isHoje(v.data))
  const totais = somarTotais(vendasBase)
  const totalSangrias = caixaId ? await getTotalSangriasDoCaixa(caixaId) : 0
  const dinheiroLiquido = Number(totais.totalDinheiro || 0) - Number(totalSangrias || 0)
  const totalEsperado = Number(caixaAtual.valorInicial || 0) + dinheiroLiquido
  const valorContadoNum = Number(valorContado) || 0
  const diferenca = valorContadoNum - totalEsperado

  const fechamento = {
    caixaId,
    data: new Date().toISOString(),
    valorInicial: Number(caixaAtual.valorInicial || 0),
    totalDinheiro: totais.totalDinheiro,
    totalCartao: totais.totalCartao,
    totalPix: totais.totalPix,
    totalSangrias,
    dinheiroLiquido,
    valorContado: valorContadoNum,
    diferenca,
  }

  const fechamentoRef = await fechamentosCol.add(fechamento)

  if (caixaId) {
    await caixasCol.doc(caixaId).set(
      {
        status: 'fechado',
        fechadoEm: new Date().toISOString(),
        totalDinheiro: totais.totalDinheiro,
        totalCartao: totais.totalCartao,
        totalPix: totais.totalPix,
        totalSangrias,
        dinheiroLiquido,
        diferenca,
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    )
  }

  await caixaConfigRef.set(
    {
      aberto: false,
      valorInicial: 0,
      aberturaEm: null,
      caixaId: null,
      updated_at: new Date().toISOString(),
    },
    { merge: true }
  )

  const comandasResetadas = await resetarComandasParaNovoDia()

  const fechamentoDoc = await fechamentoRef.get()
  res.json({ sucesso: true, fechamento: docToEntity(fechamentoDoc), comandasResetadas })
})

app.get('/caixa/relatorios', async (_, res) => {
  const snap = await fechamentosCol.orderBy('data', 'desc').get()
  res.json(snap.docs.map((doc) => docToEntity(doc)))
})

app.get('/caixa/sangrias', async (req, res) => {
  const caixaId = String(req.query.caixaId || '').trim()
  if (!caixaId) return res.status(400).json({ error: 'caixaId é obrigatório' })
  const rows = await listarSangriasDoCaixa(caixaId)
  res.json(rows)
})

app.get('/caixa/sangrias/total', async (req, res) => {
  const caixaId = String(req.query.caixaId || '').trim()
  if (!caixaId) return res.status(400).json({ error: 'caixaId é obrigatório' })
  const totalSangrias = await getTotalSangriasDoCaixa(caixaId)
  res.json({ caixaId, totalSangrias })
})

app.post('/caixa/sangrias', async (req, res) => {
  try {
    const { caixaId, valor, motivo, operadorId } = req.body || {}
    const caixaIdNorm = String(caixaId || '').trim()
    const operadorIdNorm = String(operadorId || '').trim()
    const valorNum = Number(valor) || 0
    const motivoFinal = String(motivo || '').trim() || null

    if (!caixaIdNorm) return res.status(400).json({ error: 'caixaId é obrigatório' })
    if (!operadorIdNorm) return res.status(400).json({ error: 'operadorId é obrigatório' })
    if (valorNum <= 0) return res.status(400).json({ error: 'valor deve ser maior que zero' })

    const operadorDoc = await usuariosCol.doc(operadorIdNorm).get()
    if (!operadorDoc.exists) return res.status(403).json({ error: 'Operador inválido' })
    const operador = docToEntity(operadorDoc)
    if (String(operador.perfil || '') !== 'admin') {
      return res.status(403).json({ error: 'Apenas admin pode registrar sangria' })
    }

    const caixaRef = caixasCol.doc(caixaIdNorm)
    let payload = null

    await db.runTransaction(async (trx) => {
      const caixaDoc = await trx.get(caixaRef)
      if (!caixaDoc.exists) throw new Error('Caixa não encontrado')
      const caixaData = caixaDoc.data() || {}
      if (caixaData.status !== 'aberto') throw new Error('Caixa não está aberto')

      const vendasSnap = await trx.get(vendasCol.where('caixaId', '==', caixaIdNorm))
      const totalVendasDinheiro = vendasSnap.docs
        .map((doc) => doc.data() || {})
        .filter((v) => String(v.metodoPagamento || '').toLowerCase().includes('dinheiro'))
        .reduce((acc, v) => acc + Number(v.total || 0), 0)

      const sangriasSnap = await trx.get(caixaRef.collection('sangrias'))
      const totalSangriasAtual = sangriasSnap.docs
        .map((doc) => doc.data() || {})
        .reduce((acc, row) => acc + Number(row.valor || 0), 0)

      const saldoDisponivelDinheiro = totalVendasDinheiro - totalSangriasAtual
      if (valorNum > saldoDisponivelDinheiro) {
        throw new Error('Valor da sangria maior que o saldo disponível em dinheiro')
      }

      const sangriaRef = caixaRef.collection('sangrias').doc()
      const now = new Date().toISOString()
      const totalSangriasNovo = totalSangriasAtual + valorNum

      trx.set(sangriaRef, {
        valor: valorNum,
        motivo: motivoFinal,
        operadorId: operadorIdNorm,
        operadorNome: operador.nome || null,
        createdAt: FieldValue.serverTimestamp(),
        createdAtIso: now,
        tipo: 'sangria',
      })

      trx.set(
        caixaRef,
        {
          totalSangrias: totalSangriasNovo,
          updated_at: now,
        },
        { merge: true }
      )

      payload = {
        id: sangriaRef.id,
        caixaId: caixaIdNorm,
        valor: valorNum,
        motivo: motivoFinal,
        operadorId: operadorIdNorm,
        operadorNome: operador.nome || null,
        createdAt: now,
        tipo: 'sangria',
        totalSangrias: totalSangriasNovo,
        saldoDisponivelDinheiro: saldoDisponivelDinheiro - valorNum,
        totalVendasDinheiro,
      }
    })

    return res.status(201).json({ sucesso: true, sangria: payload })
  } catch (error) {
    const message = error?.message || 'Falha ao registrar sangria'
    if (
      message.includes('saldo disponível') ||
      message.includes('Caixa não está aberto') ||
      message.includes('Caixa não encontrado')
    ) {
      return res.status(400).json({ sucesso: false, error: message })
    }
    return res.status(500).json({ sucesso: false, error: message })
  }
})

app.delete('/caixa/dados', async (_, res) => {
  try {
    await apagarColecao(vendasCol)
    await apagarColecao(fechamentosCol)
    await apagarCaixasComSangrias()
    const comandasReabertas = await reabrirComandasAguardandoPagamento()
    await caixaConfigRef.set(
      {
        aberto: false,
        valorInicial: 0,
        aberturaEm: null,
        caixaId: null,
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    )

    res.json({ sucesso: true, comandasReabertas })
  } catch (error) {
    res.status(500).json({ sucesso: false, error: error.message || 'Falha ao limpar caixa' })
  }
})

app.post('/vendas/:id/itens', async (req, res) => {
  const { id } = req.params
  const { produtoId, quantidade = 1, pesoGramas, tipoFrio } = req.body || {}

  const vendaRef = vendasCol.doc(String(id))
  const vendaDoc = await vendaRef.get()
  if (!vendaDoc.exists) return res.status(404).json({ error: 'Venda não encontrada' })
  const venda = docToEntity(vendaDoc)

  const produtoRef = produtosCol.doc(String(produtoId))
  const produtoDoc = await produtoRef.get()
  if (!produtoDoc.exists) return res.status(404).json({ error: 'Produto não encontrado' })
  const produto = docToEntity(produtoDoc)

  const isFrios = produtoEhFrios(produto)
  const qtd = Math.max(1, Number(quantidade) || 1)
  const pesoNum = Math.max(1, Number(pesoGramas) || 0)
  const tipoFrioFinal = String(tipoFrio || '').trim()
  const estoqueNecessario = isFrios ? pesoNum : qtd
  if (isFrios && !tipoFrioFinal) {
    return res.status(400).json({ error: 'tipoFrio é obrigatório para produto Frios' })
  }
  if (estoqueDisponivelParaVenda(produto) < estoqueNecessario) {
    return res.status(400).json({ error: 'Estoque insuficiente' })
  }

  const item = {
    id: gerarId(),
    produto_id: produto.id,
    produtoId: produto.id,
    nome: isFrios ? `${produto.nome} - ${tipoFrioFinal}` : produto.nome,
    preco: Number(produto.preco || 0),
    quantidade: isFrios ? 1 : qtd,
    unidadeMedida: isFrios ? 'gramas' : 'unidade',
    pesoGramas: isFrios ? pesoNum : null,
    tipoFrio: isFrios ? tipoFrioFinal : null,
    subtotal: isFrios ? Number(produto.preco || 0) * (pesoNum / 100) : Number(produto.preco || 0) * qtd,
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

  if (!produtoEhFixo(produto)) {
    await produtoRef.update({
      estoque: Math.max(0, Number(produto.estoque || 0) - estoqueNecessario),
      updated_at: new Date().toISOString(),
    })
  }

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
  const totalSangrias = caixaAtual.caixaId ? await getTotalSangriasDoCaixa(caixaAtual.caixaId) : 0
  const dinheiroLiquido = Number(totaisHoje.totalDinheiro || 0) - Number(totalSangrias || 0)

  const produtosEstoqueBaixo = produtosSnap.docs
    .map((doc) => docToEntity(doc))
    .filter((p) => p.fixo !== true && Number(p.estoque || 0) < 5)
    .sort((a, b) => Number(a.estoque || 0) - Number(b.estoque || 0))
  const estoqueBaixo = produtosEstoqueBaixo.length

  res.json({
    totalHoje: totaisHoje.totalHoje,
    totalDinheiro: totaisHoje.totalDinheiro,
    totalCartao: totaisHoje.totalCartao,
    totalPix: totaisHoje.totalPix,
    totalSangrias,
    dinheiroLiquido,
    comandasAbertas: comandasAbertasSnap.size,
    comandasAguardandoPagamento: comandasAguardandoSnap.size,
    vendasFinalizadasHoje: vendasHoje.length,
    totalHistorico,
    totalVendas: vendas.length,
    caixaAberto: caixaAtual.aberto,
    estoqueBaixo,
    produtosEstoqueBaixo: produtosEstoqueBaixo.map((p) => ({
      id: p.id,
      nome: p.nome,
      estoque: Number(p.estoque || 0),
    })),
  })
})

const port = Number(process.env.PORT || 3001)
app.listen(port, () => {
  console.log(`API rodando na porta ${port}`)
  console.log('Banco: Firestore')
})

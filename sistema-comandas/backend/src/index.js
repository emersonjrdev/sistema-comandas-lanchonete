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

function docToEntity(doc) {
  return { id: doc.id, ...doc.data() }
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
  const payload = docToEntity(novoDoc)
  payload.itens = payload.itens || []
  payload.total = payload.total || 0
  res.status(201).json(payload)
})

app.get('/comandas', async (_, res) => {
  const snap = await comandasCol.where('status', '==', 'aberta').orderBy('created_at', 'desc').get()
  const payload = snap.docs.map((doc) => {
    const comanda = docToEntity(doc)
    return { ...comanda, itens: comanda.itens || [], total: Number(comanda.total || 0) }
  })
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
  if (comanda.status !== 'aberta') return res.status(404).json({ error: 'Comanda não encontrada ou fechada' })

  const produtoDoc = await produtosCol.doc(String(produtoId)).get()
  if (!produtoDoc.exists) return res.status(404).json({ error: 'Produto não encontrado' })
  const produto = docToEntity(produtoDoc)

  const qtd = Math.max(1, Number(quantidade) || 1)
  if ((produto.estoque ?? 0) < qtd) return res.status(400).json({ error: 'Estoque insuficiente' })

  const subtotal = Number(produto.preco) * qtd
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    produto_id: produto.id,
    produtoId: produto.id,
    nome: produto.nome,
    preco: Number(produto.preco),
    quantidade: qtd,
    subtotal,
    created_at: new Date().toISOString(),
  }

  const itens = [...(comanda.itens || []), item]
  const total = itens.reduce((acc, i) => acc + Number(i.subtotal || 0), 0)
  await comandaRef.update({
    itens,
    total,
    updated_at: new Date().toISOString(),
  })

  const atualizadaDoc = await comandaRef.get()
  return res.json(docToEntity(atualizadaDoc))
})

const port = Number(process.env.PORT || 3001)
app.listen(port, () => {
  console.log(`API rodando na porta ${port}`)
  console.log('Banco: Firestore')
})

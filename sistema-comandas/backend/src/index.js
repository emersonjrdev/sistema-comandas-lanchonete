import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const dataDir = path.join(rootDir, 'data')

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })

const dbPath = process.env.DB_PATH || path.join(dataDir, 'database.sqlite')
const db = await open({ filename: dbPath, driver: sqlite3.Database })

await db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    perfil TEXT NOT NULL CHECK (perfil IN ('admin', 'funcionario')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    preco REAL NOT NULL DEFAULT 0,
    estoque INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS comandas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_comanda TEXT,
    cliente TEXT NOT NULL DEFAULT 'Balcão',
    identificacao TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'aguardando_pagamento')),
    total REAL NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS comanda_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comanda_id INTEGER NOT NULL,
    produto_id INTEGER NOT NULL,
    nome TEXT NOT NULL,
    preco REAL NOT NULL,
    quantidade INTEGER NOT NULL DEFAULT 1,
    subtotal REAL NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (comanda_id) REFERENCES comandas(id) ON DELETE CASCADE,
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
  );
`)

const countUsuarios = (await db.get('SELECT COUNT(*) AS total FROM usuarios')).total
if (countUsuarios === 0) {
  await db.run('INSERT INTO usuarios (nome, senha, perfil) VALUES (?, ?, ?)', ['admin', 'admin123', 'admin'])
  await db.run('INSERT INTO usuarios (nome, senha, perfil) VALUES (?, ?, ?)', ['funcionario', 'func123', 'funcionario'])
}

const app = express()
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || '*' }))
app.use(express.json())

app.get('/health', (_, res) => res.json({ status: 'ok', dbPath }))

app.post('/auth/login', async (req, res) => {
  const { nome, senha } = req.body || {}
  if (!nome || !senha) return res.status(400).json({ error: 'nome e senha são obrigatórios' })

  const user = await db.get(
    'SELECT id, nome, perfil FROM usuarios WHERE lower(nome) = lower(?) AND senha = ?',
    [String(nome).trim(), String(senha)]
  )

  if (!user) return res.status(401).json({ error: 'Usuário ou senha inválidos' })
  return res.json(user)
})

app.get('/usuarios', async (_, res) => {
  const rows = await db.all('SELECT id, nome, perfil, created_at FROM usuarios ORDER BY id DESC')
  res.json(rows)
})

app.post('/usuarios', async (req, res) => {
  const { nome, senha, perfil } = req.body || {}
  if (!nome || !senha) return res.status(400).json({ error: 'nome e senha são obrigatórios' })

  const perfilNormalizado = perfil === 'admin' ? 'admin' : 'funcionario'

  try {
    const result = await db.run('INSERT INTO usuarios (nome, senha, perfil) VALUES (?, ?, ?)', [
      String(nome).trim(),
      String(senha),
      perfilNormalizado,
    ])
    const novo = await db.get('SELECT id, nome, perfil FROM usuarios WHERE id = ?', [result.lastID])
    return res.status(201).json(novo)
  } catch {
    return res.status(409).json({ error: 'Usuário já existe' })
  }
})

app.get('/produtos', async (_, res) => {
  const rows = await db.all('SELECT * FROM produtos ORDER BY id DESC')
  res.json(rows)
})

app.post('/produtos', async (req, res) => {
  const { nome, preco = 0, estoque = 0 } = req.body || {}
  if (!nome) return res.status(400).json({ error: 'nome é obrigatório' })

  const result = await db.run('INSERT INTO produtos (nome, preco, estoque) VALUES (?, ?, ?)', [
    String(nome).trim(),
    Number(preco) || 0,
    Math.max(0, Number(estoque) || 0),
  ])

  const novo = await db.get('SELECT * FROM produtos WHERE id = ?', [result.lastID])
  res.status(201).json(novo)
})

app.get('/comandas', async (_, res) => {
  const comandas = await db.all("SELECT * FROM comandas WHERE status = 'aberta' ORDER BY id DESC")

  const payload = await Promise.all(
    comandas.map(async (c) => ({
      ...c,
      itens: await db.all('SELECT * FROM comanda_itens WHERE comanda_id = ? ORDER BY id ASC', [c.id]),
    }))
  )

  res.json(payload)
})

app.post('/comandas', async (req, res) => {
  const { numeroComanda = null, cliente = 'Balcão' } = req.body || {}
  const clienteNome = String(cliente)
  const identificacao = numeroComanda ? `Comanda ${numeroComanda} - ${clienteNome}` : clienteNome

  const result = await db.run(
    'INSERT INTO comandas (numero_comanda, cliente, identificacao, status, total) VALUES (?, ?, ?, ?, ?)',
    [numeroComanda ? String(numeroComanda) : null, clienteNome, identificacao, 'aberta', 0]
  )

  const nova = await db.get('SELECT * FROM comandas WHERE id = ?', [result.lastID])
  res.status(201).json({ ...nova, itens: [] })
})

app.post('/comandas/:id/itens', async (req, res) => {
  const comandaId = Number(req.params.id)
  const { produtoId, quantidade = 1 } = req.body || {}

  const comanda = await db.get("SELECT * FROM comandas WHERE id = ? AND status = 'aberta'", [comandaId])
  if (!comanda) return res.status(404).json({ error: 'Comanda não encontrada ou fechada' })

  const produto = await db.get('SELECT * FROM produtos WHERE id = ?', [Number(produtoId)])
  if (!produto) return res.status(404).json({ error: 'Produto não encontrado' })

  const qtd = Math.max(1, Number(quantidade) || 1)
  if ((produto.estoque ?? 0) < qtd) return res.status(400).json({ error: 'Estoque insuficiente' })

  const subtotal = Number(produto.preco) * qtd

  await db.run(
    'INSERT INTO comanda_itens (comanda_id, produto_id, nome, preco, quantidade, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
    [comandaId, produto.id, produto.nome, produto.preco, qtd, subtotal]
  )

  const total = (await db.get('SELECT COALESCE(SUM(subtotal), 0) AS total FROM comanda_itens WHERE comanda_id = ?', [comandaId])).total
  await db.run('UPDATE comandas SET total = ? WHERE id = ?', [total, comandaId])

  const atualizada = await db.get('SELECT * FROM comandas WHERE id = ?', [comandaId])
  const itens = await db.all('SELECT * FROM comanda_itens WHERE comanda_id = ? ORDER BY id ASC', [comandaId])

  return res.json({ ...atualizada, itens })
})

const port = Number(process.env.PORT || 3001)
app.listen(port, () => {
  console.log(`API rodando na porta ${port}`)
  console.log(`Banco: ${dbPath}`)
})

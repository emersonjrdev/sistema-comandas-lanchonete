import 'dotenv/config'
import crypto from 'node:crypto'
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
const comandasAtivasCol = db.collection('comandas_ativas')
const vendasCol = db.collection('vendas')
const fechamentosCol = db.collection('caixa_fechamentos')
const caixaConfigRef = db.collection('config').doc('caixa')
const caixasCol = db.collection('caixas')
const PRODUTOS_FIXOS = ['Pão Francês', 'Frios', 'Bolos']

const FIN_SESSION_TTL_MS_RAW = Number(process.env.FINANCEIRO_SESSAO_TTL_MS)
const FIN_SESSION_TTL_MS =
  Number.isFinite(FIN_SESSION_TTL_MS_RAW) && FIN_SESSION_TTL_MS_RAW >= 60000 ? FIN_SESSION_TTL_MS_RAW : 12 * 60 * 60 * 1000
const FIN_MARIA_SENHA = String(process.env.FINANCEIRO_MARIA_SENHA ?? '')

function financeiroSecretSessao() {
  const s = process.env.FINANCEIRO_SESSAO_SEGREDO || process.env.FIREBASE_PROJECT_ID || 'dev-finance-secret'
  return String(s)
}

function criarTokenSessaoFinanceiro() {
  const exp = Date.now() + FIN_SESSION_TTL_MS
  const payloadJson = JSON.stringify({ tipo: 'financeiro', exp })
  const sig = crypto
    .createHmac('sha256', financeiroSecretSessao())
    .update(payloadJson)
    .digest('base64url')
  const parte = Buffer.from(payloadJson, 'utf8').toString('base64url')
  return { token: `${parte}.${sig}`, expiresAt: exp }
}

function validarTokenSessaoFinanceiro(token) {
  try {
    const raw = String(token || '').trim()
    const sep = raw.indexOf('.')
    if (sep < 1 || sep >= raw.length - 1) return false
    const parte = raw.slice(0, sep)
    const sig = raw.slice(sep + 1)
    const payloadJson = Buffer.from(parte, 'base64url').toString('utf8')
    const esperadoSig = crypto
      .createHmac('sha256', financeiroSecretSessao())
      .update(payloadJson)
      .digest('base64url')
    const sigBuf = Buffer.from(sig)
    const espBuf = Buffer.from(esperadoSig)
    if (sigBuf.length !== espBuf.length || !crypto.timingSafeEqual(sigBuf, espBuf)) return false
    const payload = JSON.parse(payloadJson)
    if (payload.tipo !== 'financeiro' || typeof payload.exp !== 'number') return false
    return Date.now() <= payload.exp
  } catch {
    return false
  }
}

function tokenSessaoFinanceiroDosHeaders(req) {
  const h = req.get('x-sessao-financeiro')
  if (h) return h.trim()
  const auth = req.get('authorization') || ''
  return auth.replace(/^Bearer\s+/i, '').trim()
}

function exigirSessaoFinanceiro(req, res, next) {
  if (!FIN_MARIA_SENHA) {
    return res.status(503).json({
      error: 'Financeiro não configurado: defina FINANCEIRO_MARIA_SENHA no servidor.',
    })
  }
  const token = tokenSessaoFinanceiroDosHeaders(req)
  if (!token || !validarTokenSessaoFinanceiro(token)) {
    return res.status(403).json({
      error: 'Acesso ao histórico financeiro não autorizado. Informe a senha da Maria.',
    })
  }
  next()
}

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
  const vendasAtivas = (vendas || []).filter((v) => v?.cancelada !== true)
  const totalDinheiro = vendasAtivas
    .filter((v) => String(v.metodoPagamento || '').toLowerCase().includes('dinheiro'))
    .reduce((acc, v) => acc + Number(v.total || 0), 0)

  const totalCartao = vendasAtivas
    .filter((v) => String(v.metodoPagamento || '').toLowerCase().includes('cart'))
    .reduce((acc, v) => acc + Number(v.total || 0), 0)

  const totalPix = vendasAtivas
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

function formatarDataSp(value = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(value)
}

/** Padrão: 20:30 BRT (dia operacional inicia logo após). */
const VIRADA_CAIXA_MINUTOS_BR_PADRAO = 20 * 60 + 30

/** Lê CAIXA_VIRADA_MINUTOS_DESDE_MEIA_NOITE_BR (0–1439), ou CAIXA_VIRADA_HORA_BR + CAIXA_VIRADA_MINUTO_BR */
function lerMinutosViradaCaixaEnv() {
  const rawMin = process.env.CAIXA_VIRADA_MINUTOS_DESDE_MEIA_NOITE_BR
  if (rawMin !== undefined && String(rawMin).trim() !== '') {
    const n = Number(rawMin)
    if (Number.isFinite(n) && n >= 0 && n < 1440) return Math.floor(n)
  }
  const h = Number(process.env.CAIXA_VIRADA_HORA_BR)
  const mi = Number(process.env.CAIXA_VIRADA_MINUTO_BR)
  if (
    Number.isFinite(h) &&
    Number.isFinite(mi) &&
    h >= 0 &&
    h <= 23 &&
    mi >= 0 &&
    mi <= 59
  ) {
    return h * 60 + mi
  }
  return VIRADA_CAIXA_MINUTOS_BR_PADRAO
}

const VIRADA_CAIXA_MINUTOS_BR = lerMinutosViradaCaixaEnv()

function obterMinutosDesdeMeiaNoiteSp(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(value)
  const hh = Number(parts.find((x) => x.type === 'hour')?.value)
  const mm = Number(parts.find((x) => x.type === 'minute')?.value)
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0
  return hh * 60 + mm
}

function passouHorarioViradaCaixaBr(agora = new Date()) {
  return obterMinutosDesdeMeiaNoiteSp(agora) >= VIRADA_CAIXA_MINUTOS_BR
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

/** Produto cadastrado para venda por gramas (exc. Frios, que têm regra própria). */
function produtoVendePorGramasFlag(produto) {
  if (produtoEhFixo(produto) || produtoEhFrios(produto)) return false
  return produto?.vendePorGramas === true
}

/**
 * Monta linha de item (comanda/venda) a partir do produto + body.
 * Frios primeiro: no cadastro costuma ter fixo=true, mas a venda é sempre por peso.
 * @returns {{ item: object, estoqueNecessario: number } | { erro: string }}
 */
function montarItemLinhaProduto(produto, body = {}) {
  const { quantidade = 1, pesoGramas, tipoFrio, valorTotal, valorUnitario } = body
  const isFrios = produtoEhFrios(produto)
  const isFixo = produtoEhFixo(produto)
  const isPorGramasOpcional = produtoVendePorGramasFlag(produto)
  const qtd = Math.max(1, Number(quantidade) || 1)
  const pesoNum = Math.max(0, Number(pesoGramas) || 0)
  const tipoFrioFinal = String(tipoFrio || '').trim()
  const valorTotalBruto =
    valorTotal !== undefined && valorTotal !== null && String(valorTotal).trim() !== ''
      ? Number(valorTotal)
      : null
  const valorInformado =
    valorTotalBruto !== null && Number.isFinite(valorTotalBruto)
      ? valorTotalBruto
      : Number(valorUnitario)

  const agora = new Date().toISOString()

  function montarItemGramas({ exigeTipoFrio, nomeExibicao }) {
    if (pesoNum < 1) {
      return { erro: 'Informe o peso em gramas (mínimo 1 g)' }
    }
    if (exigeTipoFrio && !tipoFrioFinal) {
      return { erro: 'tipoFrio é obrigatório para produto Frios' }
    }
    const precoRef = Number(produto.preco || 0)
    let subtotal
    let valorManualLinha = false
    if (valorTotalBruto !== null && Number.isFinite(valorTotalBruto) && valorTotalBruto > 0) {
      subtotal = valorTotalBruto
      valorManualLinha = true
    } else {
      if (!Number.isFinite(precoRef) || precoRef <= 0) {
        return {
          erro:
            'Cadastre o preço por 100 g neste produto ou informe o valor total opcional na venda',
        }
      }
      subtotal = precoRef * (pesoNum / 100)
    }
    return {
      item: {
        id: gerarId(),
        produto_id: produto.id,
        produtoId: produto.id,
        nome: nomeExibicao,
        preco: valorManualLinha ? subtotal : precoRef,
        quantidade: 1,
        unidadeMedida: 'gramas',
        pesoGramas: pesoNum,
        tipoFrio: exigeTipoFrio ? tipoFrioFinal : null,
        valorManualTotal: valorManualLinha,
        subtotal,
        created_at: agora,
      },
      estoqueNecessario: pesoNum,
    }
  }

  if (isFrios) {
    return montarItemGramas({
      exigeTipoFrio: true,
      nomeExibicao: tipoFrioFinal ? `${produto.nome} - ${tipoFrioFinal}` : produto.nome,
    })
  }

  if (isFixo) {
    const precoBase = Number.isFinite(valorInformado) ? valorInformado : 0
    if (!Number.isFinite(precoBase) || precoBase <= 0) {
      return { erro: 'Informe um valor total maior que zero para produto fixo' }
    }
    return {
      item: {
        id: gerarId(),
        produto_id: produto.id,
        produtoId: produto.id,
        nome: produto.nome,
        preco: precoBase,
        quantidade: 1,
        unidadeMedida: 'valor_total',
        pesoGramas: null,
        tipoFrio: null,
        valorManualTotal: true,
        subtotal: precoBase,
        created_at: agora,
      },
      estoqueNecessario: qtd,
    }
  }

  if (isPorGramasOpcional) {
    return montarItemGramas({
      exigeTipoFrio: false,
      nomeExibicao: produto.nome,
    })
  }

  const precoBase = Number(produto.preco || 0)
  const subtotal = precoBase * qtd
  return {
    item: {
      id: gerarId(),
      produto_id: produto.id,
      produtoId: produto.id,
      nome: produto.nome,
      preco: precoBase,
      quantidade: qtd,
      unidadeMedida: 'unidade',
      pesoGramas: null,
      tipoFrio: null,
      valorManualTotal: false,
      subtotal,
      created_at: agora,
    },
    estoqueNecessario: qtd,
  }
}

function estoqueDisponivelParaVenda(produto) {
  if (produtoEhFixo(produto)) return Number.MAX_SAFE_INTEGER
  return Number(produto?.estoque ?? 0)
}

function normalizarNumeroComanda(valor) {
  const raw = String(valor || '').trim()
  if (!/^\d+$/.test(raw)) return null
  const numeroInt = Number.parseInt(raw, 10)
  if (!Number.isFinite(numeroInt) || numeroInt < 1 || numeroInt > 100) return null
  return String(numeroInt).padStart(3, '0')
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
    .filter((venda) => venda?.cancelada !== true)
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
  const tamanhoLote = 300 // Plano Blaze: lotes maiores; Spark: use 100
  let totalResetadas = 0
  let lastDoc = null

  while (true) {
    let q = comandasCol
      .where('status', 'in', ['aberta', 'aguardando_pagamento'])
      .limit(tamanhoLote)
    if (lastDoc) q = q.startAfter(lastDoc)
    const snap = await q.get()
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
    lastDoc = snap.docs[snap.docs.length - 1]
    if (snap.size < tamanhoLote) break
  }

  return totalResetadas
}

async function listarNumerosComandasEmUso() {
  const [abertasSnap, aguardandoSnap] = await Promise.all([
    comandasCol.where('status', '==', 'aberta').get(),
    comandasCol.where('status', '==', 'aguardando_pagamento').get(),
  ])
  const usadas = new Set()
  for (const doc of [...abertasSnap.docs, ...aguardandoSnap.docs]) {
    const numero = normalizarNumeroComanda(doc.data()?.numero_comanda)
    if (numero) usadas.add(numero)
  }
  return usadas
}

async function liberarComandaAtivaPorNumero(numeroComanda) {
  const numero = normalizarNumeroComanda(numeroComanda)
  if (!numero) return
  await comandasAtivasCol.doc(numero).delete()
}

function getProximaComandaDisponivel(numerosEmUso) {
  for (let i = 1; i <= 100; i += 1) {
    const numero = String(i).padStart(3, '0')
    if (!numerosEmUso.has(numero)) return numero
  }
  return null
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
    ultimaViradaCaixaEm: data.ultimaViradaCaixaEm || null,
    ultimaViradaCaixaData: data.ultimaViradaCaixaData || null,
  }
}

function precisaVirarCaixaAgora(status, agora = new Date()) {
  const hoje = formatarDataSp(agora)
  const ontemDate = new Date(agora.getTime() - 24 * 60 * 60 * 1000)
  const ontem = formatarDataSp(ontemDate)
  const alvoVirada = passouHorarioViradaCaixaBr(agora) ? hoje : ontem
  const ultimaData = String(status?.ultimaViradaCaixaData || '')
  return ultimaData !== alvoVirada
}

function obterDataAlvoVirada(agora = new Date()) {
  if (passouHorarioViradaCaixaBr(agora)) return formatarDataSp(agora)
  return formatarDataSp(new Date(agora.getTime() - 24 * 60 * 60 * 1000))
}

async function virarCaixaAutomaticamenteSeNecessario() {
  const status = await getCaixaStatus()
  if (status.aberto) return status
  if (!precisaVirarCaixaAgora(status)) return status

  const agora = new Date()
  const agoraIso = new Date().toISOString()
  const dataVirada = obterDataAlvoVirada(agora)
  await caixaConfigRef.set(
    {
      aberto: false,
      valorInicial: 0,
      aberturaEm: null,
      caixaId: null,
      ultimaViradaCaixaEm: agoraIso,
      ultimaViradaCaixaData: dataVirada,
      updated_at: agoraIso,
    },
    { merge: true }
  )

  await reabrirComandasAguardandoPagamento()
  return getCaixaStatus()
}

async function listarVendasHistorico() {
  const snap = await vendasCol.orderBy('data', 'desc').get()
  return snap.docs
    .map((doc) => docToEntity(doc))
    .filter((venda) => venda?.cancelada !== true)
}

/** Início do dia civil em SP (ISO) para filtrar vendas sem ler o histórico inteiro. */
function isoInicioCalendarioSp(agora = new Date()) {
  return `${formatarDataSp(agora)}T00:00:00.000-03:00`
}

/** Vendas a partir de uma data — evita carregar toda a coleção (economia de cota). */
async function listarVendasDesde(desdeIso) {
  const desde = String(desdeIso || '').trim()
  if (!desde) return listarVendasHistorico()
  const snap = await vendasCol.where('data', '>=', desde).orderBy('data', 'desc').get()
  return snap.docs
    .map((doc) => docToEntity(doc))
    .filter((venda) => venda?.cancelada !== true)
}

async function listarVendasParaTotaisCaixa(caixaAtual) {
  if (caixaAtual?.aberto && caixaAtual?.caixaId) {
    return listarVendasDoCaixa(caixaAtual.caixaId)
  }
  if (caixaAtual?.ultimaViradaCaixaEm) {
    return listarVendasDesde(caixaAtual.ultimaViradaCaixaEm)
  }
  return listarVendasDesde(isoInicioCalendarioSp())
}

function erroFirestoreQuota(err) {
  const code = err?.code
  const msg = String(err?.message || err?.details || '')
  return code === 8 || /RESOURCE_EXHAUSTED|Quota exceeded/i.test(msg)
}

const MSG_COTA_FIRESTORE =
  'Cota do Firestore excedida. Feche abas do sistema, aguarde alguns minutos ou confira o billing no Firebase.'

function responderErroFirestore(res, err) {
  if (erroFirestoreQuota(err)) {
    return res.status(503).json({ error: MSG_COTA_FIRESTORE })
  }
  return res.status(500).json({ error: err?.message || 'Erro interno' })
}

async function seedProdutosFixos() {
  const paoSnap = await produtosCol.where('nome', '==', 'Pão').limit(1).get()
  const paoNovoSnap = await produtosCol.where('nome', '==', 'Pão Francês').limit(1).get()
  if (!paoSnap.empty && paoNovoSnap.empty) {
    await paoSnap.docs[0].ref.set(
      {
        nome: 'Pão Francês',
        fixo: true,
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    )
  }

  for (const nomeFixo of PRODUTOS_FIXOS) {
    const snap = await produtosCol.where('nome', '==', nomeFixo).limit(1).get()
    if (!snap.empty) {
      const ref = snap.docs[0].ref
      const data = snap.docs[0].data() || {}
      if (
        data.fixo !== true ||
        Number(data.estoque || 0) < 999999 ||
        Number(data.preco || 0) !== 0
      ) {
        await ref.set(
          {
            fixo: true,
            preco: 0,
            estoque: Math.max(999999, Number(data.estoque || 0)),
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

async function executarSeedInicial() {
  if (process.env.DISABLE_STARTUP_SEED === 'true') {
    console.warn('[seed] Desabilitado (DISABLE_STARTUP_SEED=true)')
    return
  }
  try {
    await seedUsuarios()
    await seedProdutosFixos()
    console.log('[seed] Usuários e produtos fixos verificados')
  } catch (err) {
    if (erroFirestoreQuota(err)) {
      console.warn('[seed] Cota Firestore esgotada — API sobe mesmo assim. Tente de novo mais tarde.')
      return
    }
    console.warn('[seed] Falha não fatal:', err?.message || err)
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

function normalizarOrigem(origem) {
  return String(origem || '')
    .trim()
    .replace(/\/+$/, '')
    .toLowerCase()
}

const corsOriginsConfig = String(process.env.CORS_ORIGIN || '')
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean)

const corsOptions = {
  origin(origin, callback) {
    // Permite requests server-to-server e apps nativos sem Origin.
    if (!origin) return callback(null, true)

    if (corsOriginsConfig.length === 0 || corsOriginsConfig.includes('*')) {
      return callback(null, true)
    }

    const origemRecebida = normalizarOrigem(origin)
    const permitido = corsOriginsConfig.some(
      (item) => normalizarOrigem(item) === origemRecebida
    )
    return callback(null, permitido)
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-operador-id', 'x-sessao-financeiro'],
}

const app = express()
app.use(cors(corsOptions))
app.options(/.*/, cors(corsOptions))
app.use(express.json())

app.get('/health', async (_, res) => {
  try {
    await caixaConfigRef.get()
    res.json({ status: 'ok', database: 'firestore' })
  } catch (error) {
    if (erroFirestoreQuota(error)) {
      return res.status(503).json({
        status: 'degraded',
        database: 'firestore',
        error: 'Cota Firestore excedida. Aguarde ou verifique billing no Firebase.',
      })
    }
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
  const { nome, preco = 0, estoque = 0, vendePorGramas: bodyVpg } = req.body || {}
  if (!nome) return res.status(400).json({ error: 'nome é obrigatório' })
  const nomeFinal = String(nome).trim()
  const fixo = PRODUTOS_FIXOS.some(
    (item) => normalizarNomeProduto(item) === normalizarNomeProduto(nomeFinal)
  )
  const vendePorGramas = fixo === true ? false : bodyVpg === true

  const novo = {
    nome: nomeFinal,
    preco: fixo ? 0 : Number(preco) || 0,
    estoque: Math.max(0, Number(estoque) || 0),
    fixo,
    vendePorGramas,
    created_at: new Date().toISOString(),
  }
  const ref = await produtosCol.add(novo)
  const novoDoc = await ref.get()
  res.status(201).json(docToEntity(novoDoc))
})

app.put('/produtos/:id', async (req, res) => {
  const { id } = req.params
  const { nome, preco, estoque, vendePorGramas } = req.body || {}

  const ref = produtosCol.doc(String(id))
  const snap = await ref.get()
  if (!snap.exists) return res.status(404).json({ error: 'Produto não encontrado' })
  const atual = snap.data() || {}
  const nomeAtual = String(atual.nome || '').trim()
  const nomeNovo = nome !== undefined ? String(nome).trim() : nomeAtual
  if (atual.fixo === true && normalizarNomeProduto(nomeNovo) !== normalizarNomeProduto(nomeAtual)) {
    return res.status(400).json({ error: 'Produto fixo não pode ter o nome alterado' })
  }

  const payloadUpdate = {
    nome: nomeNovo,
    preco:
      atual.fixo === true
        ? 0
        : preco !== undefined
          ? Number(preco) || 0
          : Number(atual.preco || 0),
    estoque:
      estoque !== undefined
        ? Math.max(0, Number(estoque) || 0)
        : Math.max(0, Number(atual.estoque || 0)),
    updated_at: new Date().toISOString(),
  }
  if (atual.fixo !== true && vendePorGramas !== undefined) {
    payloadUpdate.vendePorGramas = vendePorGramas === true
  }

  await ref.update(payloadUpdate)

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

app.patch('/estoque/limpar-nao-fixos', async (req, res) => {
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
      return res.status(403).json({ error: 'Apenas admin pode limpar o estoque' })
    }

    const snap = await produtosCol.where('fixo', '!=', true).get()
    if (snap.empty) return res.json({ sucesso: true, atualizados: 0 })

    const lote = db.batch()
    const agora = new Date().toISOString()
    for (const doc of snap.docs) {
      lote.update(doc.ref, {
        estoque: 0,
        updated_at: agora,
      })
    }
    await lote.commit()

    return res.json({ sucesso: true, atualizados: snap.size })
  } catch (error) {
    return res.status(500).json({ sucesso: false, error: error.message || 'Falha ao limpar estoque' })
  }
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
      const data = doc.data() || {}
      const numero = normalizarNumeroComanda(data.numero_comanda)
      lote.delete(doc.ref)
      if (numero) lote.delete(comandasAtivasCol.doc(numero))
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
  const numeroFormatado = normalizarNumeroComanda(numero)
  if (!numeroFormatado) {
    return res.status(400).json({ error: 'numeroComanda deve estar entre 1 e 100' })
  }
  const numerosEmUso = await listarNumerosComandasEmUso()
  if (numerosEmUso.has(numeroFormatado)) {
    const proximaDisponivel = getProximaComandaDisponivel(numerosEmUso)
    const mensagemBase = `Comanda ${numeroFormatado} já está em uso`
    const mensagem = proximaDisponivel
      ? `${mensagemBase}. Use a próxima disponível: ${proximaDisponivel}.`
      : `${mensagemBase}. Não há comandas disponíveis no momento.`
    return res.status(409).json({ error: mensagem, proximaDisponivel })
  }
  const identificacao = `Comanda ${numeroFormatado}`
  const nova = {
    numero_comanda: numeroFormatado,
    cliente: null,
    identificacao,
    status: 'aberta',
    total: 0,
    itens: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  try {
    let criada = null
    await db.runTransaction(async (trx) => {
      const lockRef = comandasAtivasCol.doc(numeroFormatado)
      const lockDoc = await trx.get(lockRef)
      if (lockDoc.exists) {
        throw new Error(`Comanda ${numeroFormatado} já está em uso`)
      }

      const comandaRef = comandasCol.doc()
      trx.set(comandaRef, nova)
      trx.set(lockRef, {
        numero_comanda: numeroFormatado,
        comandaId: comandaRef.id,
        status: 'aberta',
        created_at: new Date().toISOString(),
      })

      criada = { id: comandaRef.id, ...nova }
    })

    return res.status(201).json(criada)
  } catch (error) {
    if (String(error?.message || '').includes('já está em uso')) {
      const usados = await listarNumerosComandasEmUso()
      const proximaDisponivel = getProximaComandaDisponivel(usados)
      const mensagem = proximaDisponivel
        ? `Comanda ${numeroFormatado} já está em uso. Use a próxima disponível: ${proximaDisponivel}.`
        : `Comanda ${numeroFormatado} já está em uso. Não há comandas disponíveis no momento.`
      return res.status(409).json({ error: mensagem, proximaDisponivel })
    }
    return res.status(500).json({ error: error.message || 'Falha ao criar comanda' })
  }
})

app.post('/comandas/:id/itens', async (req, res) => {
  const comandaId = String(req.params.id)
  const { produtoId } = req.body || {}

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

  const resultado = montarItemLinhaProduto(produto, req.body || {})
  if (resultado.erro) return res.status(400).json({ error: resultado.erro })
  const { item, estoqueNecessario } = resultado
  if (estoqueDisponivelParaVenda(produto) < estoqueNecessario) {
    return res.status(400).json({ error: 'Estoque insuficiente' })
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
    if (item.unidadeMedida === 'gramas') {
      return res.status(400).json({
        error:
          'Itens por peso (gramas) não permitem alterar a quantidade aqui. Remova o item e adicione novamente com o peso desejado.',
      })
    }
    if (item.valorManualTotal === true) {
      return res.status(400).json({ error: 'Item de valor total não permite alterar quantidade' })
    }
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
  await liberarComandaAtivaPorNumero(comanda.numero_comanda)

  const vendaDoc = await vendaRef.get()
  res.json(docToEntity(vendaDoc))
})

app.post('/financeiro/sessao', (req, res) => {
  if (!FIN_MARIA_SENHA) {
    return res.status(503).json({
      error: 'Senha não configurada: defina FINANCEIRO_MARIA_SENHA no servidor.',
    })
  }
  const senha = String(req.body?.senha ?? '')
  if (!senha || senha !== FIN_MARIA_SENHA) {
    return res.status(401).json({ error: 'Senha incorreta.' })
  }
  const criado = criarTokenSessaoFinanceiro()
  res.json({ token: criado.token, expiresAt: criado.expiresAt })
})

app.get('/caixa/historico', exigirSessaoFinanceiro, async (_, res) => {
  const vendas = await listarVendasHistorico()
  res.json(vendas)
})

app.get('/caixa/status', async (_, res) => {
  try {
    const status = await virarCaixaAutomaticamenteSeNecessario()
    res.json(status)
  } catch (err) {
    responderErroFirestore(res, err)
  }
})

app.get('/caixa/totais-hoje', async (_, res) => {
  try {
    const caixaAtual = await virarCaixaAutomaticamenteSeNecessario()
    const vendasBase = await listarVendasParaTotaisCaixa(caixaAtual)
    const totais = somarTotais(vendasBase)
    const totalSangrias = caixaAtual.caixaId ? await getTotalSangriasDoCaixa(caixaAtual.caixaId) : 0
    const dinheiroLiquido = Number(totais.totalDinheiro || 0) - Number(totalSangrias || 0)
    res.json({ ...totais, totalSangrias, dinheiroLiquido, caixaId: caixaAtual.caixaId || null, vendasHoje: vendasBase })
  } catch (err) {
    responderErroFirestore(res, err)
  }
})

app.post('/caixa/abrir', async (req, res) => {
  const { valorInicial } = req.body || {}
  const caixaAtual = await getCaixaStatus()
  if (caixaAtual.aberto) return res.status(400).json({ error: 'Caixa já está aberto' })

  const nowDate = new Date()
  const now = nowDate.toISOString()
  const dataViradaAtual = obterDataAlvoVirada(nowDate)
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
    ultimaViradaCaixaEm: now,
    ultimaViradaCaixaData: dataViradaAtual,
    updated_at: now,
  })

  res.json({ sucesso: true, caixaId: caixaRef.id })
})

app.post('/caixa/fechar', async (req, res) => {
  const { valorContado } = req.body || {}
  const caixaAtual = await getCaixaStatus()
  if (!caixaAtual.aberto) return res.status(400).json({ error: 'Caixa já está fechado' })

  const caixaId = caixaAtual.caixaId || null
  const vendasBase = caixaId ? await listarVendasDoCaixa(caixaId) : await listarVendasDesde(isoInicioCalendarioSp())
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

  let comandasResetadas = 0
  let avisoComandas = null
  try {
    comandasResetadas = await resetarComandasParaNovoDia()
  } catch (err) {
    console.error('Erro ao resetar comandas (quota Firestore?):', err?.message || err)
    avisoComandas = 'Caixa fechado, mas não foi possível resetar comandas. Cota Firestore pode ter sido excedida.'
  }

  const fechamentoDoc = await fechamentoRef.get()
  res.json({
    sucesso: true,
    fechamento: docToEntity(fechamentoDoc),
    comandasResetadas,
    avisoComandas,
  })
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
  const { produtoId } = req.body || {}

  const vendaRef = vendasCol.doc(String(id))
  const vendaDoc = await vendaRef.get()
  if (!vendaDoc.exists) return res.status(404).json({ error: 'Venda não encontrada' })
  const venda = docToEntity(vendaDoc)

  const produtoRef = produtosCol.doc(String(produtoId))
  const produtoDoc = await produtoRef.get()
  if (!produtoDoc.exists) return res.status(404).json({ error: 'Produto não encontrado' })
  const produto = docToEntity(produtoDoc)

  const resultado = montarItemLinhaProduto(produto, req.body || {})
  if (resultado.erro) return res.status(400).json({ error: resultado.erro })
  const { item, estoqueNecessario } = resultado
  if (estoqueDisponivelParaVenda(produto) < estoqueNecessario) {
    return res.status(400).json({ error: 'Estoque insuficiente' })
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

app.post('/vendas/:id/cancelar', async (req, res) => {
  const { id } = req.params
  const vendaRef = vendasCol.doc(String(id))
  const vendaDoc = await vendaRef.get()
  if (!vendaDoc.exists) return res.status(404).json({ error: 'Venda não encontrada' })
  const venda = docToEntity(vendaDoc)
  if (venda.cancelada === true) {
    return res.status(400).json({ error: 'Venda já cancelada' })
  }

  for (const item of venda.itens || []) {
    const produtoId = item.produtoId || item.produto_id
    const produtoRef = produtosCol.doc(String(produtoId))
    const produtoDoc = await produtoRef.get()
    if (!produtoDoc.exists) continue
    const produto = docToEntity(produtoDoc)
    if (!produtoEhFixo(produto)) {
      const qtd = item.unidadeMedida === 'gramas'
        ? Number(item.pesoGramas || 0)
        : Number(item.quantidade || 0)
      await produtoRef.update({
        estoque: Math.max(0, Number(produto.estoque || 0) + Math.max(0, qtd)),
        updated_at: new Date().toISOString(),
      })
    }
  }

  await vendaRef.update({
    cancelada: true,
    canceladaEm: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })

  const canceladaDoc = await vendaRef.get()
  return res.json({ sucesso: true, venda: docToEntity(canceladaDoc) })
})

app.get('/dashboard/resumo', async (_, res) => {
  try {
  const produtosSnap = await produtosCol.get()
  const comandasAbertasSnap = await comandasCol.where('status', '==', 'aberta').get()
  const comandasAguardandoSnap = await comandasCol.where('status', '==', 'aguardando_pagamento').get()
  const caixaAtual = await virarCaixaAutomaticamenteSeNecessario()
  const vendasHoje = await listarVendasParaTotaisCaixa(caixaAtual)
  const totaisHoje = somarTotais(vendasHoje)
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
    totalHistorico: 0,
    totalVendas: vendasHoje.length,
    caixaAberto: caixaAtual.aberto,
    estoqueBaixo,
    produtosEstoqueBaixo: produtosEstoqueBaixo.map((p) => ({
      id: p.id,
      nome: p.nome,
      estoque: Number(p.estoque || 0),
    })),
  })
  } catch (err) {
    responderErroFirestore(res, err)
  }
})

app.use((err, _req, res, next) => {
  if (erroFirestoreQuota(err)) {
    return res.status(503).json({
      error:
        'Cota do Firestore excedida. Verifique uso no Firebase Console ou aguarde a renovação da cota.',
    })
  }
  next(err)
})

process.on('unhandledRejection', (reason) => {
  if (erroFirestoreQuota(reason)) {
    console.warn('[firestore] Cota excedida em operação assíncrona:', reason?.message || reason)
    return
  }
  console.error('[unhandledRejection]', reason)
})

const port = Number(process.env.PORT || 3001)
app.listen(port, () => {
  console.log(`API rodando na porta ${port}`)
  console.log('Banco: Firestore')
  executarSeedInicial()
})

/**
 * Gera relatório mensal do caixa (vendas + fechamentos) direto do Firestore.
 *
 * Uso (na pasta backend, com .env configurado):
 *   node scripts/relatorio-caixa-mes.js
 *   node scripts/relatorio-caixa-mes.js 2026 5
 *
 * Saída em: backend/relatorios/relatorio-caixa-AAAA-MM.html e .csv
 */
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TZ = 'America/Sao_Paulo'

function normalizarPrivateKey(rawKey) {
  if (!rawKey) return ''
  let key = String(rawKey).trim()
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1)
  }
  return key.replace(/\\n/g, '\n')
}

function initDb() {
  if (getApps().length === 0) {
    const projectId = process.env.FIREBASE_PROJECT_ID
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
    const privateKey = normalizarPrivateKey(process.env.FIREBASE_PRIVATE_KEY)
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'Defina FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY no .env'
      )
    }
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    })
  }
  return getFirestore()
}

function somarTotais(vendas = []) {
  const ativas = vendas.filter((v) => v?.cancelada !== true)
  const totalDinheiro = ativas
    .filter((v) => String(v.metodoPagamento || '').toLowerCase().includes('dinheiro'))
    .reduce((acc, v) => acc + Number(v.total || 0), 0)
  const totalCartao = ativas
    .filter((v) => String(v.metodoPagamento || '').toLowerCase().includes('cart'))
    .reduce((acc, v) => acc + Number(v.total || 0), 0)
  const totalPix = ativas
    .filter((v) => String(v.metodoPagamento || '').toLowerCase().includes('pix'))
    .reduce((acc, v) => acc + Number(v.total || 0), 0)
  return {
    totalDinheiro,
    totalCartao,
    totalPix,
    totalGeral: totalDinheiro + totalCartao + totalPix,
    qtdVendas: ativas.length,
    qtdCanceladas: vendas.length - ativas.length,
  }
}

function parseArgs() {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const anoAtual = Number(parts.find((p) => p.type === 'year')?.value)
  const mesAtual = Number(parts.find((p) => p.type === 'month')?.value)

  const ano = Number(process.argv[2]) || anoAtual
  const mes = Number(process.argv[3]) || mesAtual
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new Error('Uso: node scripts/relatorio-caixa-mes.js [ano] [mes]  (ex: 2026 5)')
  }
  return { ano, mes }
}

function intervaloMesIso(ano, mes) {
  const pad = (n) => String(n).padStart(2, '0')
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const desde = new Date(`${ano}-${pad(mes)}-01T00:00:00-03:00`).toISOString()
  const ate = new Date(`${ano}-${pad(mes)}-${pad(ultimoDia)}T23:59:59.999-03:00`).toISOString()
  return { desde, ate, ultimoDia }
}

function nomeMes(ano, mes) {
  const pad = (n) => String(n).padStart(2, '0')
  return new Date(`${ano}-${pad(mes)}-15T12:00:00-03:00`).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: TZ,
  })
}

function formatarData(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatarMoeda(n) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function chaveDia(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: TZ })
}

function docData(doc) {
  return { id: doc.id, ...doc.data() }
}

async function carregarVendas(db, desde, ate) {
  const snap = await db
    .collection('vendas')
    .where('data', '>=', desde)
    .where('data', '<=', ate)
    .orderBy('data', 'asc')
    .get()
  return snap.docs.map(docData)
}

async function carregarFechamentos(db, desde, ate) {
  const snap = await db
    .collection('caixa_fechamentos')
    .where('data', '>=', desde)
    .where('data', '<=', ate)
    .orderBy('data', 'asc')
    .get()
  return snap.docs.map(docData)
}

function agruparPorDia(vendas) {
  const map = new Map()
  for (const v of vendas) {
    const dia = chaveDia(v.data)
    if (!map.has(dia)) map.set(dia, [])
    map.get(dia).push(v)
  }
  return [...map.entries()].sort((a, b) => {
    const [da] = a[0].split('/').map(Number)
    const [db] = b[0].split('/').map(Number)
    return new Date(db[2], db[1] - 1, db[0]) - new Date(da[2], da[1] - 1, da[0])
  })
}

function gerarCsv({ ano, mes, vendas, fechamentos, totais }) {
  const linhas = [
    `Relatório de caixa;${nomeMes(ano, mes)}`,
    `Gerado em;${formatarData(new Date().toISOString())}`,
    '',
    'RESUMO DO MÊS',
    'Total geral', formatarMoeda(totais.totalGeral),
    'Dinheiro', formatarMoeda(totais.totalDinheiro),
    'Cartão', formatarMoeda(totais.totalCartao),
    'PIX', formatarMoeda(totais.totalPix),
    'Vendas ativas', String(totais.qtdVendas),
    'Vendas canceladas', String(totais.qtdCanceladas),
    'Fechamentos de caixa', String(fechamentos.length),
    '',
    'VENDAS POR DIA',
    'Data;Hora;Identificação;Pagamento;Total;Cancelada',
  ]

  for (const v of vendas) {
    const [data, hora] = formatarData(v.data).split(', ')
    linhas.push(
      [
        data || chaveDia(v.data),
        hora || '',
        (v.identificacao || '-').replace(/;/g, ','),
        v.metodoPagamento || '-',
        Number(v.total || 0).toFixed(2).replace('.', ','),
        v.cancelada ? 'Sim' : 'Não',
      ].join(';')
    )
  }

  linhas.push('', 'FECHAMENTOS DE CAIXA')
  linhas.push(
    'Data;Valor inicial;Dinheiro;Cartão;PIX;Sangrias;Dinheiro líquido;Contado;Diferença'
  )
  for (const f of fechamentos) {
    linhas.push(
      [
        formatarData(f.data),
        Number(f.valorInicial || 0).toFixed(2).replace('.', ','),
        Number(f.totalDinheiro || 0).toFixed(2).replace('.', ','),
        Number(f.totalCartao || 0).toFixed(2).replace('.', ','),
        Number(f.totalPix || 0).toFixed(2).replace('.', ','),
        Number(f.totalSangrias || 0).toFixed(2).replace('.', ','),
        Number(f.dinheiroLiquido || 0).toFixed(2).replace('.', ','),
        Number(f.valorContado || 0).toFixed(2).replace('.', ','),
        Number(f.diferenca || 0).toFixed(2).replace('.', ','),
      ].join(';')
    )
  }

  return linhas.join('\n')
}

function gerarHtml({ ano, mes, vendas, fechamentos, totais, porDia }) {
  const titulo = `Relatório de Caixa — ${nomeMes(ano, mes)}`
  const diasHtml = porDia
    .map(([dia, lista]) => {
      const t = somarTotais(lista)
      const linhas = lista
        .map(
          (v) => `
        <tr class="${v.cancelada ? 'cancelada' : ''}">
          <td>${formatarData(v.data).split(', ')[1] || '-'}</td>
          <td>${v.identificacao || '-'}</td>
          <td>${v.metodoPagamento || '-'}</td>
          <td class="num">${formatarMoeda(v.total)}</td>
          <td>${v.cancelada ? 'Sim' : 'Não'}</td>
        </tr>`
        )
        .join('')
      return `
      <section class="dia">
        <h3>${dia} — ${lista.length} venda(s) — total ${formatarMoeda(t.totalGeral)}</h3>
        <table>
          <thead><tr><th>Hora</th><th>Identificação</th><th>Pagamento</th><th>Total</th><th>Cancelada</th></tr></thead>
          <tbody>${linhas}</tbody>
        </table>
      </section>`
    })
    .join('')

  const fechamentosHtml =
    fechamentos.length === 0
      ? '<p class="vazio">Nenhum fechamento formal registrado neste mês.</p>'
      : `<table>
      <thead>
        <tr>
          <th>Data/hora</th><th>Inicial</th><th>Dinheiro</th><th>Cartão</th><th>PIX</th>
          <th>Sangrias</th><th>Líquido</th><th>Contado</th><th>Diferença</th>
        </tr>
      </thead>
      <tbody>
        ${fechamentos
          .map(
            (f) => `
          <tr>
            <td>${formatarData(f.data)}</td>
            <td class="num">${formatarMoeda(f.valorInicial)}</td>
            <td class="num">${formatarMoeda(f.totalDinheiro)}</td>
            <td class="num">${formatarMoeda(f.totalCartao)}</td>
            <td class="num">${formatarMoeda(f.totalPix)}</td>
            <td class="num">${formatarMoeda(f.totalSangrias)}</td>
            <td class="num">${formatarMoeda(f.dinheiroLiquido)}</td>
            <td class="num">${formatarMoeda(f.valorContado)}</td>
            <td class="num ${f.diferenca === 0 ? 'ok' : f.diferenca > 0 ? 'mais' : 'menos'}">${formatarMoeda(f.diferenca)}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${titulo}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; color: #292524; margin: 0; padding: 24px; max-width: 960px; margin: 0 auto; }
    h1 { color: #92400e; font-size: 1.5rem; margin-bottom: 0.25rem; }
    .meta { color: #78716c; font-size: 0.9rem; margin-bottom: 24px; }
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 28px; }
    .card { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px; padding: 14px; }
    .card label { display: block; font-size: 0.75rem; color: #78716c; text-transform: uppercase; letter-spacing: 0.04em; }
    .card strong { font-size: 1.15rem; color: #92400e; }
    h2 { color: #92400e; font-size: 1.1rem; border-bottom: 2px solid #fcd34d; padding-bottom: 6px; margin-top: 32px; }
    h3 { font-size: 1rem; color: #b45309; margin: 20px 0 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-bottom: 8px; }
    th, td { border: 1px solid #e7e5e4; padding: 8px 10px; text-align: left; }
    th { background: #fef3c7; color: #92400e; }
    tr.cancelada td { color: #a8a29e; text-decoration: line-through; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .ok { color: #15803d; } .mais { color: #1d4ed8; } .menos { color: #b91c1c; }
    .vazio { color: #78716c; font-style: italic; }
    .nota { font-size: 0.8rem; color: #78716c; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e7e5e4; }
    @media print { body { padding: 12px; } .dia { break-inside: avoid; } }
  </style>
</head>
<body>
  <h1>Padaria Grande Família</h1>
  <p class="meta">${titulo}<br/>Gerado em ${formatarData(new Date().toISOString())} (horário de Brasília)</p>

  <div class="cards">
    <div class="card"><label>Total do mês</label><strong>${formatarMoeda(totais.totalGeral)}</strong></div>
    <div class="card"><label>Dinheiro</label><strong>${formatarMoeda(totais.totalDinheiro)}</strong></div>
    <div class="card"><label>Cartão</label><strong>${formatarMoeda(totais.totalCartao)}</strong></div>
    <div class="card"><label>PIX</label><strong>${formatarMoeda(totais.totalPix)}</strong></div>
    <div class="card"><label>Vendas</label><strong>${totais.qtdVendas}</strong></div>
    <div class="card"><label>Dias com venda</label><strong>${porDia.length}</strong></div>
    <div class="card"><label>Fechamentos</label><strong>${fechamentos.length}</strong></div>
  </div>

  <h2>Fechamentos de caixa no mês</h2>
  ${fechamentosHtml}

  <h2>Vendas por dia</h2>
  ${porDia.length === 0 ? '<p class="vazio">Nenhuma venda registrada neste mês.</p>' : diasHtml}

  <p class="nota">
    Documento gerado diretamente do banco de dados (Firestore). Reflete o que foi registrado no sistema de comandas.
    Vendas canceladas aparecem riscadas e não entram nos totais.
  </p>
</body>
</html>`
}

async function main() {
  const { ano, mes } = parseArgs()
  const { desde, ate } = intervaloMesIso(ano, mes)
  const db = initDb()

  console.log(`Buscando vendas e fechamentos: ${nomeMes(ano, mes)}...`)

  let vendas = []
  let fechamentos = []
  try {
    ;[vendas, fechamentos] = await Promise.all([
      carregarVendas(db, desde, ate),
      carregarFechamentos(db, desde, ate),
    ])
  } catch (err) {
    const msg = String(err?.message || err)
    if (/RESOURCE_EXHAUSTED|Quota exceeded/i.test(msg) || err?.code === 8) {
      console.error(
        '\nCota do Firestore ainda excedida. Tente de novo em alguns minutos ou exporte pelo Firebase Console.'
      )
      process.exit(1)
    }
    throw err
  }

  const totais = somarTotais(vendas)
  const porDia = agruparPorDia(vendas)
  const slug = `${ano}-${String(mes).padStart(2, '0')}`
  const outDir = path.join(__dirname, '..', 'relatorios')
  fs.mkdirSync(outDir, { recursive: true })

  const base = path.join(outDir, `relatorio-caixa-${slug}`)
  const htmlPath = `${base}.html`
  const csvPath = `${base}.csv`

  fs.writeFileSync(htmlPath, gerarHtml({ ano, mes, vendas, fechamentos, totais, porDia }), 'utf8')
  fs.writeFileSync(
    csvPath,
    '\uFEFF' + gerarCsv({ ano, mes, vendas, fechamentos, totais }),
    'utf8'
  )

  console.log('\nRelatório gerado:')
  console.log('  HTML:', htmlPath)
  console.log('  CSV: ', csvPath)
  console.log('\nResumo:')
  console.log('  Vendas:', totais.qtdVendas, '| Total:', formatarMoeda(totais.totalGeral))
  console.log('  Dias com movimento:', porDia.length, '| Fechamentos:', fechamentos.length)
  console.log('\nAbra o HTML no navegador e use Ctrl+P para salvar em PDF.')
}

main().catch((err) => {
  console.error('Erro:', err?.message || err)
  process.exit(1)
})

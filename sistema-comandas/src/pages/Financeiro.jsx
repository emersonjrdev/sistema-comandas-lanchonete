import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import {
  limparSessaoFinanceiro,
  sessaoFinanceiroValida,
  solicitarSessaoFinanceiro,
} from '../services/financeiroAccess'
import { getCaixaHistorico } from '../services/storage'
import { formatarMoedaBRL } from '../utils/moeda'

/** Alinhado ao backend: dia operacional inicia logo após 20h30 (America/Sao_Paulo). */
const HORA_VIRADA_CAIXA_TEXTO = '20h30 (horário de Brasília / São Paulo)'

function formatarData(dataStr) {
  if (!dataStr) return '-'
  const d = new Date(dataStr)
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function agruparPorDia(vendas) {
  const grupos = {}
  vendas.forEach((v) => {
    if (v?.cancelada === true) return
    const data = formatarData(v.data)
    if (!grupos[data]) grupos[data] = { data, vendas: [], total: 0 }
    grupos[data].vendas.push(v)
    grupos[data].total += v.total || 0
  })
  return Object.values(grupos).sort(
    (a, b) => new Date(b.vendas[0]?.data) - new Date(a.vendas[0]?.data)
  )
}

export default function Financeiro() {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const [sessaoOk, setSessaoOk] = useState(() => sessaoFinanceiroValida())

  const [vendas, setVendas] = useState([])
  const [carregando, setCarregando] = useState(() => sessaoFinanceiroValida())
  const [senhaFinanceiro, setSenhaFinanceiro] = useState('')
  const [enviandoSenha, setEnviandoSenha] = useState(false)

  const carregarHistorico = useCallback(async () => {
    if (!sessaoFinanceiroValida()) {
      setSessaoOk(false)
      setVendas([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    try {
      const lista = await getCaixaHistorico()
      const ativas = (lista || []).filter((v) => v?.cancelada !== true)
      setVendas(ativas)
      setSessaoOk(true)
    } catch (err) {
      const msg = String(err?.message || '')
      setVendas([])
      if (/403|financeiro não desbloqueado|não autorizado|financeiro não configurado|503/i.test(msg)) {
        limparSessaoFinanceiro()
        setSessaoOk(false)
      }
      if (!/financeiro não desbloqueado/i.test(msg)) {
        toast.show(msg || 'Não foi possível carregar o financeiro.', 'error')
      }
    } finally {
      setCarregando(false)
    }
  }, [toast])

  const dadosResumo = useMemo(() => {
    const ativas = vendas.filter((v) => v?.cancelada !== true)
    const total = ativas.reduce((acc, v) => acc + (v.total || 0), 0)
    const porDia = agruparPorDia(ativas)
    return { faturamentoTotal: total, grupos: porDia, qtdVendas: ativas.length }
  }, [vendas])

  useEffect(() => {
    if (!sessaoOk || !sessaoFinanceiroValida()) return undefined
    carregarHistorico().catch(() => {})
    window.addEventListener('pdv:storage-update', carregarHistorico)
    return () => window.removeEventListener('pdv:storage-update', carregarHistorico)
  }, [sessaoOk, carregarHistorico])

  async function handleDesbloquear(e) {
    e.preventDefault()
    if (!senhaFinanceiro.trim() || enviandoSenha) return
    setEnviandoSenha(true)
    try {
      await solicitarSessaoFinanceiro(senhaFinanceiro)
      setSenhaFinanceiro('')
      setSessaoOk(true)
      toast.show('Painel Financeiro autorizado.')
    } catch (err) {
      const msg = String(err?.message || 'Senha incorreta.')
      toast.show(msg, 'error')
    } finally {
      setEnviandoSenha(false)
    }
  }

  function handleEncerrarAcessoFinanceiro() {
    limparSessaoFinanceiro()
    setSessaoOk(false)
    setVendas([])
    toast.show('Sessão do financeiro encerrada neste dispositivo.')
  }

  if (!isAdmin) return <Navigate to="/" replace />

  const { faturamentoTotal, grupos, qtdVendas } = dadosResumo

  if (!sessaoOk || !sessaoFinanceiroValida()) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <h2 className="text-2xl font-bold text-amber-900">Financeiro — acesso restrito</h2>
        <div className="rounded-xl border-2 border-amber-300 bg-white p-5 shadow-sm">
          <p className="text-sm leading-relaxed text-stone-700">
            Só quem souber a <span className="font-semibold">senha exclusiva da Maria</span> vê valores e
            histórico aqui neste navegador. O total geral também foi removido do Dashboard.
          </p>
          <form className="mt-4 space-y-3" onSubmit={handleDesbloquear}>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
              Senha Maria
              <input
                type="password"
                autoComplete="off"
                value={senhaFinanceiro}
                onChange={(e) => setSenhaFinanceiro(e.target.value)}
                placeholder="Informe a senha"
                className="mt-1 w-full rounded-lg border border-amber-200 px-3 py-2 text-sm text-amber-950 outline-none focus:border-amber-500"
              />
            </label>
            <button
              type="submit"
              disabled={enviandoSenha}
              className="w-full rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
            >
              {enviandoSenha ? 'Verificando…' : 'Entrar no Financeiro'}
            </button>
          </form>
        </div>
        <p className="text-center text-[11px] text-stone-500">
          O administrador deve definir FINANCEIRO_MARIA_SENHA nas variáveis de ambiente do servidor.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-amber-900">Financeiro</h2>
          <p className="mt-1 text-sm text-stone-600">
            Histórico completo · <span className="font-semibold tabular-nums">{qtdVendas}</span> vendas{' '}
            listadas neste período autorizado neste navegador
          </p>
        </div>
        <button
          type="button"
          onClick={handleEncerrarAcessoFinanceiro}
          className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-50"
        >
          Encerrar acesso ao financeiro
        </button>
      </div>

      <aside
        className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 shadow-sm text-amber-950"
        aria-label="Senha Maria e sobre dia operacional"
      >
        <p className="text-sm font-semibold text-amber-950">Acesso e virada às {HORA_VIRADA_CAIXA_TEXTO}</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-relaxed text-amber-900/90">
          <li>
            Esta tela ficou apenas com Maria: use a senha exclusiva configurada pelo servidor como{' '}
            <span className="font-semibold">FINANCEIRO_MARIA_SENHA</span>.
          </li>
          <li>
            Às <span className="font-semibold">{HORA_VIRADA_CAIXA_TEXTO}</span>, fecha o período atual do caixa nos
            totais do dia — o Dashboard e o Caixa passam ao “novo dia”, mas os registros seguem aparecendo neste histórico.
          </li>
        </ul>
      </aside>

      <div className="rounded-xl bg-white border-2 border-amber-200 p-4 shadow-sm md:p-6">
        <p className="text-sm font-medium text-stone-500 mb-1">
          Faturamento total — todo o histórico (lista abaixo)
        </p>
        <p className="text-2xl font-bold text-amber-800 tabular-nums">
          {carregando ? '…' : formatarMoedaBRL(faturamentoTotal)}
        </p>
      </div>

      <div>
        <h3 className="mb-1 text-lg font-semibold text-amber-900">Histórico de vendas por dia</h3>
        <p className="mb-4 text-xs text-stone-500">
          Agrupado pela data registrada na venda (fuso local do navegador). Dias mais recentes primeiro.
        </p>
        {carregando ? (
          <div className="rounded-xl border-2 border-dashed border-amber-200 bg-white py-12 text-center">
            <p className="text-stone-500">Carregando histórico…</p>
          </div>
        ) : grupos.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-amber-200 bg-white py-12 text-center">
            <p className="text-stone-500">Nenhuma venda registrada.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {grupos.map((grupo) => (
              <div key={grupo.data} className="rounded-xl border-2 border-amber-200 bg-white p-4 shadow-sm md:p-6">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h4 className="text-lg font-bold text-amber-900">{grupo.data}</h4>
                  <p className="text-xl font-bold text-amber-800 tabular-nums">{formatarMoedaBRL(grupo.total)}</p>
                </div>
                <ul className="space-y-2">
                  {grupo.vendas.map((venda) => (
                    <li
                      key={venda.id}
                      className="flex flex-col gap-0.5 border-b border-amber-50 py-2 last:border-0 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-3"
                    >
                      <span className="min-w-0 text-stone-700">
                        {venda.identificacao}
                        {venda.metodoPagamento && (
                          <span className="ml-2 text-sm text-stone-500">({venda.metodoPagamento})</span>
                        )}
                      </span>
                      <span className="shrink-0 font-semibold text-amber-800 tabular-nums">
                        {formatarMoedaBRL(venda.total || 0)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

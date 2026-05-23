import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useRelatorios } from '../hooks/useRelatorios'
import { useToast } from '../contexts/ToastContext'
import { limparDadosCaixa } from '../services/caixaService'
import {
  limparSessaoFinanceiro,
  sessaoFinanceiroValida,
  solicitarSessaoFinanceiro,
} from '../services/financeiroAccess'
import { playSomErro, playSomVenda } from '../utils/sons'

function formatarData(dataStr) {
  if (!dataStr) return '-'
  const d = new Date(dataStr)
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function RelatorioCaixa() {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const [sessaoOk, setSessaoOk] = useState(() => sessaoFinanceiroValida())
  const [senhaFinanceiro, setSenhaFinanceiro] = useState('')
  const [enviandoSenha, setEnviandoSenha] = useState(false)
  const [relatorios, , refresh] = useRelatorios({ habilitado: sessaoOk && sessaoFinanceiroValida() })

  useEffect(() => {
    function handleAtalhoSecretoRelatorio(event) {
      if (!sessaoOk || !sessaoFinanceiroValida()) return
      if (event.ctrlKey && event.shiftKey && event.altKey && event.key === 'Backspace') {
        event.preventDefault()
        handleLimparDadosEscondido()
      }
    }

    window.addEventListener('keydown', handleAtalhoSecretoRelatorio)
    return () => window.removeEventListener('keydown', handleAtalhoSecretoRelatorio)
  }, [sessaoOk])

  if (!isAdmin) return <Navigate to="/comandas" replace />

  async function handleLimparDadosEscondido() {
    const confirmou = window.confirm(
      'Isso vai excluir o histórico de vendas e relatórios de fechamento do caixa. Deseja continuar?'
    )
    if (!confirmou) return

    const confirmouNovamente = window.confirm(
      'Confirma EXCLUIR os dados do caixa agora? Essa ação não pode ser desfeita.'
    )
    if (!confirmouNovamente) return

    const resultado = await limparDadosCaixa()
    if (resultado?.sucesso) {
      playSomVenda()
      await refresh()
      toast.show('Dados do caixa excluídos com sucesso!')
    } else {
      playSomErro()
      toast.show(resultado?.erro || 'Erro ao excluir dados do caixa', 'error')
    }
  }

  async function handleDesbloquear(e) {
    e.preventDefault()
    if (!senhaFinanceiro.trim() || enviandoSenha) return
    setEnviandoSenha(true)
    try {
      await solicitarSessaoFinanceiro(senhaFinanceiro)
      setSenhaFinanceiro('')
      setSessaoOk(true)
      toast.show('Relatório de caixa autorizado.')
    } catch (err) {
      toast.show(String(err?.message || 'Senha incorreta.'), 'error')
    } finally {
      setEnviandoSenha(false)
    }
  }

  function handleEncerrarAcesso() {
    limparSessaoFinanceiro()
    setSessaoOk(false)
    toast.show('Sessão do relatório encerrada neste dispositivo.')
  }

  if (!sessaoOk || !sessaoFinanceiroValida()) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <h2 className="text-2xl font-bold text-amber-900">Relatório de Caixa — acesso restrito</h2>
        <div className="rounded-xl border-2 border-amber-300 bg-white p-5 shadow-sm">
          <p className="text-sm leading-relaxed text-stone-700">
            Informe a senha de acesso para ver o histórico de fechamentos neste navegador.
          </p>
          <form className="mt-4 space-y-3" onSubmit={handleDesbloquear}>
            <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
              Senha
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
              {enviandoSenha ? 'Verificando…' : 'Entrar no Relatório'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  const ordenados = [...relatorios].sort((a, b) => new Date(b.data) - new Date(a.data))

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-amber-900">Relatório de Caixa</h2>
          <p className="mt-1 text-stone-600">
            Histórico de fechamentos de caixa com totais por método de pagamento.
          </p>
        </div>
        <button
          type="button"
          onClick={handleEncerrarAcesso}
          className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-50"
        >
          Encerrar acesso
        </button>
      </div>

      {ordenados.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-xl border-2 border-dashed border-amber-200">
          <p className="text-stone-500">Nenhum fechamento de caixa registrado.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {ordenados.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-xl border-2 border-amber-200 p-4 md:p-6 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-4">
                <h3 className="text-lg font-bold text-amber-900">{formatarData(r.data)}</h3>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    r.diferenca === 0
                      ? 'bg-green-100 text-green-800'
                      : r.diferenca > 0
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-red-100 text-red-800'
                  }`}
                >
                  Diferença: R$ {r.diferenca.toFixed(2)}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-stone-500">Valor inicial</p>
                  <p className="font-bold tabular-nums">R$ {(r.valorInicial || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-stone-500">Total dinheiro</p>
                  <p className="font-bold tabular-nums">R$ {(r.totalDinheiro || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-stone-500">Total cartão</p>
                  <p className="font-bold tabular-nums">R$ {(r.totalCartao || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-stone-500">Total PIX</p>
                  <p className="font-bold tabular-nums">R$ {(r.totalPix || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-stone-500">Total sangrias</p>
                  <p className="font-bold tabular-nums">R$ {(r.totalSangrias || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-stone-500">Dinheiro líquido</p>
                  <p className="font-bold tabular-nums">R$ {(r.dinheiroLiquido || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-stone-500">Valor contado</p>
                  <p className="font-bold tabular-nums">R$ {(r.valorContado || 0).toFixed(2)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { getRelatorioMensalCaixa } from '../services/caixaService'
import { formatarMoedaBRL } from '../utils/moeda'

const MESES = [
  { valor: 1, nome: 'Janeiro' },
  { valor: 2, nome: 'Fevereiro' },
  { valor: 3, nome: 'Março' },
  { valor: 4, nome: 'Abril' },
  { valor: 5, nome: 'Maio' },
  { valor: 6, nome: 'Junho' },
  { valor: 7, nome: 'Julho' },
  { valor: 8, nome: 'Agosto' },
  { valor: 9, nome: 'Setembro' },
  { valor: 10, nome: 'Outubro' },
  { valor: 11, nome: 'Novembro' },
  { valor: 12, nome: 'Dezembro' },
]

function periodoAtualSp() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date())
  return {
    ano: Number(parts.find((p) => p.type === 'year')?.value),
    mes: Number(parts.find((p) => p.type === 'month')?.value),
  }
}

function formatarGeradoEm(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function RelatorioDocumento() {
  const { isAdmin } = useAuth()
  const toast = useToast()
  const atual = periodoAtualSp()
  const [ano, setAno] = useState(atual.ano)
  const [mes, setMes] = useState(atual.mes)
  const [relatorio, setRelatorio] = useState(null)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const requisicaoSeq = useRef(0)
  const toastRef = useRef(toast)
  toastRef.current = toast

  const tituloMesSelecionado = useMemo(() => {
    const nome = MESES.find((m) => m.valor === mes)?.nome || String(mes)
    return `${nome} de ${ano}`
  }, [ano, mes])

  const relatorioDesatualizado =
    relatorio &&
    (relatorio.periodo?.ano !== ano || relatorio.periodo?.mes !== mes)

  const anosDisponiveis = useMemo(() => {
    const lista = []
    for (let a = atual.ano; a >= atual.ano - 2; a -= 1) lista.push(a)
    return lista
  }, [atual.ano])

  const carregar = useCallback(
    async (anoAlvo = ano, mesAlvo = mes) => {
      const seq = ++requisicaoSeq.current
      setCarregando(true)
      setErro('')
      try {
        const dados = await getRelatorioMensalCaixa(anoAlvo, mesAlvo)
        if (seq !== requisicaoSeq.current) return
        if (dados?.periodo?.ano !== anoAlvo || dados?.periodo?.mes !== mesAlvo) {
          throw new Error('Resposta da API não corresponde ao mês selecionado. Tente novamente.')
        }
        setRelatorio(dados)
      } catch (e) {
        if (seq !== requisicaoSeq.current) return
        setRelatorio(null)
        const msg = e?.message || 'Erro ao carregar relatório'
        setErro(msg)
        toastRef.current.show(msg, 'error')
      } finally {
        if (seq === requisicaoSeq.current) setCarregando(false)
      }
    },
    [ano, mes]
  )

  function aoMudarMes(novoMes) {
    setMes(novoMes)
    setRelatorio(null)
    setErro('')
  }

  function aoMudarAno(novoAno) {
    setAno(novoAno)
    setRelatorio(null)
    setErro('')
  }

  useEffect(() => {
    if (!isAdmin) return
    carregar(ano, mes)
  }, [isAdmin, ano, mes, carregar])

  function exportarPdf() {
    document.body.classList.add('print-relatorio-mensal')
    const limpar = () => document.body.classList.remove('print-relatorio-mensal')
    window.addEventListener('afterprint', limpar, { once: true })
    window.print()
  }

  if (!isAdmin) return <Navigate to="/comandas" replace />

  const totais = relatorio?.totais
  const dias = relatorio?.dias || []
  const fechamentos = relatorio?.fechamentos || []

  return (
    <div>
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-amber-900">Documento de uso do caixa</h2>
          <p className="text-stone-600 text-sm mt-1">
            Registro de vendas por dia e horário para apresentação. Exporte em PDF pelo navegador.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={mes}
            onChange={(e) => aoMudarMes(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border-2 border-amber-200 bg-white"
          >
            {MESES.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.nome}
              </option>
            ))}
          </select>
          <select
            value={ano}
            onChange={(e) => aoMudarAno(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border-2 border-amber-200 bg-white"
          >
            {anosDisponiveis.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={carregar}
            disabled={carregando}
            className="px-4 py-2 rounded-lg bg-amber-700 text-white font-semibold hover:bg-amber-800 disabled:opacity-60"
          >
            {carregando ? 'Carregando…' : 'Atualizar'}
          </button>
          <button
            type="button"
            onClick={exportarPdf}
            disabled={!relatorio || carregando || relatorioDesatualizado}
            className="px-4 py-2 rounded-lg bg-stone-800 text-white font-semibold hover:bg-stone-900 disabled:opacity-60"
          >
            Salvar PDF
          </button>
        </div>
      </div>

      {erro && (
        <div className="no-print mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
          {erro}
        </div>
      )}

      {relatorioDesatualizado && (
        <div className="no-print mb-4 p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-sm">
          Carregando relatório de <strong>{tituloMesSelecionado}</strong>…
        </div>
      )}

      {carregando && (
        <p className="no-print text-stone-600 py-4 text-center">
          Gerando documento de {tituloMesSelecionado}…
        </p>
      )}

      {relatorio && !relatorioDesatualizado && (
        <article className="relatorio-mensal-print bg-white rounded-xl border-2 border-amber-200 shadow-sm p-6 md:p-8 max-w-4xl mx-auto">
          <header className="text-center border-b-2 border-amber-200 pb-6 mb-6">
            <img
              src="/logo-padaria.png"
              alt="Padaria Grande Família"
              className="h-16 w-16 mx-auto mb-3 rounded-full object-contain"
            />
            <h1 className="text-xl md:text-2xl font-bold text-amber-900">Padaria Grande Família</h1>
            <p className="text-lg font-semibold text-amber-800 mt-2 capitalize">
              Relatório de uso do sistema — {relatorio.periodo?.label}
            </p>
            <p className="text-sm text-stone-500 mt-2">
              Documento gerado em {formatarGeradoEm(relatorio.geradoEm)} (horário de Brasília)
            </p>
            <p className="text-xs text-stone-500 mt-3 max-w-xl mx-auto leading-relaxed">
              Este relatório lista todas as vendas registradas no sistema de comandas no período,
              com data, horário, identificação da comanda e valor. Os totais refletem o que foi
              lançado e pago no caixa digital da padaria.
            </p>
          </header>

          <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
              <p className="text-xs text-stone-500 uppercase">Total do mês</p>
              <p className="text-lg font-bold text-amber-900 tabular-nums">
                {formatarMoedaBRL(totais?.totalGeral)}
              </p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
              <p className="text-xs text-stone-500 uppercase">Vendas</p>
              <p className="text-lg font-bold text-amber-900">{totais?.qtdVendas ?? 0}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
              <p className="text-xs text-stone-500 uppercase">Dias com venda</p>
              <p className="text-lg font-bold text-amber-900">{totais?.diasComVenda ?? 0}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
              <p className="text-xs text-stone-500 uppercase">Fechamentos</p>
              <p className="text-lg font-bold text-amber-900">{fechamentos.length}</p>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-base font-bold text-amber-900 mb-3">Totais por forma de pagamento</h2>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-stone-50 border border-stone-200">
                <span className="text-stone-500">Dinheiro</span>
                <p className="font-bold tabular-nums">{formatarMoedaBRL(totais?.totalDinheiro)}</p>
              </div>
              <div className="p-3 rounded-lg bg-stone-50 border border-stone-200">
                <span className="text-stone-500">Cartão</span>
                <p className="font-bold tabular-nums">{formatarMoedaBRL(totais?.totalCartao)}</p>
              </div>
              <div className="p-3 rounded-lg bg-stone-50 border border-stone-200">
                <span className="text-stone-500">PIX</span>
                <p className="font-bold tabular-nums">{formatarMoedaBRL(totais?.totalPix)}</p>
              </div>
            </div>
            {totais?.qtdCanceladas > 0 && (
              <p className="text-xs text-stone-500 mt-2">
                {totais.qtdCanceladas} venda(s) cancelada(s) no período (não entram nos totais).
              </p>
            )}
          </section>

          {fechamentos.length > 0 && (
            <section className="mb-8">
              <h2 className="text-base font-bold text-amber-900 mb-3">Fechamentos de caixa</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-amber-100 text-amber-900">
                      <th className="text-left p-2 border border-amber-200">Data/hora</th>
                      <th className="text-right p-2 border border-amber-200">Dinheiro</th>
                      <th className="text-right p-2 border border-amber-200">Cartão</th>
                      <th className="text-right p-2 border border-amber-200">PIX</th>
                      <th className="text-right p-2 border border-amber-200">Contado</th>
                      <th className="text-right p-2 border border-amber-200">Diferença</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fechamentos.map((f) => (
                      <tr key={f.id}>
                        <td className="p-2 border border-stone-200">{f.dataFormatada}</td>
                        <td className="p-2 border border-stone-200 text-right tabular-nums">
                          {formatarMoedaBRL(f.totalDinheiro)}
                        </td>
                        <td className="p-2 border border-stone-200 text-right tabular-nums">
                          {formatarMoedaBRL(f.totalCartao)}
                        </td>
                        <td className="p-2 border border-stone-200 text-right tabular-nums">
                          {formatarMoedaBRL(f.totalPix)}
                        </td>
                        <td className="p-2 border border-stone-200 text-right tabular-nums">
                          {formatarMoedaBRL(f.valorContado)}
                        </td>
                        <td
                          className={`p-2 border border-stone-200 text-right tabular-nums font-semibold ${
                            f.diferenca === 0
                              ? 'text-green-700'
                              : f.diferenca > 0
                                ? 'text-blue-700'
                                : 'text-red-700'
                          }`}
                        >
                          {formatarMoedaBRL(f.diferenca)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section>
            <h2 className="text-base font-bold text-amber-900 mb-4">Vendas por dia (data, hora e valor)</h2>
            {dias.length === 0 ? (
              <p className="text-stone-500 text-sm">Nenhuma venda no período selecionado.</p>
            ) : (
              <div className="space-y-6">
                {dias.map((dia) => (
                  <div key={dia.data} className="dia-bloco border border-amber-100 rounded-lg overflow-hidden">
                    <div className="bg-amber-50 px-4 py-2 flex flex-wrap justify-between gap-2 border-b border-amber-100">
                      <span className="font-bold text-amber-900">{dia.data}</span>
                      <span className="text-sm text-stone-600">
                        {dia.totais.qtdVendas} venda(s) — total{' '}
                        <strong className="text-amber-900 tabular-nums">
                          {formatarMoedaBRL(dia.totais.totalGeral)}
                        </strong>
                      </span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-stone-500 text-xs">
                          <th className="text-left p-2 pl-4">Hora</th>
                          <th className="text-left p-2">Comanda / identificação</th>
                          <th className="text-left p-2">Pagamento</th>
                          <th className="text-right p-2 pr-4">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dia.vendas.map((v) => (
                          <tr
                            key={v.id}
                            className={v.cancelada ? 'text-stone-400 line-through' : ''}
                          >
                            <td className="p-2 pl-4 tabular-nums">{v.hora}</td>
                            <td className="p-2">{v.identificacao}</td>
                            <td className="p-2">{v.metodoPagamento}</td>
                            <td className="p-2 pr-4 text-right tabular-nums font-medium">
                              {formatarMoedaBRL(v.total)}
                              {v.cancelada ? ' (cancelada)' : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </section>

          <footer className="mt-8 pt-4 border-t border-stone-200 text-xs text-stone-500 text-center">
            Sistema de comandas — Padaria Grande Família. Dados extraídos do registro digital de
            vendas; válido para comprovação de uso do sistema no período indicado.
          </footer>
        </article>
      )}
    </div>
  )
}

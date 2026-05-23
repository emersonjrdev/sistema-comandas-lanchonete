import { useDashboard } from '../hooks/usePDV'

const cardCls =
  'rounded-lg border border-amber-200 bg-white px-3 py-2 shadow-sm md:px-3.5 md:py-2.5'
const labelCls = 'text-[11px] font-medium uppercase tracking-wide text-stone-500'
const valueCls = 'mt-0.5 text-lg font-bold tabular-nums leading-tight text-amber-800'

function formatarHora(dataStr) {
  if (!dataStr) return '-'
  return new Date(dataStr).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Dashboard() {
  const [resumo] = useDashboard()
  const produtosBaixo = resumo.produtosEstoqueBaixo || []
  const vendasAmostra = resumo.vendasAmostra || []

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-amber-900">Dashboard</h2>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <div className={cardCls}>
          <p className={labelCls}>Comandas abertas</p>
          <p className={valueCls}>{resumo.comandasAbertas}</p>
        </div>
        <div className={cardCls}>
          <p className={labelCls}>Aguardando pagamento</p>
          <p className={valueCls}>{resumo.comandasAguardandoPagamento ?? 0}</p>
        </div>
        <div className={cardCls}>
          <p className={labelCls}>Vendas pagas hoje</p>
          <p className={valueCls}>{resumo.vendasFinalizadasHoje}</p>
        </div>
        <div className={cardCls}>
          <p className={labelCls}>Status caixa</p>
          <p
            className={`mt-0.5 text-base font-semibold leading-tight ${
              resumo.caixaAberto ? 'text-green-700' : 'text-amber-700'
            }`}
          >
            {resumo.caixaAberto ? 'Aberto' : 'Fechado'}
          </p>
        </div>
      </div>

      <section className={cardCls} aria-labelledby="dash-vendas-amostra">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-amber-100 pb-2">
          <div>
            <h3 id="dash-vendas-amostra" className="text-sm font-semibold text-stone-800">
              Vendas de hoje — amostra
            </h3>
            <p className="mt-0.5 text-[11px] text-stone-500">
              Últimas vendas do período atual do caixa, sem valores em reais.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-stone-700">
            {resumo.vendasFinalizadasHoje ?? 0} venda{(resumo.vendasFinalizadasHoje ?? 0) === 1 ? '' : 's'}
          </span>
        </div>

        {vendasAmostra.length === 0 ? (
          <p className="text-xs text-stone-500">Nenhuma venda registrada no período atual.</p>
        ) : (
          <ul className="max-h-[min(18rem,calc(100vh-380px))] space-y-1 overflow-y-auto text-xs text-stone-700">
            {vendasAmostra.map((venda) => (
              <li
                key={venda.id}
                className="flex flex-col gap-0.5 rounded-md border border-transparent px-1.5 py-1.5 hover:border-amber-200/70 hover:bg-amber-50/60 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="min-w-0 font-medium text-stone-800">{venda.identificacao}</span>
                <span className="shrink-0 text-stone-500">
                  {formatarHora(venda.data)}
                  {venda.metodoPagamento && venda.metodoPagamento !== '-'
                    ? ` · ${venda.metodoPagamento}`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${cardCls} lg:py-3`} aria-labelledby="dash-estoque-baixo">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-amber-100 pb-2">
          <div>
            <h3 id="dash-estoque-baixo" className="text-sm font-semibold text-stone-800">
              Estoque baixo · menos de 5 unidades
              <span className="ml-1 font-normal text-stone-500">(não fixos)</span>
            </h3>
            <p className="mt-0.5 text-[11px] text-stone-500">
              Zerados aparecem em vermelho; ordem da lista: menor estoque primeiro.
            </p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${
              (resumo.estoqueBaixo ?? 0) > 0
                ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-200/80'
                : 'bg-stone-100 text-stone-700'
            }`}
          >
            {resumo.estoqueBaixo ?? 0} produto{(resumo.estoqueBaixo ?? 0) === 1 ? '' : 's'}
          </span>
        </div>

        {produtosBaixo.length === 0 ? (
          <p className="text-xs text-stone-500">Nenhum produto abaixo de 5 unidades.</p>
        ) : (
          <ul className="max-h-[min(22rem,calc(100vh-320px))] grid gap-x-6 gap-y-1 overflow-x-hidden overflow-y-auto text-xs text-stone-700 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {produtosBaixo.map((p) => {
              const q = Number(p.estoque ?? 0)
              const critico = q === 0
              return (
                <li
                  key={p.id}
                  title={p.nome}
                  className="flex min-h-[1.875rem] items-center justify-between gap-2 rounded-md border border-transparent px-1.5 py-1 hover:border-amber-200/70 hover:bg-amber-50/60"
                >
                  <span className="min-w-0 truncate text-stone-800">{p.nome}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-px text-[11px] font-semibold tabular-nums ring-1 ${
                      critico
                        ? 'bg-red-100 text-red-800 ring-red-200'
                        : 'bg-amber-50 text-amber-900 ring-amber-200'
                    }`}
                  >
                    {q} und.
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

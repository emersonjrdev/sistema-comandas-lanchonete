import { useDashboard } from '../hooks/usePDV'

export default function Dashboard() {
  const [resumo] = useDashboard()

  return (
    <div>
      <h2 className="text-2xl font-bold text-amber-900 mb-6">Dashboard</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="p-6 rounded-xl bg-white border-2 border-amber-200 shadow-sm">
          <p className="text-sm font-medium text-stone-500 mb-1">Total vendido hoje</p>
          <p className="text-2xl font-bold text-amber-800 tabular-nums">
            R$ {resumo.totalHoje.toFixed(2)}
          </p>
        </div>
        <div className="p-6 rounded-xl bg-white border-2 border-amber-200 shadow-sm">
          <p className="text-sm font-medium text-stone-500 mb-1">Dinheiro hoje</p>
          <p className="text-2xl font-bold text-amber-800 tabular-nums">
            R$ {(resumo.totalDinheiro ?? 0).toFixed(2)}
          </p>
        </div>
        <div className="p-6 rounded-xl bg-white border-2 border-amber-200 shadow-sm">
          <p className="text-sm font-medium text-stone-500 mb-1">Cartão hoje</p>
          <p className="text-2xl font-bold text-amber-800 tabular-nums">
            R$ {(resumo.totalCartao ?? 0).toFixed(2)}
          </p>
        </div>
        <div className="p-6 rounded-xl bg-white border-2 border-amber-200 shadow-sm">
          <p className="text-sm font-medium text-stone-500 mb-1">PIX hoje</p>
          <p className="text-2xl font-bold text-amber-800 tabular-nums">
            R$ {(resumo.totalPix ?? 0).toFixed(2)}
          </p>
        </div>
        <div className="p-6 rounded-xl bg-white border-2 border-amber-200 shadow-sm">
          <p className="text-sm font-medium text-stone-500 mb-1">Comandas abertas</p>
          <p className="text-2xl font-bold text-amber-800 tabular-nums">
            {resumo.comandasAbertas}
          </p>
        </div>
        <div className="p-6 rounded-xl bg-white border-2 border-amber-200 shadow-sm">
          <p className="text-sm font-medium text-stone-500 mb-1">Aguardando pagamento</p>
          <p className="text-2xl font-bold text-amber-800 tabular-nums">
            {resumo.comandasAguardandoPagamento ?? 0}
          </p>
        </div>
        <div className="p-6 rounded-xl bg-white border-2 border-amber-200 shadow-sm">
          <p className="text-sm font-medium text-stone-500 mb-1">Vendas pagas hoje</p>
          <p className="text-2xl font-bold text-amber-800 tabular-nums">
            {resumo.vendasFinalizadasHoje}
          </p>
        </div>
        <div className="p-6 rounded-xl bg-white border-2 border-amber-200 shadow-sm">
          <p className="text-sm font-medium text-stone-500 mb-1">Status caixa</p>
          <p
            className={`text-lg font-bold ${
              resumo.caixaAberto ? 'text-green-700' : 'text-amber-700'
            }`}
          >
            {resumo.caixaAberto ? 'Aberto' : 'Fechado'}
          </p>
        </div>
        <div className="p-6 rounded-xl bg-white border-2 border-amber-200 shadow-sm">
          <p className="text-sm font-medium text-stone-500 mb-1">Estoque baixo (&lt;5)</p>
          <p
            className={`text-2xl font-bold tabular-nums ${
              (resumo.estoqueBaixo ?? 0) > 0 ? 'text-amber-600' : 'text-amber-800'
            }`}
          >
            {resumo.estoqueBaixo ?? 0}
          </p>
        </div>
        <div className="p-6 rounded-xl bg-white border-2 border-amber-200 shadow-sm sm:col-span-2">
          <p className="text-sm font-medium text-stone-500 mb-1">Total histórico</p>
          <p className="text-2xl font-bold text-amber-800 tabular-nums">
            R$ {resumo.totalHistorico.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  )
}

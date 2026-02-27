import { useMemo } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCaixa } from '../hooks/usePDV'

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
  const [vendas] = useCaixa()

  if (!isAdmin) return <Navigate to="/" replace />

  const { faturamentoTotal, grupos } = useMemo(() => {
    const total = vendas.reduce((acc, v) => acc + (v.total || 0), 0)
    const porDia = agruparPorDia(vendas)
    return { faturamentoTotal: total, grupos: porDia }
  }, [vendas])

  return (
    <div>
      <h2 className="text-2xl font-bold text-amber-900 mb-6">Financeiro</h2>

      <div className="mb-8 p-6 rounded-xl bg-white border-2 border-amber-200 shadow-sm">
        <p className="text-sm font-medium text-stone-500 mb-1">
          Faturamento total (histórico)
        </p>
        <p className="text-2xl font-bold text-amber-800 tabular-nums">
          R$ {faturamentoTotal.toFixed(2)}
        </p>
      </div>

      <h3 className="text-lg font-semibold text-amber-900 mb-4">
        Histórico de vendas por dia
      </h3>
      {grupos.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-xl border-2 border-dashed border-amber-200">
          <p className="text-stone-500">Nenhuma venda registrada.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grupos.map((grupo) => (
            <div
              key={grupo.data}
              className="bg-white rounded-xl border-2 border-amber-200 p-6 shadow-sm"
            >
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-bold text-amber-900">
                  {grupo.data}
                </h4>
                <p className="text-xl font-bold text-amber-800 tabular-nums">
                  R$ {grupo.total.toFixed(2)}
                </p>
              </div>
              <ul className="space-y-2">
                {grupo.vendas.map((venda) => (
                  <li
                    key={venda.id}
                    className="flex justify-between items-center py-2 border-b border-amber-50 last:border-0"
                  >
                    <span className="text-stone-700">
                      {venda.identificacao}
                      {venda.metodoPagamento && (
                        <span className="text-stone-500 text-sm ml-2">
                          ({venda.metodoPagamento})
                        </span>
                      )}
                    </span>
                    <span className="font-semibold text-amber-800 tabular-nums">
                      R$ {(venda.total || 0).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

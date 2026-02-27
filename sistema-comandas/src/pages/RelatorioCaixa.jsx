import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useRelatorios } from '../hooks/useRelatorios'

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
  const [relatorios] = useRelatorios()

  if (!isAdmin) return <Navigate to="/" replace />

  const ordenados = [...relatorios].sort((a, b) => new Date(b.data) - new Date(a.data))

  return (
    <div>
      <h2 className="text-2xl font-bold text-amber-900 mb-6">Relatório de Caixa</h2>
      <p className="text-stone-600 mb-6">
        Histórico de fechamentos de caixa com totais por método de pagamento.
      </p>

      {ordenados.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-xl border-2 border-dashed border-amber-200">
          <p className="text-stone-500">Nenhum fechamento de caixa registrado.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {ordenados.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-xl border-2 border-amber-200 p-6 shadow-sm"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-amber-900">
                  {formatarData(r.data)}
                </h3>
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
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

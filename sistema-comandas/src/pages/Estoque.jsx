import { useState } from 'react'
import { useEstoque } from '../hooks/useEstoque'
import { useProdutos } from '../hooks/usePDV'

export default function Estoque() {
  const [produtos, estoqueBaixo, refresh, { setEstoque, incrementarEstoque }] = useEstoque()
  const [produtosAll] = useProdutos()
  const [editando, setEditando] = useState(null)
  const [valorEntrada, setValorEntrada] = useState('')

  async function handleSalvarEstoque(produtoId) {
    const v = parseInt(valorEntrada, 10)
    if (isNaN(v) || v < 0) return
    const r = await setEstoque(produtoId, v)
    if (r.sucesso) {
      await refresh()
      setEditando(null)
      setValorEntrada('')
    }
  }

  async function handleEntrada(produtoId) {
    const v = parseInt(valorEntrada, 10)
    if (isNaN(v) || v <= 0) return
    const r = await incrementarEstoque(produtoId, v)
    if (r.sucesso) {
      await refresh()
      setEditando(null)
      setValorEntrada('')
    }
  }

  const produtosParaExibir = produtos.length > 0 ? produtos : produtosAll.map((p) => ({ ...p, estoque: p.estoque ?? 0 }))

  return (
    <div>
      <h2 className="text-2xl font-bold text-amber-900 mb-6">Estoque</h2>

      {estoqueBaixo.length > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-amber-100 border-2 border-amber-300">
          <p className="font-semibold text-amber-900">
            ⚠️ {estoqueBaixo.length} produto(s) com estoque baixo (menos de 5 unidades)
          </p>
        </div>
      )}

      {produtosParaExibir.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-xl border-2 border-dashed border-amber-200">
          <p className="text-stone-500">Nenhum produto cadastrado.</p>
          <p className="text-stone-500 text-sm mt-2">
            Cadastre produtos em Produtos para gerenciar o estoque.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {produtosParaExibir.map((produto) => {
            const baixo = (produto.estoque ?? 0) < 5
            const isEditando = editando?.id === produto.id

            return (
              <div
                key={produto.id}
                className={`p-5 rounded-xl bg-white border-2 transition-colors ${
                  baixo ? 'border-amber-400 bg-amber-50/50' : 'border-amber-200'
                }`}
              >
                <div className="flex justify-between items-start gap-4 mb-3">
                  <div>
                    <h3 className="text-lg font-bold text-amber-900">{produto.nome}</h3>
                    <p className="text-2xl font-bold text-amber-800 tabular-nums">
                      Estoque: {produto.estoque ?? 0}
                    </p>
                  </div>
                </div>

                {isEditando ? (
                  <div className="space-y-2">
                    <input
                      type="number"
                      min="0"
                      value={valorEntrada}
                      onChange={(e) => setValorEntrada(e.target.value)}
                      placeholder="Quantidade"
                      className="w-full px-3 py-2 rounded-lg border-2 border-amber-200"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSalvarEstoque(produto.id)}
                        className="flex-1 py-2 rounded-lg bg-amber-600 text-white font-semibold"
                      >
                        Definir
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEntrada(produto.id)}
                        className="flex-1 py-2 rounded-lg bg-green-600 text-white font-semibold"
                      >
                        + Entrada
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditando(null)
                          setValorEntrada('')
                        }}
                        className="py-2 px-3 rounded-lg bg-stone-200"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditando(produto)}
                    className="w-full py-2 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700"
                  >
                    Ajustar estoque
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

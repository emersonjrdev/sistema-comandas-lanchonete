import { useMemo, useState } from 'react'
import { useCaixa } from '../hooks/useCaixa'
import { useProdutos } from '../hooks/usePDV'
import { adicionarItemAVenda, confirmarPagamento } from '../services/storage'
import { temEstoque } from '../services/estoqueService'
import { useToast } from '../contexts/ToastContext'
import { playSomVenda, playSomErro } from '../utils/sons'
import ModalPagamento from '../components/ModalPagamento'

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

export default function Caixa() {
  const [
    vendas,
    refresh,
    {
      comandasPendentes,
      caixaAberto,
      totais,
      abrirCaixa,
      fecharCaixa,
      getCaixaAtual,
    },
  ] = useCaixa()
  const [produtos] = useProdutos()
  const [mostrarAbertura, setMostrarAbertura] = useState(false)
  const [valorInicial, setValorInicial] = useState('')
  const [mostrarFechamento, setMostrarFechamento] = useState(false)
  const [valorContado, setValorContado] = useState('')
  const [comandaPagamento, setComandaPagamento] = useState(null)
  const [vendaAdicionarItem, setVendaAdicionarItem] = useState(null)
  const [produtoSelecionado, setProdutoSelecionado] = useState('')
  const [quantidade, setQuantidade] = useState(1)
  const toast = useToast()

  const { totalHoje, vendasHoje } = useMemo(() => {
    const doDia = vendas.filter((v) => isHoje(v.data))
    const total = doDia.reduce((acc, v) => acc + (v.total || 0), 0)
    return { totalHoje: total, vendasHoje: doDia }
  }, [vendas])

  const vendasOrdenadas = useMemo(
    () => [...vendasHoje].sort((a, b) => new Date(b.data) - new Date(a.data)),
    [vendasHoje]
  )

  const produtosComEstoque = produtos.filter((p) => temEstoque(p.id, 1))

  function handleAbrirCaixa(e) {
    e?.preventDefault()
    const v = parseFloat(valorInicial.replace(',', '.')) || 0
    const r = abrirCaixa(v)
    if (r.sucesso) {
      playSomVenda()
      setMostrarAbertura(false)
      setValorInicial('')
      refresh()
      toast.show('Caixa aberto com sucesso!')
    } else {
      toast.show(r.erro || 'Erro ao abrir caixa', 'error')
      playSomErro()
    }
  }

  function handleFecharCaixa(e) {
    e?.preventDefault()
    const v = parseFloat(valorContado.replace(',', '.')) || 0
    const r = fecharCaixa(v)
    if (r.sucesso) {
      playSomVenda()
      setMostrarFechamento(false)
      setValorContado('')
      refresh()
      toast.show(`Caixa fechado. Diferença: R$ ${r.fechamento.diferenca.toFixed(2)}`)
    } else {
      toast.show(r.erro || 'Erro ao fechar caixa', 'error')
      playSomErro()
    }
  }

  function handleConfirmarPagamento(metodoPagamento, valorRecebido, troco) {
    if (!comandaPagamento) return
    const venda = confirmarPagamento(
      comandaPagamento.id,
      metodoPagamento,
      valorRecebido,
      troco
    )
    if (venda) {
      playSomVenda()
      toast.show('Pagamento confirmado!')
      setComandaPagamento(null)
      refresh()
    } else {
      playSomErro()
      toast.show('Erro ao confirmar pagamento. Verifique o estoque.', 'error')
    }
  }

  function handleAdicionarItemVenda() {
    if (!vendaAdicionarItem || !produtoSelecionado) return
    if (!temEstoque(produtoSelecionado, quantidade)) {
      playSomErro()
      toast.show('Estoque insuficiente', 'error')
      return
    }
    const venda = adicionarItemAVenda(vendaAdicionarItem.id, produtoSelecionado, quantidade)
    if (venda) {
      playSomVenda()
      refresh()
      setVendaAdicionarItem(null)
      setProdutoSelecionado('')
      setQuantidade(1)
      toast.show('Item adicionado à venda!')
    } else {
      playSomErro()
      toast.show('Erro ao adicionar item', 'error')
    }
  }

  const caixa = getCaixaAtual()
  const totalEsperado = (caixa.valorInicial || 0) + totais.totalDinheiro
  const diferenca =
    mostrarFechamento && valorContado
      ? (parseFloat(valorContado.replace(',', '.')) || 0) - totalEsperado
      : 0

  const totalComandaPendente =
    comandaPagamento &&
    (comandaPagamento.total ??
      (comandaPagamento.itens || []).reduce(
        (acc, item) => acc + (item.subtotal ?? item.preco * item.quantidade),
        0
      ))

  return (
    <div>
      <h2 className="text-2xl font-bold text-amber-900 mb-6">Caixa</h2>

      {/* Status e Abertura/Fechamento */}
      <div className="mb-6 flex flex-wrap gap-4 items-center">
        <span
          className={`px-4 py-2 rounded-xl font-semibold ${
            caixaAberto ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {caixaAberto ? 'Caixa aberto' : 'Caixa fechado'}
        </span>
        {!caixaAberto && !mostrarAbertura && (
          <button
            type="button"
            onClick={() => setMostrarAbertura(true)}
            className="px-4 py-2 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700"
          >
            Abrir caixa
          </button>
        )}
        {caixaAberto && !mostrarFechamento && (
          <button
            type="button"
            onClick={() => setMostrarFechamento(true)}
            className="px-4 py-2 rounded-xl bg-amber-600 text-white font-semibold hover:bg-amber-700"
          >
            Fechar caixa
          </button>
        )}
      </div>

      {mostrarAbertura && (
        <form
          onSubmit={handleAbrirCaixa}
          className="mb-6 p-6 bg-white rounded-xl border-2 border-amber-200"
        >
          <h3 className="text-lg font-semibold text-amber-900 mb-4">Abrir caixa</h3>
          <div className="flex gap-4 items-end flex-wrap">
            <div>
              <label className="block text-sm font-medium mb-1">Valor inicial (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                value={valorInicial}
                onChange={(e) => setValorInicial(e.target.value.replace(/[^\d,.]/g, ''))}
                placeholder="0,00"
                className="px-4 py-3 rounded-lg border-2 border-amber-200 w-40"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-3 rounded-xl bg-green-600 text-white font-semibold"
            >
              Confirmar abertura
            </button>
            <button
              type="button"
              onClick={() => setMostrarAbertura(false)}
              className="px-4 py-3 rounded-xl bg-stone-200"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {mostrarFechamento && (
        <form
          onSubmit={handleFecharCaixa}
          className="mb-6 p-6 bg-white rounded-xl border-2 border-amber-200"
        >
          <h3 className="text-lg font-semibold text-amber-900 mb-4">Fechar caixa</h3>
          <div className="grid gap-3 mb-4">
            <p>Valor inicial: R$ {(caixa.valorInicial || 0).toFixed(2)}</p>
            <p>Total dinheiro hoje: R$ {totais.totalDinheiro.toFixed(2)}</p>
            <p>Total cartão hoje: R$ {totais.totalCartao.toFixed(2)}</p>
            <p>Total PIX hoje: R$ {totais.totalPix.toFixed(2)}</p>
            <p className="font-bold">
              Total esperado em caixa: R$ {totalEsperado.toFixed(2)}
            </p>
          </div>
          <div className="flex gap-4 items-end flex-wrap">
            <div>
              <label className="block text-sm font-medium mb-1">Valor contado (R$)</label>
              <input
                type="text"
                inputMode="decimal"
                value={valorContado}
                onChange={(e) =>
                  setValorContado(e.target.value.replace(/[^\d,.]/g, ''))
                }
                placeholder="0,00"
                className="px-4 py-3 rounded-lg border-2 border-amber-200 w-40"
              />
            </div>
            {valorContado && (
              <p
                className={`font-bold ${
                  diferenca >= 0 ? 'text-green-700' : 'text-red-700'
                }`}
              >
                Diferença: R$ {diferenca.toFixed(2)}
              </p>
            )}
            <button
              type="submit"
              className="px-4 py-3 rounded-xl bg-amber-600 text-white font-semibold"
            >
              Confirmar fechamento
            </button>
            <button
              type="button"
              onClick={() => setMostrarFechamento(false)}
              className="px-4 py-3 rounded-xl bg-stone-200"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Totais do dia */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="p-6 rounded-xl bg-white border-2 border-amber-200 shadow-sm">
          <p className="text-sm font-medium text-stone-500 mb-1">Total vendido hoje</p>
          <p className="text-2xl font-bold text-amber-800 tabular-nums">
            R$ {totalHoje.toFixed(2)}
          </p>
        </div>
        <div className="p-6 rounded-xl bg-white border-2 border-amber-200 shadow-sm">
          <p className="text-sm font-medium text-stone-500 mb-1">Dinheiro</p>
          <p className="text-2xl font-bold text-amber-800 tabular-nums">
            R$ {totais.totalDinheiro.toFixed(2)}
          </p>
        </div>
        <div className="p-6 rounded-xl bg-white border-2 border-amber-200 shadow-sm">
          <p className="text-sm font-medium text-stone-500 mb-1">Cartão</p>
          <p className="text-2xl font-bold text-amber-800 tabular-nums">
            R$ {totais.totalCartao.toFixed(2)}
          </p>
        </div>
        <div className="p-6 rounded-xl bg-white border-2 border-amber-200 shadow-sm">
          <p className="text-sm font-medium text-stone-500 mb-1">PIX</p>
          <p className="text-2xl font-bold text-amber-800 tabular-nums">
            R$ {totais.totalPix.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Pendentes de Pagamento */}
      <h3 className="text-lg font-semibold text-amber-900 mb-4">
        Pendentes de Pagamento
      </h3>
      <div className="mb-8 space-y-4">
        {comandasPendentes.length === 0 ? (
          <div className="py-8 text-center bg-white rounded-xl border-2 border-dashed border-amber-200">
            <p className="text-stone-500">Nenhuma comanda aguardando pagamento.</p>
          </div>
        ) : (
          comandasPendentes.map((comanda) => {
            const total =
              comanda.total ??
              (comanda.itens || []).reduce(
                (acc, item) =>
                  acc + (item.subtotal ?? item.preco * item.quantidade),
                0
              )
            return (
              <div
                key={comanda.id}
                className="bg-white rounded-xl border-2 border-amber-300 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div>
                  <h4 className="text-lg font-bold text-amber-900">
                    {comanda.identificacao}
                  </h4>
                  {comanda.itens && comanda.itens.length > 0 && (
                    <ul className="mt-2 text-sm text-stone-600 space-y-0.5">
                      {comanda.itens.slice(0, 3).map((item) => (
                        <li key={item.id}>
                          {item.quantidade}x {item.nome}
                        </li>
                      ))}
                      {comanda.itens.length > 3 && (
                        <li className="text-stone-400">
                          +{comanda.itens.length - 3} itens
                        </li>
                      )}
                    </ul>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-xl font-bold text-amber-800 tabular-nums">
                    R$ {total.toFixed(2)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setComandaPagamento(comanda)}
                    className="px-6 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700"
                  >
                    Cobrar
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Vendas Finalizadas */}
      <h3 className="text-lg font-semibold text-amber-900 mb-4">
        Vendas Finalizadas
      </h3>
      <div className="space-y-4">
        {vendasOrdenadas.length === 0 ? (
          <div className="py-12 text-center bg-white rounded-xl border-2 border-dashed border-amber-200">
            <p className="text-stone-500">Nenhuma venda registrada hoje.</p>
          </div>
        ) : (
          vendasOrdenadas.map((venda) => (
            <div
              key={venda.id}
              className="bg-white rounded-xl border-2 border-amber-200 p-6 shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-amber-900">
                    {venda.identificacao}
                  </h3>
                  <p className="text-sm text-stone-500">{formatarData(venda.data)}</p>
                  {venda.metodoPagamento && (
                    <p className="text-sm text-amber-700 mt-1">{venda.metodoPagamento}</p>
                  )}
                  {venda.metodoPagamento?.toLowerCase().includes('dinheiro') &&
                    (venda.valorRecebido != null || venda.troco != null) && (
                      <p className="text-sm text-stone-600 mt-1">
                        Recebido: R$ {(venda.valorRecebido || 0).toFixed(2)} | Troco: R${' '}
                        {(venda.troco || 0).toFixed(2)}
                      </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold text-amber-800 tabular-nums">
                    R$ {(venda.total || 0).toFixed(2)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setVendaAdicionarItem(venda)}
                    className="px-3 py-2 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700"
                  >
                    + Adicionar Item
                  </button>
                </div>
              </div>
              {venda.itens && venda.itens.length > 0 && (
                <ul className="space-y-1 text-sm text-stone-600 border-t border-amber-100 pt-4">
                  {venda.itens.map((item) => (
                    <li key={item.id} className="flex justify-between gap-2">
                      <span>
                        {item.quantidade}x {item.nome}
                      </span>
                      <span className="tabular-nums">
                        R${' '}
                        {(item.subtotal ?? item.preco * item.quantidade).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {vendaAdicionarItem?.id === venda.id && (
                <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-sm font-semibold mb-2">Adicionar item à venda</p>
                  <div className="flex gap-2 flex-wrap items-end">
                    <select
                      value={produtoSelecionado}
                      onChange={(e) => setProdutoSelecionado(e.target.value)}
                      className="px-3 py-2 rounded-lg border-2 border-amber-200"
                    >
                      <option value="">Produto...</option>
                      {produtosComEstoque.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome} - R$ {p.preco?.toFixed(2)}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={quantidade}
                      onChange={(e) =>
                        setQuantidade(
                          Math.max(1, parseInt(e.target.value, 10) || 1)
                        )
                      }
                      className="w-20 px-3 py-2 rounded-lg border-2 border-amber-200"
                    />
                    <button
                      type="button"
                      onClick={handleAdicionarItemVenda}
                      disabled={!produtoSelecionado}
                      className="px-4 py-2 rounded-lg bg-green-600 text-white font-semibold disabled:opacity-50"
                    >
                      Adicionar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVendaAdicionarItem(null)
                        setProdutoSelecionado('')
                        setQuantidade(1)
                      }}
                      className="px-4 py-2 rounded-lg bg-stone-200"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {comandaPagamento && totalComandaPendente != null && (
        <ModalPagamento
          total={totalComandaPendente}
          onConfirmar={handleConfirmarPagamento}
          onCancelar={() => setComandaPagamento(null)}
        />
      )}
    </div>
  )
}

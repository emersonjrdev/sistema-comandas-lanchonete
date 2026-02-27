import { useEffect, useState } from 'react'
import ItemRow from './ItemRow'
import {
  adicionarItem,
  removerItem,
  alterarQtd,
  enviarParaCaixa,
} from '../../services/storage'
import { temEstoque } from '../../services/estoqueService'
import { useToast } from '../../contexts/ToastContext'
import { playSomErro } from '../../utils/sons'

export default function ComandaDetalhe({
  comanda,
  produtos,
  onComandaAtualizada,
  onEnviada,
  onVoltar,
  isMobile = false,
}) {
  const [mostrarAdicionar, setMostrarAdicionar] = useState(isMobile)
  const [produtoSelecionado, setProdutoSelecionado] = useState('')
  const [quantidade, setQuantidade] = useState(1)
  const toast = useToast()

  const total =
    comanda.total ??
    (comanda.itens || []).reduce(
      (acc, item) => acc + (item.subtotal ?? item.preco * item.quantidade),
      0
    )

  const produtosComEstoque = produtos.filter((p) => temEstoque(p.id, 1))

  useEffect(() => {
    if (isMobile) {
      setMostrarAdicionar(true)
    }
  }, [isMobile])

  function handleAdicionarProduto() {
    if (!produtoSelecionado) return

    if (!temEstoque(produtoSelecionado, quantidade)) {
      playSomErro()
      toast.show('Estoque insuficiente para este produto', 'error')
      return
    }

    const atualizada = adicionarItem(comanda.id, produtoSelecionado, quantidade)
    if (atualizada) {
      onComandaAtualizada(atualizada)
      setProdutoSelecionado('')
      setQuantidade(1)
      setMostrarAdicionar(!isMobile) // no mobile continua aberto
    } else {
      playSomErro()
      toast.show('Não foi possível adicionar o item', 'error')
    }
  }

  function handleQuantidadeChange(itemId, novaQuantidade) {
    const atualizada = alterarQtd(comanda.id, itemId, novaQuantidade)
    if (atualizada) onComandaAtualizada(atualizada)
  }

  function handleRemover(itemId) {
    const atualizada = removerItem(comanda.id, itemId)
    if (atualizada) onComandaAtualizada(atualizada)
  }

  function handleEnviarParaCaixa() {
    if (total <= 0) {
      toast.show('Adicione itens à comanda antes de enviar', 'warning')
      return
    }
    const enviada = enviarParaCaixa(comanda.id)
    if (enviada) {
      toast.show('Comanda enviada para o caixa!')
      onEnviada()
    } else {
      playSomErro()
      toast.show('Erro ao enviar comanda', 'error')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button
          type="button"
          onClick={onVoltar}
          className={`flex items-center gap-2 rounded-lg bg-amber-100 text-amber-800 font-semibold hover:bg-amber-200 transition-colors touch-manipulation ${
            isMobile ? 'px-6 py-4 text-lg min-h-[52px]' : 'px-4 py-2'
          }`}
        >
          ← Voltar
        </button>
        <h2 className={`font-bold text-amber-900 ${isMobile ? 'text-xl' : 'text-2xl'}`}>
          {comanda.identificacao}
        </h2>
      </div>

      <div className="bg-white rounded-xl border-2 border-amber-200 p-6 shadow-sm">
        <div className={`mb-4 ${isMobile ? 'space-y-3' : 'flex items-center justify-between'}`}>
          <h3 className="text-lg font-semibold text-amber-900">Itens</h3>
          {produtos.length > 0 && (
            <button
              type="button"
              onClick={() => setMostrarAdicionar(!mostrarAdicionar)}
              className={`rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-colors touch-manipulation min-h-[44px] ${
                isMobile ? 'w-full px-4 py-3 text-lg' : 'px-4 py-2'
              }`}
            >
              {mostrarAdicionar ? 'Fechar adição de produto' : '+ Adicionar Produto'}
            </button>
          )}
        </div>

        {mostrarAdicionar && produtos.length > 0 && (
          <div className="mb-6 p-4 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-amber-900 mb-1">
                  Produto
                </label>
                <select
                  value={produtoSelecionado}
                  onChange={(e) => setProdutoSelecionado(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-amber-900"
                >
                  <option value="">Selecione...</option>
                  {produtosComEstoque.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} - R$ {Number(p.preco).toFixed(2)}
                    </option>
                  ))}
                  {produtosComEstoque.length === 0 && (
                    <option value="" disabled>Nenhum produto com estoque</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-amber-900 mb-1">
                  Quantidade
                </label>
                <input
                  type="number"
                  min={1}
                  value={quantidade}
                  onChange={(e) =>
                    setQuantidade(Math.max(1, parseInt(e.target.value, 10) || 1))
                  }
                  className="w-full px-4 py-3 rounded-lg border-2 border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-amber-900 font-mono tabular-nums"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAdicionarProduto}
                disabled={!produtoSelecionado}
                className="px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
              >
                Adicionar
              </button>
              <button
                type="button"
                onClick={() => {
                  setMostrarAdicionar(false)
                  setProdutoSelecionado('')
                  setQuantidade(1)
                }}
                className="px-4 py-2 rounded-lg bg-stone-200 text-stone-700 font-semibold hover:bg-stone-300 touch-manipulation"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {(!comanda.itens || comanda.itens.length === 0) ? (
            <p className="py-8 text-center text-stone-500">
              {produtos.length === 0
                ? 'Cadastre produtos primeiro para adicionar à comanda.'
                : 'Nenhum item na comanda. Clique em "Adicionar Produto" para começar.'}
            </p>
          ) : (
            comanda.itens.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onQuantidadeChange={handleQuantidadeChange}
                onRemover={handleRemover}
              />
            ))
          )}
        </div>

        <div className="mt-6 pt-4 border-t-2 border-amber-200 flex justify-end">
          <p className="text-xl font-bold text-amber-900 tabular-nums">
            Total: R$ {total.toFixed(2)}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleEnviarParaCaixa}
        className={`w-full rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700 transition-colors touch-manipulation ${
          isMobile ? 'px-8 py-5 text-xl min-h-[64px]' : 'sm:w-auto px-8 py-4 text-lg min-h-[56px]'
        }`}
      >
        Enviar para Caixa
      </button>
    </div>
  )
}
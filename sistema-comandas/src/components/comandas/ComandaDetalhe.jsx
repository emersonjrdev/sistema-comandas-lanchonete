import { useEffect, useMemo, useState } from 'react'
import ItemRow from './ItemRow'
import {
  adicionarItem,
  removerItem,
  alterarQtd,
  enviarParaCaixa,
} from '../../services/storage'
import { useToast } from '../../contexts/ToastContext'
import { playSomAcao, playSomErro } from '../../utils/sons'

export default function ComandaDetalhe({
  comanda,
  produtos,
  onComandaAtualizada,
  onEnviada,
  onVoltar,
  isMobile = false,
  isTablet = false,
}) {
  const [mostrarAdicionar, setMostrarAdicionar] = useState(isMobile || isTablet)
  const [produtoSelecionado, setProdutoSelecionado] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [tipoFrio, setTipoFrio] = useState('Presunto')
  const [pesoFrioInput, setPesoFrioInput] = useState('100')
  const [pesoFrioUnidade, setPesoFrioUnidade] = useState('g')
  const toast = useToast()
  const tiposFrios = ['Presunto', 'Queijo', 'Mortadela', 'Peito de Peru', 'Salame']

  const total =
    comanda.total ??
    (comanda.itens || []).reduce(
      (acc, item) => acc + (item.subtotal ?? item.preco * item.quantidade),
      0
    )

  function estoqueDisponivel(produtoId) {
    const produto = produtos.find((p) => String(p.id) === String(produtoId))
    return Number(produto?.estoque ?? 0)
  }

  const produtosOrdenados = useMemo(
    () =>
      produtos
        .sort((a, b) =>
          String(a?.nome || '').localeCompare(String(b?.nome || ''), 'pt-BR', {
            sensitivity: 'base',
          })
        ),
    [produtos]
  )
  const produtoSelecionadoObj = produtos.find((p) => String(p.id) === String(produtoSelecionado))
  const selecionadoEhFrios =
    String(produtoSelecionadoObj?.nome || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase() === 'frios'

  useEffect(() => {
    if (isMobile || isTablet) {
      setMostrarAdicionar(true)
    }
  }, [isMobile, isTablet])

  async function handleAdicionarProduto() {
    if (!produtoSelecionado) return
    const quantidadeNum = Math.max(1, parseInt(quantidade, 10) || 1)
    const pesoBase = Math.max(1, parseFloat(String(pesoFrioInput || '').replace(',', '.')) || 0)
    const pesoGramas = pesoFrioUnidade === 'kg' ? Math.round(pesoBase * 1000) : Math.round(pesoBase)
    const estoqueNecessario = selecionadoEhFrios ? pesoGramas : quantidadeNum

    if (estoqueDisponivel(produtoSelecionado) < estoqueNecessario) {
      playSomErro()
      toast.show('Estoque insuficiente para este produto', 'error')
      return
    }

    const payload = selecionadoEhFrios
      ? { pesoGramas, tipoFrio }
      : { quantidade: quantidadeNum }
    const atualizada = await adicionarItem(comanda.id, produtoSelecionado, payload)
    if (atualizada) {
      playSomAcao()
      onComandaAtualizada(atualizada)
      setProdutoSelecionado('')
      setQuantidade('1')
      setTipoFrio('Presunto')
      setPesoFrioInput('100')
      setPesoFrioUnidade('g')
      setMostrarAdicionar(!isMobile) // no mobile continua aberto
    } else {
      playSomErro()
      toast.show('Não foi possível adicionar o item', 'error')
    }
  }

  async function handleQuantidadeChange(itemId, novaQuantidade) {
    const atualizada = await alterarQtd(comanda.id, itemId, novaQuantidade)
    if (atualizada) onComandaAtualizada(atualizada)
  }

  async function handleRemover(itemId) {
    const atualizada = await removerItem(comanda.id, itemId)
    if (atualizada) onComandaAtualizada(atualizada)
  }

  async function handleEnviarParaCaixa() {
    if (total <= 0) {
      toast.show('Adicione itens à comanda antes de enviar', 'warning')
      return
    }
    const enviada = await enviarParaCaixa(comanda.id)
    if (enviada) {
      playSomAcao()
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
            isMobile || isTablet ? 'px-6 py-4 text-lg min-h-[52px]' : 'px-4 py-2'
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
                isMobile || isTablet ? 'w-full px-4 py-3 text-lg' : 'px-4 py-2'
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
                  {produtosOrdenados.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.fixo !== true && estoqueDisponivel(p.id) < 1}>
                      {p.nome} - R$ {Number(p.preco).toFixed(2)} {p.fixo === true ? '(estoque infinito)' : estoqueDisponivel(p.id) < 1 ? '(sem estoque)' : ''}
                    </option>
                  ))}
                  {produtosOrdenados.length === 0 && (
                    <option value="" disabled>Nenhum produto com estoque</option>
                  )}
                </select>
              </div>
              {selecionadoEhFrios ? (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-amber-900 mb-1">Tipo de frio</label>
                  <select
                    value={tipoFrio}
                    onChange={(e) => setTipoFrio(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border-2 border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-amber-900"
                  >
                    {tiposFrios.map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {tipo}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={pesoFrioInput}
                      onChange={(e) => setPesoFrioInput(e.target.value.replace(/[^\d,.]/g, ''))}
                      className="w-full px-4 py-3 rounded-lg border-2 border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-amber-900 font-mono tabular-nums"
                    />
                    <select
                      value={pesoFrioUnidade}
                      onChange={(e) => setPesoFrioUnidade(e.target.value)}
                      className="px-3 py-3 rounded-lg border-2 border-amber-200"
                    >
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-amber-900 mb-1">
                    Quantidade
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={quantidade}
                    onChange={(e) => setQuantidade(e.target.value.replace(/\D/g, ''))}
                    onBlur={() => {
                      const quantidadeNum = Math.max(1, parseInt(quantidade, 10) || 1)
                      setQuantidade(String(quantidadeNum))
                    }}
                    className="w-full px-4 py-3 rounded-lg border-2 border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-amber-900 font-mono tabular-nums"
                  />
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleAdicionarProduto}
                disabled={!produtoSelecionado}
                className="px-4 py-3 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
              >
                Adicionar
              </button>
              <button
                type="button"
                onClick={() => {
                  setMostrarAdicionar(false)
                  setProdutoSelecionado('')
                  setQuantidade('1')
                  setTipoFrio('Presunto')
                  setPesoFrioInput('100')
                  setPesoFrioUnidade('g')
                }}
                className="px-4 py-3 rounded-lg bg-stone-200 text-stone-700 font-semibold hover:bg-stone-300 touch-manipulation"
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
          isMobile || isTablet
            ? 'px-8 py-5 text-xl min-h-[64px]'
            : 'sm:w-auto px-8 py-4 text-lg min-h-[56px]'
        }`}
      >
        Enviar para Caixa
      </button>
    </div>
  )
}
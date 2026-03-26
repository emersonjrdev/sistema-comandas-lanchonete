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
import { formatarCentavosInput, moedaInputParaNumero } from '../../utils/moeda'

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
  const [buscaProduto, setBuscaProduto] = useState('')
  const [produtoSelecionado, setProdutoSelecionado] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [valorTotal, setValorTotal] = useState('')
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
      [...produtos].sort((a, b) =>
        String(a?.nome || '').localeCompare(String(b?.nome || ''), 'pt-BR', {
          sensitivity: 'base',
        })
      ),
    [produtos]
  )

  const termoBusca = String(buscaProduto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
  const produtosFiltrados = useMemo(
    () =>
      termoBusca
        ? produtosOrdenados.filter((p) =>
            String(p?.nome || '')
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase()
              .includes(termoBusca)
          )
        : produtosOrdenados,
    [produtosOrdenados, termoBusca]
  )
  const produtoSelecionadoObj = produtos.find((p) => String(p.id) === String(produtoSelecionado))
  const selecionadoEhFixo = produtoSelecionadoObj?.fixo === true
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
    const valorTotalNum = moedaInputParaNumero(valorTotal)

    if (estoqueDisponivel(produtoSelecionado) < estoqueNecessario) {
      playSomErro()
      toast.show('Estoque insuficiente para este produto', 'error')
      return
    }
    if (selecionadoEhFixo && (!Number.isFinite(valorTotalNum) || valorTotalNum <= 0)) {
      playSomErro()
      toast.show('Informe o valor total para produto fixo', 'error')
      return
    }

    const payload = selecionadoEhFrios
      ? { pesoGramas, tipoFrio, ...(selecionadoEhFixo ? { valorTotal: valorTotalNum } : {}) }
      : { quantidade: quantidadeNum, ...(selecionadoEhFixo ? { valorTotal: valorTotalNum } : {}) }
    try {
      const atualizada = await adicionarItem(comanda.id, produtoSelecionado, payload)
      if (atualizada) {
        playSomAcao()
        onComandaAtualizada(atualizada)
        setBuscaProduto('')
        setProdutoSelecionado('')
        setQuantidade('1')
        setValorTotal('')
        setTipoFrio('Presunto')
        setPesoFrioInput('100')
        setPesoFrioUnidade('g')
        setMostrarAdicionar(!isMobile) // no mobile continua aberto
      } else {
        playSomErro()
        toast.show('Não foi possível adicionar o item', 'error')
      }
    } catch (err) {
      playSomErro()
      toast.show(err?.message || 'Erro ao adicionar item. Verifique a conexão.', 'error')
    }
  }

  async function handleQuantidadeChange(itemId, novaQuantidade) {
    try {
      const atualizada = await alterarQtd(comanda.id, itemId, novaQuantidade)
      if (atualizada) onComandaAtualizada(atualizada)
    } catch (err) {
      playSomErro()
      toast.show(err?.message || 'Erro ao alterar quantidade', 'error')
    }
  }

  async function handleRemover(itemId) {
    try {
      const atualizada = await removerItem(comanda.id, itemId)
      if (atualizada) onComandaAtualizada(atualizada)
    } catch (err) {
      playSomErro()
      toast.show(err?.message || 'Erro ao remover item', 'error')
    }
  }

  async function handleEnviarParaCaixa() {
    if (total <= 0) {
      toast.show('Adicione itens à comanda antes de enviar', 'warning')
      return
    }
    try {
      const enviada = await enviarParaCaixa(comanda.id)
      if (enviada) {
        playSomAcao()
        toast.show('Comanda enviada para o caixa!')
        onEnviada()
      } else {
        playSomErro()
        toast.show('Erro ao enviar comanda', 'error')
      }
    } catch (err) {
      playSomErro()
      toast.show(err?.message || 'Erro ao enviar comanda. Verifique a conexão.', 'error')
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
              {mostrarAdicionar ? 'Fechar adição de produto' : '+ Adicionar produto'}
            </button>
          )}
        </div>

        {mostrarAdicionar && produtos.length > 0 && (
          <div className="mb-6 p-4 bg-amber-50 rounded-lg border border-amber-200 space-y-3">
            <div>
              <label className="block text-sm font-medium text-amber-900 mb-1">
                Buscar e selecionar produto
              </label>
              <input
                type="search"
                value={produtoSelecionado ? (produtos.find((p) => String(p.id) === String(produtoSelecionado))?.nome ?? '') : buscaProduto}
                onChange={(e) => {
                  const v = e.target.value
                  setProdutoSelecionado('')
                  setBuscaProduto(v)
                }}
                onFocus={() => produtoSelecionado && setProdutoSelecionado('')}
                placeholder="Digite o nome do produto..."
                className="w-full px-4 py-3 rounded-lg border-2 border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-amber-900"
              />
              {produtosFiltrados.length > 0 && !produtoSelecionado && (buscaProduto.length > 0 || produtosFiltrados.length <= 10) && (
                <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border-2 border-amber-200 bg-white shadow-sm">
                  {produtosFiltrados.map((p) => {
                    const disponivel = p.fixo === true || estoqueDisponivel(p.id) >= 1
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          if (disponivel) {
                            setProdutoSelecionado(p.id)
                            setBuscaProduto('')
                          }
                        }}
                        disabled={!disponivel}
                        className={`block w-full text-left px-4 py-2 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed ${disponivel ? 'cursor-pointer' : ''}`}
                      >
                        {p.nome}{' '}
                        {p.fixo === true
                          ? '(valor no caixa)'
                          : `- R$ ${Number(p.preco).toFixed(2)} ${estoqueDisponivel(p.id) < 1 ? '(sem estoque)' : ''}`}
                      </button>
                    )
                  })}
                </div>
              )}
              {termoBusca && produtosFiltrados.length === 0 && (
                <p className="mt-1 text-sm text-stone-500">Nenhum produto encontrado</p>
              )}
            </div>
            {produtoSelecionado && (
            <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            {selecionadoEhFixo && (
              <div>
                <label className="block text-sm font-medium text-amber-900 mb-1">Valor total (R$)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={valorTotal}
                  onChange={(e) => setValorTotal(formatarCentavosInput(e.target.value))}
                  placeholder="0,00"
                  className="w-full px-4 py-3 rounded-lg border-2 border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-amber-900 font-mono tabular-nums"
                />
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleAdicionarProduto}
                className="px-4 py-3 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 touch-manipulation"
              >
                Adicionar
              </button>
              <button
                type="button"
                onClick={() => {
                  setProdutoSelecionado('')
                  setBuscaProduto('')
                  setQuantidade('1')
                  setValorTotal('')
                  setTipoFrio('Presunto')
                  setPesoFrioInput('100')
                  setPesoFrioUnidade('g')
                }}
                className="px-4 py-3 rounded-lg bg-stone-200 text-stone-700 font-semibold hover:bg-stone-300 touch-manipulation"
              >
                Trocar produto
              </button>
              <button
                type="button"
                onClick={() => {
                  setMostrarAdicionar(false)
                  setBuscaProduto('')
                  setProdutoSelecionado('')
                  setQuantidade('1')
                  setValorTotal('')
                  setTipoFrio('Presunto')
                  setPesoFrioInput('100')
                  setPesoFrioUnidade('g')
                }}
                className="px-4 py-3 rounded-lg bg-stone-200 text-stone-700 font-semibold hover:bg-stone-300 touch-manipulation"
              >
                Cancelar
              </button>
            </div>
            </>
            )}
          </div>
        )}

        <div className="space-y-2">
          {(!comanda.itens || comanda.itens.length === 0) ? (
            <p className="py-8 text-center text-stone-500">
              {produtos.length === 0
                ? 'Cadastre produtos primeiro para adicionar à comanda.'
                : 'Nenhum item na comanda. Clique em "Adicionar produto" para começar.'}
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
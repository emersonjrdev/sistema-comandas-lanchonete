import { useState } from 'react'
import { useProdutos } from '../hooks/usePDV'
import {
  addProduto,
  editarProduto,
  excluirProduto,
} from '../services/storage'
import { playSomAcao, playSomErro } from '../utils/sons'
import { formatarCentavosInput, moedaInputParaNumero, numeroParaMoedaInput } from '../utils/moeda'

export default function Produtos() {
  const [produtos, refreshProdutos] = useProdutos()
  const [editando, setEditando] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [buscaProduto, setBuscaProduto] = useState('')
  const [formNome, setFormNome] = useState('')
  const [formPreco, setFormPreco] = useState('')
  const [formEstoque, setFormEstoque] = useState('0')
  const [formVendePorGramas, setFormVendePorGramas] = useState(false)

  function sanitizarInteiro(valor) {
    return String(valor || '').replace(/\D/g, '')
  }

  function limparForm() {
    setFormNome('')
    setFormPreco('')
    setFormEstoque('0')
    setFormVendePorGramas(false)
    setEditando(null)
    setMostrarForm(false)
  }

  async function handleSalvar(e) {
    e.preventDefault()
    const nome = formNome.trim()
    const preco = moedaInputParaNumero(formPreco)
    const ehFixo = editando?.fixo === true
    if (!nome || (!ehFixo && (isNaN(preco) || preco < 0))) {
      playSomErro()
      return
    }

    const estoque = Math.max(0, parseInt(formEstoque, 10) || 0)
    const vendePorGramas = !ehFixo && formVendePorGramas === true
    try {
      if (editando) {
        await editarProduto(editando.id, nome, ehFixo ? 0 : preco, estoque, vendePorGramas)
      } else {
        await addProduto({ nome, preco, estoque, vendePorGramas })
      }
    } catch (error) {
      playSomErro()
      window.alert(error?.message || 'Não foi possível salvar o produto.')
      return
    }
    playSomAcao()
    await refreshProdutos()
    limparForm()
  }

  function handleEditar(produto) {
    setEditando(produto)
    setFormNome(produto.nome)
    setFormPreco(numeroParaMoedaInput(produto.preco))
    setFormEstoque(String(produto.estoque ?? 0))
    setFormVendePorGramas(produto.fixo !== true && produto.vendePorGramas === true)
    setMostrarForm(true)
  }

  async function handleExcluir(produto) {
    if (produto.fixo === true) {
      playSomErro()
      window.alert('Produto fixo não pode ser excluído.')
      return
    }
    if (window.confirm(`Excluir "${produto.nome}"?`)) {
      try {
        await excluirProduto(produto.id)
      } catch (error) {
        playSomErro()
        window.alert(error?.message || 'Não foi possível excluir o produto.')
        return
      }
      playSomAcao()
      await refreshProdutos()
      if (editando?.id === produto.id) limparForm()
    }
  }

  const termoBusca = String(buscaProduto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

  const produtosFiltrados = termoBusca
    ? produtos.filter((produto) =>
        String(produto?.nome || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .includes(termoBusca)
      )
    : produtos

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-amber-900">Produtos</h2>
        <button
          type="button"
          onClick={() => {
            limparForm()
            setMostrarForm(true)
          }}
          className="w-full sm:w-auto px-6 py-4 rounded-xl bg-amber-600 text-white font-bold text-lg hover:bg-amber-700 transition-colors touch-manipulation min-h-[56px] shadow-lg"
        >
          + Cadastrar Produto
        </button>
      </div>

      {produtos.length > 0 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-amber-900 mb-1">
            Buscar produto para editar
          </label>
          <input
            type="search"
            value={buscaProduto}
            onChange={(e) => setBuscaProduto(e.target.value)}
            placeholder="Digite o nome do produto..."
            className="w-full px-4 py-3 rounded-lg border-2 border-amber-200 focus:border-amber-500 outline-none text-amber-900"
          />
        </div>
      )}

      {mostrarForm && (
        <form
          onSubmit={handleSalvar}
          className="mb-6 p-6 bg-white rounded-xl border-2 border-amber-200 shadow-sm"
        >
          <h3 className="text-lg font-semibold text-amber-900 mb-4">
            {editando ? 'Editar produto' : 'Novo produto'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-amber-900 mb-1">
                Nome
              </label>
              <input
                type="text"
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                placeholder="Ex: X-Burger"
                className="w-full px-4 py-3 rounded-lg border-2 border-amber-200 focus:border-amber-500 outline-none text-amber-900"
                required
                disabled={editando?.fixo === true}
              />
              {editando?.fixo === true && (
                <p className="text-xs text-stone-500 mt-1">
                  Produto fixo: o nome não pode ser alterado.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-amber-900 mb-1">
                Preço (R$){editando?.fixo !== true && formVendePorGramas ? ' — cada 100 g' : ''}
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={formPreco}
                onChange={(e) => setFormPreco(formatarCentavosInput(e.target.value))}
                placeholder={editando?.fixo === true ? 'Valor informado no caixa' : '0,00'}
                className="w-full px-4 py-3 rounded-lg border-2 border-amber-200 focus:border-amber-500 outline-none text-amber-900 font-mono tabular-nums"
                required={editando?.fixo !== true}
                disabled={editando?.fixo === true}
              />
              {editando?.fixo === true && (
                <p className="text-xs text-stone-500 mt-1">
                  Produto fixo: o valor é informado no caixa na hora da venda.
                </p>
              )}
              {editando?.fixo !== true && (
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={formVendePorGramas}
                    onChange={(e) => setFormVendePorGramas(e.target.checked)}
                    className="mt-1 size-4 rounded border-amber-300 text-amber-700"
                  />
                  <span className="text-sm text-stone-700 leading-snug">
                    <span className="font-semibold text-amber-900">Vender por peso (gramas)</span>
                    <span className="block text-xs text-stone-600 mt-0.5">
                      No caixa/comanda será pedido peso (g ou kg). O preço acima é por 100 g. Opcionalmente dá para
                      informar valor total da peça. Produtos sem esta opção continuam por quantidade (unidade).
                    </span>
                  </span>
                </label>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-amber-900 mb-1">
                Estoque
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={formEstoque}
                onChange={(e) => setFormEstoque(sanitizarInteiro(e.target.value))}
                placeholder="0"
                className="w-full px-4 py-3 rounded-lg border-2 border-amber-200 focus:border-amber-500 outline-none text-amber-900 font-mono tabular-nums"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="submit"
              className="px-4 py-3 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 touch-manipulation"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={limparForm}
              className="px-4 py-3 rounded-lg bg-stone-200 text-stone-700 font-semibold hover:bg-stone-300 touch-manipulation"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {produtos.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-xl border-2 border-dashed border-amber-200">
          <p className="text-stone-500 text-lg mb-4">
            Nenhum produto cadastrado.
          </p>
          <p className="text-stone-500 text-sm mb-4">
            Cadastre produtos para poder adicioná-los às comandas.
          </p>
          <button
            type="button"
            onClick={() => setMostrarForm(true)}
            className="px-6 py-3 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-colors touch-manipulation"
          >
            Cadastrar primeiro produto
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {produtosFiltrados.map((produto) => (
            <div
              key={produto.id}
              className="p-5 rounded-xl bg-white border-2 border-amber-200 hover:border-amber-300 transition-colors"
            >
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="text-lg font-bold text-amber-900">
                    {produto.nome}
                  </h3>
                  {produto.fixo === true && (
                    <p className="text-xs text-amber-700 mt-1">Produto fixo</p>
                  )}
                  {produto.fixo !== true && produto.vendePorGramas === true && (
                    <p className="text-xs text-amber-800 mt-1 font-medium">Por peso (g) — preço / 100 g</p>
                  )}
                  <p className="text-xl font-bold text-amber-800 tabular-nums mt-1">
                    {produto.fixo === true
                      ? 'Valor no caixa'
                      : `R$ ${Number(produto.preco).toFixed(2)}`}
                  </p>
                  <p className="text-sm text-stone-500 mt-1">
                    Estoque: {produto.estoque ?? 0}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleEditar(produto)}
                    className="w-10 h-10 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors touch-manipulation"
                    aria-label="Editar"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExcluir(produto)}
                    className="w-10 h-10 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors touch-manipulation disabled:opacity-50"
                    aria-label="Excluir"
                    disabled={produto.fixo === true}
                    title={produto.fixo === true ? 'Produto fixo não pode ser excluído' : 'Excluir'}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {produtos.length > 0 && produtosFiltrados.length === 0 && termoBusca && (
        <p className="mt-4 text-center text-stone-500">
          Nenhum produto encontrado para &quot;{buscaProduto}&quot;.
        </p>
      )}
    </div>
  )
}

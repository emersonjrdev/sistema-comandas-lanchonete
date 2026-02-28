import { useState } from 'react'
import { useProdutos } from '../hooks/usePDV'
import {
  addProduto,
  editarProduto,
  excluirProduto,
} from '../services/storage'
import { playSomAcao, playSomErro } from '../utils/sons'

export default function Produtos() {
  const [produtos, refreshProdutos] = useProdutos()
  const [editando, setEditando] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [formNome, setFormNome] = useState('')
  const [formPreco, setFormPreco] = useState('')
  const [formEstoque, setFormEstoque] = useState('0')

  function limparForm() {
    setFormNome('')
    setFormPreco('')
    setFormEstoque('0')
    setEditando(null)
    setMostrarForm(false)
  }

  async function handleSalvar(e) {
    e.preventDefault()
    const nome = formNome.trim()
    const preco = parseFloat(formPreco)
    if (!nome || isNaN(preco) || preco < 0) {
      playSomErro()
      return
    }

    const estoque = Math.max(0, parseInt(formEstoque, 10) || 0)
    if (editando) {
      await editarProduto(editando.id, nome, preco, estoque)
    } else {
      await addProduto({ nome, preco, estoque })
    }
    playSomAcao()
    await refreshProdutos()
    limparForm()
  }

  function handleEditar(produto) {
    setEditando(produto)
    setFormNome(produto.nome)
    setFormPreco(String(produto.preco))
    setFormEstoque(String(produto.estoque ?? 0))
    setMostrarForm(true)
  }

  async function handleExcluir(produto) {
    if (window.confirm(`Excluir "${produto.nome}"?`)) {
      await excluirProduto(produto.id)
      playSomAcao()
      await refreshProdutos()
      if (editando?.id === produto.id) limparForm()
    }
  }

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
          className="px-6 py-4 rounded-xl bg-amber-600 text-white font-bold text-lg hover:bg-amber-700 transition-colors touch-manipulation min-h-[56px] shadow-lg"
        >
          + Cadastrar Produto
        </button>
      </div>

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
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-amber-900 mb-1">
                Preço (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formPreco}
                onChange={(e) => setFormPreco(e.target.value)}
                placeholder="0,00"
                className="w-full px-4 py-3 rounded-lg border-2 border-amber-200 focus:border-amber-500 outline-none text-amber-900 font-mono tabular-nums"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-amber-900 mb-1">
                Estoque
              </label>
              <input
                type="number"
                min="0"
                value={formEstoque}
                onChange={(e) => setFormEstoque(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 rounded-lg border-2 border-amber-200 focus:border-amber-500 outline-none text-amber-900 font-mono tabular-nums"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 touch-manipulation"
            >
              Salvar
            </button>
            <button
              type="button"
              onClick={limparForm}
              className="px-4 py-2 rounded-lg bg-stone-200 text-stone-700 font-semibold hover:bg-stone-300 touch-manipulation"
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
          {produtos.map((produto) => (
            <div
              key={produto.id}
              className="p-5 rounded-xl bg-white border-2 border-amber-200 hover:border-amber-300 transition-colors"
            >
              <div className="flex justify-between items-start gap-4">
                <div>
                  <h3 className="text-lg font-bold text-amber-900">
                    {produto.nome}
                  </h3>
                  <p className="text-xl font-bold text-amber-800 tabular-nums mt-1">
                    R$ {Number(produto.preco).toFixed(2)}
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
                    className="w-10 h-10 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors touch-manipulation"
                    aria-label="Excluir"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

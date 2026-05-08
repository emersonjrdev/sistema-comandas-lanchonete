import { useMemo, useState } from 'react'
import { useEstoque } from '../hooks/useEstoque'
import { useProdutos } from '../hooks/usePDV'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { playSomAcao, playSomErro } from '../utils/sons'

const alertBox =
  'rounded-lg border border-amber-200 bg-white px-3 py-2 shadow-sm md:px-3.5 md:py-2.5'

export default function Estoque() {
  const [produtos, estoqueBaixo, refresh, { setEstoque, incrementarEstoque, limparEstoqueNaoFixos }] =
    useEstoque()
  const [produtosAll] = useProdutos()
  const { usuario, isAdmin } = useAuth()
  const toast = useToast()
  const [buscaProduto, setBuscaProduto] = useState('')
  const [editando, setEditando] = useState(null)
  const [valorEntrada, setValorEntrada] = useState('')
  const [limpandoEstoque, setLimpandoEstoque] = useState(false)

  function sanitizarInteiro(valor) {
    return String(valor || '').replace(/\D/g, '')
  }

  function ordenarPorNome(a, b) {
    return String(a?.nome || '').localeCompare(String(b?.nome || ''), 'pt-BR', {
      sensitivity: 'base',
    })
  }

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

  async function handleLimparEstoqueNaoFixos() {
    if (!isAdmin || !usuario?.id || limpandoEstoque) return

    const confirmou = window.confirm(
      'Isso vai zerar o estoque de todos os produtos não fixos. Deseja continuar?'
    )
    if (!confirmou) return

    const confirmouNovamente = window.confirm(
      'Confirma LIMPAR TODO O ESTOQUE (exceto produtos fixos)? Essa ação não pode ser desfeita.'
    )
    if (!confirmouNovamente) return

    setLimpandoEstoque(true)
    try {
      const result = await limparEstoqueNaoFixos(usuario.id)
      if (result?.sucesso) {
        playSomAcao()
        await refresh()
        toast.show(`Estoque limpo! Produtos atualizados: ${Number(result.atualizados || 0)}`)
      } else {
        playSomErro()
        toast.show(result?.erro || 'Não foi possível limpar o estoque', 'error')
      }
    } finally {
      setLimpandoEstoque(false)
    }
  }

  const produtosParaExibir = useMemo(() => {
    const base =
      produtos.length > 0 ? [...produtos] : produtosAll.map((p) => ({ ...p, estoque: p.estoque ?? 0 }))
    return base.sort(ordenarPorNome)
  }, [produtos, produtosAll])

  const estoqueBaixoOrdenado = useMemo(
    () =>
      [...estoqueBaixo].sort((a, b) => {
        const d = Number(a.estoque ?? 0) - Number(b.estoque ?? 0)
        return d !== 0 ? d : ordenarPorNome(a, b)
      }),
    [estoqueBaixo]
  )

  const termoBusca = String(buscaProduto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
  const produtosFiltrados = useMemo(
    () =>
      termoBusca
        ? produtosParaExibir.filter((p) =>
            String(p?.nome || '')
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase()
              .includes(termoBusca)
          )
        : produtosParaExibir,
    [produtosParaExibir, termoBusca]
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-bold text-amber-900">Estoque</h2>
        {isAdmin && (
          <button
            type="button"
            onClick={handleLimparEstoqueNaoFixos}
            disabled={limpandoEstoque}
            className="w-full shrink-0 px-3 py-2 rounded-lg bg-red-600 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 sm:w-auto"
          >
            {limpandoEstoque
              ? 'Limpando…'
              : 'Limpar estoque não fixos'}
          </button>
        )}
      </div>

      {estoqueBaixoOrdenado.length > 0 && (
        <section className={`${alertBox} border-amber-300 bg-amber-50/70`} aria-labelledby="estoque-baixo-title">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-amber-200/80 pb-2">
            <div>
              <h3 id="estoque-baixo-title" className="text-sm font-semibold text-amber-950">
                Atenção: estoque baixo
              </h3>
              <p className="mt-0.5 text-[11px] text-amber-900/80">
                Menos de 5 unidades · não inclui produtos fixos · ordenado do menor ao maior saldo.
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center rounded-full bg-amber-200/90 px-2.5 py-0.5 text-xs font-semibold text-amber-950 ring-1 ring-amber-400/60">
              {estoqueBaixoOrdenado.length}{' '}
              {estoqueBaixoOrdenado.length === 1 ? 'produto' : 'produtos'}
            </span>
          </div>
          <ul className="max-h-[min(18rem,calc(100vh-280px))] grid grid-cols-1 gap-x-8 gap-y-1 overflow-x-hidden overflow-y-auto text-xs text-amber-950 sm:grid-cols-2 lg:grid-cols-3">
            {estoqueBaixoOrdenado.map((p) => {
              const q = Number(p.estoque ?? 0)
              const critico = q === 0
              return (
                <li
                  key={`baixo-${p.id}`}
                  title={p.nome}
                  className="flex min-h-[1.875rem] items-center justify-between gap-2 rounded-md border border-transparent bg-white/60 px-1.5 py-1 hover:border-amber-300/70"
                >
                  <span className="min-w-0 truncate font-medium">{p.nome}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-px text-[11px] font-semibold tabular-nums ring-1 ${
                      critico
                        ? 'bg-red-100 text-red-800 ring-red-200'
                        : 'bg-amber-100 text-amber-950 ring-amber-300/80'
                    }`}
                  >
                    {q} und.
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {produtosParaExibir.length === 0 ? (
        <div className="rounded-xl border border-dashed border-amber-200 bg-white py-12 text-center">
          <p className="text-stone-600">Nenhum produto cadastrado.</p>
          <p className="mt-2 text-xs text-stone-500">
            Cadastre produtos na tela Produtos para gerenciar o estoque.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div className="min-w-[12rem] flex-1">
              <label htmlFor="estoque-busca" className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                Buscar produto
              </label>
              <input
                id="estoque-busca"
                type="search"
                value={buscaProduto}
                onChange={(e) => setBuscaProduto(e.target.value)}
                placeholder="Nome do produto…"
                autoComplete="off"
                className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm text-amber-950 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-400"
              />
            </div>
            <p className="text-[11px] text-stone-500 tabular-nums" aria-live="polite">
              {termoBusca ? (
                <>
                  Mostrando {produtosFiltrados.length} de {produtosParaExibir.length}
                </>
              ) : (
                <>Total · {produtosParaExibir.length} produtos</>
              )}
            </p>
          </div>

          <ul className="overflow-hidden rounded-lg border border-amber-200 bg-white shadow-sm">
            {produtosFiltrados.map((produto) => {
              const q = Number(produto.estoque ?? 0)
              const ehFixo = produto.fixo === true
              const baixo = !ehFixo && q < 5
              const isEditando = editando?.id === produto.id

              return (
                <li
                  key={produto.id}
                  className={`border-b border-amber-100 last:border-b-0 ${
                    baixo ? 'border-l-[3px] border-l-amber-500 bg-amber-50/40' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2 px-3 py-2 sm:gap-3">
                    <div className="min-w-0 flex-1 sm:flex sm:flex-nowrap sm:items-center sm:gap-2">
                      <p className="truncate text-sm font-semibold leading-snug text-amber-950" title={produto.nome}>
                        {produto.nome}
                      </p>
                      {ehFixo && (
                        <span className="mt-1 inline-flex shrink-0 items-center rounded bg-stone-200/90 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-stone-700 sm:mt-0">
                          Fixo
                        </span>
                      )}
                    </div>

                    <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:justify-start">
                      {ehFixo ? (
                        <span className="inline-flex shrink-0 items-center rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-600 ring-1 ring-stone-200 tabular-nums">
                          —
                        </span>
                      ) : (
                        <span
                          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 tabular-nums ${
                            baixo
                              ? q === 0
                                ? 'bg-red-100 text-red-800 ring-red-200'
                                : 'bg-amber-100 text-amber-950 ring-amber-300'
                              : 'bg-green-50 text-green-900 ring-green-200/90'
                          }`}
                        >
                          {q} und.
                        </span>
                      )}
                      {!ehFixo && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditando(isEditando ? null : produto)
                            setValorEntrada('')
                          }}
                          className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
                        >
                          {isEditando ? 'Fechar' : 'Ajustar'}
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditando && !ehFixo && (
                    <div className="border-t border-amber-100 bg-stone-50/90 px-3 py-3 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={valorEntrada}
                        onChange={(e) => setValorEntrada(sanitizarInteiro(e.target.value))}
                        placeholder="Quantidade inteira"
                        className="min-w-[8rem] flex-1 rounded-lg border border-amber-200 px-3 py-2 text-sm sm:max-w-[12rem]"
                        aria-label="Nova quantidade de estoque"
                      />
                      <div className="mt-2 flex flex-wrap gap-2 sm:mt-0">
                        <button
                          type="button"
                          onClick={() => handleSalvarEstoque(produto.id)}
                          className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                        >
                          Definir saldo
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEntrada(produto.id)}
                          className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700"
                        >
                          Somar entrada
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditando(null)
                            setValorEntrada('')
                          }}
                          className="rounded-lg bg-stone-200 px-3 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-300"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          {produtosFiltrados.length === 0 && termoBusca && (
            <p className="text-center text-sm text-stone-500">
              Nenhum resultado para “{buscaProduto.trim()}”.
            </p>
          )}
        </>
      )}
    </div>
  )
}

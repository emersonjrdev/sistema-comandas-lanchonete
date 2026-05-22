/** Nome igual a "Frios" (cadastro especial com tipo de frio). */
export function produtoEhFriosNome(nome) {
  return (
    String(nome || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase() === 'frios'
  )
}

/** Vende por gramas: Frios sempre; demais apenas se marcado no cadastro. */
export function produtoVendePorGramas(p) {
  if (!p || p.fixo === true) return false
  if (produtoEhFriosNome(p.nome)) return true
  return p.vendePorGramas === true
}

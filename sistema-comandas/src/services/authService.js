const USUARIOS_KEY = 'sistema-comandas:usuarios'

function gerarId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function getUsuarios() {
  try {
    const data = localStorage.getItem(USUARIOS_KEY)
    const usuarios = data ? JSON.parse(data) : []
    if (usuarios.length === 0) {
      const maria = {
        id: gerarId(),
        nome: 'Maria',
        senha: 'admin123',
        perfil: 'admin',
      }
      const usuariosIniciais = [maria]
      localStorage.setItem(USUARIOS_KEY, JSON.stringify(usuariosIniciais))
      return usuariosIniciais
    }
    return usuarios
  } catch {
    return []
  }
}

export function login(nome, senha) {
  const usuarios = getUsuarios()
  const usuario = usuarios.find(
    (u) => u.nome?.toLowerCase() === nome?.toLowerCase().trim() && u.senha === senha
  )
  return usuario || null
}

export function getUsuarioPorId(id) {
  const usuarios = getUsuarios()
  return usuarios.find((u) => String(u.id) === String(id)) || null
}

export function isAdmin(usuario) {
  return usuario?.perfil === 'admin'
}

export function podeAcessarFinanceiro(usuario) {
  return isAdmin(usuario)
}

export function podeExcluirVenda(usuario) {
  return isAdmin(usuario)
}

export function podeAcessarRelatorioCaixa(usuario) {
  return isAdmin(usuario)
}

export function addUsuario(usuario) {
  const usuarios = getUsuarios()
  const novo = {
    id: gerarId(),
    nome: usuario.nome?.trim() || 'Usuário',
    senha: usuario.senha || '',
    perfil: usuario.perfil === 'admin' ? 'admin' : 'funcionario',
  }
  usuarios.push(novo)
  localStorage.setItem(USUARIOS_KEY, JSON.stringify(usuarios))
  return novo
}

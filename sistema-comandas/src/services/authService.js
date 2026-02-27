const USUARIOS_KEY = 'sistema-comandas:usuarios'

function gerarId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function usuariosPadrao() {
  return [
    {
      id: gerarId(),
      nome: 'admin',
      senha: 'admin123',
      perfil: 'admin',
    },
    {
      id: gerarId(),
      nome: 'funcionario',
      senha: 'func123',
      perfil: 'funcionario',
    },
  ]
}

function getUsuarios() {
  try {
    const data = localStorage.getItem(USUARIOS_KEY)
    const usuarios = data ? JSON.parse(data) : []

<<<<<<< ours
<<<<<<< ours
    const base = Array.isArray(usuarios) ? [...usuarios] : []

    const temAdmin = base.some((u) => u?.nome?.toLowerCase() === 'admin')
    const temFuncionario = base.some((u) => u?.nome?.toLowerCase() === 'funcionario')

    if (!temAdmin) {
      base.push({
=======
=======
>>>>>>> theirs
    const temAdmin = usuarios.some((u) => u.nome?.toLowerCase() === 'admin')
    const temFuncionario = usuarios.some((u) => u.nome?.toLowerCase() === 'funcionario')

    const usuariosNormalizados = [...usuarios]

    if (!temAdmin) {
      usuariosNormalizados.push({
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
        id: gerarId(),
        nome: 'admin',
        senha: 'admin123',
        perfil: 'admin',
      })
    }

    if (!temFuncionario) {
<<<<<<< ours
<<<<<<< ours
      base.push({
=======
      usuariosNormalizados.push({
>>>>>>> theirs
=======
      usuariosNormalizados.push({
>>>>>>> theirs
        id: gerarId(),
        nome: 'funcionario',
        senha: 'func123',
        perfil: 'funcionario',
      })
    }

<<<<<<< ours
<<<<<<< ours
    localStorage.setItem(USUARIOS_KEY, JSON.stringify(base))
    return base
=======
=======
>>>>>>> theirs
    if (usuariosNormalizados.length !== usuarios.length) {
      localStorage.setItem(USUARIOS_KEY, JSON.stringify(usuariosNormalizados))
    }

    return usuariosNormalizados
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
  } catch {
    const padrao = usuariosPadrao()
    localStorage.setItem(USUARIOS_KEY, JSON.stringify(padrao))
    return padrao
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
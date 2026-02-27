// src/services/authService.js
// Serviço simples de autenticação usando localStorage.
// Providencia login(nome, senha) e getUsuarioPorId(id).
// Também inicializa usuários padrão (admin / funcionario) se não houver nenhum registrado.

const STORAGE_KEY = 'sistema-comandas:usuarios'

function gerarId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function getUsuariosRaw() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveUsuarios(users) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users || []))
}

function garantirUsuariosPadrao() {
  const usuarios = getUsuariosRaw()
  const lista = Array.isArray(usuarios) ? [...usuarios] : []

  const temAdmin = lista.some((u) => String(u?.nome).toLowerCase() === 'admin')
  const temFuncionario = lista.some((u) => String(u?.nome).toLowerCase() === 'funcionario')

  if (!temAdmin) {
    lista.push({
      id: gerarId(),
      nome: 'admin',
      senha: 'admin123',
      perfil: 'admin',
      nomeExibicao: 'Administrador',
    })
  }

  if (!temFuncionario) {
    lista.push({
      id: gerarId(),
      nome: 'funcionario',
      senha: 'func123',
      perfil: 'funcionario',
      nomeExibicao: 'Funcionário',
    })
  }

  if (lista.length !== usuarios.length) {
    saveUsuarios(lista)
  }

  return lista
}

/**
 * Retorna array de usuários (sem remover senha — o serviço é local).
 * Use com cuidado em UI (não expor senha).
 */
export function getUsuarios() {
  garantirUsuariosPadrao()
  return getUsuariosRaw()
}

/**
 * Retorna usuário pelo id (ou null)
 */
export function getUsuarioPorId(id) {
  if (!id) return null
  const usuarios = getUsuarios()
  return usuarios.find((u) => String(u.id) === String(id)) || null
}

/**
 * Tenta logar com nome e senha.
 * Retorna o usuário (sem senha) se sucesso, ou null se falhar.
 * Observação: comparações são case-sensitive para senha e nome.
 */
export function login(nome, senha) {
  if (!nome || !senha) return null
  garantirUsuariosPadrao()
  const usuarios = getUsuariosRaw()
  const usuario = usuarios.find(
    (u) => String(u.nome) === String(nome) && String(u.senha) === String(senha)
  )
  if (!usuario) return null

  // Retornamos o objeto sem a senha para segurança na camada de UI
  const { senha: _s, ...rest } = usuario
  return { ...rest }
}

/**
 * Cria um novo usuário. Retorna o usuário criado (sem senha removida).
 * Se já existir usuário com mesmo nome, retorna null.
 */
export function criarUsuario({ nome, senha, perfil = 'funcionario', nomeExibicao }) {
  if (!nome || !senha) return null
  garantirUsuariosPadrao()
  const usuarios = getUsuariosRaw()
  if (usuarios.some((u) => String(u.nome) === String(nome))) return null

  const novo = {
    id: gerarId(),
    nome,
    senha,
    perfil,
    nomeExibicao: nomeExibicao || nome,
  }
  usuarios.push(novo)
  saveUsuarios(usuarios)
  const { senha: _s, ...rest } = novo
  return rest
}

/**
 * Remove usuário por id. Retorna true se removido, false caso contrário.
 */
export function removerUsuario(id) {
  if (!id) return false
  const usuarios = getUsuariosRaw()
  const filtrado = usuarios.filter((u) => String(u.id) !== String(id))
  if (filtrado.length === usuarios.length) return false
  saveUsuarios(filtrado)
  return true
}

/**
 * Atualiza usuário (nomeExibicao, perfil, senha opcional). Retorna usuário (sem senha) ou null.
 */
export function atualizarUsuario(id, { nome, senha, perfil, nomeExibicao } = {}) {
  if (!id) return null
  const usuarios = getUsuariosRaw()
  const idx = usuarios.findIndex((u) => String(u.id) === String(id))
  if (idx === -1) return null

  // Previne sobrescrever nome para um já existente (exceto o próprio)
  if (nome && usuarios.some((u, i) => i !== idx && String(u.nome) === String(nome))) {
    return null
  }

  const u = usuarios[idx]
  usuarios[idx] = {
    ...u,
    nome: nome ?? u.nome,
    senha: senha ?? u.senha,
    perfil: perfil ?? u.perfil,
    nomeExibicao: nomeExibicao ?? u.nomeExibicao,
  }
  saveUsuarios(usuarios)
  const { senha: _s, ...rest } = usuarios[idx]
  return rest
}
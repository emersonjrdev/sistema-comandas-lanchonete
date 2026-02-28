import { apiRequest } from './api'

export async function getUsuarios() {
  return apiRequest('/usuarios')
}

export async function getUsuarioPorId(id) {
  if (!id) return null
  const usuarios = await getUsuarios()
  return usuarios.find((u) => String(u.id) === String(id)) || null
}

export async function login(nome, senha) {
  if (!nome || !senha) return null
  return apiRequest('/auth/login', {
    method: 'POST',
    body: { nome, senha },
  })
}

export async function criarUsuario({ nome, senha, perfil = 'funcionario' }) {
  if (!nome || !senha) return null
  return apiRequest('/usuarios', {
    method: 'POST',
    body: { nome, senha, perfil },
  })
}

// Endpoints de atualização/remoção de usuário não existem ainda na API.
export async function removerUsuario() {
  return false
}

export async function atualizarUsuario() {
  return null
}
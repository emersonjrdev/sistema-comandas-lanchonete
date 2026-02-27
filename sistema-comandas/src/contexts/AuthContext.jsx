import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { login as loginService, getUsuarioPorId } from '../services/authService'

export const AuthContext = createContext(null) // ✅ apenas isso foi alterado

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [carregando, setCarregando] = useState(true)

  const login = useCallback((nome, senha) => {
    const u = loginService(nome, senha)
    if (u) {
      setUsuario(u)
      localStorage.setItem('sistema-comandas:usuario-id', u.id)
      return { sucesso: true }
    }
    return { sucesso: false, erro: 'Usuário ou senha inválidos' }
  }, [])

  const logout = useCallback(() => {
    setUsuario(null)
    localStorage.removeItem('sistema-comandas:usuario-id')
  }, [])

  useEffect(() => {
    const id = localStorage.getItem('sistema-comandas:usuario-id')
    if (id) {
      const u = getUsuarioPorId(id)
      setUsuario(u || null)
    }
    setCarregando(false)
  }, [])

  const value = {
    usuario,
    carregando,
    login,
    logout,
    isAdmin: usuario?.perfil === 'admin',
    isFuncionario: usuario?.perfil === 'funcionario',
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return ctx
}
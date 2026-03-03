import { useState, useRef, useEffect } from 'react'
import { playSomVenda, playSomErro } from '../utils/sons'

export default function Login({ onLogin }) {
  const [nome, setNome] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const nomeRef = useRef(null)

  useEffect(() => {
    nomeRef.current?.focus()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    let resultado = null
    try {
      resultado = await onLogin(nome.trim(), senha)
    } catch (error) {
      playSomErro()
      setErro(error?.message || 'Erro ao conectar com o servidor')
      return
    }
    if (resultado.sucesso) {
      playSomVenda()
      return
    }
    playSomErro()
    setErro(resultado.erro || 'Erro ao fazer login')
    setSenha('')
  }

  return (
    <div className="min-h-screen bg-amber-50/80 flex items-center justify-center p-4 md:p-6">
      <div className="w-full max-w-md md:max-w-lg">
        <div className="bg-white rounded-2xl border-2 border-amber-200 shadow-xl p-6 md:p-8">
          <div className="text-center mb-6">
            <img
              src="/logo-padaria.png"
              alt="Logo Padaria Grande Família"
              className="h-20 w-20 md:h-24 md:w-24 mx-auto mb-3 object-contain rounded-full"
            />
            <h1 className="text-2xl md:text-3xl font-bold text-amber-900">
              Padaria Grande Familia
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {erro && (
              <div
                role="alert"
                className="p-4 rounded-lg bg-red-100 text-red-700 border border-red-200"
              >
                {erro}
              </div>
            )}
            <div>
              <label
                htmlFor="nome"
                className="block text-sm font-medium text-amber-900 mb-2"
              >
                Usuário
              </label>
              <input
                ref={nomeRef}
                id="nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full px-4 py-3 md:py-4 rounded-lg border-2 border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-amber-900"
                placeholder="Nome do usuário"
                required
                autoComplete="username"
              />
            </div>
            <div>
              <label
                htmlFor="senha"
                className="block text-sm font-medium text-amber-900 mb-2"
              >
                Senha
              </label>
              <input
                id="senha"
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full px-4 py-3 md:py-4 rounded-lg border-2 border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-amber-900"
                placeholder="Senha"
                required
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              className="w-full py-4 rounded-xl bg-amber-600 text-white font-bold text-lg hover:bg-amber-700 transition-colors touch-manipulation shadow-lg"
            >
              Entrar
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
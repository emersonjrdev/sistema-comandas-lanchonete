import { useState, useRef, useEffect } from 'react'

export default function Login({ onLogin }) {
  const [nome, setNome] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const nomeRef = useRef(null)

  useEffect(() => {
    nomeRef.current?.focus()
  }, [])

  function handleSubmit(e) {
    e.preventDefault()
    setErro('')
    const resultado = onLogin(nome.trim(), senha)
    if (resultado.sucesso) return
    setErro(resultado.erro || 'Erro ao fazer login')
    setSenha('')
  }

  return (
    <div className="min-h-screen bg-amber-50/80 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl border-2 border-amber-200 shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-amber-900">
              Padaria Grande Família
            </h1>
            <p className="text-stone-500 mt-2">PDV - Faça login para continuar</p>
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
                className="w-full px-4 py-3 rounded-lg border-2 border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-amber-900"
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
                className="w-full px-4 py-3 rounded-lg border-2 border-amber-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none text-amber-900"
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

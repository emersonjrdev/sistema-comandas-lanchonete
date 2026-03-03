const configuredBase = String(import.meta.env.VITE_API_URL || '').trim()
const fallbackBase = import.meta.env.DEV ? 'http://localhost:3001' : ''
const API_BASE_URL = (configuredBase || fallbackBase).replace(/\/+$/, '')

export function getApiBaseUrl() {
  return API_BASE_URL
}

export async function apiRequest(path, { method = 'GET', body, headers } = {}) {
  const defaultHeaders = body !== undefined ? { 'Content-Type': 'application/json' } : {}
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        ...defaultHeaders,
        ...(headers || {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error(
      `Não foi possível conectar à API (${API_BASE_URL || window.location.origin}). Verifique VITE_API_URL e CORS_ORIGIN.`
    )
  }

  if (!response.ok) {
    let message = `Erro HTTP ${response.status}`
    try {
      const payload = await response.json()
      if (payload?.error) message = payload.error
    } catch {
      // Ignora parse e usa mensagem padrão.
    }
    throw new Error(message)
  }

  if (response.status === 204) return null
  return response.json()
}

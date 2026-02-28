const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/+$/, '')

export function getApiBaseUrl() {
  return API_BASE_URL
}

export async function apiRequest(path, { method = 'GET', body, headers } = {}) {
  const defaultHeaders = body !== undefined ? { 'Content-Type': 'application/json' } : {}
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      ...defaultHeaders,
      ...(headers || {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

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

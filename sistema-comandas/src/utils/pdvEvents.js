const DEBOUNCE_MS = 350
let debounceTimer = null

/** Dispara atualização para hooks do PDV (agrupa várias mudanças seguidas). */
export function emitPdvStorageUpdate() {
  if (debounceTimer != null) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    window.dispatchEvent(new CustomEvent('pdv:storage-update'))
  }, DEBOUNCE_MS)
}

export function subscribePdvStorageUpdate(handler) {
  window.addEventListener('pdv:storage-update', handler)
  return () => window.removeEventListener('pdv:storage-update', handler)
}

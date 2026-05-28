/** Evita refreshes sobrepostos; agenda um novo se chegar pedido durante execução. */
export function createRefreshRunner(runFn) {
  let inFlight = false
  let scheduled = false

  async function run() {
    if (inFlight) {
      scheduled = true
      return
    }
    inFlight = true
    try {
      await runFn()
    } finally {
      inFlight = false
      if (scheduled) {
        scheduled = false
        await run()
      }
    }
  }

  return run
}

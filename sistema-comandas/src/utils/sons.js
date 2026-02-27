export function playSomVenda() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime)
    oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1)
    oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2)

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.4)
  } catch {
    // Fallback silencioso se AudioContext não disponível
  }
}

export function playSomAcao() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.type = 'triangle'
    oscillator.frequency.setValueAtTime(440, audioContext.currentTime)
    oscillator.frequency.linearRampToValueAtTime(520, audioContext.currentTime + 0.08)

    gainNode.gain.setValueAtTime(0.12, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.12)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.12)
  } catch {
    // Fallback silencioso
  }
}

export function playSomErro() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.frequency.setValueAtTime(200, audioContext.currentTime)
    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15)

    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.15)
  } catch {
    // Fallback silencioso
  }
}

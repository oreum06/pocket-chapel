// 말씀 읽어주기: AI 낭독 mp3가 있으면 그걸, 없으면 기기 내장 한국어 음성
let current = null
export function stopSpeaking() {
  try { speechSynthesis.cancel() } catch { /* 지원 안 함 */ }
  if (current) { current.pause(); current = null }
}
export function speak(verse, onEnd) {
  stopSpeaking()
  if (verse.audio) {
    current = new Audio(verse.audio)
    current.onended = onEnd
    current.play().catch(onEnd)
    return
  }
  try {
    const u = new SpeechSynthesisUtterance(`${verse.ref} 말씀. ${verse.text}`)
    u.lang = 'ko-KR'
    u.rate = 0.9
    const ko = speechSynthesis.getVoices().find((x) => x.lang.startsWith('ko'))
    if (ko) u.voice = ko
    u.onend = onEnd
    u.onerror = onEnd
    speechSynthesis.speak(u)
  } catch { onEnd && onEnd() }
}

// 효과음 (고양이, 이모트 등)
// - public/sfx/ 의 짧은 소리를 Web Audio로 재생 (여러 소리가 겹쳐도 OK)
// - 아이폰은 "터치한 순간"이 아니면 소리를 막아서, 첫 터치 때 소리 장치를 깨워 둠
// - 🔈/🔇 효과음 끄기 상태는 이 기기에 기억
import { store } from './api.js'

// 소리 목록: 이름 → 파일
// 캐릭터별 목소리는 'hello-pinky' 처럼 "이름-캐릭터" 로 추가하면 그 캐릭터만 그 소리를 써요.
export const SOUNDS = {
  'cat-meow': 'sfx/cat-meow.mp3',
  'cat-purr': 'sfx/cat-purr.mp3',
  'cat-nyang': 'sfx/cat-nyang.mp3',
}

let ctx = null
const buffers = {}
let muted = store.get('sfx-muted') === true

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  return ctx
}

// 첫 터치/클릭 때 소리 장치를 깨우고, 소리 파일을 미리 받아 둠
function unlock() {
  const c = getCtx()
  if (!c) return
  c.resume().catch(() => {})
  for (const name of Object.keys(SOUNDS)) load(name)
}
window.addEventListener('pointerdown', unlock, { capture: true })
window.addEventListener('touchend', unlock, { capture: true })

function load(name) {
  if (!buffers[name]) {
    buffers[name] = fetch(SOUNDS[name])
      .then((r) => r.arrayBuffer())
      .then((data) => new Promise((ok, fail) => getCtx().decodeAudioData(data, ok, fail)))
      .catch(() => { delete buffers[name]; return null })
  }
  return buffers[name]
}

// 캐릭터 전용 소리가 있으면 그걸, 없으면 기본 소리
export const soundFor = (name, char) => (char && SOUNDS[`${name}-${char}`] ? `${name}-${char}` : SOUNDS[name] ? name : null)

export async function playSfx(name, volume = 1) {
  if (muted || !name || !SOUNDS[name]) return
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => {})
  const buf = await load(name)
  if (!buf) return
  const src = c.createBufferSource()
  const g = c.createGain()
  src.buffer = buf
  g.gain.value = volume
  src.connect(g).connect(c.destination)
  src.start()
}

export const isMuted = () => muted
export function setMuted(v) {
  muted = v
  store.set('sfx-muted', v)
}

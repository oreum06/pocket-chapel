// 실시간 함께하기
// - Supabase 설정이 있으면: Supabase Realtime (다른 기기·다른 집끼리)
// - 없으면: 같은 브라우저의 다른 탭끼리만 (테스트용)
import { getSupabase, hasSupabase } from './supabase.js'

export async function roomIdFromCode(code) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ourhome:' + code))
  return [...new Uint8Array(buf)].slice(0, 10).map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function connect(opts) {
  if (hasSupabase()) {
    try {
      return await connectSupabase(opts)
    } catch (e) {
      console.warn('Supabase 연결 실패, 로컬 모드로 전환', e)
    }
  }
  return connectLocal(opts)
}

// Supabase 규칙: Presence(접속 표시)는 한 사람이 30초에 5번까지만 바꿀 수 있고,
// 넘으면 그 사람의 연결이 끊겨요. 그래서
//   - Presence: "누가 접속해 있는지"(이름·캐릭터)만, 들어올 때 한 번
//   - Broadcast: 위치·방·자세·예배 순서처럼 자주 바뀌는 것 (횟수 제한 걱정 없음)
async function connectSupabase({ room, id, state, onPeers, onEvent }) {
  const client = await getSupabase()
  let latest = { ...state, ts: Date.now() }
  let online = {} // 접속 중인 사람: id -> { name, char }
  const states = {} // 각자 마지막으로 알려 준 상태: id -> { room, x, y, pose, ... }
  let ch = null
  let joined = false

  const flush = () => {
    const out = {}
    for (const [k, meta] of Object.entries(online)) if (k !== id) out[k] = { ...meta, ...(states[k] || {}) }
    onPeers(out)
  }
  const profile = (s) => ({ name: s.name, char: s.char })
  let trackedProfile = ''
  const trackProfile = () => {
    if (!joined) return
    trackedProfile = JSON.stringify(profile(latest))
    ch.track(profile(latest)).catch(() => {})
  }
  const sendState = () => {
    if (joined) ch.send({ type: 'broadcast', event: 'st', payload: { id, s: latest } }).catch(() => {})
  }

  let restartTimer = null
  const restart = () => {
    if (restartTimer) return
    restartTimer = setTimeout(async () => {
      restartTimer = null
      const old = ch
      ch = null
      joined = false
      try { if (old) await client.removeChannel(old) } catch { /* 이미 닫힘 */ }
      start().catch(restart)
    }, 3000)
  }

  const start = () => new Promise((ok, fail) => {
    const c = client.channel('home-' + room, { config: { presence: { key: id }, broadcast: { self: false } } })
    ch = c
    c.on('presence', { event: 'sync' }, () => {
      const next = {}
      for (const [k, metas] of Object.entries(c.presenceState())) if (metas.length) next[k] = metas[metas.length - 1]
      const newcomer = Object.keys(next).some((k) => k !== id && !online[k])
      online = next
      for (const k of Object.keys(states)) if (!online[k]) delete states[k]
      flush()
      // 새로 들어온 사람이 내 위치를 알 수 있게 한 번 더 알려 줌
      if (newcomer) setTimeout(sendState, 300 + Math.random() * 700)
    })
    c.on('broadcast', { event: 'st' }, ({ payload }) => {
      if (!payload || payload.id === id) return
      states[payload.id] = payload.s
      flush()
    })
    c.on('broadcast', { event: 'ev' }, ({ payload }) => onEvent(payload))

    let first = true
    const t = setTimeout(() => { if (first) { first = false; fail(new Error('timeout')) } }, 10000)
    c.subscribe((status) => {
      if (c !== ch) return // 이전 연결에서 온 소식은 무시
      if (status === 'SUBSCRIBED') {
        joined = true
        trackProfile()
        sendState()
        if (first) { first = false; clearTimeout(t); ok() }
      } else {
        joined = false
        if (first && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')) { first = false; clearTimeout(t); fail(new Error(status)) }
        else if (!first) restart() // 끊기면 3초 뒤 다시 연결
      }
    })
  })

  await start()

  let timer = null
  const update = (s) => {
    latest = { ...s, ts: Date.now() }
    if (JSON.stringify(profile(latest)) !== trackedProfile) trackProfile() // 이름·캐릭터를 바꿨을 때만
    if (timer) return
    timer = setTimeout(() => { timer = null; sendState() }, 150)
  }
  // 안전장치: 15초마다, 화면에 돌아왔을 때, 인터넷이 다시 연결됐을 때 내 상태를 다시 알림
  const heal = () => { if (joined) sendState(); else restart() }
  setInterval(sendState, 15000)
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') heal() })
  window.addEventListener('online', heal)
  window.addEventListener('beforeunload', () => { if (ch) ch.untrack() })

  return {
    mode: 'live',
    update,
    emit: (ev) => { if (joined) ch.send({ type: 'broadcast', event: 'ev', payload: { ...ev, from: id } }).catch(() => {}) },
  }
}

function connectLocal({ room, id, state, onPeers, onEvent }) {
  const bc = new BroadcastChannel('home-' + room)
  const peers = {}
  let mine = state
  const flush = () => {
    const now = Date.now(), out = {}
    for (const [k, v] of Object.entries(peers)) {
      if (now - v.seen > 6000) delete peers[k]
      else out[k] = v.state
    }
    onPeers(out)
  }
  bc.onmessage = ({ data }) => {
    if (!data || data.id === id) return
    if (data.t === 'state' || data.t === 'hello') {
      peers[data.id] = { state: data.state, seen: Date.now() }
      if (data.t === 'hello') bc.postMessage({ t: 'state', id, state: mine })
      flush()
    } else if (data.t === 'bye') { delete peers[data.id]; flush() }
    else if (data.t === 'ev') onEvent({ ...data.ev, from: data.id })
  }
  bc.postMessage({ t: 'hello', id, state: mine })
  const iv = setInterval(() => { bc.postMessage({ t: 'state', id, state: mine }); flush() }, 2000)
  window.addEventListener('beforeunload', () => bc.postMessage({ t: 'bye', id }))
  return {
    mode: 'local',
    update: (s) => { mine = s; bc.postMessage({ t: 'state', id, state: s }) },
    emit: (ev) => bc.postMessage({ t: 'ev', id, ev }),
    close: () => { clearInterval(iv); bc.close() },
  }
}

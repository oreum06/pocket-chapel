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

async function connectSupabase({ room, id, state, onPeers, onEvent }) {
  const client = await getSupabase()
  const ch = client.channel('home-' + room, { config: { presence: { key: id }, broadcast: { self: false } } })
  ch.on('presence', { event: 'sync' }, () => {
    const peers = {}
    for (const [key, metas] of Object.entries(ch.presenceState())) {
      if (key !== id && metas.length) peers[key] = metas[metas.length - 1]
    }
    onPeers(peers)
  })
  ch.on('broadcast', { event: 'ev' }, ({ payload }) => onEvent(payload))

  // 내 최신 상태. 연결이 끊겼다 다시 붙으면(휴대폰 화면 꺼짐, 앱 전환 등)
  // Supabase가 내 "접속 중" 표시를 지워 버리므로, 다시 붙을 때마다 새로 알려야 해요.
  let latest = state
  let joined = false
  const announce = () => { if (joined) ch.track(latest).catch(() => {}) }

  await new Promise((ok, fail) => {
    let first = true
    const t = setTimeout(() => fail(new Error('timeout')), 10000)
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        joined = true
        announce() // 처음 연결 + 다시 연결될 때마다
        if (first) { first = false; clearTimeout(t); ok() }
      } else {
        joined = false
        if (first && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')) { clearTimeout(t); fail(new Error(status)) }
      }
    })
  })

  let timer = null
  const update = (s) => {
    latest = s
    if (timer) return
    timer = setTimeout(() => { timer = null; announce() }, 250)
  }
  // 혹시 놓치는 경우를 대비한 안전장치: 화면으로 돌아왔을 때, 인터넷이 다시 연결됐을 때, 30초마다
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') announce() })
  window.addEventListener('online', announce)
  setInterval(announce, 30000)
  window.addEventListener('beforeunload', () => ch.untrack())
  return { mode: 'live', update, emit: (ev) => ch.send({ type: 'broadcast', event: 'ev', payload: { ...ev, from: id } }) }
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

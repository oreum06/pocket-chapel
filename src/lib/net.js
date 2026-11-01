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
  await new Promise((ok, fail) => {
    const t = setTimeout(() => fail(new Error('timeout')), 10000)
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') { clearTimeout(t); ok() }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(t); fail(new Error(status)) }
    })
  })
  let pending = null, timer = null
  const update = (s) => {
    pending = s
    if (timer) return
    timer = setTimeout(() => { timer = null; ch.track(pending) }, 250)
  }
  update(state)
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

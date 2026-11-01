import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Scene from './components/Scene.jsx'
import WorshipTV, { WORSHIP_STEPS } from './components/WorshipTV.jsx'
import {
  Sheet, RoomsPanel, PrayPanel, MusicPanel, WordPanel, RequestsPanel, BoardPanel,
  ThanksPanel, SayPanel, MorePanel, CharPicker, STEPS, verseOfDay,
} from './components/Panels.jsx'
import { CONFIG } from './config.js'
import { roomById } from './data/rooms.js'
import { CHARS } from './data/chars.js'
import { api, login, store, todayKey } from './lib/api.js'
import { connect, roomIdFromCode } from './lib/net.js'
import { Music } from './lib/music.js'
import { speak, stopSpeaking } from './lib/speech.js'

const uid = store.get('uid') || crypto.randomUUID()
store.set('uid', uid)

export default function App() {
  const [profile, setProfile] = useState(() => store.get('profile'))
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    // 저장된 정보가 있으면 바로 입장
    if (profile?.code) login(profile.code).then(() => setEntered(true)).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!entered) {
    return (
      <Gate
        initial={profile}
        onEnter={async (p) => {
          await login(p.code)
          store.set('profile', p)
          setProfile(p)
          setEntered(true)
        }}
      />
    )
  }
  return (
    <Home
      profile={profile}
      setProfile={(p) => { store.set('profile', p); setProfile(p) }}
      onLogout={() => { store.set('profile', null); location.reload() }}
    />
  )
}

// ================= 입장 화면 =================
function Gate({ initial, onEnter }) {
  const [name, setName] = useState(initial?.name || '')
  const [char, setChar] = useState(initial?.char || CHARS[0].id)
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const go = async () => {
    if (!name.trim() || !code.trim()) return setMsg('이름과 모임 코드를 입력해 주세요')
    setBusy(true)
    try { await onEnter({ name: name.trim(), char, code: code.trim() }) } catch (e) { setMsg(e.message) }
    setBusy(false)
  }
  return (
    <div className="gate">
      <img className="gate-bg" src="rooms/living.webp" alt="" />
      <motion.div className="gate-card" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 20 }}>
        <p className="gate-eyebrow">🏠 가정과 이웃이 함께하는 온라인 예배</p>
        <h1>{CONFIG.groupName}</h1>
        <p className="muted">나를 닮은 친구를 골라 주세요</p>
        <CharPicker value={char} onChange={setChar} />
        <input value={name} maxLength={12} onChange={(e) => setName(e.target.value)} placeholder="이름 (예: 김성도)" />
        <input value={code} maxLength={40} type="password" onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} placeholder="모임 코드" />
        <button className="btn primary wide big" disabled={busy} onClick={go}>우리 집으로 들어가기</button>
        {msg && <p className="error">{msg}</p>}
      </motion.div>
    </div>
  )
}

// ================= 집 안 =================
const EMOTES = {
  hello: { text: '안녕하세요 😊', emoji: '👋', hop: true },
  amen: { text: '아멘 🙏', emoji: '✨' },
  clap: { text: '👏👏👏', emoji: '👏', hop: true },
  love: { text: '사랑해요 💕', emoji: '💕' },
  tea: { text: '따뜻한 차 한잔 드세요 ☕', emoji: '☕' },
  melon: { text: '수박 드세요! 🍉', emoji: '🍉', hop: true },
  bread: { text: '빵 나눠 먹어요 🍞', emoji: '🍞' },
}

function Home({ profile, setProfile, onLogout }) {
  const music = useMemo(() => new Music(), [])
  const [roomId, setRoomId] = useState('living') // 들어올 때는 모두 거실에서 만나요
  const room = roomById(roomId)
  const [pos, setPos] = useState(room.start)
  const [pose, setPose] = useState('stand')
  const [peers, setPeers] = useState({})
  const [bubbles, setBubbles] = useState({})
  const [hops, setHops] = useState({})
  const [effects, setEffects] = useState([])
  const [sheet, setSheet] = useState(null)
  const [toast, setToast] = useState(null)
  const [done, setDone] = useState(() => store.get('steps-' + todayKey()) || [])
  const [lampOff, setLampOff] = useState(false)
  const [prayer, setPrayer] = useState(null) // { left, opts }
  const [worship, setWorship] = useState({ step: 0, t: 0 })
  const [requests, setRequests] = useState([])
  const [catBubble, setCatBubble] = useState(null)
  const [live, setLive] = useState(false)
  const net = useRef(null)
  const roomRef = useRef(roomId)
  const posRef = useRef(pos)
  const peersRef = useRef(peers)
  const worshipRef = useRef(worship)
  useEffect(() => {
    roomRef.current = roomId
    posRef.current = pos
    peersRef.current = peers
    worshipRef.current = worship
  })

  // ---------- 작은 도우미 ----------
  const showToast = useCallback((text) => {
    const id = Math.random()
    setToast({ id, text })
    setTimeout(() => setToast((t) => (t && t.id === id ? null : t)), 2600)
  }, [])

  const markStep = useCallback((k) => {
    setDone((d) => {
      if (d.includes(k)) return d
      const next = [...d, k]
      store.set('steps-' + todayKey(), next)
      const label = STEPS.find((s) => s[0] === k)[1]
      setTimeout(() => showToast(next.length === STEPS.length ? '🌳 오늘의 발자국을 모두 채웠어요!' : `🌱 ${label} (${next.length}/4)`), 0)
      return next
    })
  }, [showToast])

  const say = useCallback((id, text, ms = 3500) => {
    const bid = Math.random()
    setBubbles((b) => ({ ...b, [id]: { text, id: bid } }))
    setTimeout(() => setBubbles((b) => (b[id]?.id === bid ? { ...b, [id]: null } : b)), ms)
  }, [])

  const burst = useCallback((id, emoji, n = 3) => {
    const p = id === uid ? posRef.current : peersRef.current[id]
    if (!p) return
    const r = roomById(roomRef.current)
    const items = Array.from({ length: n }, (_, i) => ({ id: Math.random(), emoji, x: p.x + (i - (n - 1) / 2) * 0.02, y: p.y - r.charH * 0.8 }))
    setEffects((e) => [...e.slice(-20), ...items])
    setTimeout(() => setEffects((e) => e.filter((f) => !items.includes(f))), 2000)
  }, [])

  const showEmote = useCallback((id, kind) => {
    const e = EMOTES[kind]
    if (!e) return
    say(id, e.text)
    burst(id, e.emoji)
    if (e.hop) setHops((h) => ({ ...h, [id]: Date.now() }))
  }, [say, burst])

  const emote = useCallback((kind) => {
    showEmote(uid, kind)
    net.current?.emit({ type: 'emote', kind, room: roomRef.current })
  }, [showEmote])

  const sayAloud = useCallback((text) => {
    say(uid, text, 5000)
    net.current?.emit({ type: 'say', text, room: roomRef.current })
  }, [say])

  // ---------- 실시간 연결 ----------
  const myState = { name: profile.name, char: profile.char, room: roomId, x: pos.x, y: pos.y, pose, worship }
  const myStateRef = useRef(myState)
  useEffect(() => { myStateRef.current = myState })

  useEffect(() => {
    let alive = true
    ;(async () => {
      const r = await roomIdFromCode(profile.code)
      const n = await connect({
        room: r,
        id: uid,
        state: myStateRef.current,
        onPeers: (list) => {
          setPeers(list)
          // 가장 최근에 바뀐 예배 순서를 따라감 (늦게 들어온 사람도 같은 화면)
          let newest = worshipRef.current
          for (const p of Object.values(list)) if (p.worship && p.worship.t > newest.t) newest = p.worship
          if (newest !== worshipRef.current) setWorship(newest)
        },
        onEvent: (ev) => {
          if (ev.type === 'worship') {
            if (ev.t > worshipRef.current.t) setWorship({ step: ev.step, t: ev.t })
            return
          }
          if (ev.room !== roomRef.current) return
          if (ev.type === 'emote') showEmote(ev.from, ev.kind)
          if (ev.type === 'say') say(ev.from, ev.text, 5000)
        },
      })
      if (!alive) return n.close?.()
      net.current = n
      setLive(n.mode === 'live')
      setTimeout(() => emote('hello'), 1200)
    })()
    return () => { alive = false; net.current?.close?.(); net.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.code])

  useEffect(() => {
    net.current?.update(myStateRef.current)
  }, [profile.name, profile.char, roomId, pos.x, pos.y, pose, worship.t])

  // ---------- 개인 기도 ----------
  const stopPrayer = useCallback((finished) => {
    setPrayer(null)
    setPose('stand')
    setLampOff(false)
    music.stop()
    if (finished) {
      music.bell()
      emote('amen')
      markStep('pray')
      api('attendance', { method: 'POST', body: JSON.stringify({ name: profile.name }) }).catch(() => {})
    }
  }, [music, emote, markStep, profile.name])

  useEffect(() => {
    if (!prayer) return
    const t = setTimeout(() => {
      if (prayer.left <= 1) stopPrayer(true)
      else setPrayer((p) => (p ? { ...p, left: p.left - 1 } : p))
    }, 1000)
    return () => clearTimeout(t)
  }, [prayer, stopPrayer])

  const startPrayer = (min, opts) => {
    setSheet(null)
    const dim = opts.dim && roomId === 'bedroom'
    if (roomId === 'bedroom') setPos(room.spots.find((s) => s.action === 'pray').stand)
    if (opts.music && !music.playing) music.play('synth', 0)
    if (dim) setLampOff(true)
    setPose('pray')
    setPrayer({ left: min * 60 })
  }

  // ---------- 가정예배 (거실 TV) ----------
  const prevStep = useRef(0)
  const verse = verseOfDay()
  useEffect(() => {
    const step = worship.step
    const prev = prevStep.current
    prevStep.current = step
    if (step === prev || roomId !== 'living') return
    if (step === 0) { music.stop(); stopSpeaking(); setPose('stand'); return }
    if (step === 1) { music.play(CONFIG.hymns.length ? 'mp3' : 'synth', 0); markStep('praise'); setPose('stand') } // mp3 찬양이 있으면 첫 곡으로
    if (step === 2) { music.duck(true); speak(verse, () => music.duck(false)); markStep('word') }
    if (step === 3) {
      stopSpeaking()
      music.duck(true)
      setPose('pray')
      api('prayers').then((l) => setRequests(l.slice(0, 10))).catch(() => {})
    }
    if (step === 4) {
      music.stop()
      music.bell()
      setPose('stand')
      burst(uid, '💕', 5)
      markStep('pray')
      api('attendance', { method: 'POST', body: JSON.stringify({ name: profile.name }) }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worship.step, worship.t])

  const setWorshipStep = (step) => {
    const w = { step, t: Date.now() }
    setWorship(w)
    net.current?.emit({ type: 'worship', ...w })
  }

  // ---------- 이동 ----------
  const goRoom = (id) => {
    if (prayer) stopPrayer(false)
    if (roomId === 'living' && worship.step > 0) { music.stop(); stopSpeaking() }
    // 거실로 돌아올 때 이미 진행 중인 순서는 효과(음악 등)를 다시 시작하지 않음
    prevStep.current = worship.step
    setLampOff(false)
    setPose('stand')
    setSheet(null)
    setRoomId(id)
    setPos(roomById(id).start)
  }

  const moveTo = (p) => {
    if (prayer) stopPrayer(false)
    else if (pose === 'pray') setPose('stand')
    setPos(p)
  }

  const onSpot = (s) => {
    moveTo(s.stand)
    setTimeout(() => {
      switch (s.action) {
        case 'worship':
          if (worshipRef.current.step === 0) setWorshipStep(1)
          else showToast('가정예배가 진행 중이에요')
          break
        case 'lamp': setLampOff((v) => !v); break
        case 'cat':
          setCatBubble({ id: Math.random(), text: ['냐옹~ 💤', '고롱고롱…', '냥! 🐾'][Math.floor(Math.random() * 3)], x: (s.x0 + s.x1) / 2, y: s.y0 })
          setTimeout(() => setCatBubble(null), 2200)
          break
        case 'music': music.bell(); setSheet('music'); break
        case 'tea': case 'melon': case 'bread': emote(s.action); break
        default: setSheet(s.action)
      }
    }, 450)
  }

  // ---------- 화면에 그릴 캐릭터 ----------
  const avatars = [
    { id: uid, isMe: true, name: profile.name, char: profile.char, x: pos.x, y: pos.y, pose, bubble: bubbles[uid], hopAt: hops[uid] },
    ...Object.entries(peers)
      .filter(([, p]) => p.room === roomId)
      .map(([id, p]) => ({ id, name: p.name, char: p.char, x: p.x, y: p.y, pose: p.pose, bubble: bubbles[id], hopAt: hops[id] })),
  ]
  const counts = {}
  for (const p of [myState, ...Object.values(peers)]) counts[p.room] = (counts[p.room] || 0) + 1
  const total = Object.keys(peers).length + 1
  const songTitle = (CONFIG.hymns[0]?.title || music.songs[0].title).replace('피아노 · ', '')

  const SHEETS = {
    rooms: ['🏠 어느 방으로 갈까요?', <RoomsPanel current={roomId} counts={counts} onGo={goRoom} />],
    pray: ['🕯️ 얼마나 기도할까요?', <PrayPanel inBedroom={roomId === 'bedroom'} onStart={startPrayer} />],
    music: ['🎵 찬양', <MusicPanel music={music} onPlay={() => markStep('praise')} />],
    word: ['📖 오늘의 말씀', <WordPanel onRead={(v) => { music.duck(true); speak(v, () => { music.duck(false); markStep('word') }) }} onAmen={() => { markStep('word'); emote('amen'); setSheet(null) }} />],
    requests: ['🍞 식탁 교제 · 기도제목', <RequestsPanel me={profile} onShared={() => sayAloud('기도제목을 나눴어요 🙏')} onTogether={() => markStep('together')} />],
    board: ['🧊 냉장고 메모', <BoardPanel done={done} />],
    thanks: ['💛 감사 노트', <ThanksPanel />],
    say: ['💬 한마디', <SayPanel onSay={(t) => { sayAloud(t); setSheet(null) }} />],
    more: ['⋯ 더보기', <MorePanel me={profile} live={live} onLogout={onLogout} onSave={(p) => { setProfile({ ...profile, ...p }); showToast('저장했어요') }} />],
  }

  return (
    <div className="home">
      <AnimatePresence mode="wait">
        <motion.div key={roomId} className="room-fade" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}>
          <Scene
            room={room}
            avatars={avatars}
            myPos={pos}
            onMove={moveTo}
            onSpot={onSpot}
            lampOff={lampOff}
            effects={effects}
            catBubble={catBubble}
            tv={room.tv && <WorshipTV step={worship.step} verse={verse} songTitle={songTitle} requests={requests} />}
          />
        </motion.div>
      </AnimatePresence>

      {/* 위쪽 */}
      <header className="hud-top">
        <button className="hud-card" onClick={() => setSheet('rooms')}>
          <span className="hud-title">{CONFIG.groupName}</span>
          <span className="hud-sub">{room.emoji} {room.name} · {new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' })}</span>
        </button>
        <div className="hud-pills">
          <span className="pill" title={live ? '실시간 연결됨' : 'Supabase를 설정하면 다른 집과 함께할 수 있어요 (README 참고)'}>
            {live ? '🟢' : '🟡'} {total}명{live ? ' 함께' : ''}{total > 1 && counts[roomId] < total ? ` · ${room.name} ${counts[roomId]}명` : ''}
          </span>
          <button className="pill" onClick={() => setSheet('board')}>🌱 {done.length}/4</button>
        </div>
      </header>

      <AnimatePresence>
        {prayer && (
          <motion.div className="pray-hud" initial={{ opacity: 0, y: -20, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: -20, x: '-50%' }}>
            <span>🕯️ 조용히 주님 앞에</span>
            <b>{String(Math.floor(prayer.left / 60)).padStart(2, '0')}:{String(prayer.left % 60).padStart(2, '0')}</b>
            <button className="btn small" onClick={() => stopPrayer(false)}>그만하기</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 아래쪽 */}
      <div className="hud-bottom">
        <AnimatePresence>
          {roomId === 'living' && (
            <motion.div className="worship-bar" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
              {worship.step === 0 ? (
                <>
                  <span className="wb-label">📺 함께 드리는 가정예배</span>
                  <button className="btn primary" onClick={() => setWorshipStep(1)}>▶ 예배 시작</button>
                </>
              ) : (
                <>
                  <div className="wb-steps">
                    {WORSHIP_STEPS.slice(1).map((s, i) => (
                      <span key={s.key} className={`wb-dot ${worship.step === i + 1 ? 'on' : worship.step > i + 1 ? 'done' : ''}`}>{s.label}</span>
                    ))}
                  </div>
                  {worship.step < 4
                    ? <button className="btn primary" onClick={() => setWorshipStep(worship.step + 1)}>다음 ›</button>
                    : <button className="btn primary" onClick={() => setWorshipStep(0)}>마치기</button>}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="emotes">
          <button className="chip-btn" onClick={() => emote('hello')}>👋 인사</button>
          <button className="chip-btn" onClick={() => emote('amen')}>🙏 아멘</button>
          <button className="chip-btn" onClick={() => emote('clap')}>👏 박수</button>
          <button className="chip-btn" onClick={() => emote('love')}>💕 사랑해요</button>
          <button className="chip-btn" onClick={() => setSheet('say')}>💬 한마디</button>
        </div>
        <nav className="nav">
          <button onClick={() => setSheet('rooms')}><span>🏠</span>방 이동</button>
          <button onClick={() => (prayer ? showToast('지금 기도 중이에요') : setSheet('pray'))}><span>🙏</span>기도</button>
          <button onClick={() => setSheet('music')}><span>🎵</span>찬양</button>
          <button onClick={() => setSheet('word')}><span>📖</span>말씀</button>
          <button onClick={() => setSheet('requests')}><span>📝</span>나눔</button>
          <button onClick={() => setSheet('more')}><span>⋯</span>더보기</button>
        </nav>
      </div>

      <Sheet open={!!sheet} title={sheet ? SHEETS[sheet][0] : ''} onClose={() => { setSheet(null); stopSpeaking(); music.duck(false) }}>
        {sheet && SHEETS[sheet][1]}
      </Sheet>

      <AnimatePresence>
        {toast && (
          <motion.div key={toast.id} className="toast" initial={{ opacity: 0, y: -10, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, x: '-50%' }}>
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

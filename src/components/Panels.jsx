import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { api, isDemo, store, todayKey } from '../lib/api.js'
import { VERSES } from '../data/verses.js'
import { ROOMS } from '../data/rooms.js'
import { CHARS } from '../data/chars.js'

export function Sheet({ open, title, onClose, children }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="sheet-bg" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.section
            className="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          >
            <div className="sheet-head">
              <h2>{title}</h2>
              <button className="btn ghost small" onClick={onClose}>닫기</button>
            </div>
            {children}
          </motion.section>
        </>
      )}
    </AnimatePresence>
  )
}

export const verseOfDay = (offset = 0) =>
  VERSES[(Math.floor(Date.parse(todayKey()) / 86400000) + offset) % VERSES.length]

// ---------- 🏠 방 이동 ----------
export function RoomsPanel({ current, counts, onGo }) {
  return (
    <div className="room-grid">
      {ROOMS.map((r) => (
        <button key={r.id} className={`room-card ${r.id === current ? 'sel' : ''}`} onClick={() => onGo(r.id)}>
          <img src={r.src} alt="" />
          <div className="room-info">
            <b>{r.emoji} {r.name}</b>
            <span>{r.desc}</span>
            {counts[r.id] > 0 && <span className="count">👥 {counts[r.id]}명</span>}
          </div>
        </button>
      ))}
    </div>
  )
}

// ---------- 🙏 기도 ----------
export function PrayPanel({ onStart, inBedroom }) {
  const [music, setMusic] = useState(true)
  const [dim, setDim] = useState(true)
  return (
    <>
      <p className="muted">조용히 주님 앞에 머물러요. 휴대폰은 잠시 내려놓아도 좋아요.</p>
      <div className="grid-3">
        {[1, 3, 5, 10, 20, 30].map((m) => (
          <button key={m} className="btn" onClick={() => onStart(m, { music, dim })}>{m}분</button>
        ))}
      </div>
      <label className="check"><input type="checkbox" checked={music} onChange={(e) => setMusic(e.target.checked)} /> 잔잔한 피아노 반주와 함께</label>
      {inBedroom && <label className="check"><input type="checkbox" checked={dim} onChange={(e) => setDim(e.target.checked)} /> 무드등만 켜 두기</label>}
    </>
  )
}

// ---------- 🎵 찬양 ----------
export function MusicPanel({ music, onPlay }) {
  const [, force] = useState(0)
  const [vol, setVol] = useState(Math.round(music.volume * 100))
  return (
    <>
      <ul className="list">
        {music.songs.map((s) => {
          const on = music.playing && music.playing.kind === s.kind && music.playing.index === s.index
          return (
            <li key={s.kind + s.index} className="song">
              <div className="grow">
                {s.title}
                {s.credit && <div className="muted small">{s.credit}</div>}
              </div>
              <button
                className={`btn small ${on ? 'sel' : ''}`}
                onClick={() => { if (on) music.stop(); else { music.play(s.kind, s.index); onPlay() } force((n) => n + 1) }}
              >
                {on ? '■ 멈춤' : '▶ 듣기'}
              </button>
            </li>
          )
        })}
      </ul>
      <label className="check">볼륨
        <input type="range" min="0" max="100" value={vol} onChange={(e) => { setVol(+e.target.value); music.setVolume(e.target.value / 100) }} />
      </label>
      <p className="muted small">AI로 만든 찬양(mp3)은 src/config.js 의 hymns 에 추가하면 여기에 나와요.</p>
    </>
  )
}

// ---------- 📖 말씀 ----------
export function WordPanel({ onRead, onAmen }) {
  const [off, setOff] = useState(0)
  const v = verseOfDay(off)
  return (
    <>
      <div className="verse-card">
        <blockquote>{v.text}</blockquote>
        <p className="ref">{v.ref} · 개역한글</p>
      </div>
      <div className="row">
        <button className="btn primary" onClick={() => onRead(v)}>🔊 읽어주기</button>
        <button className="btn" onClick={onAmen}>🙏 아멘</button>
        <button className="btn ghost" onClick={() => setOff((o) => o + 1)}>다른 말씀 ›</button>
      </div>
    </>
  )
}

// ---------- 📝 기도제목 (부엌 식탁) ----------
export function RequestsPanel({ me, onShared, onTogether }) {
  const [list, setList] = useState(null)
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  useEffect(() => { api('prayers').then(setList).catch((e) => setErr(e.message)) }, [])
  const run = (p) => p.then(setList).catch((e) => setErr(e.message))
  return (
    <>
      <textarea rows={3} maxLength={500} value={text} onChange={(e) => setText(e.target.value)} placeholder="함께 기도할 제목을 나눠 주세요" />
      <button
        className="btn primary wide"
        onClick={() => {
          if (!text.trim()) return
          run(api('prayers', { method: 'POST', body: JSON.stringify({ name: me.name, text: text.trim() }) }))
          setText('')
          onShared()
        }}
      >
        식탁에 올리기
      </button>
      {err && <p className="muted small">{err}</p>}
      <ul className="list">
        {list === null && <li className="muted small">불러오는 중…</li>}
        {list && list.length === 0 && <li className="muted small">아직 기도제목이 없어요. 첫 번째로 나눠 주세요.</li>}
        {list && list.map((p) => (
          <li key={p.id}>
            <div className="meta"><b>{p.name}</b><span>{p.date}</span></div>
            <div className="body">{p.text}</div>
            <div className="row">
              <button
                className="btn small"
                disabled={p.amen.includes(me.name)}
                onClick={() => { run(api('prayers', { method: 'POST', body: JSON.stringify({ action: 'amen', id: p.id, name: me.name }) })); onTogether() }}
              >
                🙏 함께 기도해요 {p.amen.length || ''}
              </button>
              {p.name === me.name && (
                <button
                  className="btn ghost small"
                  onClick={() => run(api(`prayers?id=${encodeURIComponent(p.id)}&name=${encodeURIComponent(me.name)}`, { method: 'DELETE' }))}
                >
                  삭제
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

// ---------- 🧊 냉장고 메모: 오늘 함께한 사람 + 발자국 ----------
export const STEPS = [
  ['word', '📖 말씀 읽기'],
  ['pray', '🙏 기도하기'],
  ['praise', '🎵 찬양 듣기'],
  ['together', '🤝 기도제목에 함께 기도'],
]
export function BoardPanel({ done }) {
  const [list, setList] = useState(null)
  useEffect(() => { api('attendance').then(setList).catch(() => setList([])) }, [])
  return (
    <>
      <div className="memo yellow">
        <b>🌱 오늘의 발자국 ({done.length}/4)</b>
        <ul className="steps">
          {STEPS.map(([k, l]) => <li key={k}>{done.includes(k) ? '✅' : '⬜️'} {l}</li>)}
        </ul>
      </div>
      <div className="memo pink">
        <b>🙋 오늘 함께 기도한 식구</b>
        <div className="chips">
          {list === null && <span className="muted small">불러오는 중…</span>}
          {list && list.length === 0 && <span className="muted small">아직 없어요. 기도나 가정예배를 마치면 이름이 붙어요.</span>}
          {list && list.map((n) => <span key={n} className="chip">{n}</span>)}
        </div>
      </div>
    </>
  )
}

// ---------- 💛 감사 노트 (이 기기에만 저장) ----------
const THANKS_VERSES = [
  { ref: '시편 107:1', text: '여호와께 감사하라 그는 선하시며 그 인자하심이 영원함이로다' },
  { ref: '데살로니가전서 5:18', text: '범사에 감사하라 이는 그리스도 예수 안에서 너희를 향하신 하나님의 뜻이니라' },
  { ref: '시편 23:1', text: '여호와는 나의 목자시니 내가 부족함이 없으리로다' },
  { ref: '빌립보서 4:6', text: '아무 것도 염려하지 말고 다만 모든 일에 기도와 간구로, 너희 구할 것을 감사함으로 하나님께 아뢰라' },
]
export function ThanksPanel() {
  const [list, setList] = useState(() => store.get('thanks') || [])
  const [text, setText] = useState('')
  const [reply, setReply] = useState(null)
  const save = () => {
    if (!text.trim()) return
    const next = [{ date: todayKey(), text: text.trim() }, ...list].slice(0, 100)
    setList(next)
    store.set('thanks', next)
    setText('')
    setReply(THANKS_VERSES[Math.floor(Math.random() * THANKS_VERSES.length)])
  }
  return (
    <>
      <p className="muted">오늘 무엇이 감사한가요? 이 기기에만 저장돼요.</p>
      <textarea rows={2} maxLength={200} value={text} onChange={(e) => setText(e.target.value)} placeholder="예) 아침 햇살이 따뜻해서 감사해요" />
      <button className="btn primary wide" onClick={save}>감사드려요</button>
      <AnimatePresence>
        {reply && (
          <motion.div className="verse-card small-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <blockquote>{reply.text}</blockquote>
            <p className="ref">{reply.ref}</p>
          </motion.div>
        )}
      </AnimatePresence>
      <ul className="list">
        {list.map((t, i) => (
          <li key={i}><div className="meta"><span>{t.date}</span></div><div className="body">💛 {t.text}</div></li>
        ))}
      </ul>
    </>
  )
}

// ---------- 💬 한마디 ----------
export function SayPanel({ onSay }) {
  const [t, setT] = useState('')
  const send = () => { if (t.trim()) onSay(t.trim()) }
  return (
    <>
      <input autoFocus maxLength={40} value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && send()} placeholder="예) 오늘도 힘내세요!" />
      <div className="row">
        {['안녕하세요 😊', '함께 기도할게요 🙏', '축복해요 💕', '좋은 하루 되세요 🌷'].map((q) => (
          <button key={q} className="btn small" onClick={() => onSay(q)}>{q}</button>
        ))}
      </div>
      <button className="btn primary wide" onClick={send}>말하기</button>
    </>
  )
}

// ---------- ⋯ 더보기 ----------
export function MorePanel({ me, onSave, onLogout, live }) {
  const [name, setName] = useState(me.name)
  const [char, setChar] = useState(me.char)
  return (
    <>
      <div className="section-title">🎨 내 모습</div>
      <input maxLength={12} value={name} onChange={(e) => setName(e.target.value)} />
      <CharPicker value={char} onChange={setChar} />
      <button className="btn primary wide" onClick={() => onSave({ name: name.trim() || me.name, char })}>저장하기</button>
      <p className="muted small">
        {isDemo() ? '체험 모드: 기도제목·출석이 이 기기에만 저장돼요. ' : '기도제목·출석이 모임 서버에 저장돼요. '}
        {live ? '다른 집과 실시간으로 연결됐어요.' : '실시간 연결 없음 (Supabase 설정 필요 · README 참고)'}
      </p>
      <button className="btn ghost wide" onClick={onLogout}>나가기</button>
    </>
  )
}

export function CharPicker({ value, onChange }) {
  return (
    <div className="char-grid">
      {CHARS.map((c) => (
        <motion.button
          key={c.id}
          type="button"
          className={`char-card ${value === c.id ? 'sel' : ''}`}
          onClick={() => onChange(c.id)}
          whileTap={{ scale: 0.92 }}
          animate={value === c.id ? { y: [0, -6, 0] } : { y: 0 }}
          transition={value === c.id ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : {}}
        >
          <img src={c.src} alt={c.name} draggable={false} />
          <span>{c.name}</span>
        </motion.button>
      ))}
    </div>
  )
}

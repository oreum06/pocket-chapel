import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Avatar from './Avatar.jsx'

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
let uid = 0

// 화면 크기에 맞춰 방 그림의 크기를 정함
// - 너무 작게 줄이지 않고(contain의 1.25배까지 키움), 남는 부분은 카메라가 따라다님
function useLayout(room) {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  // 아래쪽 버튼들이 차지하는 높이: 바닥(캐릭터가 서는 곳)은 그 위에 보이도록
  const hud = vp.w < 700 ? 196 : 176
  const avail = vp.h - hud
  const contain = Math.min(vp.w / room.w, avail / room.h)
  const cover = Math.max(vp.w / room.w, vp.h / room.h)
  const scale = vp.w < 700
    ? Math.min(avail / room.h, contain * 2.2) // 휴대폰: 크게 보고 좌우로 따라다님
    : Math.min(cover, contain * 1.25)
  return { vp, avail, sw: room.w * scale, sh: room.h * scale }
}

export default function Scene({ room, avatars, myPos, onMove, onSpot, tv, lampOff, effects, catBubble }) {
  const { vp, avail, sw, sh } = useLayout(room)
  const sceneRef = useRef(null)
  const [marks, setMarks] = useState([])
  const [puffs, setPuffs] = useState([])

  // 카메라: 내 캐릭터가 화면 가운데 오도록 (방 밖이 보이지 않는 범위 안에서)
  const camX = sw <= vp.w ? (vp.w - sw) / 2 : clamp(vp.w / 2 - myPos.x * sw, vp.w - sw, 0)
  const camY = sh <= avail ? Math.max(0, (avail - sh) / 2) : clamp(avail * 0.6 - myPos.y * sh, avail - sh, 0)

  const toFrac = (e) => {
    const r = sceneRef.current.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }

  const handleDown = (e) => {
    const p = toFrac(e)
    const f = room.floor
    const target = { x: clamp(p.x, f.x0, f.x1), y: clamp(p.y, f.y0, f.y1) }
    onMove(target)
    const id = ++uid
    setMarks((m) => [...m, { id, ...p }])
    setTimeout(() => setMarks((m) => m.filter((k) => k.id !== id)), 900)
  }

  const onPuff = useCallback((el) => {
    const s = sceneRef.current?.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    if (!s) return
    const id = ++uid
    const p = { id, x: (r.left - s.left) / s.width + (Math.random() - 0.5) * 0.02, y: (r.top - s.top) / s.height }
    setPuffs((l) => [...l.slice(-10), p])
    setTimeout(() => setPuffs((l) => l.filter((k) => k.id !== id)), 700)
  }, [])

  return (
    <div className="scene-wrap" onPointerDown={handleDown}>
      <img className="scene-blur" src={room.src} alt="" draggable={false} />
      <motion.div
        ref={sceneRef}
        className="scene"
        style={{ width: sw, height: sh }}
        initial={false}
        animate={{ x: camX, y: camY }}
        transition={{ type: 'tween', duration: 1.1, ease: 'easeInOut' }}
      >
        <img className="scene-bg" src={room.src} alt={room.name} draggable={false} />

        {room.tv && tv && (
          <div
            className="tv"
            style={{
              left: `${room.tv.x0 * 100}%`, top: `${room.tv.y0 * 100}%`,
              width: `${(room.tv.x1 - room.tv.x0) * 100}%`, height: `${(room.tv.y1 - room.tv.y0) * 100}%`,
            }}
          >
            {tv}
          </div>
        )}

        {room.spots.map((s) => (
          <button
            key={s.id}
            className="spot"
            style={{ left: `${s.x0 * 100}%`, top: `${s.y0 * 100}%`, width: `${(s.x1 - s.x0) * 100}%`, height: `${(s.y1 - s.y0) * 100}%` }}
            onPointerDown={(e) => { e.stopPropagation(); onSpot(s) }}
            aria-label={s.label}
          >
            <motion.span
              className="spot-tag"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', delay: (s.x0 * 7) % 1 }}
            >
              ✨ {s.label}
            </motion.span>
          </button>
        ))}

        <AnimatePresence>
          {catBubble && (
            <motion.div
              key={catBubble.id}
              className="obj-bubble"
              style={{ left: `${catBubble.x * 100}%`, top: `${catBubble.y * 100}%` }}
              initial={{ opacity: 0, y: 6, scale: 0.7 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
            >
              {catBubble.text}
            </motion.div>
          )}
        </AnimatePresence>

        {avatars.map((a) => (
          <Avatar key={a.id} room={room} data={a} onPuff={a.isMe ? onPuff : undefined} />
        ))}

        <AnimatePresence>
          {puffs.map((p) => (
            <motion.span
              key={p.id}
              className="puff"
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
              initial={{ opacity: 0.7, scale: 0.4 }}
              animate={{ opacity: 0, scale: 1.3, y: -16 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {marks.map((m) => (
            <motion.div key={m.id} className="mark" style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%` }} exit={{ opacity: 0 }}>
              <motion.span className="ring" initial={{ scale: 0.2, opacity: 0.9 }} animate={{ scale: 1.6, opacity: 0 }} transition={{ duration: 0.7 }} />
              {['✦', '♡', '✧', '✿'].map((s, i) => {
                const a = (i / 4) * Math.PI * 2 + Math.PI / 4
                return (
                  <motion.span
                    key={i}
                    className="spark"
                    initial={{ x: 0, y: 0, opacity: 1, scale: 0.5 }}
                    animate={{ x: Math.cos(a) * 32, y: Math.sin(a) * 24 - 10, opacity: 0, scale: 1.1 }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  >
                    {s}
                  </motion.span>
                )
              })}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* 떠오르는 이모지 (하트, 수박 등) */}
        <AnimatePresence>
          {effects.map((f) => (
            <motion.span
              key={f.id}
              className="float-emoji"
              style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%` }}
              initial={{ opacity: 0, y: 0, scale: 0.5 }}
              animate={{ opacity: [0, 1, 1, 0], y: -90 - Math.random() * 40, x: (Math.random() - 0.5) * 60, scale: 1.2 }}
              transition={{ duration: 1.8, ease: 'easeOut' }}
            >
              {f.emoji}
            </motion.span>
          ))}
        </AnimatePresence>

        {/* 무드등 끄기: 방이 어두워지고 등 주변만 은은하게 */}
        <AnimatePresence>
          {lampOff && (
            <motion.div
              className="night"
              style={(() => {
                const l = room.spots.find((s) => s.action === 'lamp')
                return l ? { '--lx': `${((l.x0 + l.x1) / 2) * 100}%`, '--ly': `${((l.y0 + l.y1) / 2) * 100}%` } : {}
              })()}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2 }}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}

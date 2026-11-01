import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { charById } from '../data/chars.js'

const SPEED = 0.34 // 1초에 그림 높이의 34%만큼 걸어감

// 가만히: 요정처럼 둥실둥실 / 걸을 때: 통통 뽈뽈 / 기도: 아주 천천히, 조용히
const bodyVariants = {
  idle: {
    y: [0, -14, 0],
    rotate: [0, 1.5, 0, -1.5, 0],
    scaleX: 1,
    scaleY: 1,
    transition: {
      y: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
      rotate: { duration: 6.4, repeat: Infinity, ease: 'easeInOut' },
    },
  },
  walk: {
    y: [0, -14, 0],
    rotate: [-5, 5, -5],
    scaleX: [1.04, 0.97, 1.04],
    scaleY: [0.95, 1.04, 0.95],
    transition: {
      duration: 0.34,
      repeat: Infinity,
      ease: 'easeInOut',
      rotate: { duration: 0.68, repeat: Infinity, ease: 'easeInOut' },
    },
  },
  pray: {
    y: [0, -6, 0],
    rotate: 0,
    scaleX: 1,
    scaleY: 1,
    transition: { y: { duration: 4.5, repeat: Infinity, ease: 'easeInOut' } },
  },
  hop: {
    y: [0, -30, 0, -14, 0],
    scaleY: [1, 1.06, 0.92, 1.03, 1],
    rotate: 0,
    transition: { duration: 0.7, ease: 'easeOut' },
  },
}

const shadowVariants = {
  idle: { scale: [1, 0.82, 1], opacity: [0.3, 0.18, 0.3], transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } },
  walk: { scale: [1, 0.86, 1], opacity: [0.3, 0.22, 0.3], transition: { duration: 0.34, repeat: Infinity, ease: 'easeInOut' } },
  pray: { scale: 1, opacity: 0.3 },
  hop: { scale: [1, 0.7, 1], opacity: [0.3, 0.15, 0.3], transition: { duration: 0.7 } },
}

export default function Avatar({ room, data, onPuff }) {
  const { x, y, char, name, pose, bubble, hopAt, isMe } = data
  const [prev, setPrev] = useState({ x, y })
  const [walk, setWalk] = useState(null)
  const [facingLeft, setFacingLeft] = useState(false)
  const [hopping, setHopping] = useState(false)
  const anchorRef = useRef(null)

  // 목적지가 바뀐 바로 그 렌더에서 걷는 시간을 계산 (그래야 순간이동 없이 걸어감)
  if (prev.x !== x || prev.y !== y) {
    const dx = (x - prev.x) * (room.w / room.h)
    const dy = y - prev.y
    const dist = Math.hypot(dx, dy)
    setPrev({ x, y })
    if (dist > 0.002) {
      if (Math.abs(dx) > 0.01) setFacingLeft(dx < 0)
      setWalk({ duration: Math.min(4, Math.max(0.35, dist / SPEED)), id: Math.random() })
    }
  }

  // 도착하면 걷기 끝
  useEffect(() => {
    if (!walk) return
    const t = setTimeout(() => setWalk(null), walk.duration * 1000 + 60)
    return () => clearTimeout(t)
  }, [walk])

  useEffect(() => {
    if (!hopAt) return
    setHopping(true)
    const t = setTimeout(() => setHopping(false), 720)
    return () => clearTimeout(t)
  }, [hopAt])

  // 걷는 동안 발밑 먼지
  useEffect(() => {
    if (!walk || !onPuff) return
    const t = setInterval(() => {
      const el = anchorRef.current
      if (el) onPuff(el)
    }, 170)
    return () => clearInterval(t)
  }, [walk, onPuff])

  const { floor, charH } = room
  const depth = 0.75 + ((y - floor.y0) / (floor.y1 - floor.y0)) * 0.35
  const mode = walk ? 'walk' : hopping ? 'hop' : pose === 'pray' ? 'pray' : 'idle'
  const c = charById(char)

  return (
    <motion.div
      ref={anchorRef}
      className="av-anchor"
      initial={false}
      animate={{ left: `${x * 100}%`, top: `${y * 100}%`, scale: depth }}
      transition={walk ? { duration: walk.duration, ease: [0.33, 0, 0.25, 1] } : { duration: 0 }}
      style={{ zIndex: Math.round(y * 1000), '--ch': `${charH * 100}cqh` }}
    >
      <motion.div className="av-shadow" variants={shadowVariants} animate={mode} />

      <AnimatePresence>
        {pose === 'pray' && !walk && (
          <motion.div
            className="av-glow"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0.55, 0.9, 0.55], scale: [1, 1.08, 1] }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </AnimatePresence>

      <motion.div
        className="av-flip"
        animate={{ scaleX: facingLeft ? -1 : 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 26 }}
      >
        <motion.img
          key={mode}
          className="av-img"
          src={c.src}
          alt={name}
          draggable={false}
          variants={bodyVariants}
          animate={mode}
        />
      </motion.div>

      <div className={`av-name ${isMe ? 'me' : ''}`}>
        {pose === 'pray' && !walk ? '🙏 ' : ''}{name}
      </div>

      <AnimatePresence>
        {bubble && (
          <motion.div
            key={bubble.id}
            className="av-bubble"
            initial={{ opacity: 0, y: 8, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          >
            {bubble.text}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

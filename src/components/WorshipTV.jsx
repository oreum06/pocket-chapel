import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

// 가정예배 순서
export const WORSHIP_STEPS = [
  { key: 'idle', label: '대기' },
  { key: 'praise', label: '🎵 여는 찬양' },
  { key: 'word', label: '📖 말씀' },
  { key: 'pray', label: '🙏 함께 기도' },
  { key: 'bless', label: '✨ 축복' },
]

// 거실 TV 화면
export default function WorshipTV({ step, verse, songTitle, requests }) {
  const [ri, setRi] = useState(0)
  useEffect(() => {
    if (step !== 3 || !requests.length) return
    const t = setInterval(() => setRi((i) => i + 1), 6000)
    return () => clearInterval(t)
  }, [step, requests.length])

  let body
  if (step === 0) {
    body = (
      <>
        <motion.div className="tv-cross" animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 4, repeat: Infinity }}>✝</motion.div>
        <p className="tv-big">오늘도<br />하나님과 함께해요 ♡</p>
        <p className="tv-small">{verse.ref}</p>
      </>
    )
  } else if (step === 1) {
    body = (
      <>
        <p className="tv-label">여는 찬양</p>
        <p className="tv-big">{songTitle}</p>
        <div className="tv-notes">
          {['♪', '♫', '♪', '♬'].map((n, i) => (
            <motion.span key={i} animate={{ y: [0, -10, 0], opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.3 }}>{n}</motion.span>
          ))}
        </div>
      </>
    )
  } else if (step === 2) {
    body = (
      <>
        <p className="tv-label">오늘의 말씀</p>
        <p className="tv-verse">{verse.text}</p>
        <p className="tv-small">{verse.ref}</p>
      </>
    )
  } else if (step === 3) {
    const r = requests.length ? requests[ri % requests.length] : null
    body = (
      <>
        <p className="tv-label">함께 기도해요</p>
        <AnimatePresence mode="wait">
          <motion.p
            key={r ? r.id : 'none'}
            className="tv-verse"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            {r ? `“${r.text}”` : '서로의 가정과 이웃을 위해 기도해요'}
          </motion.p>
        </AnimatePresence>
        {r && <p className="tv-small">— {r.name}</p>}
      </>
    )
  } else {
    body = (
      <>
        <p className="tv-big">아멘 ✨</p>
        <p className="tv-verse">주님의 평강이 우리 집과<br />이웃의 집에 함께하길</p>
      </>
    )
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={step}
        className={`tv-screen s${step}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6 }}
      >
        {body}
      </motion.div>
    </AnimatePresence>
  )
}

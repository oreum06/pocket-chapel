// 캐릭터 목록: public/chars/ 에 투명 PNG를 넣고 여기에 추가하면 돼요
export const CHARS = [
  { id: 'flower', name: '꽃가방 소녀', src: 'chars/flower.png' },
  { id: 'baseball', name: '야구 소녀', src: 'chars/baseball.png' },
  { id: 'pinky', name: '분홍 토끼', src: 'chars/pinky.png' },
  { id: 'music', name: '음악 소년', src: 'chars/music.png' },
  { id: 'bookworm', name: '책 읽는 아이', src: 'chars/bookworm.png' },
  { id: 'puppy', name: '강아지 모자', src: 'chars/puppy.png' },
  { id: 'starlight', name: '별빛 소녀', src: 'chars/starlight.png' },
]
export const charById = (id) => CHARS.find((c) => c.id === id) || CHARS[0]

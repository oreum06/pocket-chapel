// 기도제목 / 출석 저장 (Supabase 데이터베이스, supabase/setup.sql 참고)
// Supabase 설정이 없으면 이 기기에만 저장하는 "체험 모드"로 동작
import { getSupabase } from './supabase.js'

export const todayKey = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })

let code = ''
let demo = false
export const isDemo = () => demo

const store = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* 저장 불가 환경 */ } },
}
export { store }

// 입장할 때 한 번 호출: 코드가 틀리면 에러, 서버가 없으면 체험 모드
export async function login(groupCode) {
  code = groupCode
  demo = !(await getSupabase())
  if (demo) return
  try {
    await api('attendance')
  } catch (e) {
    if (e.message.includes('모임 코드')) throw e
    console.warn('서버에 연결하지 못해 체험 모드로 전환', e)
    demo = true
  }
}

// 예전 서버 주소 형식(path, options)을 Supabase 함수 호출로 바꿔 줌
async function rpc(fn, args) {
  const sb = await getSupabase()
  const { data, error } = await sb.rpc(fn, { p_code: code, ...args })
  if (error) {
    if (/invalid group code/.test(error.message)) throw new Error('모임 코드가 맞지 않아요')
    throw new Error('서버 오류: ' + error.message)
  }
  return data
}

export async function api(path, options = {}) {
  if (demo) return demoApi(path, options)
  const body = options.body ? JSON.parse(options.body) : {}
  const method = options.method || 'GET'
  if (path.startsWith('attendance')) {
    return method === 'POST' ? rpc('chapel_attend', { p_name: body.name }) : rpc('chapel_attendance_list')
  }
  if (method === 'DELETE') {
    const q = new URLSearchParams(path.split('?')[1])
    return rpc('chapel_delete_prayer', { p_id: q.get('id'), p_name: q.get('name') })
  }
  if (method === 'POST' && body.action === 'amen') return rpc('chapel_amen', { p_id: body.id, p_name: body.name })
  if (method === 'POST') return rpc('chapel_add_prayer', { p_name: body.name, p_text: body.text })
  return rpc('chapel_prayer_list')
}

function demoApi(path, options) {
  const body = options.body ? JSON.parse(options.body) : {}
  const method = options.method || 'GET'
  if (path.startsWith('attendance')) {
    const k = 'demo-attend-' + todayKey()
    const list = store.get(k) || []
    if (method === 'POST' && !list.includes(body.name)) { list.push(body.name); store.set(k, list) }
    return list
  }
  let list = store.get('demo-prayers') || []
  if (method === 'POST' && body.action === 'amen') {
    const p = list.find((x) => x.id === body.id)
    if (p && !p.amen.includes(body.name)) p.amen.push(body.name)
  } else if (method === 'POST') {
    list.unshift({ id: crypto.randomUUID(), name: body.name, text: body.text, date: todayKey(), amen: [] })
  } else if (method === 'DELETE') {
    const q = new URLSearchParams(path.split('?')[1])
    list = list.filter((x) => !(x.id === q.get('id') && x.name === q.get('name')))
  }
  store.set('demo-prayers', list)
  return list
}

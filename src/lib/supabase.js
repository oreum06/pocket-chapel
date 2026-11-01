// Supabase 연결 (설정이 없으면 null) — 처음 필요할 때 한 번만 불러옴
import { CONFIG } from '../config.js'

let clientPromise = null
export const hasSupabase = () => !!(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey)
export function getSupabase() {
  if (!hasSupabase()) return Promise.resolve(null)
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, { auth: { persistSession: false } }),
    )
  }
  return clientPromise
}

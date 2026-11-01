// ===== 앱 설정 =====
// Supabase 연결 정보 (publishable/anon 키는 공개용이라 여기 적어도 괜찮아요)
// ⚠️ service_role / secret 키는 절대 여기에 넣지 마세요.
// GitHub Variables(SUPABASE_URL, SUPABASE_ANON_KEY)에 값을 넣으면 그 값이 우선 적용돼요.
export const CONFIG = {
  // 우리 모임 이름 (화면 위쪽에 보여요)
  groupName: import.meta.env.VITE_GROUP_NAME || '새벽빛 우리집',

  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || 'https://srdfntcryjwgwcaqbwlo.supabase.co',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_O1SEOQa-kRGuBI0IEFlMrw_lb7VGdvd',

  // mp3 찬양 목록: public/hymns/ 폴더에 넣고 여기에 적으세요 (AI 찬양, 공공영역 녹음 등)
  hymns: [
    // { title: '아침 찬양 (AI)', url: 'hymns/morning.mp3', credit: 'Suno로 제작' },
  ],
}

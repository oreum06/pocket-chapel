// ===== 앱 설정 =====
// Supabase 값은 GitHub 저장소 Settings → Secrets and variables → Actions → Variables 에
// SUPABASE_URL, SUPABASE_ANON_KEY 로 넣으면 자동으로 들어가요. (여기에 직접 적어도 돼요)
export const CONFIG = {
  // 우리 모임 이름 (화면 위쪽에 보여요)
  groupName: import.meta.env.VITE_GROUP_NAME || '새벽빛 우리집',

  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',

  // mp3 찬양 목록: public/hymns/ 폴더에 넣고 여기에 적으세요 (AI 찬양, 공공영역 녹음 등)
  hymns: [
    // { title: '아침 찬양 (AI)', url: 'hymns/morning.mp3', credit: 'Suno로 제작' },
  ],
}

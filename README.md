# 새벽빛 우리집 · 가정과 이웃이 함께하는 온라인 예배

새벽예배당에서 출발한 아이디어를, 포근한 **우리 집** 분위기로 옮긴 2D 웹 공간입니다.
각자의 집에서 접속한 가족과 이웃이 한 집에 모여 함께 예배하고, 기도하고, 나눕니다.

## 방과 할 수 있는 일
| 방 | 분위기 | 눌러 보세요 |
|---|---|---|
| 🛋️ 거실 | 함께 드리는 가정예배 | 📺 TV(가정예배), 📖 성경(오늘의 말씀), ☕ 머그컵 |
| 🛏️ 골방 | 혼자 조용히 기도 | 기도 방석(타이머), 무드등(방이 어두워짐), 감사 노트 |
| 🍞 부엌 | 식탁 교제 | 식탁(기도제목 나눔), 냉장고 메모(오늘 함께한 식구·발자국), 빵 나누기 |
| 🎐 툇마루 | 풍경 소리와 찬양 | 풍경(찬양 듣기), 고양이 |
| 🌻 여름 마당 | 이웃과 쉼 | 수박 나누기, 풍경, 고양이 |

### 📺 거실 가정예배 (모두 같은 화면)
`예배 시작` → 🎵 여는 찬양 → 📖 말씀(읽어주기) → 🙏 함께 기도(TV에 기도제목이 차례로) → ✨ 축복
- 누구든 `다음 ›`을 누르면 거실에 있는 모든 사람의 TV가 함께 넘어가요.
- 기도 순서에서는 모두 기도하는 모습(🙏 + 따뜻한 빛)이 되고, 축복에서 출석이 기록돼요.

### 그 밖에
- 바닥을 누르면 캐릭터가 뽈뽈 걸어가요 (Framer Motion). 가만히 있으면 둥실둥실 떠 있어요.
- 👋 인사 · 🙏 아멘 · 👏 박수 · 💕 사랑해요 · 💬 한마디 (말풍선)
- 🌱 오늘의 발자국: 말씀 · 기도 · 찬양 · 함께 기도 4가지

## 구성
| 부분 | 무엇으로 | 비용 |
|---|---|---|
| 웹사이트 | React + Framer Motion (Vite) → **GitHub Pages** | 무료 |
| 기도제목·출석 저장 | **Supabase** 데이터베이스 (`supabase/setup.sql`) | 무료 |
| 실시간 함께하기 | **Supabase** Realtime | 무료 |

## 처음 설정하기 (한 번만)

### 1. Supabase 만들기
1. [supabase.com](https://supabase.com) 가입 → **New project** (지역은 Northeast Asia (Seoul) 추천)
2. 왼쪽 메뉴 **SQL Editor** → **New query** → `supabase/setup.sql` 내용을 전부 붙여넣기
3. 맨 아래 줄의 `'여기에-모임-코드'` 를 우리 모임 코드로 바꾸고 **Run**
4. **Project Settings → API** 에서 두 값을 복사해 두기
   - Project URL (예: `https://abcd.supabase.co`)
   - `anon` `public` key

### 2. GitHub에 값 넣기
저장소 **Settings → Secrets and variables → Actions → Variables 탭 → New repository variable**
| 이름 | 값 |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | anon public key |
| `GROUP_NAME` (선택) | 화면에 보일 모임 이름 |

> anon key는 웹사이트에 들어가도록 만들어진 공개용 키라 Variables에 넣어도 괜찮아요.
> 기도제목은 모임 코드가 맞아야만 읽고 쓸 수 있게 잠가 두었어요.

### 3. GitHub Pages 켜기
저장소 **Settings → Pages → Build and deployment → Source: GitHub Actions**

그다음 **Actions** 탭 → **GitHub Pages 배포** → **Run workflow** 를 누르면 몇 분 뒤
`https://<아이디>.github.io/<저장소이름>/` 주소로 열려요. 이후에는 main에 올릴 때마다 자동으로 다시 배포돼요.

### 모임 코드를 바꾸고 싶을 때
Supabase SQL Editor에서 이 한 줄만 실행하세요.
```sql
update chapel_config set code = '새-모임-코드';
```

## 내 컴퓨터에서 실행
```
npm install
npm run dev
```
Supabase 값이 없으면 "체험 모드"(이 기기에만 저장, 같은 브라우저 탭끼리만 함께)로 동작해요.
값을 넣고 실행하려면 프로젝트 폴더에 `.env.local` 파일을 만들어 아래처럼 적으세요.
```
VITE_SUPABASE_URL=https://abcd.supabase.co
VITE_SUPABASE_ANON_KEY=복사한-anon-key
```

## 꾸미기
- **모임 이름**: GitHub Variables의 `GROUP_NAME` (또는 `src/config.js`)
- **캐릭터 추가**: 투명 PNG를 `public/chars/`에 넣고 `src/data/chars.js`에 한 줄 추가
- **방 추가/수정**: 그림을 `public/rooms/`에 넣고 `src/data/rooms.js`에 추가
  - `floor`: 걸어갈 수 있는 영역, `charH`: 캐릭터 크기, `spots`: 눌러서 쓰는 물건 (모두 그림 기준 0~1 비율)
- **AI 찬양 mp3**: `public/hymns/`에 넣고 `src/config.js`의 `hymns`에 추가
- **말씀**: `src/data/verses.js` (개역한글. 개역개정은 저작권이 있어요)

> 그림 속 일부 캐릭터(흰 강아지, 노란 강아지 인형 등)는 기존 캐릭터와 닮아 있어요.
> 모임 안에서 쓰는 건 괜찮지만 공개 서비스로 내놓을 땐 다른 그림으로 바꾸는 게 안전해요.

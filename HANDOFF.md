# 인수인계 — Kate's Taro Shop

새 대화창에서 이 파일을 읽고 바로 이어서 작업할 수 있게 정리한 것.
마지막 갱신: 2026-09-08

---

## ⚠️ 마감

**2026-09-08 18:00.** 사용자가 알려준 것이다. 새 창에서도 이걸 먼저 본다.

## 과제

모두의연구소 AI 에이전트 과정 — **갈래 B: 내 서비스에 백엔드 붙여 배포**

제출물 셋:
1. 작동 링크 (또는 3분 시연) — **새로고침해도 데이터가 남는 장면**
2. 설계 한 장
3. 고른 호스팅과 그 이유 한 줄

## 만드는 것

타로 카드를 뽑으면 AI가 해석해 주고, 로그인한 사용자가 **자기 이력만** 다시 볼 수 있는 웹 앱.

## 확정된 설계 (사용자가 직접 정한 것 — 바꾸지 말 것)

| 항목 | 결정 |
|---|---|
| 스프레드 | **1장** (오늘의 카드) |
| 역방향 | **안 쓴다** (정방향만) |
| 카드 이름 | **영어로 저장** (`The Fool`, `Ace of Wands` ...) |
| 덱 | 전체 78장 |
| 로그인 | **이메일 + 비밀번호** |
| 해석 | **Claude API** (고정 문구 아님) |
| 호스팅 | Supabase (Auth + DB + Edge Function) + GitHub Pages (화면) |
| 이름 | Kate's Taro Shop / 폴더·저장소 `kates_taro_shop` |
| 저장 방식 | 해석까지 받은 뒤 **INSERT 한 번**. UPDATE 없음 |
| 카드 이미지 | Rider–Waite 실제 그림 사용 (사용자가 선택) |

---

## 끝난 것

### 1. 저장소

- 로컬: `C:\Users\ctale\Desktop\claudecode\kates_taro_shop`
- 원격: `git@github.com:ctaleez51-art/kates_taro_shop.git`
- 커밋 2개 푸시 완료 (`5c1e026` PRD 초안, `812a71f` 미결정 항목 확정)

### 2. Supabase 프로젝트

| | 값 |
|---|---|
| 프로젝트 이름 | `kates-taro-shop` |
| Project URL | `https://hwihutjovqonuvajfhar.supabase.co` |
| project ref | `hwihutjovqonuvajfhar` |
| Region | Northeast Asia (Seoul) |
| 요금제 | Free |

### 3. `readings` 테이블 — 만들었고 확인까지 끝남

```sql
create table readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  question text,
  cards jsonb not null,
  interpretation text not null
);
```

**RLS 켜짐 확인됨** (`rowsecurity = true`), **정책 3개 확인됨**:

| 정책 이름 | 적용 대상 | 조건 |
|---|---|---|
| `read own` | SELECT | `auth.uid() = user_id` |
| `insert own` | INSERT | `auth.uid() = user_id` |
| `delete own` | DELETE | `auth.uid() = user_id` |

인덱스: `readings_user_created_idx (user_id, created_at desc)`

⚠️ **이 확인은 이미 끝났다. 다시 시키지 말 것.**

### 4. 파일 — 프론트까지 다 만들었음

| 파일 | 내용 | 커밋됨? |
|---|---|---|
| `PRD_tarot.md` | 설계 문서 (설계 한 장 포함) | ✅ |
| `cards.js` | 타로 78장 이름 목록 + `drawCard()` | ✅ |
| `assets/cards/*.jpg` | 카드 이미지 78장 (39.9MB, 600px 폭) | ✅ |
| `supabase/functions/interpret/index.ts` | Edge Function — Claude API 호출 | ✅ (CORS 수정분은 미커밋) |
| `index.html` | 화면 셋 — 로그인 / 카드 뽑기 / 이력 | ❌ |
| `styles.css` | 꾸미기 | ❌ |
| `script.js` | 로그인, 뽑기, 함수 호출, INSERT, 이력 조회·삭제 | ❌ |

카드 이미지 출처: 위키미디어 커먼즈, Rider–Waite 덱 (1909년 발행, 저작권 만료).
파일명 규칙: 카드 이름 소문자 + 공백을 `_` 로 (`the_fool.jpg`, `ace_of_cups.jpg`).
78장 전부 이름↔파일명 일치 확인됨.

### 5. anon public key — 받아서 `script.js` 에 넣음

`role: anon`, `ref: hwihutjovqonuvajfhar` 확인함. 공개돼도 되는 값이다.

### 6. Supabase CLI 연결·시크릿·배포 — 됐음

- `npx supabase login` 은 **Windows에서 토큰이 저장되지 않는다.** 성공 문구가 떠도 다음 명령이 인증 실패한다
- 그래서 개인 액세스 토큰(`sbp_`)을 만들어 `SUPABASE_ACCESS_TOKEN` 으로 넘겼다
  (Full access / 프로젝트 한정 / 7일 만료. 배포 끝나면 삭제 가능)
- ⚠️ **환경변수는 그 창에서만 산다.** 창이 바뀌면 다시 넣어야 한다.
  명령은 항상 `토큰 설정; cd 프로젝트폴더; 명령` 을 **한 줄로** 줄 것
- ⚠️ **PowerShell에서는 `secrets set` 인자를 따옴표로 묶어야 한다.**
  안 묶으면 아무 반응 없이 조용히 실패한다 (`secrets list` 가 비어 있으면 그것이다)
- `npx.cmd` 를 쓴다. `npx` 는 실행 정책에 막힌다
- `link` 는 **프로젝트 폴더에서** 해야 한다. 홈에서 하면 `C:\Users\ctale\supabase` 가 생긴다
- 시크릿 `ANTHROPIC_API_KEY` 등록 완료 (`secrets list` 로 확인)
- `functions deploy interpret` 완료. Docker 경고는 무시해도 된다

### 7. 이메일 확인 안내 — `script.js` 에 넣음

`Confirm email` 스위치는 **켜진 상태를 유지**하기로 사용자가 정했다. 끄지 말 것.
켜둔 대로 제대로 작동하게 아래를 넣었다.

| 상황 | 화면에 나오는 것 |
|---|---|
| 가입 직후 | "○○ 로 확인 메일을 보냈습니다" + 재전송 버튼 |
| 확인 전 로그인 | "아직 이메일 확인이 안 됐습니다" + 재전송 버튼 |
| 비밀번호 틀림 | "이메일 또는 비밀번호가 맞지 않습니다" |
| 링크 눌러 돌아옴 | 로그인된 상태로 "이메일 확인이 끝났습니다" |
| 링크 만료 등 | "확인 링크 오류: ○○" |

- 확인 링크가 돌아올 주소는 `emailRedirectTo` 로 **현재 열려 있는 주소**를 지정했다.
  안 하면 Supabase 기본값 `localhost:3000` 으로 가서 "사이트에 연결할 수 없음" 이 뜬다
- 그래서 `Authentication → URL Configuration → Redirect URLs` 에 등록이 필요하다.
  `http://localhost:5500/**` 는 등록 완료.
  ⬜ **Pages 주소는 아직 등록 안 했다**

### 8. 로컬 서버

`claudecode/.claude/launch.json` 에 `taro` 라는 이름으로 만들어 뒀다.
`python -m http.server 5500 --directory kates_taro_shop`. 주소는 `http://localhost:5500`.

---

## 배포 — 끝났음 (2026-09-08 저녁)

### Edge Function 배포 완료

```
$env:SUPABASE_ACCESS_TOKEN = "sbp_토큰"; cd "C:\Users\ctale\Desktop\claudecode\kates_taro_shop"; npx.cmd supabase functions deploy interpret
```

⚠️ Windows에서 걸린 것들. 다음에도 그대로 걸린다.

- **`npx.cmd`** 를 쓴다. `npx` 는 PowerShell 실행 정책에 막힌다
- **`supabase login` 은 토큰을 저장하지 않는다.** 성공 문구가 떠도 다음 명령이 인증 실패한다.
  개인 액세스 토큰(`sbp_`)을 만들어 `SUPABASE_ACCESS_TOKEN` 으로 넘긴다
  (Full access / 프로젝트 한정 / 7일 만료. `Review access` 다음 `Create token` 을 눌러야 값이 나온다)
- **환경변수는 그 창에서만 산다.** 명령은 항상 `토큰; cd 폴더; 명령` 을 **한 줄로** 줄 것
- **`secrets set` 인자는 따옴표로 묶는다.** 안 묶으면 아무 반응 없이 조용히 실패한다
- **`link` 는 프로젝트 폴더에서** 한다. 홈에서 하면 `C:\Users\ctale\supabase` 가 생긴다
- Docker 경고는 무시해도 된다

시크릿 `ANTHROPIC_API_KEY` 등록 완료 (`secrets list` 로 확인).

### GitHub Pages 켰음 — 공개 주소 살아 있음

```
https://ctaleez51-art.github.io/kates_taro_shop/
```

Supabase `Authentication → URL Configuration` 도 같이 맞췄다.

- `Site URL` — Pages 주소로 변경 완료
- `Redirect URLs` — `http://localhost:5500/**` 과 `https://ctaleez51-art.github.io/kates_taro_shop/**` 둘 다 등록 완료

### RLS 실제 확인 완료

⚠️ 전에 적혀 있던 "RLS 확인 끝났다"는 **정책이 존재한다는 것까지**였다.
대시보드 SQL Editor는 소유자 권한이라 RLS를 적용받지 않고, 거기서는 `auth.uid()` 가 `null` 이라
정책이 걸러내는지 확인할 수 없다.

**계정 두 개로 양방향 확인 완료.** 서로의 기록이 안 보인다.

### 커밋·푸시 완료

| 커밋 | 내용 |
|---|---|
| `e7f540f` | 프론트 3파일, Edge Function CORS 수정 |
| `4e2ac17` | 확인 전용 페이지, 해석 품질·속도 조정 |

미푸시 없음.

### 최종 파일 구성

| 파일 | 내용 |
|---|---|
| `index.html` | 로그인 / 카드 뽑기 / 이력 |
| `confirm.html` `confirm.js` | 이메일 확인 전용 페이지. 확인만 하고 로그아웃시킨다 |
| `config.js` | Supabase URL + anon key (두 페이지가 공유) |
| `cards.js` | 78장 이름 + `drawCard()` |
| `script.js` | 로그인, 뽑기, 함수 호출, INSERT, 이력 조회·삭제 |
| `styles.css` | |
| `assets/cards/*.jpg` | 78장 |
| `supabase/functions/interpret/index.ts` | Edge Function |

### Edge Function 현재 설정

- 모델 `claude-opus-5` (sonnet-5 는 해석이 얕았다)
- `max_tokens: 1200`, `output_config: { effort: "low" }`
- 프롬프트: 질문 유형 판단 → 그림 요소 → 카드 위치 → 대입. 마크다운 금지. 5~8문장
- 요금 한 번에 20~30원 정도. 응답 15초 정도

⚠️ **CORS `Access-Control-Allow-Headers` 에 `x-client-info` 가 반드시 있어야 한다.**
빠지면 브라우저가 preflight 에서 막고 `Failed to send a request to the Edge Function` 이 뜬다.

### 화면 쪽 함정 — 다시 건드릴 때 주의

- **`[hidden] { display: none !important; }` 를 지우지 말 것.**
  `.card { display: flex }` 가 브라우저 기본 `[hidden]` 처리를 덮어써서,
  이게 없으면 숨긴 요소가 그대로 보인다
- `render()` 안에서 결과 칸을 비우면 안 된다. 탭 복귀 때도 불려서 해석이 사라진다.
  `onAuthStateChange` 에서 `TOKEN_REFRESHED`/`USER_UPDATED` 는 건너뛴다
- 카드 이미지는 높이를 고정해야 한다. flex 가 세로로 늘인다
- 해석 텍스트는 `white-space: pre-wrap` (단락 유지) + `textContent` (태그 실행 방지)

---

## 회고

`README.md` 「회고」 절 참조.

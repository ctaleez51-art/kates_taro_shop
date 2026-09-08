# Kate's Taro Shop

타로 카드를 뽑으면 AI가 해석해 주고, **로그인한 사용자가 자기 이력만** 다시 볼 수 있는 웹 앱.

모두의연구소 AI 에이전트 과정 — **[프로젝트] 내 서비스에 백엔드 붙이기 (갈래 B)** 제출물입니다.

---

## 제출물

| 요구 | 여기 |
|---|---|
| **작동 링크** | https://ctaleez51-art.github.io/kates_taro_shop/ |
| **3분 시연** (새로고침해도 데이터가 남는 장면) | https://youtu.be/YKVYqPOVdRs |
| **설계 한 장** | [`PRD_tarot.md` 5절](PRD_tarot.md#5-설계-한-장) |
| **고른 호스팅과 그 이유 한 줄** | [`PRD_tarot.md` 5절 아래](PRD_tarot.md#5-설계-한-장) |
| 제출 전 보안 체크 5항목 | [`PRD_tarot.md` 8절](PRD_tarot.md#8-보안) |

---

## 무엇이 백엔드로 도는가

```
브라우저 (GitHub Pages)
  ├─→ 로그인          →  Supabase Auth
  ├─→ 이력 저장/조회   →  Supabase DB   (RLS로 내 것만)
  └─→ 카드 해석 요청   →  Supabase Edge Function  →  Claude API
                          (여기에만 ANTHROPIC_API_KEY 가 있다)
```

- **저장** — 해석까지 받은 뒤 `readings` 테이블에 INSERT 한 번. 새로고침·다른 기기에서도 남는다
- **내 것만 조회** — DB의 RLS 정책(`auth.uid() = user_id`)이 거른다. 프론트가 보내는 값을 믿지 않는다
- **AI 해석** — Claude API 키를 브라우저에 두면 페이지 소스로 유출되므로 Edge Function을 거친다

## 보안

- `ANTHROPIC_API_KEY` 는 Edge Function 환경변수(`Deno.env.get`)에만 있다. 프론트 코드·저장소 어디에도 없다
- `readings` 에 RLS ON + 정책 3개(select / insert / delete, 전부 `auth.uid() = user_id`)
- **RLS는 계정 두 개로 양방향 실제 확인했다.** 서로의 기록이 보이지 않는다
  (대시보드 SQL Editor는 소유자 권한이라 RLS를 적용받지 않아 그 창에서는 확인할 수 없다 — [`PRD_tarot.md` 8절](PRD_tarot.md#8-보안))
- `config.js` 의 `SUPABASE_ANON_KEY` 는 공개 키다. 이것만으로는 남의 기록을 볼 수 없다. 막는 것은 RLS다
- Anthropic Console에 월 $10 사용량 한도·알림 설정

## 파일

| 파일 | 내용 |
|---|---|
| `index.html` | 로그인 / 카드 뽑기 / 이력 화면 |
| `confirm.html` `confirm.js` | 이메일 확인 전용 페이지. 확인만 마치고 로그인은 사용자가 직접 |
| `config.js` | Supabase 주소와 공개 키 (두 페이지가 공유) |
| `cards.js` | 타로 78장 이름 + `drawCard()` |
| `script.js` | 로그인, 뽑기, Edge Function 호출, 저장, 이력 조회·삭제 |
| `styles.css` | |
| `assets/cards/` | 카드 이미지 78장 |
| `supabase/functions/interpret/` | Edge Function — Claude API 호출 |
| `PRD_tarot.md` | 설계 문서 |

## 만들면서 정한 것

- 스프레드 **1장**(오늘의 카드), **정방향만**
- 카드 이름은 **영어로 저장** (`The Fool`, `Ace of Wands` …)
- 저장은 해석까지 받은 뒤 **INSERT 한 번**. UPDATE 없음 — 이유는 [`PRD_tarot.md` 7절](PRD_tarot.md#7-창구-엔드포인트)
- 이메일 확인(Confirm email) **켬**. 대신 확인 전용 페이지와 상황별 한국어 안내를 넣었다
- 카드 그림은 Rider–Waite 덱(1909년 발행, 저작권 만료), 위키미디어 커먼즈

## 로컬에서 실행

```bash
python -m http.server 5500
```

`http://localhost:5500` 을 연다. 빌드 도구 없이 순수 HTML/CSS/JS 이고, Supabase JS는 CDN으로 불러온다.

Supabase의 `Authentication → URL Configuration → Redirect URLs` 에 실행 주소가 등록돼 있어야
가입 확인 링크가 돌아온다.

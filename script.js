// Kate's Taro Shop — 화면 동작
//
// 흐름은 하나다.
//   로그인 → 카드 뽑기 → Edge Function이 해석 → readings 에 INSERT 1번 → 이력 다시 읽기
//
// 여기 적는 anon key 는 공개돼도 되는 값이다. 이 키만으로는 남의 기록을 못 본다.
// 막는 것은 키가 아니라 DB의 RLS 정책(auth.uid() = user_id)이다.
// 반대로 Claude API 키는 절대 여기 적지 않는다. 그건 Edge Function 환경변수에만 있다.

const SUPABASE_URL = "https://hwihutjovqonuvajfhar.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3aWh1dGpvdnFvbnV2YWpmaGFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4MzIyMTQsImV4cCI6MjEwNDQwODIxNH0.r_KZVs59dqa7le8jqgJ5aTqbGoiLjKQsQo4S-FsmzHA"; // ← Supabase → Settings → API

// CDN이 만들어 준 전역 supabase 로 클라이언트를 만든다
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- 화면 요소 ----------
const $ = (id) => document.getElementById(id);

const screenAuth = $("screen-auth");
const screenApp = $("screen-app");
const authForm = $("auth-form");
const authMsg = $("auth-msg");
const drawForm = $("draw-form");
const drawMsg = $("draw-msg");
const historyMsg = $("history-msg");
const historyList = $("history");
const result = $("result");

// 안내 문구를 한 곳에서 처리한다
function say(el, text, isError = false) {
  el.textContent = text;
  el.classList.toggle("error", isError);
}

// 카드 이름 → 이미지 경로. "Ace of Wands" → assets/cards/ace_of_wands.jpg
function cardImage(name) {
  return "assets/cards/" + name.toLowerCase().replaceAll(" ", "_") + ".jpg";
}

// DB에 저장된 시각을 읽기 좋게
function whenText(iso) {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ---------- 로그인 여부에 따라 화면 갈아끼우기 ----------
async function render(session) {
  const loggedIn = Boolean(session);
  screenAuth.hidden = loggedIn;
  screenApp.hidden = !loggedIn;

  if (loggedIn) {
    $("who").textContent = session.user.email;
    await loadHistory();
  }
}

// ---------- 회원가입 / 로그인 / 로그아웃 ----------
$("btn-signup").addEventListener("click", async () => {
  const email = $("email").value.trim();
  const password = $("password").value;
  if (!email || password.length < 6) {
    return say(authMsg, "이메일과 6자 이상 비밀번호를 넣어 주세요.", true);
  }

  say(authMsg, "가입 중...");
  // emailRedirectTo — 확인 링크를 누른 뒤 돌아올 주소.
  // 안 적으면 Supabase 기본값(localhost:3000)으로 가서 "연결할 수 없음" 이 뜬다.
  // 지금 열려 있는 주소를 그대로 쓰면 로컬이든 GitHub Pages든 알아서 맞는다.
  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: window.location.href.split("#")[0] },
  });
  if (error) return say(authMsg, "가입 실패: " + error.message, true);

  // 이메일 확인이 켜져 있으면 session 이 아직 없다.
  // 이때 아무 문구도 안 띄우면 가입한 사람은 왜 로그인이 안 되는지 알 수가 없다.
  if (!data.session) {
    say(authMsg,
      email + " 로 확인 메일을 보냈습니다. " +
      "메일함에서 링크를 누르면 로그인됩니다. " +
      "메일이 안 보이면 스팸함도 확인해 주세요."
    );
    $("btn-resend").hidden = false;   // 못 받은 경우를 위한 버튼
  }
});

// 확인 메일을 못 받았거나 지워버린 경우 다시 보낸다.
// 돌아올 주소는 가입할 때와 같아야 한다.
$("btn-resend").addEventListener("click", async () => {
  const email = $("email").value.trim();
  if (!email) return say(authMsg, "이메일을 먼저 넣어 주세요.", true);

  const btn = $("btn-resend");
  btn.disabled = true;
  say(authMsg, "다시 보내는 중...");

  const { error } = await sb.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: window.location.href.split("#")[0] },
  });

  btn.disabled = false;
  if (error) return say(authMsg, "다시 보내지 못했습니다: " + error.message, true);
  say(authMsg, email + " 로 다시 보냈습니다. 메일함을 확인해 주세요.");
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("email").value.trim();
  const password = $("password").value;

  say(authMsg, "로그인 중...");
  const { error } = await sb.auth.signInWithPassword({ email, password });

  if (error) {
    // Supabase가 주는 문구는 영어다. 그대로 보여주면 처음 온 사람은 뜻을 모른다.
    // 특히 "Email not confirmed" 는 비밀번호가 틀린 게 아니라
    // 확인 메일을 아직 안 누른 것이므로, 할 일을 알려줘야 한다.
    if (error.message.includes("Email not confirmed")) {
      say(authMsg,
        "아직 이메일 확인이 안 됐습니다. " +
        email + " 메일함에서 확인 링크를 누른 뒤 다시 로그인해 주세요.",
        true
      );
      $("btn-resend").hidden = false;
      return;
    }
    if (error.message.includes("Invalid login credentials")) {
      return say(authMsg, "이메일 또는 비밀번호가 맞지 않습니다.", true);
    }
    return say(authMsg, "로그인 실패: " + error.message, true);
  }

  say(authMsg, "");
  $("btn-resend").hidden = true;
});

$("btn-logout").addEventListener("click", async () => {
  await sb.auth.signOut();
  result.hidden = true;
  historyList.replaceChildren();
  say(drawMsg, "");
});

// 로그인·로그아웃·새로고침 전부 이 한 곳으로 들어온다.
//
// 확인 링크를 누르면 Supabase가 이 주소로 돌려보내면서 주소 끝에 토큰을 붙여 준다.
// 라이브러리가 그걸 읽어 로그인 처리를 하고 SIGNED_IN 을 알려준다.
// 그때는 사용자가 로그인 버튼을 누른 게 아니므로, 확인이 끝났다고 알려줘야 한다.
const cameFromEmailLink = window.location.hash.includes("access_token");

sb.auth.onAuthStateChange((event, session) => {
  render(session);
  if (event === "SIGNED_IN" && cameFromEmailLink) {
    say(drawMsg, "이메일 확인이 끝났습니다. 이제 카드를 뽑을 수 있습니다.");
    // 주소창에 남은 토큰을 지운다. 그대로 두면 새로고침·공유 때 같이 따라간다.
    history.replaceState(null, "", window.location.pathname);
  }
});

// 확인 링크로 들어온 경우 주소에 오류가 실려 올 수도 있다 (링크 만료 등)
const hashError = new URLSearchParams(window.location.hash.slice(1)).get("error_description");
if (hashError) say(authMsg, "확인 링크 오류: " + hashError, true);

sb.auth.getSession().then(({ data }) => render(data.session));

// ---------- 카드 뽑기 ----------
drawForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const btn = $("btn-draw");
  const question = $("question").value.trim();
  const card = drawCard();          // cards.js 의 78장에서 한 장

  btn.disabled = true;
  result.hidden = true;
  say(drawMsg, `${card} — 해석을 받아오는 중...`);

  try {
    // 1) Edge Function 에 해석 요청. Claude 키는 저쪽에만 있다.
    const { data, error } = await sb.functions.invoke("interpret", {
      body: { card, question },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);

    const interpretation = data.interpretation;

    // 2) 해석까지 받은 뒤 한 번만 INSERT 한다. user_id 는 RLS 통과용.
    const { data: session } = await sb.auth.getSession();
    const { error: insErr } = await sb.from("readings").insert({
      user_id: session.session.user.id,
      question: question || null,
      cards: [card],              // 1장이지만 배열로 저장한다
      interpretation,
    });
    if (insErr) throw new Error("저장 실패: " + insErr.message);

    // 3) 화면에 보여준다
    $("result-img").src = cardImage(card);
    $("result-img").alt = card;
    $("result-card").textContent = card;
    $("result-question").textContent = question ? `“${question}”` : "";
    $("result-text").textContent = interpretation;
    result.hidden = false;

    say(drawMsg, "");
    $("question").value = "";
    await loadHistory();
  } catch (err) {
    say(drawMsg, err.message, true);
  } finally {
    btn.disabled = false;
  }
});

// ---------- 이력 읽기 ----------
// RLS 가 걸려 있으므로 조건을 안 써도 내 것만 온다.
async function loadHistory() {
  say(historyMsg, "불러오는 중...");

  const { data, error } = await sb
    .from("readings")
    .select("id, created_at, question, cards, interpretation")
    .order("created_at", { ascending: false });

  if (error) return say(historyMsg, "이력을 불러오지 못했습니다: " + error.message, true);

  historyList.replaceChildren();

  if (!data.length) {
    return say(historyMsg, "아직 기록이 없습니다. 카드를 뽑아 보세요.");
  }
  say(historyMsg, `${data.length}개`);

  for (const row of data) {
    historyList.appendChild(historyItem(row));
  }
}

// 이력 한 줄 만들기.
// AI가 쓴 글과 사용자가 쓴 질문은 textContent 로만 넣는다 —
// innerHTML 로 넣으면 글 안의 태그가 실행돼 버린다.
function historyItem(row) {
  const name = Array.isArray(row.cards) ? row.cards[0] : String(row.cards);

  const li = document.createElement("li");

  const img = document.createElement("img");
  img.src = cardImage(name);
  img.alt = name;

  const body = document.createElement("div");
  body.className = "body";

  const when = document.createElement("div");
  when.className = "when";
  when.textContent = whenText(row.created_at);

  const title = document.createElement("div");
  title.className = "name";
  title.textContent = name;

  body.append(when, title);

  if (row.question) {
    const q = document.createElement("p");
    q.className = "question";
    q.textContent = `“${row.question}”`;
    body.appendChild(q);
  }

  const text = document.createElement("p");
  text.className = "text";
  text.textContent = row.interpretation;
  body.appendChild(text);

  const del = document.createElement("button");
  del.type = "button";
  del.textContent = "삭제";
  del.addEventListener("click", async () => {
    del.disabled = true;
    const { error } = await sb.from("readings").delete().eq("id", row.id);
    if (error) {
      del.disabled = false;
      return say(historyMsg, "삭제 실패: " + error.message, true);
    }
    await loadHistory();
  });

  li.append(img, body, del);
  return li;
}

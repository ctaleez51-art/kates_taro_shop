// Kate's Taro Shop — 화면 동작
//
// 흐름은 하나다.
//   로그인 → 카드 뽑기 → Edge Function이 해석 → readings 에 INSERT 1번 → 이력 다시 읽기
//
// 여기 적는 anon key 는 공개돼도 되는 값이다. 이 키만으로는 남의 기록을 못 본다.
// 막는 것은 키가 아니라 DB의 RLS 정책(auth.uid() = user_id)이다.
// 반대로 Claude API 키는 절대 여기 적지 않는다. 그건 Edge Function 환경변수에만 있다.

// 접속 정보는 config.js 에 있다 (index.html 이 먼저 불러온다)

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

// 위쪽 결과 칸에 지금 띄워 둔 줄의 id.
// 이력 목록에서 이것만 빼면 같은 게 화면에 두 번 안 나온다.
// 삭제·재조회 때도 유지돼야 하므로 변수로 둔다.
let shownResultId = null;

// 안내 문구를 한 곳에서 처리한다
function say(el, text, isError = false) {
  el.textContent = text;
  el.classList.toggle("error", isError);
}

// 결과 칸과 입력칸을 완전히 비운다.
// hidden 으로 숨기기만 하면 안의 글이 남아 있어서, 어떤 경로로든
// 다시 보이게 되는 순간 옛 내용이 그대로 나온다. 내용까지 지운다.
function clearResult() {
  result.hidden = true;
  $("result-img").removeAttribute("src");
  $("result-img").alt = "";
  $("result-card").textContent = "";
  $("result-question").textContent = "";
  $("result-text").textContent = "";
  shownResultId = null;
}

function clearAuthForm() {
  $("email").value = "";
  $("password").value = "";
  $("btn-resend").hidden = true;
  say(authMsg, "");
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

  // 여기서 결과 칸을 비우면 안 된다.
  // 탭을 떠났다 돌아올 때도 이 함수가 다시 불려서, 보고 있던 해석이 지워진다.
  // 비우는 것은 로그아웃할 때만 한다.
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
    // 확인 링크는 전용 페이지로 돌려보낸다. 거기서 확인만 마치고,
    // 로그인은 사용자가 첫 화면에서 직접 한다.
    options: { emailRedirectTo: new URL("confirm.html", window.location.href).href },
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
    options: { emailRedirectTo: new URL("confirm.html", window.location.href).href },
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
  clearResult();
  clearAuthForm();
  historyList.replaceChildren();
  say(drawMsg, "");
  say(historyMsg, "");
});

// 로그인·로그아웃·새로고침 전부 이 한 곳으로 들어온다.
// 확인 링크는 이 페이지로 오지 않는다 (confirm.html 이 받는다).

sb.auth.onAuthStateChange((event, session) => {
  // 토큰 자동 갱신 때도 이 콜백이 불린다. 그때 다시 그리면
  // 보고 있던 해석이 지워지므로 건너뛴다. 로그인 상태는 그대로다.
  if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;

  render(session);
});

sb.auth.getSession().then(({ data }) => render(data.session));

// ---------- 카드 뽑기 ----------
drawForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const btn = $("btn-draw");
  const question = $("question").value.trim();
  const card = drawCard();          // cards.js 의 78장에서 한 장

  btn.disabled = true;
  result.hidden = true;
  say(drawMsg, `${card} — 해석을 받아오는 중입니다. (15~20초 정도 소요됩니다.)`);

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
    // select().single() 을 붙여 방금 만든 줄의 id 를 돌려받는다.
    // 위에 결과를 띄우므로, 아래 "지난 기록" 에서는 이 id 를 빼야 같은 게 두 번 안 보인다.
    const { data: inserted, error: insErr } = await sb
      .from("readings")
      .insert({
        user_id: session.session.user.id,
        question: question || null,
        cards: [card],              // 1장이지만 배열로 저장한다
        interpretation,
      })
      .select("id")
      .single();
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
    shownResultId = inserted.id;      // 방금 뽑은 것은 위에 있으니 목록에서 뺀다
    await loadHistory();
  } catch (err) {
    say(drawMsg, err.message, true);
  } finally {
    btn.disabled = false;
  }
});

// ---------- 이력 읽기 ----------
// RLS 가 걸려 있으므로 조건을 안 써도 내 것만 온다.
//
// excludeId — 방금 뽑아 위쪽에 띄운 줄. "지난 기록" 이라는 제목대로
// 지난 것만 보이게 하려고 그 하나만 목록에서 뺀다.
async function loadHistory(excludeId = shownResultId) {
  say(historyMsg, "불러오는 중...");

  const { data, error } = await sb
    .from("readings")
    .select("id, created_at, question, cards, interpretation")
    .order("created_at", { ascending: false });

  if (error) return say(historyMsg, "이력을 불러오지 못했습니다: " + error.message, true);

  const rows = data.filter((r) => r.id !== excludeId);

  historyList.replaceChildren();

  if (!rows.length) {
    return say(historyMsg,
      excludeId ? "지난 기록은 아직 없습니다." : "아직 기록이 없습니다. 카드를 뽑아 보세요."
    );
  }
  say(historyMsg, `${rows.length}개`);

  for (const row of rows) {
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

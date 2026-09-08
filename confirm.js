// Kate's Taro Shop — 이메일 확인 전용 페이지
//
// 확인 링크를 누르면 Supabase가 이 주소로 되돌려 보내면서
// 주소 끝(#)에 토큰을 붙여 준다. 라이브러리가 그걸 읽어 로그인 처리를 한다.
//
// 이 페이지는 확인만 마치고 그 로그인을 바로 풀어 준다.
// 로그인은 사용자가 첫 화면에서 직접 하도록 두는 것이 보통의 방식이다.

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);
const title = $("title");
const detail = $("detail");
const go = $("go");

function done(titleText, detailText, isError = false) {
  title.textContent = titleText;
  detail.textContent = detailText;
  detail.classList.toggle("error", isError);
  go.hidden = false;
}

// 주소에 오류가 실려 오는 경우 (링크 만료, 이미 사용한 링크 등)
const hash = new URLSearchParams(window.location.hash.slice(1));
const hashError = hash.get("error_description") || hash.get("error");

async function run() {
  if (hashError) {
    return done("확인하지 못했습니다", hashError + " — 링크가 만료되었거나 이미 사용된 것일 수 있습니다.", true);
  }

  // 라이브러리가 주소의 토큰을 처리할 시간을 준다
  const { data } = await sb.auth.getSession();

  if (!data.session) {
    return done(
      "확인 정보가 없습니다",
      "이 페이지는 메일의 확인 링크를 눌렀을 때 열리는 곳입니다.",
      true
    );
  }

  const email = data.session.user.email;

  // 확인은 끝났다. 로그인 상태는 풀어 준다.
  await sb.auth.signOut();

  // 주소창에 남은 토큰을 지운다. 그대로 두면 새로고침·공유 때 따라간다.
  history.replaceState(null, "", window.location.pathname);

  done("이메일 인증이 완료되었습니다", email + " 으로 로그인하실 수 있습니다.");
}

run();

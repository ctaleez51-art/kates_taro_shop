# AIFFEL Campus Code Peer Review Templete
- 코더 : 이지연
- 리뷰어 : 이예림


# PRT(Peer Review Template)
[x]  **1. 주어진 문제를 해결하는 완성된 코드가 제출되었나요?**
- 문제에서 요구하는 기능이 정상적으로 작동하는지?
    - 해당 조건을 만족하는 부분의 코드 및 결과물을 근거로 첨부

  로그인 → 카드 뽑기 → AI 해석 → 저장, 그리고 **새로고침해도 이력이 남는 것**과 **다른 계정끼리는 서로의 기록이 보이지 않는 것**은 테스트 영상에서 의도대로 동작함을 확인했습니다. (PRD 3절 시나리오 6·8번, `PRD_tarot.md` 참고)

  ```js
  // script.js:216-231 — 해석까지 받은 뒤 readings 테이블에 INSERT 한 번
  const { data: session } = await sb.auth.getSession();
  const { data: inserted, error: insErr } = await sb
    .from("readings")
    .insert({
      user_id: session.session.user.id,
      question: question || null,
      cards: [card],
      interpretation,
    })
    .select("id")
    .single();
  if (insErr) throw new Error("저장 실패: " + insErr.message);
  ```

  이력 삭제(Delete)도 리뷰어가 직접 재테스트한 결과 정상적으로 반영됨을 확인했습니다. 코드 리뷰 초안에서 "삭제 후 새로고침하면 데이터가 남아 있다"고 지적했던 부분은, 실제 재현이 되지 않아 **철회합니다.** (아래 3번 참고 — 코더 쪽 확인 과정에서도 같은 결론이었습니다.)

  ```js
  // script.js:319-330 — 이력 삭제 버튼 핸들러
  del.addEventListener("click", async () => {
    del.disabled = true;
    const { error } = await sb.from("readings").delete().eq("id", row.id);
    if (error) {
      del.disabled = false;
      return say(historyMsg, "삭제 실패: " + error.message, true);
    }
    await loadHistory();
  });
  ```

  `readings` 테이블의 `delete own` 정책(`auth.uid() = user_id`)이 정상적으로 걸려 있고, 삭제 후 `loadHistory()`로 서버에서 목록을 다시 받아오는 구조라 새로고침 여부와 무관하게 삭제가 반영됩니다. 로그인 격리(RLS) · 새로고침 후 영속성 · 삭제(Delete)까지 PRD가 요구하는 핵심 기능이 모두 의도대로 동작하는 것을 확인했습니다.

[x]  **2. 핵심적이거나 복잡하고 이해하기 어려운 부분에 작성된 설명을 보고 해당 코드가 잘 이해되었나요?**
- 해당 코드 블럭에 doc string/annotation/markdown이 달려 있는지 확인
- 해당 코드가 무슨 기능을 하는지, 왜 그렇게 짜여진건지, 작동 메커니즘이 뭔지 기술.
- 주석을 보고 코드 이해가 잘 되었는지 확인
    - 잘 작성되었다고 생각되는 부분을 근거로 첨부합니다.

  `script.js` 상단에 전체 데이터 흐름과 "이 값을 왜 여기에 두면 안 되는지"까지 미리 밝혀 둬서, 코드를 읽기 전에 큰 그림이 먼저 잡힙니다.

  ```js
  // script.js:1-8
  // Kate's Taro Shop — 화면 동작
  //
  // 흐름은 하나다.
  //   로그인 → 카드 뽑기 → Edge Function이 해석 → readings 에 INSERT 1번 → 이력 다시 읽기
  //
  // 여기 적는 anon key 는 공개돼도 되는 값이다. 이 키만으로는 남의 기록을 못 본다.
  // 막는 것은 키가 아니라 DB의 RLS 정책(auth.uid() = user_id)이다.
  ```

  `shownResultId`처럼 "왜 이 변수가 필요한가"가 한 줄로는 설명이 안 되는 부분에 의도를 정확히 남겨 두었습니다.

  ```js
  // script.js:28-31
  // 위쪽 결과 칸에 지금 띄워 둔 줄의 id.
  // 이력 목록에서 이것만 빼면 같은 게 화면에 두 번 안 나온다.
  // 삭제·재조회 때도 유지돼야 하므로 변수로 둔다.
  let shownResultId = null;
  ```

  `onAuthStateChange`에서 특정 이벤트를 건너뛰는, 이유를 모르면 실수로 지우기 쉬운 코드에도 근거가 남아 있습니다.

  ```js
  // script.js:184-190
  sb.auth.onAuthStateChange((event, session) => {
    // 토큰 자동 갱신 때도 이 콜백이 불린다. 그때 다시 그리면
    // 보고 있던 해석이 지워지므로 건너뛴다. 로그인 상태는 그대로다.
    if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;
    render(session);
  });
  ```

  Edge Function 쪽도 CORS 헤더 하나하나에 "빠지면 무엇이 실패하는지"를 적어 둬서, 나중에 값을 지웠을 때 왜 깨지는지 바로 알 수 있습니다.

  ```ts
  // supabase/functions/interpret/index.ts:12-19
  // 브라우저가 다른 주소(GitHub Pages)에서 이 함수를 부르므로 CORS 허용이 필요하다
  const cors = {
    "Access-Control-Allow-Origin": "*",
    // Supabase JS가 자동으로 붙이는 x-client-info 를 빠뜨리면
    // 브라우저가 preflight 단계에서 요청을 막는다 (함수에 도달조차 못 한다)
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  ```

[x]  **3. 에러가 난 부분을 디버깅하여 “문제를 해결한 기록”을 남겼나요? 또는 “새로운 시도 및 추가 실험”을 해봤나요?**
- 문제 원인 및 해결 과정을 잘 기록하였는지 확인
- 문제에서 요구하는 조건에 더해 추가적으로 수행한 나만의 시도, 실험이 기록되어 있는지 확인
    - 잘 작성되었다고 생각되는 부분을 캡쳐해 근거로 첨부합니다.

  `HANDOFF.md`에 배포 과정에서 실제로 막혔던 지점과 원인·해결책이 구체적으로 남아 있습니다. 특히 "설정을 넣은 것"과 "실제로 작동을 확인한 것"을 구분해 다시 검증한 기록이 인상적입니다.

  ```md
  // HANDOFF.md:177-183
  ### RLS 실제 확인 완료

  ⚠️ 전에 적혀 있던 "RLS 확인 끝났다"는 **정책이 존재한다는 것까지**였다.
  대시보드 SQL Editor는 소유자 권한이라 RLS를 적용받지 않고, 거기서는 `auth.uid()` 가 `null` 이라
  정책이 걸러내는지 확인할 수 없다.

  **계정 두 개로 양방향 확인 완료.** 서로의 기록이 안 보인다.
  ```

  Windows 환경에서 겪은 배포 문제(토큰 미저장, 따옴표 누락 시 조용한 실패 등)도 재발 방지용으로 정리해 뒀습니다.

  ```md
  // HANDOFF.md:153-162
  ⚠️ Windows에서 걸린 것들. 다음에도 그대로 걸린다.

  - **`npx.cmd`** 를 쓴다. `npx` 는 PowerShell 실행 정책에 막힌다
  - **`supabase login` 은 토큰을 저장하지 않는다.** 성공 문구가 떠도 다음 명령이 인증 실패한다.
    개인 액세스 토큰(`sbp_`)을 만들어 `SUPABASE_ACCESS_TOKEN` 으로 넘긴다
  - **환경변수는 그 창에서만 산다.** 명령은 항상 `토큰; cd 폴더; 명령` 을 **한 줄로** 줄 것
  - **`secrets set` 인자는 따옴표로 묶는다.** 안 묶으면 아무 반응 없이 조용히 실패한다
  ```

  README 회고 2·3번 항목에서도 500 에러와 잘못된 예측을 원인 분석과 함께 기록했습니다.

  ```md
  // README.md:76-88
  ### 2. 404와 500 중 더 만나고 싶지 않은 것과 이유
  **500이 더 싫다. 404는 내가 어디를 잘못 짚었는지 알려주는데, 500은 아무것도 알려주지 않기 때문이다.**
  ...
  ### 3. '먼저 예측' 표에서 틀리게 예측했던 항목
  **"정책을 넣었으니 RLS 확인은 끝났다"** 고 예측한 것이 틀렸다.
  ```

  (참고: 초안 리뷰 단계에서 "삭제 후 새로고침하면 데이터가 남는다"는 의심이 있었으나, 리뷰어가 직접 재테스트한 결과 재현되지 않아 실제 이슈가 아닌 것으로 정리했습니다 — 1번 항목 참고.)

[x]  **4. 회고를 잘 작성했나요?**
- 프로젝트 결과물에 대해 배운점과 아쉬운점, 느낀점 등이 상세히 기록 되어 있나요?
	- 딥러닝 모델의 경우, 인풋이 들어가 최종적으로 아웃풋이 나오기까지의 전체 흐름을 도식화하여 모델 아키텍쳐에 대한 이해를 돕고 있는지 확인

  `README.md` 「회고」 절에 요구된 4문항(백엔드가 왜 필요했는지, 404/500 비교, 잘못된 예측, AI 보안 검증 질문)에 각각 구체적인 사례와 근거를 들어 답했습니다. 비유를 써서 "왜 그런지"까지 설명한 점이 특히 좋았습니다.

  ```md
  // README.md:70-74
  ### 1. 내 화면이 세상과 끊겨 있던 이유 — 손님·주방 비유로 한 문장

  메뉴판과 손님 자리는 다 차려 놨는데 주방이 없어서, 주문을 받아도 아무것도 만들어 나오지 않고
  손님이 나가면 주문 기록도 같이 사라지는 가게였다.
  ```

  ```md
  // README.md:96-102
  ### 4. AI에게 보안을 맡길 때 반드시 되물어야 할 질문 하나

  **"그게 막힌다는 걸 어떻게 확인했나 — 설정이 있다는 것만 봤나, 실제로 막히는 것을 봤나?"**

  이번에 내가 그 함정에 그대로 빠졌다. "RLS 확인 완료" 라고 적혀 있었지만 확인된 것은
  정책이 존재한다는 것까지였다. ... 막는 장치가 있느냐를 묻는 것으로는 부족하고,
  **막히는 장면을 봤느냐**를 물어야 한다.
  ```

  이 과제는 딥러닝 모델이 아닌 백엔드 연동 웹앱이라 아키텍처 도식은 해당 사항이 없으나, 대신 `PRD_tarot.md` 5절에 브라우저 → Auth/DB/Edge Function → Claude API로 이어지는 데이터 흐름도가 회고 내용과 일치하게 실려 있어 이해를 돕습니다.

[x]  **5. 코드가 간결하고 효율적인가요?**
- 파이썬 스타일 가이드 (PEP8)를 준수하였는지 확인
- 코드 중복을 최소화하고 범용적으로 사용할 수 있도록 모듈화(함수화) 했는지
    - 잘 작성되었다고 생각되는 부분을 근거로 첨부합니다.

  이 프로젝트는 Python이 아닌 순수 HTML/CSS/JS라 PEP8은 해당하지 않지만, 동일한 취지(일관된 네이밍, 중복 제거)로 보면 반복되는 DOM 조작과 안내 문구 처리를 작은 함수로 잘 모듈화했습니다.

  ```js
  // script.js:16, 34-37, 60-70
  const $ = (id) => document.getElementById(id);

  function say(el, text, isError = false) {
    el.textContent = text;
    el.classList.toggle("error", isError);
  }

  function cardImage(name) {
    return "assets/cards/" + name.toLowerCase().replaceAll(" ", "_") + ".jpg";
  }
  ```

  이력 한 줄을 그리는 로직도 `historyItem()` 함수 하나로 분리돼 있어, `loadHistory()`는 목록을 순회하며 호출만 하면 되고 DOM 생성 코드가 중복되지 않습니다.

  ```js
  // script.js:277-279
  for (const row of rows) {
    historyList.appendChild(historyItem(row));
  }
  ```

  개선 여지는 있습니다 — 카드 뽑기(INSERT) 후와 삭제 후 모두 `loadHistory()`로 **목록 전체를 다시 조회**합니다. 항목 하나만 늘거나 줄어드는 상황이므로, 서버에 다시 묻는 대신 DOM에서 해당 항목만 추가/제거해도 충분합니다. 지금 규모(이력 1인당 최대 수십 건)에서는 성능 문제로 이어지진 않지만, 요청 수를 줄일 수 있는 부분입니다.


# 참고 링크 및 코드 개선

## 1.코드 리뷰 시 참고한 링크가 있다면 링크와 간략한 설명을 첨부합니다.

- Supabase JS `delete()` 레퍼런스 — https://supabase.com/docs/reference/javascript/delete
  `delete()`가 실제로 지워진 행 수를 알려주지 않는다는 점(기본값은 `error` 유무만 반환)을 확인하려고 참고했습니다. 이번 프로젝트에서는 재현되는 문제가 아니었지만, 앞으로 삭제 실패를 더 세밀하게 감지하고 싶을 때 `.select()`나 `{ count: "exact" }` 옵션을 쓸 수 있다는 것을 알아두면 좋습니다.

## 2.코드 리뷰를 통해 개선을 제안할 코드가 있다면 코드와 간략한 설명을 첨부합니다.

- `script.js:319-330`의 삭제 핸들러는 현재도 잘 동작하지만, 방어적으로 아래처럼 삭제된 행 수를 같이 확인해 두면 이후에 RLS 정책이 바뀌거나 다른 사람 계정으로 잘못된 id가 넘어오는 등의 상황에서도 원인 파악이 쉬워집니다. (지금 당장 고쳐야 할 버그는 아니고, 참고용 제안입니다.)

  ```js
  del.addEventListener("click", async () => {
    del.disabled = true;
    const { error, count } = await sb
      .from("readings")
      .delete({ count: "exact" })
      .eq("id", row.id);

    if (error) {
      del.disabled = false;
      return say(historyMsg, "삭제 실패: " + error.message, true);
    }
    if (count === 0) {
      del.disabled = false;
      return say(historyMsg, "삭제되지 않았습니다. (권한 또는 이미 삭제된 기록)", true);
    }
    await loadHistory();
  });
  ```


# 총평

로그인 → 카드 뽑기 → AI 해석 → 저장 → 새로고침 후 이력 유지 → 계정별 데이터 격리(RLS) → 이력 삭제까지, 이 과제의 핵심인 "백엔드가 실제로 돈다"는 것을 PRD가 요구하는 시나리오 그대로 잘 구현하고 검증했습니다. 특히 RLS를 대시보드가 아니라 계정 두 개로 직접 확인한 점, 그 과정에서 겪은 삽질을 회고와 HANDOFF에 솔직하게 남긴 점이 좋았습니다. 코드 주석도 "무엇을" 넘어 "왜"까지 설명하고 있어 다른 사람이 이어받기 좋은 코드입니다.

(리뷰 초안에서 "삭제 후 새로고침하면 데이터가 남는다"고 지적했던 부분은 리뷰어의 재테스트 결과 재현되지 않아 철회합니다. 코드상 삭제 핸들러와 RLS 정책 모두 정상적으로 구성돼 있습니다.) 굳이 더 다듬는다면, 카드 뽑기·삭제 후 매번 `loadHistory()`로 목록 전체를 다시 조회하는 부분을 부분 갱신으로 바꾸는 정도가 남아 있지만, 이번 제출 기준을 막는 문제는 아닙니다.

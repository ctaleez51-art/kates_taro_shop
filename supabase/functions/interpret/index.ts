// Kate's Taro Shop — 카드 해석 Edge Function
//
// 이 함수가 있는 이유는 하나다. Claude API 키를 브라우저에 두면 안 되기 때문이다.
// 키를 프론트 코드에 적으면 페이지 소스를 열어본 누구나 가져갈 수 있고,
// 그 키로 남이 AI를 호출하면 요금은 내게 온다.
// 그래서 키는 이 함수의 환경변수에만 두고, 브라우저는 이 함수만 부른다.
//
// 브라우저 → (카드 이름 + 질문) → 이 함수 → Claude API → 해석 → 브라우저

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

// 브라우저가 다른 주소(GitHub Pages)에서 이 함수를 부르므로 CORS 허용이 필요하다
const cors = {
  "Access-Control-Allow-Origin": "*",
  // Supabase JS가 자동으로 붙이는 x-client-info 를 빠뜨리면
  // 브라우저가 preflight 단계에서 요청을 막는다 (함수에 도달조차 못 한다)
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // 브라우저가 본 요청 전에 먼저 물어보는 단계(preflight)
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  if (req.method !== "POST") return json({ error: "POST만 받습니다" }, 405);

  if (!ANTHROPIC_API_KEY) {
    return json({ error: "서버에 ANTHROPIC_API_KEY가 설정되지 않았습니다" }, 500);
  }

  // --- 프론트가 보낸 값을 백엔드에서 검증한다 ---
  // 프론트를 믿지 않는다. 이상한 값이 오면 여기서 막는다.
  let card: string, question: string;
  try {
    const body = await req.json();
    card = typeof body.card === "string" ? body.card.trim() : "";
    question = typeof body.question === "string" ? body.question.trim() : "";
  } catch {
    return json({ error: "요청 형식이 잘못되었습니다" }, 400);
  }

  if (!card) return json({ error: "카드가 비었습니다" }, 400);
  if (card.length > 60) return json({ error: "카드 이름이 너무 깁니다" }, 400);
  if (question.length > 300) return json({ error: "질문이 너무 깁니다 (300자 이내)" }, 400);

  // --- Claude API 호출 ---
  const prompt = [
    "당신은 타로 리더입니다. 아래 정보를 보고 한국어로 해석을 써 주세요.",
    "",
    `뽑은 카드: ${card} (정방향)`,
    question ? `질문: ${question}` : "질문: (따로 없음. 오늘 전반에 대한 조언)",
    "",
    "아래 순서는 당신이 머릿속으로 밟을 방법이다.",
    "답에는 단계 번호도, 제목도, 소제목도 쓰지 말 것.",
    "",
    "읽는 순서:",
    "1. 질문의 유형을 먼저 판단할 것 — 상대의 마음 / 시기 / 선택 / 흐름 중 무엇인가.",
    "   같은 카드도 유형에 따라 다르게 읽힌다.",
    "2. 카드 그림의 구체적 요소를 짚을 것 — 인물의 자세, 배경, 손에 든 것,",
    "   둘러싼 것, 반복되는 수. 그 요소가 무엇을 뜻하는지 밝힐 것.",
    "3. 그 카드가 메이저인지 마이너인지, 순서상 어느 자리인지 고려할 것.",
    "4. 위 근거를 질문에 대입해 답할 것.",
    "",
    "지킬 것:",
    "- 좋게 포장하거나 돌려 말하지 말 것. 부정적으로 읽히면 그대로 쓸 것.",
    "- 근거 없이 안심시키지 말 것. 카드에 없는 것을 덧붙이지 말 것.",
    "- 질문에서 바라는 답이 카드에 없으면 없다고 말할 것.",
    "- 5~8문장. 근거는 짚되 나열하지 말 것. 핵심만 골라 쓸 것.",
    "- 마크다운을 쓰지 말 것. #, *, -, 표 기호를 쓰지 말고",
    "  평범한 문장과 단락으로만 쓸 것. 화면이 기호를 그대로 보여준다.",
    "- 손님에게 말하듯 이어지는 글로 쓸 것. 분석 보고서처럼 항목을 나누지 말 것.",
    "- 마지막에 오늘 해볼 만한 행동 한 가지를 덧붙일 것.",
  ].join("\n");

  let r: Response;
  try {
    r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        // 해석의 깊이 차이가 커서 opus 로 올렸다.
        // 요금: 입력 $5 / 출력 $25 per 1M (sonnet 은 $2 / $10)
        model: "claude-opus-5",
        max_tokens: 1200,   // 5~8문장이면 충분하다. 길면 응답이 느려진다
        // Opus 는 답하기 전에 속으로 추론한다. 기본값(high)이면 그만큼 느리다.
        // 타로 한 장 읽기에 high 는 과하다. medium 으로 낮춰 응답을 앞당긴다.
        output_config: { effort: "low" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch (e) {
    return json({ error: "AI 호출에 실패했습니다: " + String(e) }, 502);
  }

  if (!r.ok) {
    const detail = await r.text();
    // 429 = 사용량 한도, 529 = 과부하
    return json({ error: `AI가 응답하지 않았습니다 (${r.status})`, detail }, 502);
  }

  const data = await r.json();
  const interpretation = (data.content ?? [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("\n")
    .trim();

  if (!interpretation) return json({ error: "해석이 비어 있습니다" }, 502);

  return json({ card, question, interpretation });
});

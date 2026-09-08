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
    "조건:",
    "- 3~5문장. 너무 길지 않게.",
    "- 카드의 상징을 근거로 말할 것.",
    "- 단정적인 예언이나 불안을 주는 표현은 쓰지 말 것.",
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
        model: "claude-sonnet-5",
        max_tokens: 600,
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

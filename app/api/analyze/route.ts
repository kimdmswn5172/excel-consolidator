// POST /api/analyze: 대표 파일의 위쪽 행(또는 헤더만)을 받아 AI에게 취합 조건을 추천받아 돌려준다. (DESIGN 4번)
//  - API 키(ANTHROPIC_API_KEY)는 여기서만 읽고 브라우저로 내보내지 않는다.
//  - 받은 내용은 저장하지 않고, 내용이 들어간 로그(console.log 포함)도 남기지 않는다. (PRD 7번)
//  - 한 번 호출은 10초까지만 기다린다. 다시 시도와 실패 시 화면 전환은 PLAN.md 21번에서 만든다.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { buildUserMessage, SYSTEM_PROMPT } from "../../_lib/ai/buildPrompt";
import { toFailureReason } from "../../_lib/ai/failureReason";
import { aiOutputSchema, analyzeRequestSchema } from "../../_lib/ai/schemas";
import { toRecommendation } from "../../_lib/ai/toRecommendation";
import type { AnalyzeFailureReason, AnalyzeRequest, AnalyzeResponse } from "../../_lib/types";

const MODEL = "claude-sonnet-5-5";
const TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 200_000; // 위쪽 10행 샘플로는 넘을 수 없는 크기

function respond(body: AnalyzeResponse, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function fail(reason: AnalyzeFailureReason, status: number) {
  return respond({ ok: false, reason }, status);
}

export async function POST(request: Request) {
  // 1) 요청이 약속한 모양인지 검사한다.
  let analyzeRequest: AnalyzeRequest;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return fail("invalid-request", 413);
    const parsed = analyzeRequestSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return fail("invalid-request", 400);
    analyzeRequest = parsed.data;
  } catch {
    return fail("invalid-request", 400);
  }

  // 2) 키가 없으면 AI를 부를 수 없다. 값은 사용자가 .env에 직접 넣는다.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fail("auth", 503);

  // 3) AI에게 묻고, 답이 약속한 모양인지 검사해 추천으로 바꾼다. 재시도는 21번에서 직접 다루므로 SDK의 자동 재시도는 끈다.
  try {
    const client = new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: 0 });
    const message = await client.messages.parse({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserMessage(analyzeRequest) }],
      output_config: { format: zodOutputFormat(aiOutputSchema) },
    });
    const output = aiOutputSchema.safeParse(message.parsed_output);
    if (!output.success) return fail("invalid-response", 502);
    return respond({ ok: true, recommendation: toRecommendation(output.data, analyzeRequest) });
  } catch (error) {
    const reason = toFailureReason(error);
    return fail(reason, reason === "auth" ? 401 : reason === "timeout" ? 504 : 502);
  }
}

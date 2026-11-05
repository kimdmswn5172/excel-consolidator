// POST /api/analyze: 대표 파일의 위쪽 행(또는 헤더만)을 받아 AI에게 취합 조건을 추천받아 돌려준다. (DESIGN 4번)
//  - API 키(OPENAI_API_KEY)는 여기서만 읽고 브라우저로 내보내지 않는다.
//  - 받은 내용은 저장하지 않고, 내용이 들어간 로그(console.log 포함)도 남기지 않는다. (PRD 7번)
//  - 한 번 호출은 10초까지만 기다린다. 다시 시도와 실패 시 화면 전환은 브라우저 쪽(requestAnalysis)이 맡는다.
import { failureResponse, jsonResponse } from "../../_lib/ai/apiResponse";
import { buildUserMessage, SYSTEM_PROMPT } from "../../_lib/ai/buildPrompt";
import { askOpenAI, jsonSchemaOf } from "../../_lib/ai/openai";
import { aiOutputSchema, analyzeRequestSchema } from "../../_lib/ai/schemas";
import { toRecommendation } from "../../_lib/ai/toRecommendation";
import type { AnalyzeRequest, AnalyzeResponse } from "../../_lib/types";

const ANALYZE_JSON_SCHEMA = jsonSchemaOf(aiOutputSchema);
const TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 200_000; // 위쪽 10행 샘플로는 넘을 수 없는 크기

export async function POST(request: Request) {
  // 1) 요청이 약속한 모양인지 검사한다.
  let analyzeRequest: AnalyzeRequest;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return failureResponse("invalid-request", 413);
    const parsed = analyzeRequestSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return failureResponse("invalid-request");
    analyzeRequest = parsed.data;
  } catch {
    return failureResponse("invalid-request");
  }

  // 2) 키가 없으면 AI를 부를 수 없다. 값은 사용자가 .env에 직접 넣는다.
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return failureResponse("auth", 503);

  // 3) AI에게 묻고, 답이 약속한 모양인지 검사해 추천으로 바꾼다.
  const answer = await askOpenAI({
    apiKey,
    model: process.env.OPENAI_MODEL || undefined, // 모델을 바꾸고 싶을 때만 .env에 적는다
    system: SYSTEM_PROMPT,
    user: buildUserMessage(analyzeRequest),
    schemaName: "excel_consolidation_conditions",
    schema: ANALYZE_JSON_SCHEMA,
    timeoutMs: TIMEOUT_MS,
  });
  if (!answer.ok) return failureResponse(answer.reason);

  let output;
  try {
    output = aiOutputSchema.safeParse(JSON.parse(answer.content));
  } catch {
    return failureResponse("invalid-response");
  }
  if (!output.success) return failureResponse("invalid-response");
  const body: AnalyzeResponse = { ok: true, recommendation: toRecommendation(output.data, analyzeRequest) };
  return jsonResponse(body);
}

// POST /api/template: 업무 목적 글을 받아 AI에게 엑셀 양식(제목, 기준 열 이름, 작성 열 이름들)을 제안받아 돌려준다. (DESIGN 10번)
//  - 받는 것은 목적 글뿐이다. 엑셀 내용은 받지 않는다. 글은 저장하거나 로그에 남기지 않는다. (PRD 7번)
//  - 키 처리와 10초 제한은 /api/analyze와 같다.
import { failureResponse, jsonResponse } from "../../_lib/ai/apiResponse";
import { askOpenAI, jsonSchemaOf } from "../../_lib/ai/openai";
import { cleanProposal, templateOutputSchema, templateRequestSchema, type TemplateResponse } from "../../_lib/ai/templateSchemas";
import { buildTemplatePrompt, TEMPLATE_SYSTEM_PROMPT } from "../../_lib/ai/templatePrompt";

const TEMPLATE_JSON_SCHEMA = jsonSchemaOf(templateOutputSchema);
const TIMEOUT_MS = 10_000;
const MAX_BODY_BYTES = 5_000; // 500자 글이면 충분한 크기

export async function POST(request: Request) {
  let purpose: string;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return failureResponse("invalid-request", 413);
    const parsed = templateRequestSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return failureResponse("invalid-request");
    purpose = parsed.data.purpose;
  } catch {
    return failureResponse("invalid-request");
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return failureResponse("auth", 503);

  const answer = await askOpenAI({
    apiKey,
    model: process.env.OPENAI_MODEL || undefined,
    system: TEMPLATE_SYSTEM_PROMPT,
    user: buildTemplatePrompt(purpose),
    schemaName: "excel_template_proposal",
    schema: TEMPLATE_JSON_SCHEMA,
    timeoutMs: TIMEOUT_MS,
  });
  if (!answer.ok) return failureResponse(answer.reason);

  let proposal;
  try {
    const output = templateOutputSchema.safeParse(JSON.parse(answer.content));
    proposal = output.success ? cleanProposal(output.data) : null;
  } catch {
    proposal = null;
  }
  if (!proposal) return failureResponse("invalid-response");
  const body: TemplateResponse = { ok: true, proposal };
  return jsonResponse(body);
}

// OpenAI Chat Completions를 부르는 얇은 도구. (서버에서만 쓴다)
// 새 패키지를 설치하지 않고 표준 fetch로 REST 주소를 직접 부른다.
// 오류 메시지에는 요청 내용이 섞일 수 있어서, 이유 분류만 돌려주고 메시지는 어디에도 남기지 않는다. (PRD 7번)
import * as z from "zod/v4";
import type { AnalyzeFailureReason } from "../types";
import { aiOutputSchema } from "./schemas";

export const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
// gpt-4.1: 연습용 양식 10종 시험에서 9/10(두 번 모두). 더 작은 gpt-4.1-mini는 7~8/10이었다. (PLAN 23번 기록)
export const DEFAULT_MODEL = "gpt-4.1";

// AI가 약속한 모양(JSON)으로만 답하게 하는 규칙. Zod 규칙에서 그대로 만들어 검사 규칙과 어긋나지 않게 한다.
const { $schema: _unused, ...outputJsonSchema } = z.toJSONSchema(aiOutputSchema) as Record<string, unknown>;
void _unused;

// HTTP 상태 코드를 실패 이유로 바꾼다.
export function reasonFromStatus(status: number): AnalyzeFailureReason {
  if (status === 401 || status === 403) return "auth"; // 키가 틀렸거나 권한이 없음
  if (status === 408 || status === 504) return "timeout";
  return "service"; // 429(사용량 한도·혼잡), 5xx, 그 밖의 오류
}

export type AskOptions = {
  apiKey: string;
  model?: string;
  system: string;
  user: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch; // 시험에서 가짜 fetch를 넣는다
};

export type AskResult = { ok: true; content: string } | { ok: false; reason: AnalyzeFailureReason };

export async function askOpenAI({ apiKey, model = DEFAULT_MODEL, system, user, timeoutMs, fetchImpl = fetch }: AskOptions): Promise<AskResult> {
  try {
    const response = await fetchImpl(OPENAI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_schema", json_schema: { name: "excel_consolidation_conditions", strict: true, schema: outputJsonSchema } },
        max_completion_tokens: 1024,
        store: false, // OpenAI 쪽에 대화를 저장하지 않게 한다
      }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, reason: reasonFromStatus(response.status) };

    const json = (await response.json()) as { choices?: { message?: { content?: string | null; refusal?: string | null } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (typeof content !== "string" || content === "") return { ok: false, reason: "invalid-response" }; // 답이 없거나 거절됨
    return { ok: true, content };
  } catch (error) {
    if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) return { ok: false, reason: "timeout" };
    return { ok: false, reason: error instanceof SyntaxError ? "invalid-response" : "network" };
  }
}

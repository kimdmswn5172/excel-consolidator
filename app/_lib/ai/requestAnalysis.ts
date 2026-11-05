// 브라우저에서 /api/analyze를 부르는 부분. (PRD 5번 must 1의 규칙 8, DESIGN 4번)
//  - 한 번 호출은 10초까지만 기다린다. 넘으면 실패(timeout)로 본다.
//  - 실패하면 1회 자동으로 다시 시도한다. (최대 약 20초)
//  - 키 문제(auth)나 요청 모양 문제(invalid-request)는 다시 해도 같으므로 재시도하지 않는다.
//  - 끝내 실패하면 이유를 돌려주고, 화면은 직접 선택 모드로 넘어간다. 이 함수는 예외를 던지지 않는다.
import type { AnalyzeFailureReason, AnalyzeRequest, AnalyzeResponse } from "../types";

export const ATTEMPT_TIMEOUT_MS = 10_000;
export const MAX_RETRIES = 1;

export type RequestAnalysisOptions = {
  fetchImpl?: typeof fetch; // 시험에서 가짜 fetch를 넣는다
  timeoutMs?: number;
  retries?: number;
};

const NOT_WORTH_RETRY: AnalyzeFailureReason[] = ["auth", "invalid-request"];

async function attempt(request: AnalyzeRequest, fetchImpl: typeof fetch, timeoutMs: number): Promise<AnalyzeResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    const json = (await response.json()) as AnalyzeResponse;
    // 서버가 약속한 모양으로 답하지 않았다면 실패로 본다
    if (typeof json !== "object" || json === null || typeof json.ok !== "boolean") return { ok: false, reason: "invalid-response" };
    return json;
  } catch (error) {
    if (controller.signal.aborted) return { ok: false, reason: "timeout" };
    return { ok: false, reason: error instanceof SyntaxError ? "invalid-response" : "network" };
  } finally {
    clearTimeout(timer);
  }
}

export async function requestAnalysis(request: AnalyzeRequest, options: RequestAnalysisOptions = {}): Promise<AnalyzeResponse> {
  const { fetchImpl = fetch, timeoutMs = ATTEMPT_TIMEOUT_MS, retries = MAX_RETRIES } = options;
  let result = await attempt(request, fetchImpl, timeoutMs);
  for (let retry = 0; retry < retries && !result.ok && !NOT_WORTH_RETRY.includes(result.reason); retry++) {
    result = await attempt(request, fetchImpl, timeoutMs);
  }
  return result;
}

// 화면에 보여 줄 안내. 어느 경우에도 "직접 선택해 주세요"로 이어진다.
const DETAIL: Record<AnalyzeFailureReason, string> = {
  network: "인터넷 연결을 확인해 주세요.",
  timeout: "응답이 10초 안에 오지 않았습니다.",
  service: "AI 서비스에 일시적인 문제가 있습니다.",
  auth: "AI 사용 설정(키)에 문제가 있습니다. 관리자에게 알려 주세요.",
  "invalid-response": "AI의 답을 이해하지 못했습니다.",
  "invalid-request": "AI에 보낼 내용이 너무 크거나 형식이 맞지 않습니다.",
};

export function failureMessage(reason: AnalyzeFailureReason): string {
  return `AI 분석에 실패했습니다. 직접 선택해 주세요. (${DETAIL[reason]})`;
}

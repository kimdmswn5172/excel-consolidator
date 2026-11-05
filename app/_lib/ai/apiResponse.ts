// AI 서버 코드(/api/analyze, /api/template)가 함께 쓰는 응답 도구.
import type { AnalyzeFailureReason } from "../types";

// 실패 이유별 HTTP 상태 코드
export const FAILURE_STATUS: Record<AnalyzeFailureReason, number> = {
  network: 502,
  timeout: 504,
  service: 502,
  auth: 401,
  "invalid-response": 502,
  "invalid-request": 400,
};

// 응답은 저장(캐시)하지 않는다. 내용이 담길 수 있기 때문이다.
export function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function failureResponse(reason: AnalyzeFailureReason, status: number = FAILURE_STATUS[reason]) {
  return jsonResponse({ ok: false, reason }, status);
}

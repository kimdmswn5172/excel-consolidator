// 브라우저에서 /api/template을 부르는 부분. 10초 제한과 1회 재시도는 /api/analyze와 같다. (PLAN 25번)
import type { AnalyzeFailureReason } from "../types";
import { postJsonWithRetry, type RequestAnalysisOptions } from "./requestAnalysis";
import type { TemplateResponse } from "./templateSchemas";

export function requestTemplate(purpose: string, options: RequestAnalysisOptions = {}): Promise<TemplateResponse> {
  return postJsonWithRetry<TemplateResponse>("/api/template", { purpose }, options) as Promise<TemplateResponse>;
}

// 실패했을 때 화면에 보여 줄 안내. 양식은 직접 써서 만들 수도 있다.
const DETAIL: Record<AnalyzeFailureReason, string> = {
  network: "인터넷 연결을 확인해 주세요.",
  timeout: "응답이 10초 안에 오지 않았습니다.",
  service: "AI 서비스에 일시적인 문제가 있습니다.",
  auth: "AI 사용 설정(키)에 문제가 있습니다. 관리자에게 알려 주세요.",
  "invalid-response": "AI가 쓸 수 있는 양식을 만들지 못했습니다. 목적을 조금 더 구체적으로 적어 보세요.",
  "invalid-request": "목적 글이 비었거나 너무 깁니다. (최대 500자)",
};

export function templateFailureMessage(reason: AnalyzeFailureReason): string {
  return `AI 양식 제안에 실패했습니다. (${DETAIL[reason]}) 아래에서 열 이름을 직접 써서 만들 수도 있습니다.`;
}

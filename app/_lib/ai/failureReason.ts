// AI 호출에서 난 오류를 사용자에게 알릴 실패 이유로 바꾼다. (서버에서만 쓴다)
// 오류 메시지에는 요청 내용이 섞일 수 있어서, 이유 분류만 쓰고 메시지는 어디에도 남기지 않는다.
import { APIConnectionError, APIConnectionTimeoutError, APIError, AuthenticationError, PermissionDeniedError } from "@anthropic-ai/sdk";
import type { AnalyzeFailureReason } from "../types";

export function toFailureReason(error: unknown): AnalyzeFailureReason {
  if (error instanceof APIConnectionTimeoutError) return "timeout";
  if (error instanceof APIConnectionError) return "network";
  if (error instanceof AuthenticationError || error instanceof PermissionDeniedError) return "auth";
  if (error instanceof APIError) return "service";
  return "invalid-response"; // 검사 규칙(Zod)에 맞지 않는 답 등 그 밖의 오류
}

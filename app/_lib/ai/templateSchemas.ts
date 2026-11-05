// AI 양식 생성(PLAN 25번)의 요청·응답 모양과 정리 규칙. (DESIGN 10번)
import * as z from "zod/v4";
import type { AnalyzeFailureReason } from "../types";

// 프로그램이 첫 열에 따로 넣는 번호 열의 이름. 열 이름으로 다시 쓸 수 없다.
export const SERIAL_HEADER = "연번";

export const TEMPLATE_LIMITS = { purpose: 500, columns: 30, nameLength: 30, titleLength: 60, rows: 1000, defaultRows: 30 } as const;

// 브라우저가 서버로 보내는 요청: 업무 목적 글뿐이다. 엑셀 내용은 보내지 않는다.
export const templateRequestSchema = z.object({ purpose: z.string().trim().min(1).max(TEMPLATE_LIMITS.purpose) });

// AI가 돌려주는 양식 제안
export const templateOutputSchema = z.object({
  title: z.string(), // 시트 위에 적을 제목
  keyName: z.string(), // 기준 열 이름 (행을 구분하는 열. 예: 사번)
  fieldNames: z.array(z.string()), // 부서가 채울 작성 열 이름들
  rowCount: z.number().int().nullable(), // 목적 글에 적힌 인원·건수(예: "50명" → 50). 적혀 있지 않으면 null
});

export type TemplateProposal = z.infer<typeof templateOutputSchema>;

export type TemplateResponse = { ok: true; proposal: TemplateProposal } | { ok: false; reason: AnalyzeFailureReason };

// 제안을 쓸 수 있게 정리한다. 앞뒤 공백 제거, 너무 긴 글 자르기, 빈 이름과 중복 이름 빼기.
// 기준 열 이름이 없거나 작성 열이 하나도 없으면 쓸 수 없는 제안이라 null이다.
export function cleanProposal(proposal: TemplateProposal): TemplateProposal | null {
  const trim = (text: string, max: number) => text.replace(/\s+/g, " ").trim().slice(0, max);
  const keyName = trim(proposal.keyName, TEMPLATE_LIMITS.nameLength);
  if (keyName === "" || keyName === SERIAL_HEADER) return null;

  const seen = new Set([SERIAL_HEADER, keyName.toLowerCase()]);
  const fieldNames: string[] = [];
  for (const raw of proposal.fieldNames) {
    const name = trim(raw, TEMPLATE_LIMITS.nameLength);
    if (name === "" || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    fieldNames.push(name);
  }
  if (fieldNames.length === 0 || fieldNames.length + 2 > TEMPLATE_LIMITS.columns) return null;

  // 행 수: 1~1000의 정수만 쓰고, 아니면 null(화면에서 기본값을 보여 주고 사용자가 정한다)
  const rows = proposal.rowCount;
  const rowCount = rows !== null && Number.isInteger(rows) && rows >= 1 && rows <= TEMPLATE_LIMITS.rows ? rows : null;

  return { title: trim(proposal.title, TEMPLATE_LIMITS.titleLength), keyName, fieldNames, rowCount };
}

// 사용자가 화면에서 고친 양식으로 파일을 만들 수 없는 이유. 만들 수 있으면 null이다.
export function templateBlockedReason(spec: { keyName: string; fieldNames: string[]; rowCount?: number }): string | null {
  const keyName = spec.keyName.trim();
  const names = spec.fieldNames.map((name) => name.trim());
  if (keyName === "") return "기준 열 이름을 적어 주세요.";
  if (names.length === 0 || names.every((name) => name === "")) return "작성 열을 하나 이상 적어 주세요.";
  if (names.some((name) => name === "")) return "비어 있는 작성 열 이름이 있습니다. 적거나 지워 주세요.";
  const all = [SERIAL_HEADER, keyName, ...names].map((name) => name.toLowerCase());
  if (new Set(all).size !== all.length) return "같은 이름의 열이 있습니다. 열 이름은 서로 달라야 합니다.";
  if (all.length > TEMPLATE_LIMITS.columns) return `열은 연번을 빼고 ${TEMPLATE_LIMITS.columns - 1}개까지 만들 수 있습니다.`;
  const rows = spec.rowCount;
  if (rows !== undefined && (!Number.isInteger(rows) || rows < 1 || rows > TEMPLATE_LIMITS.rows)) return `행 수는 1에서 ${TEMPLATE_LIMITS.rows} 사이의 숫자로 적어 주세요.`;
  return null;
}

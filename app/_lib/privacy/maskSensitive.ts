// 주민등록번호·전화번호 모양의 값을 찾아 가린다(마스킹). (PRD 7번 규칙 2)
// AI에 보내는 샘플에 개인정보가 섞여 있을 때를 대비한 안전장치다. 헤더를 포함한 모든 칸에 적용한다.
// 실제 번호인지 확인하지는 않고 "모양"만 본다. 놓치는 것보다 잘못 가리는 쪽이 안전하다.
import type { CellValue } from "../types";

export type MaskKind = "주민등록번호" | "전화번호";

// 글자 안에서 찾는 모양. 앞뒤가 숫자이면 더 긴 숫자의 일부라서 건너뛴다.
const PATTERNS: { kind: MaskKind; regex: RegExp }[] = [
  // 주민등록번호: 6자리(생년월일) + 성별 숫자(1~8) + 6자리. 가운데 하이픈은 있어도 없어도 된다.
  { kind: "주민등록번호", regex: /(?<!\d)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[- ]?[1-8]\d{6}(?!\d)/g },
  // 휴대전화: 010-1234-5678, 01012345678 등
  { kind: "전화번호", regex: /(?<!\d)01[016789][- .]?\d{3,4}[- .]?\d{4}(?!\d)/g },
  // 지역번호·대표번호: 02-123-4567, 031-123-4567, 1588-1234 등
  { kind: "전화번호", regex: /(?<!\d)0(?:2|[3-6]\d)[- .]?\d{3,4}[- .]\d{4}(?!\d)/g },
  { kind: "전화번호", regex: /(?<!\d)1[5-9]\d{2}[- .]\d{4}(?!\d)/g },
];

export type MaskResult = { value: CellValue; masked: MaskKind[] };

// 숫자로 저장된 칸: 엑셀은 맨 앞 0을 지우므로 휴대전화 번호가 1012345678처럼 보인다. 그 모양도 함께 가린다.
function numberAsText(value: number): string | null {
  if (!Number.isInteger(value) || value < 0) return null;
  const text = String(value);
  if (text.length === 13) return text; // 주민등록번호 13자리
  if (/^1[016789]\d{7,8}$/.test(text)) return `0${text}`; // 앞의 0이 지워진 휴대전화
  return null;
}

// 칸 하나를 검사해 개인정보 모양이 있으면 그 부분을 "[전화번호 가림]"처럼 바꿔서 돌려준다.
export function maskCellValue(value: CellValue): MaskResult {
  if (typeof value === "number") {
    const text = numberAsText(value);
    if (text === null) return { value, masked: [] };
    const inner = maskCellValue(text);
    return inner.masked.length > 0 ? { value: `[${inner.masked[0]} 가림]`, masked: inner.masked } : { value, masked: [] };
  }
  if (typeof value !== "string") return { value, masked: [] };

  const masked: MaskKind[] = [];
  let text = value;
  for (const { kind, regex } of PATTERNS) {
    text = text.replace(regex, () => {
      masked.push(kind);
      return `[${kind} 가림]`;
    });
  }
  return { value: text, masked };
}

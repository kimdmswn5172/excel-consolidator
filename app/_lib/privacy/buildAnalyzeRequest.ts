// AI에 보낼 데이터를 만든다. (PRD 5번 must 1, 7번 규칙 1·2, DESIGN 데이터 흐름 ④)
//  - 기본: 시트마다 위쪽 10행의 샘플만 보낸다. 엑셀 전체는 절대 보내지 않는다.
//  - "개인정보 포함"으로 체크하면 샘플 값 없이 헤더 행 하나만 보낸다.
//  - 어느 경우든 주민등록번호·전화번호 모양의 값은 가려서 보내고, 몇 개를 가렸는지 알려 준다. (화면 경고용)
import type { AnalyzeRequest, CellValue, SheetData, WorkbookData } from "../types";
import { maskCellValue, type MaskKind } from "./maskSensitive";

export const SAMPLE_ROW_LIMIT = 10;

export type AnalyzePayload = {
  request: AnalyzeRequest;
  maskedCount: number; // 가린 칸의 수
  maskedKinds: MaskKind[]; // 가린 종류 (중복 없이)
};

function isText(value: CellValue): value is string {
  return typeof value === "string" && value.trim() !== "";
}

// 헤더 행 추정: 위쪽 행들 중 글자 칸이 2개 이상이고 숫자·날짜 칸이 없는 첫 행. (제목 줄은 칸이 1개라서 건너뛴다)
// 그런 행이 없으면 글자 칸이 가장 많은 행, 그것도 없으면 1행이다. 정확한 헤더 위치는 AI와 사용자가 확정한다.
export function guessHeaderRow(sheet: SheetData): number {
  const top = sheet.cells.slice(0, SAMPLE_ROW_LIMIT);
  const looksLikeHeader = (row: CellValue[]) => row.filter(isText).length >= 2 && row.every((cell) => cell === null || isText(cell));
  const found = top.findIndex(looksLikeHeader);
  if (found >= 0) return found + 1;

  let best = 0;
  let bestCount = 0;
  top.forEach((row, index) => {
    const count = row.filter(isText).length;
    if (count > bestCount) {
      best = index;
      bestCount = count;
    }
  });
  return best + 1;
}

export function buildAnalyzeRequest(workbook: WorkbookData, headersOnly: boolean): AnalyzePayload {
  let maskedCount = 0;
  const kinds = new Set<MaskKind>();

  function maskRow(row: CellValue[]): CellValue[] {
    return row.map((cell) => {
      const result = maskCellValue(cell);
      if (result.masked.length > 0) {
        maskedCount += result.masked.length;
        result.masked.forEach((kind) => kinds.add(kind));
      }
      return result.value;
    });
  }

  const sheets = workbook.sheets.map((sheet) => {
    if (headersOnly) {
      const headerRow = guessHeaderRow(sheet);
      return { name: sheet.name, headerRow, rows: [maskRow(sheet.cells[headerRow - 1] ?? [])] };
    }
    return { name: sheet.name, rows: sheet.cells.slice(0, SAMPLE_ROW_LIMIT).map(maskRow) };
  });

  return { request: { headersOnly, sheets }, maskedCount, maskedKinds: [...kinds] };
}

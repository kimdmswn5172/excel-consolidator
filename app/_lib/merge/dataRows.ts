// 시트의 데이터 영역에서 "키가 들어 있는 행"을 꺼내는 공통 도구.
// 중복 찾기, 병합 셀 검사, 취합이 모두 같은 기준으로 행을 세도록 한곳에 모았다.
import type { CellValue, ConsolidationSettings, SheetData } from "../types";
import { normalizeKey } from "./normalizeKey";

// 기준 열의 칸이 가로로 여러 열에 걸쳐 병합되어 있는지. (데이터 아래 안내 문구가 이런 모양이다)
// 키는 한 칸에 하나씩 들어가므로, 가로로 병합된 칸은 키로 보지 않는다.
export function isSpreadAcrossColumns(sheet: SheetData, row: number, column: number): boolean {
  return sheet.merges.some(
    (merge) =>
      merge.endCol > merge.startCol &&
      row >= merge.startRow &&
      row <= merge.endRow &&
      column >= merge.startCol &&
      column <= merge.endCol,
  );
}

export type DataRow = {
  row: number; // 엑셀 화면과 같은 행 번호 (1부터)
  key: string; // 비교용으로 정리한 키
  raw: CellValue; // 엑셀에 적힌 원래 값
};

// 데이터 시작 행부터 끝까지, 기준 열에 키가 있는 행을 위에서 아래로 모두 돌려준다.
// 빈 칸(세로 병합의 나머지 칸 포함)과 가로로 병합된 안내 문구는 건너뛴다.
export function listDataRows(sheet: SheetData, settings: Pick<ConsolidationSettings, "keyColumn" | "dataStartRow">): DataRow[] {
  const rows: DataRow[] = [];
  for (let row = settings.dataStartRow; row <= sheet.rowCount; row++) {
    const raw = sheet.cells[row - 1]?.[settings.keyColumn - 1] ?? null;
    const key = normalizeKey(raw);
    if (key === null || isSpreadAcrossColumns(sheet, row, settings.keyColumn)) continue;
    rows.push({ row, key, raw });
  }
  return rows;
}

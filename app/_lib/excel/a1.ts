// 엑셀 주소 표기("B5:B6")와 숫자(행·열 번호)를 서로 바꿔 주는 도구.
// 행·열 번호는 엑셀 화면과 같이 1부터 시작한다. (A열 = 1, B열 = 2)
import type { MergedRange } from "../types";

// "A" → 1, "B" → 2, "AA" → 27
export function columnLettersToNumber(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n;
}

// 1 → "A", 2 → "B", 27 → "AA"
export function numberToColumnLetters(n: number): string {
  let rest = n;
  let letters = "";
  while (rest > 0) {
    const remainder = (rest - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    rest = Math.floor((rest - 1) / 26);
  }
  return letters;
}

// "A1:C1" 또는 한 칸짜리 "A1"을 범위로 바꾼다. 형식이 틀리면 오류를 던진다.
export function parseRange(range: string): MergedRange {
  const match = /^([A-Za-z]+)(\d+)(?::([A-Za-z]+)(\d+))?$/.exec(range.trim());
  if (!match) {
    throw new Error(`엑셀 범위 형식이 올바르지 않습니다: ${range}`);
  }
  const startCol = columnLettersToNumber(match[1]);
  const startRow = Number(match[2]);
  const endCol = match[3] ? columnLettersToNumber(match[3]) : startCol;
  const endRow = match[4] ? Number(match[4]) : startRow;
  return { startRow, startCol, endRow, endCol };
}

// 범위를 "B5:B6" 모양의 글자로 바꾼다. 한 칸이면 "B5"만 돌려준다.
export function formatRange(range: MergedRange): string {
  const start = `${numberToColumnLetters(range.startCol)}${range.startRow}`;
  if (range.startRow === range.endRow && range.startCol === range.endCol) {
    return start;
  }
  return `${start}:${numberToColumnLetters(range.endCol)}${range.endRow}`;
}

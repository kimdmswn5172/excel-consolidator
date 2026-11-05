// 결과 파일에 기본 서식을 덧입힌다. (PLAN 26번, DESIGN 10번) 사용자가 4단계에서 체크했을 때만 쓴다.
//  - 헤더 행: 굵은 글씨, 연한 배경색, 가운데 정렬
//  - 헤더와 데이터 영역: 얇은 테두리
//  - 열 너비: 내용이 잘리지 않게 필요한 만큼만 넓힘 (한글은 영문보다 넓게 셈, 최대 60). 마스터에 정해 둔 너비는 줄이지 않는다
//  - 머리글 행 고정: 스크롤해도 헤더가 보임
// 값, 병합 셀, 행 순서는 바꾸지 않는다. (정렬은 병합 셀·수식·안내 문구가 있을 때 값이 어긋날 위험이 있어 하지 않는다)
import type ExcelJS from "exceljs";
import type { ConsolidationSettings } from "../types";

export type FormatSettings = Pick<ConsolidationSettings, "keyColumn" | "headerRow" | "dataStartRow">;

export const HEADER_FILL = "FFE8EEF7";
export const BORDER = { style: "thin", color: { argb: "FFBFC5CE" } } as const;
const DEFAULT_WIDTH = 9;
const MAX_WIDTH = 60;
const WIDTH_SAMPLE_ROWS = 1000; // 열 너비는 데이터 위쪽 1000행만 보고 정한다 (큰 파일에서 느려지지 않게)

function textOf(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return "0000-00-00";
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((part) => part.text).join("");
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("result" in value && value.result !== undefined) return String(value.result);
    return "";
  }
  return String(value);
}

// 글자 폭: 한글·한자·전각 문자는 2칸, 나머지는 1칸으로 센다.
export function displayWidth(text: string): number {
  let width = 0;
  for (const char of text) width += /[ᄀ-ᇿ㄰-㆏가-힯一-鿿＀-￯]/.test(char) ? 2 : 1;
  return width;
}

// 기준 열에 키가 들어 있는 마지막 행. 가로로 병합된 안내 문구는 키가 아니므로 건너뛴다.
function lastDataRow(sheet: ExcelJS.Worksheet, settings: FormatSettings): number {
  for (let row = sheet.rowCount; row >= settings.dataStartRow; row--) {
    const cell = sheet.getCell(row, settings.keyColumn);
    if (cell.isMerged && cell.master.address !== cell.address) continue;
    if (textOf(cell.value).trim() !== "") return row;
  }
  return settings.dataStartRow - 1; // 데이터가 하나도 없으면 헤더까지만
}

// 헤더 행에서 값이 있는 마지막 열
function lastHeaderColumn(sheet: ExcelJS.Worksheet, headerRow: number): number {
  let last = 0;
  sheet.getRow(headerRow).eachCell({ includeEmpty: false }, (cell, column) => {
    if (textOf(cell.value).trim() !== "") last = Math.max(last, column);
  });
  return last;
}

export function applyBasicFormat(sheet: ExcelJS.Worksheet, settings: FormatSettings): void {
  const lastColumn = lastHeaderColumn(sheet, settings.headerRow);
  if (lastColumn === 0) return; // 헤더가 비어 있으면 서식을 입힐 기준이 없다
  const lastRow = lastDataRow(sheet, settings);

  // 시작 너비는 마스터에 이미 정해 둔 너비다. 없으면 엑셀 기본 너비(9)에서 시작한다.
  const widths = Array.from({ length: lastColumn }, (_, index) => sheet.getColumn(index + 1).width ?? DEFAULT_WIDTH);
  for (let row = settings.headerRow; row <= lastRow; row++) {
    const isHeader = row === settings.headerRow;
    const inWidthSample = isHeader || row < settings.dataStartRow + WIDTH_SAMPLE_ROWS;
    for (let column = 1; column <= lastColumn; column++) {
      const cell = sheet.getCell(row, column);
      // ExcelJS는 스타일이 없는 칸들이 같은 스타일 객체를 함께 쓰는 경우가 있어서, 속성을 하나씩 고치면 다른 칸(제목 줄 등)까지 바뀐다.
      // 그래서 칸마다 새 스타일 객체를 만들어 통째로 넣는다.
      cell.style = {
        ...cell.style,
        border: { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER },
        ...(isHeader
          ? {
              font: { ...cell.style.font, bold: true },
              fill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: HEADER_FILL } },
              alignment: { ...cell.style.alignment, horizontal: "center" as const, vertical: "middle" as const },
            }
          : {}),
      };
      // 병합된 칸의 나머지 부분은 같은 글자를 돌려주므로 폭 계산에서 뺀다
      if (inWidthSample && !(cell.isMerged && cell.master.address !== cell.address)) {
        widths[column - 1] = Math.max(widths[column - 1], displayWidth(textOf(cell.value)) + 2);
      }
    }
  }
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = Math.min(MAX_WIDTH, width);
  });

  // 머리글 행 고정: 헤더 행까지(위의 제목 줄 포함) 고정한다. 보기 설정 중 고정만 바꾼다.
  sheet.views = [{ state: "frozen", xSplit: 0, ySplit: settings.headerRow, topLeftCell: `A${settings.headerRow + 1}` }];
}

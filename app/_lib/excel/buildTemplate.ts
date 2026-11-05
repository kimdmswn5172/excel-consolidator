// AI가 제안하고 사용자가 고친 양식으로 빈 엑셀 양식 파일을 만든다. (PLAN 25번, DESIGN 10번)
// 모양은 연습용 마스터·부서 파일과 같다: 1행 제목(병합), 2행 빈 줄, 3행 헤더, 4행부터 데이터 칸.
//  - 첫 열은 "연번"이고 1부터 행 수만큼 번호가 들어 있다. 그다음 기준 열, 작성 열 순서다.
//  - 헤더 행에는 굵은 글씨·배경색·테두리를, 데이터 칸에는 행 수만큼 테두리를 넣는다. (예: "50명 대상" → 50행)
// 그래서 이 양식을 부서에 나눠 주고 받은 파일을 바로 취합에 쓸 수 있다.
import { SERIAL_HEADER } from "../ai/templateSchemas";
import { numberToColumnLetters } from "./a1";
import { BORDER, HEADER_FILL } from "./formatResult";
import { XLSX_MIME_TYPE } from "./writeResult";

export { XLSX_MIME_TYPE, SERIAL_HEADER };

export const TEMPLATE_HEADER_ROW = 3;
export const TEMPLATE_DATA_START_ROW = 4;

export type TemplateSpec = {
  title: string;
  keyName: string; // 기준 열 이름 (연번 다음 열)
  fieldNames: string[]; // 작성 열 이름들
  rowCount: number; // 테두리와 연번을 넣을 데이터 행 수
};

export async function buildTemplateFile(spec: TemplateSpec): Promise<Uint8Array<ArrayBuffer>> {
  // 엑셀 처리 도구는 크기가 커서, 필요할 때 처음으로 불러온다.
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");

  const headers = [SERIAL_HEADER, spec.keyName, ...spec.fieldNames];
  const lastColumn = numberToColumnLetters(headers.length);
  const lastRow = TEMPLATE_DATA_START_ROW + spec.rowCount - 1;
  const border = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };

  // 제목: 병합하고 크고 굵게
  const title = sheet.getCell(1, 1);
  title.value = spec.title === "" ? null : spec.title;
  title.style = { font: { bold: true, size: 14 }, alignment: { horizontal: "center", vertical: "middle" } };
  sheet.mergeCells(`A1:${lastColumn}1`);
  sheet.getRow(1).height = 26;

  // 헤더: 굵은 글씨, 배경색, 가운데 정렬, 테두리. 칸마다 새 스타일 객체를 넣는다. (ExcelJS가 스타일을 공유하는 문제 때문)
  headers.forEach((name, index) => {
    const cell = sheet.getCell(TEMPLATE_HEADER_ROW, index + 1);
    cell.value = name;
    cell.style = {
      font: { bold: true },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } },
      alignment: { horizontal: "center", vertical: "middle" },
      border,
    };
    // 글자 수에 맞춰 열 너비를 정한다. (한글은 영문보다 넓게 보여서 2배로 셈) 연번 열은 좁게.
    sheet.getColumn(index + 1).width = index === 0 ? 8 : Math.min(40, Math.max(12, name.length * 2 + 2));
  });

  // 데이터 칸: 행 수만큼 테두리, 연번 열에는 1부터 번호
  for (let row = TEMPLATE_DATA_START_ROW; row <= lastRow; row++) {
    for (let column = 1; column <= headers.length; column++) {
      const cell = sheet.getCell(row, column);
      if (column === 1) cell.value = row - TEMPLATE_DATA_START_ROW + 1;
      cell.style = { border, ...(column === 1 ? { alignment: { horizontal: "center" as const } } : {}) };
    }
  }

  const written = await workbook.xlsx.writeBuffer();
  return new Uint8Array(written as ArrayBuffer);
}

// "양식_20261105.xlsx" 형태의 파일 이름
export function templateFileName(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `양식_${yyyy}${mm}${dd}.xlsx`;
}

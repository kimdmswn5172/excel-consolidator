// AI가 제안하고 사용자가 고친 양식으로 빈 엑셀 양식 파일을 만든다. (PLAN 25번, DESIGN 10번)
// 모양은 연습용 마스터·부서 파일과 같다: 1행 제목(병합), 2행 빈 줄, 3행 헤더, 4행부터 빈 칸.
// 그래서 이 양식을 부서에 나눠 주고 받은 파일을 바로 취합에 쓸 수 있다.
import { numberToColumnLetters } from "./a1";
import { XLSX_MIME_TYPE } from "./writeResult";

export { XLSX_MIME_TYPE };

export const TEMPLATE_HEADER_ROW = 3;
export const TEMPLATE_DATA_START_ROW = 4;

export type TemplateSpec = {
  title: string;
  keyName: string; // 기준 열 이름 (첫 번째 열)
  fieldNames: string[]; // 작성 열 이름들 (두 번째 열부터)
};

export async function buildTemplateFile(spec: TemplateSpec): Promise<Uint8Array<ArrayBuffer>> {
  // 엑셀 처리 도구는 크기가 커서, 필요할 때 처음으로 불러온다.
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");

  const headers = [spec.keyName, ...spec.fieldNames];
  const lastColumn = numberToColumnLetters(headers.length);

  sheet.getCell(1, 1).value = spec.title === "" ? null : spec.title;
  if (headers.length > 1) sheet.mergeCells(`A1:${lastColumn}1`);

  headers.forEach((name, index) => {
    sheet.getCell(TEMPLATE_HEADER_ROW, index + 1).value = name;
    // 글자 수에 맞춰 열 너비를 정한다. (한글은 영문보다 넓게 보여서 2배로 셈)
    sheet.getColumn(index + 1).width = Math.min(40, Math.max(12, name.length * 2 + 2));
  });

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

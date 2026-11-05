// 취합 결과를 새 .xlsx 파일로 만든다. (PRD 5번 must 2의 규칙 6: 원본은 수정하지 않고 결과는 새 파일로만)
//
// 원본 마스터 파일을 복사해서 연 뒤, 취합 엔진이 값을 쓴 칸만 바꿔서 저장한다.
// 이렇게 하면 마스터의 글꼴, 열 너비, 날짜 서식, 병합된 제목 줄 같은 모양이 결과 파일에 그대로 남는다.
// (WorkbookData에는 값만 있고 서식은 없어서, 거기서 새로 만들면 서식이 모두 사라진다)
import type { AppliedValue } from "../merge/consolidate";
import type { ConsolidationSettings } from "../types";

export const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// 원본 바이트를 건드리지 않도록 복사본 ArrayBuffer를 만든다.
function copyToArrayBuffer(bytes: ArrayBuffer | Uint8Array): ArrayBuffer {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return view.slice().buffer;
}

// 원본 마스터 파일 내용과 쓰기 기록으로 결과 파일 내용(바이트)을 만든다.
export type ResultOptions = {
  // 기본 서식 적용(헤더 굵게·배경색, 테두리, 열 너비, 머리글 고정). 사용자가 4단계에서 체크했을 때만 켠다. (PLAN 26번)
  applyBasicFormat?: boolean;
};

export async function buildResultFile(
  originalMaster: ArrayBuffer | Uint8Array,
  appliedValues: AppliedValue[],
  // 서식을 적용하려면 기준 열·헤더 행·데이터 시작 행도 필요하다. 없으면 서식은 건너뛴다.
  settings: Pick<ConsolidationSettings, "sheetName"> & Partial<Pick<ConsolidationSettings, "keyColumn" | "headerRow" | "dataStartRow">>,
  options: ResultOptions = {},
): Promise<Uint8Array<ArrayBuffer>> {
  // 엑셀 처리 도구는 크기가 커서, 필요할 때 처음으로 불러온다.
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(copyToArrayBuffer(originalMaster));

  const worksheet = workbook.getWorksheet(settings.sheetName);
  if (!worksheet) {
    throw new Error(`마스터 파일에 "${settings.sheetName}" 시트가 없어 결과 파일을 만들 수 없습니다.`);
  }

  // 기록된 순서대로 쓴다. 같은 칸에 여러 번 썼다면 마지막 값이 남아 취합 엔진의 결과와 같아진다.
  for (const applied of appliedValues) {
    worksheet.getCell(applied.masterRow, applied.column).value = applied.newValue;
  }

  // 서식은 값을 모두 쓴 다음에 덧입힌다. 값과 병합 셀, 행 순서는 바꾸지 않는다.
  if (options.applyBasicFormat && settings.keyColumn !== undefined && settings.headerRow !== undefined && settings.dataStartRow !== undefined) {
    const { applyBasicFormat } = await import("./formatResult");
    applyBasicFormat(worksheet, { keyColumn: settings.keyColumn, headerRow: settings.headerRow, dataStartRow: settings.dataStartRow });
  }

  const written = await workbook.xlsx.writeBuffer();
  return new Uint8Array(written as ArrayBuffer);
}

// 결과 파일 이름: "마스터_취합결과_20261104.xlsx" (원본 이름과 겹치지 않게)
export function resultFileName(masterFileName: string, date: Date = new Date()): string {
  const base = masterFileName.replace(/\.xlsx$/i, "");
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${base}_취합결과_${yyyy}${mm}${dd}.xlsx`;
}

// .xlsx 내용(바이트)을 ExcelJS 워크북으로 연다. 읽기(readWorkbook)와 결과 파일 만들기(writeResult)가 함께 쓴다.
// 먼저 그대로 열어 보고, 실패하면 한셀처럼 태그 접두어가 붙은 파일일 수 있어 표준 모양으로 고친 뒤 한 번 더 연다. (repairXlsx.ts)
// 그래도 안 열리면 처음의 오류를 그대로 던져서, 호출한 쪽이 "손상되었거나 읽을 수 없는 파일"로 안내하게 한다.
import type ExcelJS from "exceljs";
import { repairNamespacePrefixes } from "./repairXlsx";

export type ExcelJSModule = typeof ExcelJS;

export async function loadWorkbook(excel: ExcelJSModule, buffer: ArrayBuffer) {
  try {
    const workbook = new excel.Workbook();
    await workbook.xlsx.load(buffer.slice(0));
    return workbook;
  } catch (firstError) {
    const repaired = await repairNamespacePrefixes(buffer);
    if (!repaired) throw firstError;
    const workbook = new excel.Workbook();
    await workbook.xlsx.load(repaired);
    return workbook;
  }
}

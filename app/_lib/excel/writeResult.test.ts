// 결과 파일 만들기를 시험한다. 실행: npm run test
import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { checkMergeRisks } from "../merge/checkMergeRisks";
import { consolidate } from "../merge/consolidate";
import { checkHeaders } from "../merge/inspectFiles";
import type { CellValue, ConsolidationSettings, WorkbookData } from "../types";
import { readWorkbookFromBuffer } from "./readWorkbook";
import { buildResultFile, resultFileName } from "./writeResult";

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}

async function readBack(bytes: Uint8Array, fileName: string): Promise<WorkbookData> {
  const result = await readWorkbookFromBuffer(bytes, fileName);
  if (!result.ok) throw new Error(result.skipped.message);
  return result.workbook;
}

function sameCell(a: CellValue, b: CellValue): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

describe("resultFileName", () => {
  it("원본 이름 뒤에 취합결과와 날짜를 붙인다", () => {
    expect(resultFileName("마스터.xlsx", new Date(2026, 10, 4))).toBe("마스터_취합결과_20261104.xlsx");
    expect(resultFileName("현황.XLSX", new Date(2027, 0, 9))).toBe("현황_취합결과_20270109.xlsx");
  });
});

describe("buildResultFile (작은 예)", () => {
  // 서식이 있는 작은 마스터 파일을 만든다: 제목 병합, 굵은 헤더, 열 너비, 날짜 서식
  async function makeMaster(): Promise<Uint8Array> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");
    sheet.addRow(["교육 현황"]);
    sheet.mergeCells("A1:C1");
    sheet.addRow(["사번", "이수일", "점수"]);
    sheet.getRow(2).font = { bold: true };
    sheet.addRow(["A", null, 55]);
    sheet.addRow(["B", null, null]);
    sheet.getColumn(1).width = 20;
    sheet.getColumn(2).numFmt = "yyyy-mm-dd";
    return new Uint8Array((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
  }

  const settings: ConsolidationSettings = { sheetName: "Sheet1", keyColumn: 1, targetColumns: [2, 3], headerRow: 2, dataStartRow: 3 };

  it("값을 쓴 칸만 바뀌고 서식·병합·열 너비는 그대로 남는다", async () => {
    const masterBytes = await makeMaster();
    const master = await readBack(masterBytes, "마스터.xlsx");
    const dept: WorkbookData = {
      fileName: "가.xlsx",
      sheets: [
        {
          name: "Sheet1",
          rowCount: 4,
          colCount: 3,
          cells: [["교육 현황", null, null], ["사번", "이수일", "점수"], ["A", new Date(Date.UTC(2026, 2, 5)), 89], ["B", null, 70]],
          merges: [],
        },
      ],
    };
    const outcome = consolidate(master, [dept], settings);
    const resultBytes = await buildResultFile(masterBytes, outcome.appliedValues, settings);

    // 값: 엔진 결과와 같다
    const result = await readBack(resultBytes, "결과.xlsx");
    expect(result.sheets[0].cells.slice(2)).toEqual([
      ["A", new Date(Date.UTC(2026, 2, 5)), 89],
      ["B", null, 70],
    ]);

    // 모양: 원본 서식이 남아 있다
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(toArrayBuffer(resultBytes));
    const sheet = workbook.getWorksheet("Sheet1")!;
    expect(sheet.model.merges).toEqual(["A1:C1"]);
    expect(sheet.getRow(2).getCell(1).font?.bold).toBe(true);
    expect(sheet.getColumn(1).width).toBe(20);
    expect(sheet.getCell("B3").numFmt).toBe("yyyy-mm-dd");
  });

  it("원본 마스터 바이트를 바꾸지 않는다", async () => {
    const masterBytes = await makeMaster();
    const before = Array.from(masterBytes);
    const master = await readBack(masterBytes, "마스터.xlsx");
    const outcome = consolidate(master, [{ ...master, fileName: "가.xlsx" }], settings);
    await buildResultFile(masterBytes, outcome.appliedValues, settings);
    expect(Array.from(masterBytes)).toEqual(before);
  });

  it("마스터에 시트가 없으면 오류를 낸다", async () => {
    await expect(buildResultFile(await makeMaster(), [], { sheetName: "없는시트" })).rejects.toThrow('"없는시트" 시트가 없어');
  });
});

// 연습용 파일 전체: 점검 → 취합 → 결과 파일 → 다시 읽어 비교
describe("buildResultFile (연습용 파일)", () => {
  const settings: ConsolidationSettings = {
    sheetName: "Sheet1",
    keyColumn: 2,
    targetColumns: [5, 6, 7, 8],
    headerRow: 3,
    dataStartRow: 4,
  };

  async function loadBytes(relPath: string): Promise<Uint8Array> {
    return new Uint8Array(await readFile(path.resolve(process.cwd(), "samples", relPath)));
  }

  it("결과 파일을 다시 읽으면 엔진 결과와 모든 칸이 같고, 제목 병합과 날짜가 유지된다", async () => {
    const masterBytes = await loadBytes("마스터.xlsx");
    const masterBefore = Array.from(masterBytes);
    const master = await readBack(masterBytes, "마스터.xlsx");

    const all: WorkbookData[] = [];
    for (let k = 1; k <= 20; k++) {
      const name = `부서${String(k).padStart(2, "0")}.xlsx`;
      all.push(await readBack(await loadBytes(`부서/${name}`), name));
    }
    const headers = checkHeaders(all[0], master, all, settings);
    const merges = checkMergeRisks(master, headers.passedDepartments, settings);
    const outcome = consolidate(master, merges.passedDepartments, settings, { mode: "all", strategy: "first" });

    const resultBytes = await buildResultFile(masterBytes, outcome.appliedValues, settings);
    const result = await readBack(resultBytes, resultFileName("마스터.xlsx"));
    const expected = outcome.resultMaster.sheets[0];
    const actual = result.sheets[0];

    // 모든 칸이 엔진 결과와 같다
    expect(actual.rowCount).toBe(expected.rowCount);
    for (let r = 0; r < expected.rowCount; r++) {
      for (let c = 0; c < expected.colCount; c++) {
        const ok = sameCell(actual.cells[r][c], expected.cells[r][c]);
        if (!ok) throw new Error(`${r + 1}행 ${c + 1}열이 다릅니다: ${String(actual.cells[r][c])} / ${String(expected.cells[r][c])}`);
      }
    }

    // 대표적인 칸 확인
    expect(actual.cells[3][4]).toBe("이수"); // 직원001 교육이수: 미이수 → 이수
    expect(actual.cells[12][6]).toBe(89); // 직원010 점수: 55 → 89
    expect(actual.cells[4][5]).toBeInstanceOf(Date); // 직원002 이수일: 부서 파일에서 채운 날짜
    expect(actual.cells[9][5]).toBeInstanceOf(Date); // 직원007 이수일: 마스터 값 유지
    expect(actual.merges).toEqual([{ startRow: 1, startCol: 1, endRow: 1, endCol: 8 }]); // 제목 병합 유지

    // 원본 마스터 파일 내용은 그대로
    expect(Array.from(masterBytes)).toEqual(masterBefore);
  });
});

// 바뀐 칸 목록과 처리 요약을 시험한다. 실행: npm run test
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readWorkbookFromBuffer } from "../excel/readWorkbook";
import type { CellValue, ConsolidationSettings, SkippedFile, WorkbookData } from "../types";
import { checkMergeRisks } from "./checkMergeRisks";
import { consolidate } from "./consolidate";
import { checkHeaders } from "./inspectFiles";
import { buildChangedCells, buildConsolidationResult, isSameValue } from "./summarize";

// 작은 시험용 워크북: 1행 헤더, 2행부터 데이터. 열: 1 사번(기준), 2 이수, 3 점수, 4 (헤더 없음)
function book(fileName: string, rows: CellValue[][]): WorkbookData {
  return {
    fileName,
    sheets: [{ name: "Sheet1", rowCount: rows.length + 1, colCount: 4, cells: [["사번", "이수", "점수", null], ...rows], merges: [] }],
  };
}

const small: ConsolidationSettings = { sheetName: "Sheet1", keyColumn: 1, targetColumns: [2, 3, 4], headerRow: 1, dataStartRow: 2 };

describe("isSameValue", () => {
  it("같은 값과 다른 값을 구분한다", () => {
    expect(isSameValue("이수", "이수")).toBe(true);
    expect(isSameValue(89, 89)).toBe(true);
    expect(isSameValue(89, "89")).toBe(false);
    expect(isSameValue(new Date(Date.UTC(2026, 2, 1)), new Date(Date.UTC(2026, 2, 1)))).toBe(true);
    expect(isSameValue(new Date(Date.UTC(2026, 2, 1)), new Date(Date.UTC(2026, 2, 2)))).toBe(false);
  });
});

describe("buildChangedCells", () => {
  it("마스터 값이 다른 값으로 바뀐 칸만 담는다", () => {
    const master = book("마스터", [
      ["A", "미이수", 55, null], // 이수가 바뀜, 점수가 바뀜
      ["B", "이수", null, null], // 이수는 같은 값, 점수는 빈 칸을 채움
    ]);
    const dept = book("가.xlsx", [
      ["A", "이수", 89, null],
      ["B", "이수", 70, null],
    ]);
    const outcome = consolidate(master, [dept], small);
    expect(outcome.appliedValues).toHaveLength(4); // 쓴 칸은 4개

    expect(buildChangedCells(outcome.appliedValues, outcome.resultMaster, small)).toEqual([
      { key: "A", columnName: "이수", column: 2, masterValue: "미이수", departmentValue: "이수", sourceFile: "가.xlsx" },
      { key: "A", columnName: "점수", column: 3, masterValue: 55, departmentValue: 89, sourceFile: "가.xlsx" },
    ]);
  });

  it("헤더가 비어 있는 열은 열 기호로 이름을 붙인다", () => {
    const master = book("마스터", [["A", null, null, "메모1"]]);
    const dept = book("가.xlsx", [["A", null, null, "메모2"]]);
    const outcome = consolidate(master, [dept], small);
    expect(buildChangedCells(outcome.appliedValues, outcome.resultMaster, small)[0].columnName).toBe("D열");
  });

  it("마스터 행 → 열 순서로 정렬한다", () => {
    const master = book("마스터", [["A", "x", "x", null], ["B", "x", "x", null]]);
    // 부서 파일 순서가 B, A여도 결과는 A, B 순서
    const outcome = consolidate(master, [book("가", [["B", "y", "y", null]]), book("나", [["A", "y", "y", null]])], small);
    const changed = buildChangedCells(outcome.appliedValues, outcome.resultMaster, small);
    expect(changed.map((c) => [c.key, c.column])).toEqual([["A", 2], ["A", 3], ["B", 2], ["B", 3]]);
  });
});

describe("buildConsolidationResult", () => {
  it("요약 숫자를 계산한다", () => {
    const master = book("마스터", [["A", "미이수", null, null], ["B", null, null, null]]);
    const dept = book("가.xlsx", [["A", "이수", 1, null], ["B", "이수", 2, null], ["Z", "이수", 3, null]]);
    const skipped: SkippedFile[] = [{ fileName: "손상.xlsx", reason: "unreadable", message: "손상.xlsx은(는) 손상되었거나 읽을 수 없는 파일입니다." }];
    const result = buildConsolidationResult({
      outcome: consolidate(master, [dept], small),
      settings: small,
      consolidatedFileCount: 1,
      skippedFiles: skipped,
    });
    expect(result.summary).toEqual({
      processedFiles: 2,
      succeededFiles: 1,
      skippedFiles: 1,
      unmatchedCount: 1,
      duplicateCount: 0,
      changedCellCount: 1,
    });
    expect(result.skippedFiles).toEqual(skipped);
  });

  it("처리 방법을 고르지 않은 중복 키가 있으면 결과를 확정하지 않는다", () => {
    const master = book("마스터", [["A", null, null, null]]);
    const dept = book("가.xlsx", [["A", "이수", 1, null], ["A", "미이수", 2, null]]);
    expect(() =>
      buildConsolidationResult({ outcome: consolidate(master, [dept], small), settings: small, consolidatedFileCount: 1, skippedFiles: [] }),
    ).toThrow("중복 키의 처리 방법을 먼저 골라 주세요: A");
  });
});

// 연습용 파일 전체: 점검 → 취합 → 요약까지 한 번에
describe("연습용 파일 결과 요약", () => {
  const settings: ConsolidationSettings = {
    sheetName: "Sheet1",
    keyColumn: 2,
    targetColumns: [5, 6, 7, 8],
    headerRow: 3,
    dataStartRow: 4,
  };

  async function load(relPath: string): Promise<WorkbookData> {
    const file = await readFile(path.resolve(process.cwd(), "samples", relPath));
    const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
    const result = await readWorkbookFromBuffer(buffer, path.basename(relPath));
    if (!result.ok) throw new Error(result.skipped.message);
    return result.workbook;
  }

  it("바뀐 칸은 직원001 교육이수와 직원010 점수 두 개뿐이고, 요약 숫자가 맞다", async () => {
    const master = await load("마스터.xlsx");
    const all: WorkbookData[] = [];
    for (let k = 1; k <= 20; k++) all.push(await load(`부서/부서${String(k).padStart(2, "0")}.xlsx`));

    const headers = checkHeaders(all[0], master, all, settings);
    const merges = checkMergeRisks(master, headers.passedDepartments, settings);
    const outcome = consolidate(master, merges.passedDepartments, settings, { mode: "all", strategy: "first" });
    const result = buildConsolidationResult({
      outcome,
      settings,
      consolidatedFileCount: merges.passedDepartments.length,
      skippedFiles: [...headers.excludedFiles, ...merges.excludedFiles],
    });

    expect(result.changedCells).toEqual([
      { key: "S0001", columnName: "교육이수", column: 5, masterValue: "미이수", departmentValue: "이수", sourceFile: "부서01.xlsx" },
      { key: "S0010", columnName: "점수", column: 7, masterValue: 55, departmentValue: 89, sourceFile: "부서02.xlsx" },
    ]);
    expect(result.summary).toEqual({
      processedFiles: 20,
      succeededFiles: 18,
      skippedFiles: 2, // 부서15(헤더 다름), 부서09(병합 셀 위험)
      unmatchedCount: 1, // S9999
      duplicateCount: 2, // S0032, S0060
      changedCellCount: 2,
    });
    expect(result.skippedFiles.map((f) => f.fileName)).toEqual(["부서15.xlsx", "부서09.xlsx"]);
  });
});

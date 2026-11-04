// 취합 엔진을 시험한다. 실행: npm run test
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readWorkbookFromBuffer } from "../excel/readWorkbook";
import type { CellValue, ConsolidationSettings, WorkbookData } from "../types";
import { checkHeaders } from "./inspectFiles";
import { checkMergeRisks } from "./checkMergeRisks";
import { consolidate } from "./consolidate";

// 작은 시험용 워크북: 1행 헤더, 2행부터 데이터. 열: 1 사번(기준), 2 이수, 3 점수
function book(fileName: string, rows: CellValue[][]): WorkbookData {
  return {
    fileName,
    sheets: [
      {
        name: "Sheet1",
        rowCount: rows.length + 1,
        colCount: 3,
        cells: [["사번", "이수", "점수"], ...rows],
        merges: [],
      },
    ],
  };
}

const small: ConsolidationSettings = { sheetName: "Sheet1", keyColumn: 1, targetColumns: [2, 3], headerRow: 1, dataStartRow: 2 };

function cellsOf(workbook: WorkbookData): CellValue[][] {
  return workbook.sheets[0].cells.slice(1);
}

describe("consolidate (기본 규칙)", () => {
  it("키로 마스터 행을 찾아 부서 값을 채운다", () => {
    const master = book("마스터", [["A", null, null], ["B", null, null]]);
    const dept = book("가", [["B", "이수", 90], ["A", "미이수", 70]]);
    const { resultMaster, appliedValues } = consolidate(master, [dept], small);
    expect(cellsOf(resultMaster)).toEqual([["A", "미이수", 70], ["B", "이수", 90]]);
    expect(appliedValues).toHaveLength(4);
  });

  it("마스터에 값이 있어도 부서 값을 우선하고, 쓰기 전 값을 기록한다", () => {
    const master = book("마스터", [["A", "미이수", 55]]);
    const dept = book("가", [["A", "이수", 89]]);
    const { resultMaster, appliedValues } = consolidate(master, [dept], small);
    expect(cellsOf(resultMaster)).toEqual([["A", "이수", 89]]);
    expect(appliedValues).toEqual([
      { key: "A", masterRow: 2, column: 2, previousValue: "미이수", newValue: "이수", sourceFile: "가" },
      { key: "A", masterRow: 2, column: 3, previousValue: 55, newValue: 89, sourceFile: "가" },
    ]);
  });

  it("부서 칸이 비어 있으면 마스터 값을 그대로 두고 기록하지 않는다", () => {
    const master = book("마스터", [["A", "이수", 80], ["B", null, null]]);
    const dept = book("가", [["A", null, null], ["B", null, null]]);
    const { resultMaster, appliedValues } = consolidate(master, [dept], small);
    expect(cellsOf(resultMaster)).toEqual([["A", "이수", 80], ["B", null, null]]);
    expect(appliedValues).toEqual([]);
  });

  it("부서 칸 일부만 비어 있으면 값이 있는 칸만 채운다", () => {
    const master = book("마스터", [["A", "이수", 80]]);
    const dept = book("가", [["A", null, 95]]);
    expect(cellsOf(consolidate(master, [dept], small).resultMaster)).toEqual([["A", "이수", 95]]);
  });

  it("0이나 빈 글자가 아닌 진짜 값 0은 그대로 채운다", () => {
    const master = book("마스터", [["A", null, 50]]);
    const dept = book("가", [["A", null, 0]]);
    expect(cellsOf(consolidate(master, [dept], small).resultMaster)).toEqual([["A", null, 0]]);
  });

  it("마스터에 없는 키는 결과에 추가하지 않고 미매칭 목록에 담는다", () => {
    const master = book("마스터", [["A", null, null]]);
    const dept = book("가", [["A", "이수", 1], ["Z9", "이수", 2]]);
    const { resultMaster, unmatchedKeys } = consolidate(master, [dept], small);
    expect(cellsOf(resultMaster)).toEqual([["A", "이수", 1]]);
    expect(unmatchedKeys).toEqual([{ key: "Z9", fileName: "가", row: 3 }]);
  });

  it("표기가 달라도 정리한 키로 마스터와 맞춘다", () => {
    const master = book("마스터", [["S0052", null, null], ["S0053", null, null]]);
    const dept = book("가", [["s0052 ", "이수", 1], ["Ｓ0053", "이수", 2]]);
    const { resultMaster, unmatchedKeys } = consolidate(master, [dept], small);
    expect(cellsOf(resultMaster)).toEqual([["S0052", "이수", 1], ["S0053", "이수", 2]]);
    expect(unmatchedKeys).toEqual([]);
  });

  it("부서 파일이 여러 개이면 각자 맞는 행을 채운다", () => {
    const master = book("마스터", [["A", null, null], ["B", null, null]]);
    const { resultMaster } = consolidate(master, [book("가", [["A", "이수", 1]]), book("나", [["B", "미이수", 2]])], small);
    expect(cellsOf(resultMaster)).toEqual([["A", "이수", 1], ["B", "미이수", 2]]);
  });

  it("원본 마스터와 부서 파일을 바꾸지 않는다", () => {
    const master = book("마스터", [["A", null, null]]);
    const dept = book("가", [["A", "이수", 1]]);
    const before = JSON.stringify([master, dept]);
    consolidate(master, [dept], small);
    expect(JSON.stringify([master, dept])).toBe(before);
  });

  it("마스터에 지정한 시트가 없으면 오류를 던지고, 부서 파일에 없으면 그 파일만 건너뛴다", () => {
    const master = book("마스터", [["A", null, null]]);
    expect(() => consolidate(master, [], { ...small, sheetName: "없는시트" })).toThrow('"없는시트" 시트가 없어');
    const noSheet: WorkbookData = { fileName: "나", sheets: [] };
    const result = consolidate(master, [noSheet, book("가", [["A", "이수", 1]])], small);
    expect(cellsOf(result.resultMaster)).toEqual([["A", "이수", 1]]);
  });
});

describe("consolidate (중복 키)", () => {
  // 부서 쪽 중복: 같은 파일에서 A가 두 번, 값이 다르다
  const master = book("마스터", [["A", null, null], ["B", null, null]]);
  const dupDept = book("가", [["A", "이수", 10], ["B", "이수", 5], ["A", "미이수", 20]]);

  it("처리 방법을 고르지 않으면 그 키는 채우지 않고 선택이 필요하다고 알린다", () => {
    const { resultMaster, unresolvedDuplicates, duplicateKeys } = consolidate(master, [dupDept], small);
    expect(cellsOf(resultMaster)).toEqual([["A", null, null], ["B", "이수", 5]]);
    expect(unresolvedDuplicates.map((d) => d.key)).toEqual(["a"]);
    expect(duplicateKeys.map((d) => d.key)).toEqual(["a"]);
  });

  it("첫 번째 값으로 처리", () => {
    const { resultMaster, unresolvedDuplicates } = consolidate(master, [dupDept], small, { mode: "all", strategy: "first" });
    expect(cellsOf(resultMaster)[0]).toEqual(["A", "이수", 10]);
    expect(unresolvedDuplicates).toEqual([]);
  });

  it("마지막 값으로 처리", () => {
    const { resultMaster } = consolidate(master, [dupDept], small, { mode: "all", strategy: "last" });
    expect(cellsOf(resultMaster)[0]).toEqual(["A", "미이수", 20]);
  });

  it("값을 모두 나열해 처리 (빈 칸은 빼고 값을 그대로 이어 붙이며, 같은 값도 줄이지 않는다)", () => {
    const sameValues = book("나", [["A", "이수", 7], ["A", "이수", null]]);
    const { resultMaster, appliedValues } = consolidate(master, [dupDept, sameValues], small, { mode: "all", strategy: "list-all" });
    // 부서 파일 둘에서 A가 4번 나온다: 이수 / 미이수 / 이수 / 이수 (모두 나열), 점수 10 / 20 / 7
    expect(cellsOf(resultMaster)[0]).toEqual(["A", "이수 / 미이수 / 이수 / 이수", "10 / 20 / 7"]);
    expect(appliedValues.find((v) => v.column === 3 && v.key === "A")?.sourceFile).toBe("가, 나");
  });

  it("값이 하나뿐인 칸은 나열하지 않고 원래 모양 그대로 쓴다", () => {
    const dept = book("가", [["A", null, 10], ["A", null, null]]);
    const { resultMaster } = consolidate(master, [dept], small, { mode: "all", strategy: "list-all" });
    expect(cellsOf(resultMaster)[0]).toEqual(["A", null, 10]); // 숫자 10이 "10" 글자로 바뀌지 않는다
  });

  it("비워 두고 중복 목록에 표시", () => {
    const { resultMaster, duplicateKeys, unresolvedDuplicates } = consolidate(master, [dupDept], small, {
      mode: "all",
      strategy: "leave-blank",
    });
    expect(cellsOf(resultMaster)[0]).toEqual(["A", null, null]);
    expect(duplicateKeys).toHaveLength(1);
    expect(unresolvedDuplicates).toEqual([]);
  });

  it("키별로 따로 고를 수 있고, 고르지 않은 키는 계속 선택이 필요하다", () => {
    const master2 = book("마스터", [["A", null, null], ["B", null, null]]);
    const dept = book("가", [["A", "이수", 1], ["A", "미이수", 2], ["B", "이수", 3], ["B", "미이수", 4]]);
    const { resultMaster, unresolvedDuplicates } = consolidate(master2, [dept], small, {
      mode: "per-key",
      byKey: { a: "last" },
    });
    expect(cellsOf(resultMaster)).toEqual([["A", "미이수", 2], ["B", null, null]]);
    expect(unresolvedDuplicates.map((d) => d.key)).toEqual(["b"]);
  });

  it("부서 파일 사이의 중복도 같은 방식으로 처리한다", () => {
    const m = book("마스터", [["A", null, null]]);
    const result = consolidate(m, [book("가", [["A", "이수", 1]]), book("나", [["A", "미이수", 2]])], small, {
      mode: "all",
      strategy: "last",
    });
    expect(cellsOf(result.resultMaster)).toEqual([["A", "미이수", 2]]);
    expect(result.appliedValues.every((v) => v.sourceFile === "나")).toBe(true);
  });

  it("마스터 안 중복: 첫 번째 행 / 마지막 행 / 모든 행 / 비워 두기", () => {
    const m = book("마스터", [["A", null, null], ["A", null, null]]);
    const dept = book("가", [["A", "이수", 1]]);
    const run = (strategy: "first" | "last" | "list-all" | "leave-blank") =>
      cellsOf(consolidate(m, [dept], small, { mode: "all", strategy }).resultMaster);
    expect(run("first")).toEqual([["A", "이수", 1], ["A", null, null]]);
    expect(run("last")).toEqual([["A", null, null], ["A", "이수", 1]]);
    expect(run("list-all")).toEqual([["A", "이수", 1], ["A", "이수", 1]]);
    expect(run("leave-blank")).toEqual([["A", null, null], ["A", null, null]]);
  });

  it("마스터에 없는 키가 부서 쪽에서 겹쳐도 선택을 요구하지 않고 미매칭으로만 알린다", () => {
    const m = book("마스터", [["A", null, null]]);
    const dept = book("가", [["Z", "이수", 1], ["Z", "이수", 2]]);
    const result = consolidate(m, [dept], small);
    expect(result.unresolvedDuplicates).toEqual([]);
    expect(result.unmatchedKeys).toHaveLength(2);
    expect(result.duplicateKeys.map((d) => d.key)).toEqual(["z"]);
  });
});

// 연습용 파일 전체로 확인한다: 기준 열 B(2), 대상 열 E~H(5~8), 헤더 3행, 데이터 4행부터
describe("consolidate (연습용 파일)", () => {
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

  // 점검을 통과한 부서 파일만 모은다 (헤더가 다른 부서15, 병합 위험이 있는 부서09는 빠진다)
  async function checkedDepartments(master: WorkbookData): Promise<WorkbookData[]> {
    const all: WorkbookData[] = [];
    for (let k = 1; k <= 20; k++) all.push(await load(`부서/부서${String(k).padStart(2, "0")}.xlsx`));
    const headers = checkHeaders(all[0], master, all, settings);
    const merges = checkMergeRisks(master, headers.passedDepartments, settings);
    expect(headers.excludedFiles.map((f) => f.fileName)).toEqual(["부서15.xlsx"]);
    expect(merges.excludedFiles.map((f) => f.fileName)).toEqual(["부서09.xlsx"]);
    return merges.passedDepartments;
  }

  // 마스터에서 직원 번호 i의 행을 찾는다 (S0001 = 4행)
  const rowOf = (i: number) => 3 + i;
  function cell(workbook: WorkbookData, i: number, column: number): CellValue {
    return workbook.sheets[0].cells[rowOf(i) - 1][column - 1];
  }

  it("점검을 통과한 18개 파일을 취합한다 (중복은 첫 번째 값으로)", async () => {
    const master = await load("마스터.xlsx");
    const departments = await checkedDepartments(master);
    expect(departments).toHaveLength(18);

    const outcome = consolidate(master, departments, settings, { mode: "all", strategy: "first" });
    const result = outcome.resultMaster;

    // 마스터에 없는 키는 S9999 하나뿐이다 (부서11의 표기 차이는 정리로 맞춰진다)
    expect(outcome.unmatchedKeys).toEqual([{ key: "S9999", fileName: "부서05.xlsx", row: 9 }]);
    expect(outcome.unresolvedDuplicates).toEqual([]);

    // 마스터 값을 부서 값으로 덮어쓴 칸
    expect(cell(result, 1, 5)).toBe("이수"); // 직원001: 마스터 "미이수" → 부서 "이수"
    expect(cell(result, 10, 7)).toBe(89); // 직원010: 마스터 55 → 부서 89
    // 부서 칸이 비어 있어 마스터 값을 유지한 칸
    expect(cell(result, 3, 5)).toBe("이수"); // 직원003
    expect(cell(result, 7, 5)).toBe("이수"); // 직원007
    expect(cell(result, 7, 6)).toBeInstanceOf(Date);
    // 키 표기가 달랐던 직원052(s0052 ), 직원053(Ｓ0053)도 채워졌다
    expect(cell(result, 52, 5)).toBe("미이수");
    expect(cell(result, 53, 5)).toBe("이수");
    // 점검에서 빠진 부서09(직원041~045)와 부서15(직원071~075)는 채워지지 않았다
    expect(cell(result, 41, 5)).toBeNull();
    expect(cell(result, 71, 5)).toBeNull();
    // 마스터 원본은 그대로
    expect(cell(master, 1, 5)).toBe("미이수");
    expect(cell(master, 10, 7)).toBe(55);
  });

  it("같은 파일 안 중복(직원032)과 파일 사이 중복(직원060)은 선택에 따라 다르게 채워진다", async () => {
    const master = await load("마스터.xlsx");
    const departments = await checkedDepartments(master);
    const run = (strategy: "first" | "last" | "list-all") =>
      consolidate(master, departments, settings, { mode: "all", strategy }).resultMaster;

    expect([cell(run("first"), 32, 7), cell(run("first"), 60, 7)]).toEqual([79, 70]);
    expect([cell(run("last"), 32, 7), cell(run("last"), 60, 7)]).toEqual([99, 77]);
    expect([cell(run("list-all"), 32, 7), cell(run("list-all"), 60, 7)]).toEqual(["79 / 99", "70 / 77"]);
  });

  it("처리 방법을 고르지 않으면 직원032와 직원060은 채우지 않고 선택이 필요하다고 알린다", async () => {
    const master = await load("마스터.xlsx");
    const departments = await checkedDepartments(master);
    const outcome = consolidate(master, departments, settings);
    expect(outcome.unresolvedDuplicates.map((d) => d.displayKey)).toEqual(["S0032", "S0060"]);
    expect(cell(outcome.resultMaster, 32, 5)).toBeNull();
    expect(cell(outcome.resultMaster, 60, 5)).toBeNull();
    expect(cell(outcome.resultMaster, 31, 5)).not.toBeNull(); // 중복이 아닌 다른 직원은 채워진다
  });

  it("마스터 안에 직원100이 두 번 있는 파일: 처리 방법에 따라 첫 행 / 마지막 행 / 모든 행에 채운다", async () => {
    const master = await load("예외/마스터_중복키.xlsx");
    const departments = await checkedDepartments(master);
    const column = 7; // 점수
    const row = (strategy: "first" | "last" | "list-all" | "leave-blank") =>
      consolidate(master, departments, settings, { mode: "all", strategy }).resultMaster.sheets[0].cells;
    const score = 60 + ((100 * 7) % 41); // 부서20 직원100의 점수

    expect([row("first")[102][column - 1], row("first")[103][column - 1]]).toEqual([score, null]);
    expect([row("last")[102][column - 1], row("last")[103][column - 1]]).toEqual([null, score]);
    expect([row("list-all")[102][column - 1], row("list-all")[103][column - 1]]).toEqual([score, score]);
    expect([row("leave-blank")[102][column - 1], row("leave-blank")[103][column - 1]]).toEqual([null, null]);
  });
});

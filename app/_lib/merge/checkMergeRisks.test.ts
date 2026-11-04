// 병합 셀 위험 검사를 시험한다. 실행: npm run test
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseRange } from "../excel/a1";
import { readWorkbookFromBuffer } from "../excel/readWorkbook";
import type { CellValue, ConsolidationSettings, WorkbookData } from "../types";
import { checkMergeRisks, findMergeRisks } from "./checkMergeRisks";

// 작은 시험용 워크북: 1행 제목, 2행 헤더, 3~5행 데이터(키 A,B,C), 6행 비어 있음, 7행 안내 문구
// 열: 1 사번(기준), 2 이름, 3 점수(취합 대상)
function book(fileName: string, merges: string[]): WorkbookData {
  const cells: CellValue[][] = [
    ["제목", null, null],
    ["사번", "이름", "점수"],
    ["A", "가", 10],
    ["B", "나", 20],
    ["C", "다", 30],
    [null, null, null],
    ["※ 안내", null, null],
  ];
  return {
    fileName,
    sheets: [{ name: "Sheet1", rowCount: 7, colCount: 3, cells, merges: merges.map(parseRange) }],
  };
}

const small: ConsolidationSettings = { sheetName: "Sheet1", keyColumn: 1, targetColumns: [3], headerRow: 2, dataStartRow: 3 };

describe("findMergeRisks (작은 예)", () => {
  it("병합이 없으면 위험이 없다", () => {
    expect(findMergeRisks(book("가", []), small)).toEqual([]);
  });

  it("제목 줄(헤더 위)의 병합은 위험이 아니다", () => {
    expect(findMergeRisks(book("가", ["A1:C1"]), small)).toEqual([]);
  });

  it("데이터 아래 안내 문구의 병합은 위험이 아니다", () => {
    expect(findMergeRisks(book("가", ["A7:C7"]), small)).toEqual([]);
  });

  it("기준도 대상도 아닌 열(이름)의 병합은 위험이 아니다", () => {
    expect(findMergeRisks(book("가", ["B3:B4"]), small)).toEqual([]);
  });

  it("기준 열 데이터 영역의 병합은 위험이다", () => {
    const risks = findMergeRisks(book("가", ["A3:A4"]), small);
    expect(risks).toEqual([{ kind: "key-column", sheetName: "Sheet1", range: parseRange("A3:A4") }]);
  });

  it("기준 열 마지막 데이터 행에 걸친 병합도 위험이다", () => {
    expect(findMergeRisks(book("가", ["A5:A6"]), small)[0]?.kind).toBe("key-column");
  });

  it("취합 대상 열 데이터 영역의 병합은 위험이다", () => {
    const risks = findMergeRisks(book("가", ["C4:C5"]), small);
    expect(risks.map((r) => r.kind)).toEqual(["target-columns"]);
  });

  it("여러 열에 걸친 병합이 기준 열을 포함하면 위험이다", () => {
    expect(findMergeRisks(book("가", ["A4:B4"]), small)[0]?.kind).toBe("key-column");
  });

  it("헤더 행에 걸친 병합은 위험이다", () => {
    expect(findMergeRisks(book("가", ["B2:C2"]), small)[0]?.kind).toBe("header");
  });

  it("제목과 헤더를 함께 묶은 병합은 위험이다", () => {
    expect(findMergeRisks(book("가", ["A1:A2"]), small)[0]?.kind).toBe("header");
  });

  it("지정한 시트가 없으면 위험을 찾지 않는다", () => {
    expect(findMergeRisks(book("가", ["A3:A4"]), { ...small, sheetName: "없는시트" })).toEqual([]);
  });

  it("위험한 병합이 여러 개여도 모두 찾는다", () => {
    expect(findMergeRisks(book("가", ["A3:A4", "C4:C5", "A1:C1"]), small)).toHaveLength(2);
  });
});

describe("checkMergeRisks (작은 예)", () => {
  it("위험한 부서 파일은 이유와 위치와 함께 제외한다", () => {
    const ok = book("가.xlsx", ["A1:C1"]);
    const bad = book("나.xlsx", ["A3:A4"]);
    const result = checkMergeRisks(book("마스터.xlsx", []), [ok, bad], small);

    expect(result.passedDepartments.map((w) => w.fileName)).toEqual(["가.xlsx"]);
    expect(result.excludedFiles).toHaveLength(1);
    expect(result.excludedFiles[0]).toEqual({
      fileName: "나.xlsx",
      reason: "merged-cell-risk",
      message: "나.xlsx의 Sheet1 A3:A4이(가) 병합되어 있어 기준 열의 행 위치가 어긋날 수 있어 취합하지 않았습니다.",
      sheetName: "Sheet1",
      mergedRange: parseRange("A3:A4"),
    });
    expect(result.masterMessage).toBeNull();
  });

  it("위험한 병합이 여러 곳이면 첫 번째만 자세히 적고 나머지는 개수로 줄인다", () => {
    const bad = book("나.xlsx", ["A3:A4", "C4:C5"]);
    const result = checkMergeRisks(book("마스터.xlsx", []), [bad], small);
    expect(result.excludedFiles[0].message).toContain("(이 밖에 1곳)");
  });

  it("마스터에 위험한 병합이 있으면 제외하지 않고 경고만 한다", () => {
    const result = checkMergeRisks(book("마스터.xlsx", ["C3:C4"]), [book("가.xlsx", [])], small);
    expect(result.passedDepartments).toHaveLength(1);
    expect(result.masterRisks).toHaveLength(1);
    expect(result.masterMessage).toContain("마스터.xlsx의 Sheet1 C3:C4");
    expect(result.masterMessage).toContain("결과가 잘못될 수 있습니다.");
  });
});

// 연습용 파일로 확인한다: 기준 열 B(2), 대상 열 E~H(5~8), 헤더 3행, 데이터 4행부터
describe("checkMergeRisks (연습용 파일)", () => {
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

  async function allDepartments(): Promise<WorkbookData[]> {
    const books: WorkbookData[] = [];
    for (let k = 1; k <= 20; k++) books.push(await load(`부서/부서${String(k).padStart(2, "0")}.xlsx`));
    return books;
  }

  it("부서09(기준 열 B5:B6 병합)만 제외되고, 나머지 19개는 제목 병합이 있어도 통과한다", async () => {
    const result = checkMergeRisks(await load("마스터.xlsx"), await allDepartments(), settings);
    expect(result.excludedFiles.map((f) => f.fileName)).toEqual(["부서09.xlsx"]);
    expect(result.passedDepartments).toHaveLength(19);
    expect(result.excludedFiles[0].message).toBe(
      "부서09.xlsx의 Sheet1 B5:B6이(가) 병합되어 있어 기준 열의 행 위치가 어긋날 수 있어 취합하지 않았습니다.",
    );
    expect(result.masterMessage).toBeNull();
  });

  it("데이터 아래에 안내 문구를 병합한 부서18은 통과한다", async () => {
    const dept18 = await load("부서/부서18.xlsx");
    expect(dept18.sheets[0].merges.map((m) => m.startRow)).toContain(10); // 안내 문구 병합이 실제로 있다
    expect(findMergeRisks(dept18, settings)).toEqual([]);
  });
});

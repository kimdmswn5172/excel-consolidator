// 파일 점검(읽기 실패 모으기, 헤더 비교)을 시험한다. 실행: npm run test
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readWorkbookFromBuffer, type ReadWorkbookResult } from "../excel/readWorkbook";
import type { CellValue, WorkbookData } from "../types";
import { checkHeaders, compareHeaders, splitReadResults, type HeaderSettings } from "./inspectFiles";

// 작은 시험용 워크북: 1행이 헤더
function book(fileName: string, header: CellValue[], sheetName = "Sheet1"): WorkbookData {
  return { fileName, sheets: [{ name: sheetName, rowCount: 1, colCount: header.length, cells: [header], merges: [] }] };
}

const small: HeaderSettings = { sheetName: "Sheet1", headerRow: 1 };

describe("compareHeaders", () => {
  it("같으면 차이가 없다", () => {
    expect(compareHeaders(book("대표", ["사번", "이름"]), book("가", ["사번", "이름"]), small)).toEqual([]);
  });

  it("공백·대소문자·전각 차이는 무시한다", () => {
    expect(compareHeaders(book("대표", ["ID", "이름"]), book("가", [" id ", "이름"]), small)).toEqual([]);
    expect(compareHeaders(book("대표", ["ID", "이름"]), book("가", ["ＩＤ", "이름"]), small)).toEqual([]);
  });

  it("다른 열을 열 번호와 함께 알려 준다", () => {
    expect(compareHeaders(book("대표", ["사번", "이름"]), book("가", ["직원번호", "이름"]), small)).toEqual([
      { column: 1, expected: "사번", actual: "직원번호" },
    ]);
  });

  it("열이 더 많거나 적어도 다른 것으로 본다", () => {
    const more = compareHeaders(book("대표", ["사번"]), book("가", ["사번", "메모"]), small);
    expect(more).toEqual([{ column: 2, expected: "(비어 있음)", actual: "메모" }]);
    const fewer = compareHeaders(book("대표", ["사번", "메모"]), book("가", ["사번"]), small);
    expect(fewer).toEqual([{ column: 2, expected: "메모", actual: "(비어 있음)" }]);
  });

  it("시트가 없으면 null이다", () => {
    expect(compareHeaders(book("대표", ["사번"]), book("가", ["사번"], "다른시트"), small)).toBeNull();
  });
});

describe("checkHeaders (작은 예)", () => {
  it("같은 파일은 통과하고 다른 부서 파일은 이유와 함께 제외한다", () => {
    const rep = book("대표.xlsx", ["사번", "이름"]);
    const ok = book("가.xlsx", ["사번", "이름"]);
    const bad = book("나.xlsx", ["직원번호", "이름"]);
    const result = checkHeaders(rep, book("마스터.xlsx", ["사번", "이름"]), [rep, ok, bad], small);

    expect(result.passedDepartments.map((w) => w.fileName)).toEqual(["대표.xlsx", "가.xlsx"]);
    expect(result.excludedFiles).toHaveLength(1);
    expect(result.excludedFiles[0].fileName).toBe("나.xlsx");
    expect(result.excludedFiles[0].reason).toBe("header-mismatch");
    expect(result.excludedFiles[0].message).toContain('A열 "직원번호" (대표 파일: "사번")');
    expect(result.masterHeaderMismatch).toBe(false);
    expect(result.masterMessage).toBeNull();
  });

  it("마스터가 다르면 제외하지 않고 경고 정보만 돌려준다", () => {
    const rep = book("대표.xlsx", ["사번", "이름"]);
    const result = checkHeaders(rep, book("마스터.xlsx", ["직원번호", "이름"]), [rep], small);
    expect(result.passedDepartments).toHaveLength(1);
    expect(result.masterHeaderMismatch).toBe(true);
    expect(result.masterDifferences).toHaveLength(1);
    expect(result.masterMessage).toContain("마스터.xlsx의 헤더가 대표 파일(대표.xlsx)과 다릅니다");
  });

  it("지정한 시트가 없는 부서 파일은 이유와 함께 제외한다", () => {
    const rep = book("대표.xlsx", ["사번"]);
    const result = checkHeaders(rep, book("마스터.xlsx", ["사번"]), [rep, book("가.xlsx", ["사번"], "다른시트")], small);
    expect(result.excludedFiles[0].message).toContain('"Sheet1" 시트가 없어');
  });

  it("다른 곳이 많으면 3곳까지만 보여 주고 나머지는 개수로 줄인다", () => {
    const rep = book("대표.xlsx", ["가", "나", "다", "라", "마"]);
    const bad = book("제외.xlsx", ["1", "2", "3", "4", "5"]);
    const result = checkHeaders(rep, book("마스터.xlsx", ["가", "나", "다", "라", "마"]), [rep, bad], small);
    expect(result.excludedFiles[0].message).toContain("외 2곳");
  });
});

describe("splitReadResults", () => {
  it("읽은 파일과 읽지 못한 파일을 나눈다", () => {
    const ok: ReadWorkbookResult = { ok: true, workbook: book("가.xlsx", ["사번"]) };
    const bad: ReadWorkbookResult = {
      ok: false,
      skipped: { fileName: "손상.xlsx", reason: "unreadable", message: "손상.xlsx은(는) 손상되었거나 읽을 수 없는 파일입니다." },
    };
    const { workbooks, skipped } = splitReadResults([ok, bad, ok]);
    expect(workbooks).toHaveLength(2);
    expect(skipped).toEqual([bad.skipped]);
  });
});

// 연습용 파일로 확인한다 (시트 Sheet1, 헤더는 3행)
describe("연습용 파일 점검", () => {
  const settings: HeaderSettings = { sheetName: "Sheet1", headerRow: 3 };

  async function read(relPath: string): Promise<ReadWorkbookResult> {
    const file = await readFile(path.resolve(process.cwd(), "samples", relPath));
    const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
    return readWorkbookFromBuffer(buffer, path.basename(relPath));
  }

  async function allDepartments(): Promise<WorkbookData[]> {
    const results: ReadWorkbookResult[] = [];
    for (let k = 1; k <= 20; k++) results.push(await read(`부서/부서${String(k).padStart(2, "0")}.xlsx`));
    const { workbooks, skipped } = splitReadResults(results);
    expect(skipped).toEqual([]);
    return workbooks;
  }

  it("예외 폴더의 손상 파일과 CSV는 읽기 단계에서 제외 목록으로 모인다", async () => {
    const { workbooks, skipped } = splitReadResults([
      await read("예외/손상.xlsx"),
      await read("예외/목록.csv"),
      await read("마스터.xlsx"),
    ]);
    expect(workbooks.map((w) => w.fileName)).toEqual(["마스터.xlsx"]);
    expect(skipped.map((s) => [s.fileName, s.reason])).toEqual([
      ["손상.xlsx", "unreadable"],
      ["목록.csv", "not-xlsx"],
    ]);
  });

  it("부서01을 대표로 하면 헤더가 다른 부서15만 제외된다", async () => {
    const departments = await allDepartments();
    const master = (await read("마스터.xlsx")) as { ok: true; workbook: WorkbookData };
    const result = checkHeaders(departments[0], master.workbook, departments, settings);

    expect(result.excludedFiles.map((f) => f.fileName)).toEqual(["부서15.xlsx"]);
    expect(result.excludedFiles[0].message).toContain('B열 "직원번호" (대표 파일: "사번")');
    expect(result.passedDepartments).toHaveLength(19);
    expect(result.masterHeaderMismatch).toBe(false);
  });

  it("마스터_헤더다름.xlsx는 마스터 경고로 잡힌다", async () => {
    const departments = await allDepartments();
    const master = (await read("예외/마스터_헤더다름.xlsx")) as { ok: true; workbook: WorkbookData };
    const result = checkHeaders(departments[0], master.workbook, departments, settings);
    expect(result.masterHeaderMismatch).toBe(true);
    expect(result.masterMessage).toContain('B열 "직원번호" (대표 파일: "사번")');
    expect(result.excludedFiles.map((f) => f.fileName)).toEqual(["부서15.xlsx"]); // 부서 쪽 결과는 그대로
  });

  it("특이한 부서15가 대표로 뽑히면 나머지 19개가 모두 제외된다 (그래서 다시 뽑기 버튼이 필요하다)", async () => {
    const departments = await allDepartments();
    const master = (await read("마스터.xlsx")) as { ok: true; workbook: WorkbookData };
    const unusual = departments[14]; // 부서15
    const result = checkHeaders(unusual, master.workbook, departments, settings);
    expect(result.excludedFiles).toHaveLength(19);
    expect(result.passedDepartments.map((w) => w.fileName)).toEqual(["부서15.xlsx"]);
    expect(result.masterHeaderMismatch).toBe(true);
  });
});

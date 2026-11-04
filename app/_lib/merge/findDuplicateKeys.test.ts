// 중복 키 찾기를 시험한다. 실행: npm run test
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readWorkbookFromBuffer } from "../excel/readWorkbook";
import type { CellValue, WorkbookData } from "../types";
import { displayKey } from "./normalizeKey";
import { findDuplicateKeys, type KeySettings } from "./findDuplicateKeys";

// 작은 시험용 워크북: 1행은 헤더, 2행부터 데이터, 기준 열은 1번째 열
function book(fileName: string, keys: CellValue[]): WorkbookData {
  return {
    fileName,
    sheets: [
      {
        name: "Sheet1",
        rowCount: keys.length + 1,
        colCount: 1,
        cells: [["사번"], ...keys.map((key) => [key])],
        merges: [],
      },
    ],
  };
}

const small: KeySettings = { sheetName: "Sheet1", keyColumn: 1, dataStartRow: 2 };

describe("findDuplicateKeys (작은 예)", () => {
  it("마스터와 부서 파일에 한 번씩 있는 키는 중복이 아니다", () => {
    const result = findDuplicateKeys(book("마스터", ["A", "B"]), [book("가", ["A"]), book("나", ["B"])], small);
    expect(result).toEqual([]);
  });

  it("한 부서 파일 안에서 겹치면 중복이다", () => {
    const result = findDuplicateKeys(book("마스터", ["A", "B"]), [book("가", ["A", "B", "A"])], small);
    expect(result).toEqual([
      {
        key: "a",
        displayKey: "A",
        occurrences: [
          { fileName: "가", sheetName: "Sheet1", row: 2 },
          { fileName: "가", sheetName: "Sheet1", row: 4 },
        ],
      },
    ]);
  });

  it("부서 파일 사이에서 겹치면 중복이다", () => {
    const result = findDuplicateKeys(book("마스터", ["A"]), [book("가", ["A"]), book("나", ["A"])], small);
    expect(result).toHaveLength(1);
    expect(result[0].occurrences.map((o) => o.fileName)).toEqual(["가", "나"]);
  });

  it("마스터 안에서 겹치면 중복이고, 마스터 위치만 담는다", () => {
    const result = findDuplicateKeys(book("마스터", ["A", "A"]), [book("가", ["A"])], small);
    expect(result).toHaveLength(1);
    expect(result[0].occurrences).toEqual([
      { fileName: "마스터", sheetName: "Sheet1", row: 2 },
      { fileName: "마스터", sheetName: "Sheet1", row: 3 },
    ]);
  });

  it("표기가 달라도 정리하면 같은 키로 겹친다", () => {
    const result = findDuplicateKeys(book("마스터", ["S1"]), [book("가", ["s1 "]), book("나", ["Ｓ1"])], small);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("s1");
    expect(result[0].displayKey).toBe("S1"); // 처음 나온 값(마스터)의 원래 모양
  });

  it("헤더 줄과 빈 칸은 키로 세지 않는다", () => {
    const result = findDuplicateKeys(book("마스터", ["A", null, null]), [book("가", [null, null])], small);
    expect(result).toEqual([]);
  });

  it("조건의 시트 이름이 없는 파일은 건너뛴다", () => {
    const result = findDuplicateKeys(book("마스터", ["A"]), [book("가", ["A", "A"])], { ...small, sheetName: "없는시트" });
    expect(result).toEqual([]);
  });

  it("displayKey는 원래 값에서 앞뒤 공백만 뺀다", () => {
    expect(displayKey(" Ｓ0001 ")).toBe("Ｓ0001");
    expect(displayKey(101)).toBe("101");
    expect(displayKey(null)).toBe("");
  });
});

// 연습용 파일 전체로 확인한다 (기준 열 B = 2, 데이터는 4행부터)
describe("findDuplicateKeys (연습용 파일)", () => {
  const settings: KeySettings = { sheetName: "Sheet1", keyColumn: 2, dataStartRow: 4 };

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

  it("부서 파일 20개에서 같은 파일 안 중복(S0032)과 파일 사이 중복(S0060)을 찾는다", async () => {
    const result = findDuplicateKeys(await load("마스터.xlsx"), await allDepartments(), settings);
    expect(result.map((d) => d.displayKey)).toEqual(["S0032", "S0060"]);

    const s0032 = result.find((d) => d.key === "s0032")!;
    expect(s0032.occurrences).toEqual([
      { fileName: "부서07.xlsx", sheetName: "Sheet1", row: 5 },
      { fileName: "부서07.xlsx", sheetName: "Sheet1", row: 9 },
    ]);

    const s0060 = result.find((d) => d.key === "s0060")!;
    expect(s0060.occurrences).toEqual([
      { fileName: "부서12.xlsx", sheetName: "Sheet1", row: 8 },
      { fileName: "부서13.xlsx", sheetName: "Sheet1", row: 9 },
    ]);
  });

  it("마스터에 같은 사번이 두 번 있는 파일에서는 마스터 안 중복도 찾는다", async () => {
    const result = findDuplicateKeys(await load("예외/마스터_중복키.xlsx"), await allDepartments(), settings);
    // 목록은 마스터 행 순서대로 처음 나온 키 순서를 따른다
    expect(result.map((d) => d.displayKey)).toEqual(["S0032", "S0060", "S0100"]);
    expect(result[2].occurrences.map((o) => [o.fileName, o.row])).toEqual([
      ["마스터_중복키.xlsx", 103],
      ["마스터_중복키.xlsx", 104],
    ]);
  });

  it("키 표기만 다른 부서11은 중복으로 잘못 잡히지 않는다", async () => {
    const result = findDuplicateKeys(await load("마스터.xlsx"), [await load("부서/부서11.xlsx")], settings);
    expect(result).toEqual([]);
  });

  it("병합된 칸(부서09)은 같은 사번이 여러 번 나온 것으로 잡히지 않는다", async () => {
    const result = findDuplicateKeys(await load("마스터.xlsx"), [await load("부서/부서09.xlsx")], settings);
    expect(result).toEqual([]);
  });
});

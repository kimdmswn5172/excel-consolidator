// 연습용 파일(samples/)로 엑셀 읽기를 시험한다. 실행: npm run test
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { columnLettersToNumber, formatRange, numberToColumnLetters, parseRange } from "./a1";
import { readWorkbookFromBuffer } from "./readWorkbook";

async function readSample(relPath: string) {
  const file = await readFile(path.resolve(process.cwd(), "samples", relPath));
  const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
  return readWorkbookFromBuffer(buffer, path.basename(relPath));
}

async function readOk(relPath: string) {
  const result = await readSample(relPath);
  if (!result.ok) throw new Error(`읽기 실패: ${result.skipped.message}`);
  return result.workbook.sheets[0];
}

describe("엑셀 주소 변환", () => {
  it("열 글자와 번호를 서로 바꾼다", () => {
    expect(columnLettersToNumber("A")).toBe(1);
    expect(columnLettersToNumber("AA")).toBe(27);
    expect(numberToColumnLetters(2)).toBe("B");
    expect(numberToColumnLetters(27)).toBe("AA");
  });

  it("범위를 읽고 다시 글자로 만든다", () => {
    expect(parseRange("B5:B6")).toEqual({ startRow: 5, startCol: 2, endRow: 6, endCol: 2 });
    expect(parseRange("C3")).toEqual({ startRow: 3, startCol: 3, endRow: 3, endCol: 3 });
    expect(formatRange(parseRange("A1:H1"))).toBe("A1:H1");
    expect(formatRange(parseRange("C3"))).toBe("C3");
  });

  it("형식이 틀린 범위는 오류를 낸다", () => {
    expect(() => parseRange("1A")).toThrow();
  });
});

describe("마스터 표 읽기", () => {
  it("시트·행열 수·병합·칸 값을 읽는다", async () => {
    const sheet = await readOk("마스터.xlsx");
    expect(sheet.name).toBe("Sheet1");
    expect(sheet.rowCount).toBe(103);
    expect(sheet.colCount).toBe(8);
    expect(sheet.merges).toEqual([{ startRow: 1, startCol: 1, endRow: 1, endCol: 8 }]);
    expect(sheet.cells[2]).toEqual(["연번", "사번", "이름", "부서", "교육이수", "이수일", "점수", "비고"]);
    expect(sheet.cells[3][1]).toBe("S0001");
    expect(sheet.cells[3][4]).toBe("미이수"); // 미리 채워 둔 칸
    expect(sheet.cells[12][6]).toBe(55); // 직원010 점수
  });

  it("빈 칸은 null이고, 병합된 칸은 왼쪽 위만 값을 갖는다", async () => {
    const sheet = await readOk("마스터.xlsx");
    expect(sheet.cells[1].every((value) => value === null)).toBe(true); // 2행은 빈 줄
    expect(sheet.cells[3][5]).toBeNull(); // 아직 비어 있는 이수일
    expect(typeof sheet.cells[0][0]).toBe("string"); // 제목
    expect(sheet.cells[0][1]).toBeNull(); // 제목 병합 영역의 나머지 칸
  });
});

describe("부서 파일 읽기", () => {
  it("날짜 칸은 Date로 읽는다", async () => {
    const sheet = await readOk("부서/부서01.xlsx");
    expect(sheet.cells[3][5]).toBeInstanceOf(Date);
  });

  it("취합 대상 칸이 빈 부서 파일은 null로 읽는다", async () => {
    const sheet = await readOk("부서/부서01.xlsx");
    expect(sheet.cells[5][1]).toBe("S0003");
    expect(sheet.cells.at(5)!.slice(4)).toEqual([null, null, null, null]);
  });

  it("데이터 영역의 병합 셀을 찾아내고 나머지 칸을 비운다", async () => {
    const sheet = await readOk("부서/부서09.xlsx");
    expect(sheet.merges).toContainEqual({ startRow: 5, startCol: 2, endRow: 6, endCol: 2 });
    expect(sheet.cells[4][1]).toBe("S0042");
    expect(sheet.cells[5][1]).toBeNull();
  });

  it("키의 표기 차이를 고치지 않고 있는 그대로 읽는다", async () => {
    const sheet = await readOk("부서/부서11.xlsx");
    expect(sheet.cells[4][1]).toBe("s0052 ");
    expect(sheet.cells[5][1]).toBe("Ｓ0053");
  });

  it("다른 헤더 이름을 그대로 읽는다", async () => {
    const sheet = await readOk("부서/부서15.xlsx");
    expect(sheet.cells[2][1]).toBe("직원번호");
  });
});

describe("읽을 수 없는 파일", () => {
  it(".xlsx가 아닌 파일은 not-xlsx", async () => {
    const result = await readSample("예외/목록.csv");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.skipped.reason).toBe("not-xlsx");
  });

  it("손상된 파일은 unreadable이고 이유 문장이 있다", async () => {
    const result = await readSample("예외/손상.xlsx");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.skipped.reason).toBe("unreadable");
      expect(result.skipped.message).toContain("손상.xlsx");
    }
  });

  it("비밀번호가 걸린 파일(OLE 형식)은 password-protected", async () => {
    const locked = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
    const result = await readWorkbookFromBuffer(locked, "잠금.xlsx");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.skipped.reason).toBe("password-protected");
  });
});

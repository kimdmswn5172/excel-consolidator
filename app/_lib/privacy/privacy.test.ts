// 개인정보 가리기와 AI 전송 데이터 만들기를 시험한다. 실행: npm run test
// 시험에 쓰는 번호는 모두 가짜로 만든 모양이다.
import { describe, expect, it } from "vitest";
import type { CellValue, WorkbookData } from "../types";
import { buildAnalyzeRequest, guessHeaderRow, SAMPLE_ROW_LIMIT } from "./buildAnalyzeRequest";
import { maskCellValue } from "./maskSensitive";

describe("maskCellValue", () => {
  it("주민등록번호 모양을 가린다 (하이픈 있음·없음)", () => {
    expect(maskCellValue("900101-1234567")).toEqual({ value: "[주민등록번호 가림]", masked: ["주민등록번호"] });
    expect(maskCellValue("9001011234567").masked).toEqual(["주민등록번호"]);
  });

  it("전화번호 모양을 가린다 (휴대전화·지역번호·대표번호)", () => {
    expect(maskCellValue("010-1234-5678").value).toBe("[전화번호 가림]");
    expect(maskCellValue("01012345678").masked).toEqual(["전화번호"]);
    expect(maskCellValue("02-123-4567").masked).toEqual(["전화번호"]);
    expect(maskCellValue("031-1234-5678").masked).toEqual(["전화번호"]);
    expect(maskCellValue("1588-1234").masked).toEqual(["전화번호"]);
  });

  it("문장 안의 번호만 바꾸고 나머지 글자는 둔다", () => {
    expect(maskCellValue("연락처 010-1234-5678 입니다").value).toBe("연락처 [전화번호 가림] 입니다");
  });

  it("숫자로 저장된 번호(앞의 0이 지워진 휴대전화, 13자리 주민번호)도 가린다", () => {
    expect(maskCellValue(1012345678).masked).toEqual(["전화번호"]);
    expect(maskCellValue(9001011234567).masked).toEqual(["주민등록번호"]);
  });

  it("사번·점수·날짜·일반 글자는 그대로 둔다", () => {
    for (const value of ["S0001", "직원001", "2026-03-02", "20260302", "이수", 89, 55, true, null, new Date(0)] as CellValue[]) {
      expect(maskCellValue(value).masked).toEqual([]);
      expect(maskCellValue(value).value).toBe(value);
    }
  });

  it("더 긴 숫자의 일부는 번호로 보지 않는다", () => {
    expect(maskCellValue("1010-1234-56789").masked).toEqual([]);
  });
});

function book(cells: CellValue[][], sheetName = "Sheet1"): WorkbookData {
  return { fileName: "부서.xlsx", sheets: [{ name: sheetName, rowCount: cells.length, colCount: 3, cells, merges: [] }] };
}

// 1행 제목, 2행 비어 있음, 3행 헤더, 4행부터 15행까지 데이터
const rows: CellValue[][] = [
  ["제목", null, null],
  [null, null, null],
  ["사번", "이름", "연락처"],
  ...Array.from({ length: 12 }, (_, i): CellValue[] => [`S${i}`, `직원${i}`, i === 0 ? "010-1234-5678" : "-"]),
];

describe("guessHeaderRow", () => {
  it("제목 줄을 건너뛰고 글자만 있는 첫 행을 헤더로 본다", () => {
    expect(guessHeaderRow(book(rows).sheets[0])).toBe(3);
  });
});

describe("buildAnalyzeRequest", () => {
  it("기본은 위쪽 10행만 보낸다", () => {
    const { request } = buildAnalyzeRequest(book(rows), false);
    expect(request.headersOnly).toBe(false);
    expect(request.sheets[0].rows).toHaveLength(SAMPLE_ROW_LIMIT);
    expect(request.sheets[0].headerRow).toBeUndefined();
  });

  it("샘플에 섞인 전화번호는 가리고 개수와 종류를 알려 준다", () => {
    const payload = buildAnalyzeRequest(book(rows), false);
    expect(JSON.stringify(payload.request)).not.toContain("010-1234-5678");
    expect(payload.maskedCount).toBe(1);
    expect(payload.maskedKinds).toEqual(["전화번호"]);
  });

  it("개인정보 포함으로 체크하면 헤더 행 하나만 보내고 데이터 값은 보내지 않는다", () => {
    const { request } = buildAnalyzeRequest(book(rows), true);
    expect(request.headersOnly).toBe(true);
    expect(request.sheets[0]).toEqual({ name: "Sheet1", headerRow: 3, rows: [["사번", "이름", "연락처"]] });
    const text = JSON.stringify(request);
    expect(text).not.toContain("직원0");
    expect(text).not.toContain("010-1234");
  });

  it("엑셀 전체가 아니라 10행을 넘는 부분은 어느 경우에도 보내지 않는다", () => {
    const text = JSON.stringify(buildAnalyzeRequest(book(rows), false).request);
    expect(text).not.toContain("직원9"); // 14행째 이후
  });

  it("헤더 칸 자체에 번호 모양이 있어도 가린다", () => {
    const tricky = book([["사번", "010-1234-5678"], ["S1", "x"]]);
    const payload = buildAnalyzeRequest(tricky, true);
    expect(payload.request.sheets[0].rows[0]).toEqual(["사번", "[전화번호 가림]"]);
  });
});

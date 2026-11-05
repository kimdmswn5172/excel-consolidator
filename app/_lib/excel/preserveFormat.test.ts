// 서식이 많은 마스터를 취합해도 마스터의 서식이 그대로 남는지 시험한다. (PRD 원칙: 마스터의 원래 서식 보존, 원본은 바꾸지 않음)
// "기본 서식 적용"을 끈 기본 상태의 결과 파일을 원본과 비교한다. 값을 쓴 칸의 값만 달라야 한다.
// 실행: npm run test
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { AppliedValue } from "../merge/consolidate";
import { buildResultFile } from "./writeResult";

const settings = { sheetName: "Sheet1", keyColumn: 1, targetColumns: [3, 4], headerRow: 2, dataStartRow: 3 };

// 서식을 최대한 많이 넣은 마스터: 글꼴·색·테두리·표시 형식·정렬·병합·너비·높이·숨김 열·고정·입력 제한·조건부 서식·메모·두 번째 시트
async function richMaster(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Sheet1", { properties: { tabColor: { argb: "FFFF6600" } }, views: [{ state: "frozen", ySplit: 2 }], pageSetup: { orientation: "landscape", fitToPage: true } });
  ws.mergeCells("A1:E1");
  ws.getCell("A1").value = "2026 교육 현황";
  ws.getCell("A1").style = { font: { bold: true, size: 16, color: { argb: "FFC00000" } }, alignment: { horizontal: "center" }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } } };
  ["사번", "이름", "교육이수", "이수일", "점수"].forEach((h, i) => {
    ws.getCell(2, i + 1).value = h;
    ws.getCell(2, i + 1).style = { font: { bold: true, name: "맑은 고딕" }, border: { bottom: { style: "double", color: { argb: "FF000000" } } }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } } };
  });
  for (let r = 3; r <= 8; r++) {
    ws.getCell(r, 1).value = `S000${r - 2}`;
    ws.getCell(r, 2).value = `직원${r - 2}`;
    ws.getCell(r, 2).style = { font: { italic: true, color: { argb: "FF0070C0" } }, alignment: { wrapText: true, vertical: "top" } };
    ws.getCell(r, 4).numFmt = "yyyy-mm-dd";
    ws.getCell(r, 4).style = { numFmt: "yyyy-mm-dd", font: { color: { argb: "FF00B050" } }, border: { left: { style: "thin" }, right: { style: "thin" } } };
    ws.getCell(r, 5).value = r * 10;
    ws.getCell(r, 5).numFmt = '#,##0.0"점"';
  }
  ws.getCell("C3").value = "미이수"; // 마스터에 이미 값이 있던 칸 (부서 값으로 바뀐다)
  ws.getCell("C3").style = { font: { bold: true, color: { argb: "FFFF0000" } }, fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFCE4D6" } } };
  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 22;
  ws.getColumn(4).hidden = true;
  ws.getRow(3).height = 30;
  for (let r = 3; r <= 8; r++) ws.getCell(r, 3).dataValidation = { type: "list", allowBlank: true, formulae: ['"이수,미이수"'] };
  ws.addConditionalFormatting({ ref: "E3:E8", rules: [{ type: "cellIs", operator: "greaterThan", formulae: [60], priority: 1, style: { font: { bold: true, color: { argb: "FF9C0006" } } } }] });
  ws.getCell("A3").note = "사번은 인사팀 기준";
  ws.getCell("E9").value = { formula: "SUM(E3:E8)", result: 0 }; // 수식 칸
  // 1x1 그림 하나 (로고 같은 그림이 들어 있는 마스터를 흉내 낸다)
  const png = wb.addImage({ base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", extension: "png" });
  ws.addImage(png, { tl: { col: 6, row: 1 }, ext: { width: 40, height: 40 } });
  const other = wb.addWorksheet("메모시트");
  other.getCell("A1").value = "건드리면 안 되는 시트";
  other.getCell("A1").style = { font: { bold: true, size: 20 } };
  const out = await wb.xlsx.writeBuffer();
  return (out as ArrayBuffer).slice(0);
}

const applied: AppliedValue[] = [
  { key: "s0001", masterRow: 3, column: 3, previousValue: "미이수", newValue: "이수", sourceFile: "부서A.xlsx" },
  { key: "s0002", masterRow: 4, column: 3, previousValue: null, newValue: "이수", sourceFile: "부서A.xlsx" },
  { key: "s0002", masterRow: 4, column: 4, previousValue: null, newValue: new Date(Date.UTC(2026, 2, 5)), sourceFile: "부서A.xlsx" },
];

// ExcelJS가 실제로는 갖고 있지만 타입에는 없는 조건부 서식 목록
const conditionalOf = (sheet: ExcelJS.Worksheet) => (sheet as unknown as { conditionalFormattings: unknown[] }).conditionalFormattings;

async function load(buffer: ArrayBuffer | Uint8Array) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer instanceof Uint8Array ? (buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer) : buffer);
  return wb;
}

describe("마스터 서식 보존 (기본 서식 적용 끔)", async () => {
  const original = await richMaster();
  const resultBytes = await buildResultFile(original, applied, settings);
  const [before, after] = [await load(original), await load(resultBytes)];
  const [a, b] = [before.getWorksheet("Sheet1")!, after.getWorksheet("Sheet1")!];
  const changed = new Set(applied.map((v) => `${v.masterRow}:${v.column}`));

  it("값을 쓴 칸의 값만 바뀌고, 다른 모든 칸의 값은 그대로다", () => {
    for (let r = 1; r <= 9; r++) {
      for (let c = 1; c <= 6; c++) {
        if (changed.has(`${r}:${c}`)) continue;
        expect(String(b.getCell(r, c).value)).toBe(String(a.getCell(r, c).value));
      }
    }
    expect(b.getCell("C3").value).toBe("이수");
    expect(b.getCell("C4").value).toBe("이수");
  });

  it("모든 칸의 서식(글꼴·색·테두리·정렬·표시 형식)이 값을 쓴 칸까지 포함해 그대로다", () => {
    for (let r = 1; r <= 9; r++) {
      for (let c = 1; c <= 6; c++) {
        const [x, y] = [a.getCell(r, c), b.getCell(r, c)];
        expect({ at: `${r}:${c}`, font: y.font, fill: y.fill, border: y.border, alignment: y.alignment, numFmt: y.numFmt }).toEqual({
          at: `${r}:${c}`,
          font: x.font,
          fill: x.fill,
          border: x.border,
          alignment: x.alignment,
          numFmt: x.numFmt,
        });
      }
    }
  });

  it("병합, 열 너비·숨김, 행 높이, 고정, 탭 색, 용지 방향이 그대로다", () => {
    expect(b.model.merges).toEqual(a.model.merges);
    expect([1, 2, 3, 4, 5].map((c) => b.getColumn(c).width)).toEqual([1, 2, 3, 4, 5].map((c) => a.getColumn(c).width));
    expect(b.getColumn(4).hidden).toBe(true);
    expect(b.getRow(3).height).toBe(30);
    expect(b.views[0]).toMatchObject({ state: "frozen", ySplit: 2 });
    expect(b.properties.tabColor).toEqual(a.properties.tabColor);
    expect(b.pageSetup.orientation).toBe("landscape");
  });

  it("입력 제한(드롭다운), 조건부 서식, 메모가 그대로다", () => {
    expect(b.getCell("C5").dataValidation).toEqual(a.getCell("C5").dataValidation);
    expect(b.getCell("C5").dataValidation?.type).toBe("list");
    expect(conditionalOf(b)).toEqual(conditionalOf(a));
    expect(conditionalOf(b).length).toBeGreaterThan(0);
    expect(JSON.stringify(b.getCell("A3").note)).toContain("사번은 인사팀 기준");
  });

  it("수식 칸과 그림이 그대로 남는다", () => {
    expect(b.getCell("E9").value).toMatchObject({ formula: "SUM(E3:E8)" });
    expect(b.getImages()).toHaveLength(a.getImages().length);
    expect(b.getImages().length).toBe(1);
  });

  it("다른 시트는 건드리지 않는다", () => {
    const [x, y] = [before.getWorksheet("메모시트")!, after.getWorksheet("메모시트")!];
    expect(y.getCell("A1").value).toBe(x.getCell("A1").value);
    expect(y.getCell("A1").font).toEqual(x.getCell("A1").font);
  });

  it("원본 파일 내용(바이트)은 취합 뒤에도 그대로다", async () => {
    const copy = original.slice(0);
    await buildResultFile(original, applied, settings);
    expect(Buffer.from(original).equals(Buffer.from(copy))).toBe(true);
  });
});

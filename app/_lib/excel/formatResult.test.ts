// 결과 파일 기본 서식(PLAN 26번)을 시험한다. 실행: npm run test
// 확인할 것: 서식을 켰을 때만 입히고, 값·병합 셀·행 순서는 어떤 경우에도 그대로이며, 꺼져 있으면 마스터의 원래 서식을 그대로 둔다.
import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { ConsolidationSettings } from "../types";
import { consolidate } from "../merge/consolidate";
import { readWorkbookFromBuffer } from "./readWorkbook";
import { displayWidth } from "./formatResult";
import { buildResultFile } from "./writeResult";

const settings: ConsolidationSettings = { sheetName: "Sheet1", keyColumn: 2, targetColumns: [5, 6, 7, 8], headerRow: 3, dataStartRow: 4 };

async function bytesOf(relative: string): Promise<ArrayBuffer> {
  const buf = await readFile(path.join(process.cwd(), "samples", relative));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

async function load(relative: string) {
  const result = await readWorkbookFromBuffer(await bytesOf(relative), path.basename(relative));
  if (!result.ok) throw new Error(result.skipped.message);
  return result.workbook;
}

async function sheetOf(bytes: Uint8Array): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  return workbook.getWorksheet("Sheet1")!;
}

const values = (sheet: ExcelJS.Worksheet) => {
  const out: string[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, r) => row.eachCell({ includeEmpty: false }, (cell, c) => out.push(`${r}:${c}=${String(cell.value)}`)));
  return out;
};

describe("displayWidth", () => {
  it("한글은 2칸, 영문·숫자는 1칸으로 센다", () => {
    expect(displayWidth("사번")).toBe(4);
    expect(displayWidth("ID12")).toBe(4);
    expect(displayWidth("교육이수 A")).toBe(10);
  });
});

describe("기본 서식 (연습용 마스터 + 부서18: 데이터 아래 병합 안내가 있는 파일)", async () => {
  const masterBytes = await bytesOf("마스터.xlsx");
  const master = await load("마스터.xlsx");
  const outcome = consolidate(master, [await load("부서/부서01.xlsx"), await load("부서/부서02.xlsx")], settings);

  const plain = await buildResultFile(masterBytes, outcome.appliedValues, settings);
  const formatted = await buildResultFile(masterBytes, outcome.appliedValues, settings, { applyBasicFormat: true });

  it("서식을 켜도 값·병합 셀·행 순서는 꺼진 결과와 똑같다", async () => {
    const [a, b] = [await sheetOf(plain), await sheetOf(formatted)];
    expect(values(b)).toEqual(values(a));
    expect(b.model.merges).toEqual(a.model.merges);
    expect(b.rowCount).toBe(a.rowCount);
  });

  it("켜면 헤더 행에 굵은 글씨·배경색·가운데 정렬이 들어간다", async () => {
    const sheet = await sheetOf(formatted);
    for (let c = 1; c <= 8; c++) {
      const cell = sheet.getCell(3, c);
      expect(cell.font?.bold).toBe(true);
      expect(cell.fill).toMatchObject({ type: "pattern", pattern: "solid" });
      expect(cell.alignment?.horizontal).toBe("center");
    }
    expect(sheet.getCell(4, 2).font?.bold).not.toBe(true); // 데이터 행은 굵게 하지 않는다
  });

  it("켜면 헤더와 데이터 영역에 테두리가 생기고, 제목 줄과 데이터 아래는 건드리지 않는다", async () => {
    const sheet = await sheetOf(formatted);
    expect(sheet.getCell(3, 1).border?.top?.style).toBe("thin");
    expect(sheet.getCell(103, 8).border?.bottom?.style).toBe("thin"); // 마지막 데이터 행(100명, 4~103행)
    expect(sheet.getCell(1, 1).border?.top?.style).toBeUndefined(); // 제목 줄
    expect(sheet.getCell(104, 2).border?.top?.style).toBeUndefined(); // 데이터 아래
  });

  it("켜면 열 너비를 필요한 만큼만 넓히고(줄이지 않음), 머리글 행이 고정된다", async () => {
    const [before, after] = [await sheetOf(plain), await sheetOf(formatted)];
    expect(after.getColumn(2).width).toBeGreaterThanOrEqual(before.getColumn(2).width ?? 0); // 마스터의 B열 너비(12)를 줄이지 않는다
    expect(after.getColumn(6).width).toBeGreaterThanOrEqual(12); // 날짜 열
    expect(after.views?.[0]).toMatchObject({ state: "frozen", ySplit: 3 });
  });

  it("날짜 칸의 표시 형식(numFmt)은 서식을 켜도 그대로 남는다", async () => {
    const [a, b] = [await sheetOf(plain), await sheetOf(formatted)];
    expect(b.getCell(10, 6).numFmt).toBe(a.getCell(10, 6).numFmt);
    expect(b.getCell(10, 6).numFmt).toBeTruthy();
  });

  it("끄면 서식을 입히지 않는다 (마스터 원래 모양 그대로)", async () => {
    const sheet = await sheetOf(plain);
    expect(sheet.getCell(3, 1).fill).toBeUndefined();
    expect(sheet.getCell(3, 1).border).toBeUndefined();
    expect(sheet.views?.[0]?.state).not.toBe("frozen");
  });

  it("서식에 필요한 조건(기준 열·헤더 행·시작 행)이 없으면 서식은 건너뛰고 값만 쓴다", async () => {
    const bytes = await buildResultFile(masterBytes, outcome.appliedValues, { sheetName: "Sheet1" }, { applyBasicFormat: true });
    expect((await sheetOf(bytes)).getCell(3, 1).fill).toBeUndefined();
  });
});

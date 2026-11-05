// 성공 기준 "취합 후 누락·오류 0건"을 연습용 파일 전체(마스터 + 부서 20개)로 확인한다. (PRD 3번 측정 방법, PLAN 23번)
// 취합 엔진과는 별개로, 엑셀 파일을 ExcelJS로 직접 읽어 "정답"을 따로 계산해 비교한다.
//  - 오류: 값이 엉뚱한 칸에 들어간 경우. 정답과 다른 칸이 하나라도 있으면 오류다.
//  - 누락: 부서 파일에 값이 있는데 결과에 없고, 그 이유도 사용자에게 안내되지 않은 칸.
//    (미매칭, 중복 보류, 점검에서 제외된 파일로 안내된 것은 누락으로 세지 않는다)
// 실행: npm run test
import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildResultFile } from "../excel/writeResult";
import { readWorkbookFromBuffer } from "../excel/readWorkbook";
import type { ConsolidationSettings, WorkbookData } from "../types";
import { consolidate } from "./consolidate";
import { inspectAll } from "./inspectAll";

const SAMPLES = path.join(process.cwd(), "samples");
const settings: ConsolidationSettings = { sheetName: "Sheet1", keyColumn: 2, targetColumns: [5, 6, 7, 8], headerRow: 3, dataStartRow: 4 };

async function bytesOf(relative: string): Promise<ArrayBuffer> {
  const buf = await readFile(path.join(SAMPLES, relative));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

async function loadWorkbook(relative: string): Promise<WorkbookData> {
  const result = await readWorkbookFromBuffer(await bytesOf(relative), path.basename(relative));
  if (!result.ok) throw new Error(result.skipped.message);
  return result.workbook;
}

// ───── 정답 계산용: 엔진을 거치지 않고 ExcelJS로 직접 읽는다 ─────
type Raw = { key: string; row: number; values: Map<number, string> }; // values: 대상 열 → 값(글자로 통일, 빈 칸은 없음)

const text = (value: unknown): string | null => {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
};
const normalizeKey = (value: unknown) => (text(value) ?? "").normalize("NFKC").trim().toLowerCase();

async function rawRows(buffer: ArrayBuffer): Promise<{ rows: Raw[]; sheet: ExcelJS.Worksheet }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet("Sheet1")!;
  const rows: Raw[] = [];
  for (let r = settings.dataStartRow; r <= sheet.rowCount; r++) {
    const keyCell = sheet.getCell(r, settings.keyColumn);
    // 가로로 병합된 안내 문구(예: 부서18의 A10:H10)는 병합 범위의 모든 칸이 같은 글자를 돌려주므로 키가 아니다
    if (keyCell.isMerged && keyCell.master.address !== keyCell.address) continue;
    const key = normalizeKey(keyCell.value);
    if (key === "") continue;
    const values = new Map<number, string>();
    for (const c of settings.targetColumns) {
      const v = text(sheet.getCell(r, c).value);
      if (v !== null) values.set(c, v);
    }
    rows.push({ key, row: r, values });
  }
  return { rows, sheet };
}

const EXCLUDED = ["부서09.xlsx", "부서15.xlsx"]; // README: 병합 셀 위험, 헤더 다름

describe("성공 기준: 누락·오류 0건 (연습용 마스터 + 부서 20개)", async () => {
  const masterBytes = await bytesOf("마스터.xlsx");
  const master = await loadWorkbook("마스터.xlsx");
  const names = Array.from({ length: 20 }, (_, i) => `부서${String(i + 1).padStart(2, "0")}.xlsx`);
  const departments = await Promise.all(names.map((name) => loadWorkbook(`부서/${name}`)));
  const inspection = inspectAll({ representative: departments[0], master, departments, unreadable: [], settings });

  it("점검이 제외하는 파일은 정확히 부서09(병합 셀)와 부서15(헤더 다름)이고 이유가 안내된다", () => {
    expect(inspection.excludedFiles.map((f) => f.fileName).sort()).toEqual(EXCLUDED);
    for (const file of inspection.excludedFiles) expect(file.message.length).toBeGreaterThan(10);
    expect(inspection.passedDepartments).toHaveLength(18);
  });

  it("결과(화면용 데이터와 다운로드 파일)가 따로 계산한 정답과 모든 칸에서 같다 — 오류 0건", async () => {
    // 중복 키는 비워 두기로 처리(가장 보수적). 정답도 같은 규칙으로 계산한다.
    const outcome = consolidate(master, inspection.passedDepartments, settings, { mode: "all", strategy: "leave-blank" });

    const masterRaw = await rawRows(masterBytes);
    const masterRowByKey = new Map(masterRaw.rows.map((r) => [r.key, r]));

    const passedNames = new Set(inspection.passedDepartments.map((d) => d.fileName));
    const deptRaw = await Promise.all(names.map(async (name) => ({ name, ...(await rawRows(await bytesOf(`부서/${name}`))) })));
    const counts = new Map<string, number>();
    for (const d of deptRaw.filter((d) => passedNames.has(d.name))) for (const r of d.rows) counts.set(r.key, (counts.get(r.key) ?? 0) + 1);

    // 정답: 마스터 원래 값 위에 "마스터에 있고 중복이 아닌 키"의 부서 값(비어 있지 않은 것)만 덮어쓴다
    const expected = new Map<string, string>(); // "행:열" → 값
    for (const r of masterRaw.rows) for (const [c, v] of r.values) expected.set(`${r.row}:${c}`, v);
    for (const d of deptRaw.filter((d) => passedNames.has(d.name))) {
      for (const r of d.rows) {
        const target = masterRowByKey.get(r.key);
        if (!target || (counts.get(r.key) ?? 0) > 1) continue;
        for (const [c, v] of r.values) expected.set(`${target.row}:${c}`, v);
      }
    }

    // 다운로드 파일을 실제로 만들어 다시 읽어서 비교한다
    const bytes = await buildResultFile(masterBytes, outcome.appliedValues, settings);
    const resultBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const result = await rawRows(resultBuffer);
    const actual = new Map<string, string>();
    for (const r of result.rows) for (const [c, v] of r.values) actual.set(`${r.row}:${c}`, v);

    const wrong = [...new Set([...expected.keys(), ...actual.keys()])].filter((k) => expected.get(k) !== actual.get(k));
    expect(wrong).toEqual([]); // 엉뚱한 값이 들어가거나 빠진 칸이 없어야 한다

    // 값을 채운 칸이 충분히 많은지(빈 결과가 우연히 같아지는 것을 막는다)
    expect(outcome.appliedValues.length).toBeGreaterThan(200);

    // 마스터의 다른 열(A~D)과 제목 줄 병합, 열 너비 같은 모양은 그대로여야 한다
    const original = masterRaw.sheet;
    for (let r = 1; r <= original.rowCount; r++) {
      for (let c = 1; c <= 4; c++) expect(text(result.sheet.getCell(r, c).value)).toBe(text(original.getCell(r, c).value));
    }
    expect(result.sheet.model.merges).toEqual(original.model.merges);
    expect(result.sheet.getColumn(2).width).toBe(original.getColumn(2).width);
  });

  it("부서 파일에 있는 모든 값은 결과에 반영되었거나 이유가 안내된다 — 누락 0건", async () => {
    const outcome = consolidate(master, inspection.passedDepartments, settings, { mode: "all", strategy: "leave-blank" });
    const excluded = new Set(inspection.excludedFiles.map((f) => f.fileName));
    const unmatched = new Set(outcome.unmatchedKeys.map((u) => `${u.fileName}:${u.row}`));
    const duplicateKeys = new Set(outcome.duplicateKeys.map((d) => d.key));
    const landed = new Set(outcome.appliedValues.map((a) => `${a.sourceFile}:${a.masterRow}:${a.column}`));

    const masterRowByKey = new Map((await rawRows(masterBytes)).rows.map((r) => [r.key, r.row]));
    const unexplained: string[] = [];
    for (const name of names) {
      const { rows } = await rawRows(await bytesOf(`부서/${name}`));
      for (const r of rows) {
        const masterRow = masterRowByKey.get(r.key);
        for (const c of r.values.keys()) {
          const accounted =
            excluded.has(name) || // 점검에서 제외된 파일: 3단계·결과 화면에 이유와 함께 안내
            masterRow === undefined || // 마스터에 없는 키: 미매칭 목록
            duplicateKeys.has(r.key) || // 중복 키: 중복 목록
            landed.has(`${name}:${masterRow}:${c}`);
          if (!accounted) unexplained.push(`${name} ${r.row}행 ${c}열`);
        }
        if (masterRow === undefined && !excluded.has(name)) {
          expect(unmatched.has(`${name}:${r.row}`)).toBe(true); // 미매칭은 반드시 목록에 있어야 한다
        }
      }
    }
    expect(unexplained).toEqual([]);
  });

  it("원본 마스터와 부서 파일 내용은 취합 뒤에도 그대로다", () => {
    const before = structuredClone(master);
    consolidate(master, inspection.passedDepartments, settings, { mode: "all", strategy: "first" });
    expect(master).toEqual(before);
  });
});

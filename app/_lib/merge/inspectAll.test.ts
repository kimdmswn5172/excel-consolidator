// 취합 전 점검 묶음(inspectAll)을 연습용 파일로 시험한다. 실행: npm run test
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readWorkbookFromBuffer } from "../excel/readWorkbook";
import type { ConsolidationSettings, SkippedFile, WorkbookData } from "../types";
import { inspectAll } from "./inspectAll";

const settings: ConsolidationSettings = { sheetName: "Sheet1", keyColumn: 2, targetColumns: [5, 6, 7, 8], headerRow: 3, dataStartRow: 4 };

async function load(relative: string): Promise<WorkbookData> {
  const bytes = await readFile(path.join(process.cwd(), "samples", relative));
  const result = await readWorkbookFromBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer, path.basename(relative));
  if (!result.ok) throw new Error(result.skipped.message);
  return result.workbook;
}

describe("inspectAll (연습용 파일)", () => {
  it("문제없는 파일만 있으면 판단할 것이 없어 3단계를 건너뛴다", async () => {
    const master = await load("마스터.xlsx");
    const departments = [await load("부서/부서01.xlsx"), await load("부서/부서02.xlsx")];
    const result = inspectAll({ representative: departments[0], master, departments, unreadable: [], settings });
    expect(result.needsReview).toBe(false);
    expect(result.canContinue).toBe(true);
    expect(result.passedDepartments).toHaveLength(2);
  });

  it("헤더가 다른 파일(부서15)과 병합 위험 파일(부서09)을 이유와 함께 제외한다", async () => {
    const master = await load("마스터.xlsx");
    const departments = [await load("부서/부서01.xlsx"), await load("부서/부서09.xlsx"), await load("부서/부서15.xlsx"), await load("부서/부서18.xlsx")];
    const result = inspectAll({ representative: departments[0], master, departments, unreadable: [], settings });
    expect(result.excludedFiles.map((f) => [f.fileName, f.reason])).toEqual([
      ["부서15.xlsx", "header-mismatch"],
      ["부서09.xlsx", "merged-cell-risk"],
    ]);
    expect(result.passedDepartments.map((d) => d.fileName)).toEqual(["부서01.xlsx", "부서18.xlsx"]); // 부서18은 데이터 아래 병합이라 통과
    expect(result.needsReview).toBe(true);
  });

  it("읽지 못한 파일을 제외 목록 맨 앞에 합친다", async () => {
    const master = await load("마스터.xlsx");
    const departments = [await load("부서/부서01.xlsx")];
    const unreadable: SkippedFile[] = [{ fileName: "손상.xlsx", reason: "unreadable", message: "손상되었습니다." }];
    const result = inspectAll({ representative: departments[0], master, departments, unreadable, settings });
    expect(result.excludedFiles.map((f) => f.fileName)).toEqual(["손상.xlsx"]);
    expect(result.needsReview).toBe(true);
    expect(result.canContinue).toBe(true);
  });

  it("마스터 헤더가 다르면 경고만 하고 계속할 수 있다", async () => {
    const master = await load("예외/마스터_헤더다름.xlsx");
    const departments = [await load("부서/부서01.xlsx")];
    const result = inspectAll({ representative: departments[0], master, departments, unreadable: [], settings });
    expect(result.masterWarnings).toHaveLength(1);
    expect(result.needsReview).toBe(true);
    expect(result.canContinue).toBe(true);
  });

  it("중복 키(부서07)가 있으면 3단계에서 고르게 한다", async () => {
    const master = await load("마스터.xlsx");
    const departments = [await load("부서/부서07.xlsx")];
    const result = inspectAll({ representative: departments[0], master, departments, unreadable: [], settings });
    expect(result.duplicateKeys.map((d) => d.key)).toEqual(["s0032"]);
    expect(result.needsReview).toBe(true);
  });

  it("취합할 부서 파일이 하나도 남지 않으면 계속할 수 없다", async () => {
    const master = await load("마스터.xlsx");
    const rep = await load("부서/부서01.xlsx");
    const departments = [await load("부서/부서09.xlsx")];
    const result = inspectAll({ representative: rep, master, departments, unreadable: [], settings });
    expect(result.passedDepartments).toEqual([]);
    expect(result.canContinue).toBe(false);
  });
});

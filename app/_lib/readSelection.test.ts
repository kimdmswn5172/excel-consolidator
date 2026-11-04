// 고른 파일 읽기를 시험한다. 실행: npm run test
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readSelection } from "./readSelection";

async function sampleFile(relPath: string): Promise<File> {
  const bytes = await readFile(path.resolve(process.cwd(), "samples", relPath));
  return new File([new Uint8Array(bytes)], path.basename(relPath));
}

describe("readSelection", () => {
  it("마스터와 부서 파일을 읽고, 읽지 못한 부서 파일은 이유와 함께 모은다", async () => {
    const progress: string[] = [];
    const result = await readSelection(
      await sampleFile("마스터.xlsx"),
      [await sampleFile("부서/부서01.xlsx"), await sampleFile("예외/손상.xlsx"), await sampleFile("부서/부서02.xlsx")],
      (done, total) => progress.push(`${done}/${total}`),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.master.fileName).toBe("마스터.xlsx");
    expect(result.departments.map((w) => w.fileName)).toEqual(["부서01.xlsx", "부서02.xlsx"]);
    expect(result.skipped.map((s) => [s.fileName, s.reason])).toEqual([["손상.xlsx", "unreadable"]]);
    expect(progress).toEqual(["0/4", "1/4", "2/4", "3/4", "4/4"]);
  });

  it("마스터를 읽지 못하면 진행하지 않는다", async () => {
    const result = await readSelection(await sampleFile("예외/손상.xlsx"), [await sampleFile("부서/부서01.xlsx")]);
    expect(result).toEqual({ ok: false, message: expect.stringContaining("마스터 표를 읽을 수 없습니다.") });
  });

  it("부서 파일을 하나도 읽지 못하면 진행하지 않는다", async () => {
    const result = await readSelection(await sampleFile("마스터.xlsx"), [await sampleFile("예외/손상.xlsx")]);
    expect(result).toEqual({ ok: false, message: expect.stringContaining("부서 파일을 하나도 읽을 수 없습니다.") });
  });
});

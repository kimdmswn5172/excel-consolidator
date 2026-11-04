// 기준 키 정리를 시험한다. 실행: npm run test
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readWorkbookFromBuffer } from "../excel/readWorkbook";
import type { CellValue } from "../types";
import { normalizeKey } from "./normalizeKey";

describe("normalizeKey", () => {
  it("앞뒤 공백을 지운다", () => {
    expect(normalizeKey("  A01  ")).toBe("a01");
    expect(normalizeKey("s0052 ")).toBe("s0052");
  });

  it("영문 대소문자를 통일한다", () => {
    expect(normalizeKey("S0052")).toBe(normalizeKey("s0052"));
  });

  it("전각 문자를 반각으로 바꾼다", () => {
    expect(normalizeKey("Ｓ0053")).toBe("s0053");
    expect(normalizeKey("０００１")).toBe("0001");
  });

  it("전각 공백과 줄바꿈 없는 공백도 앞뒤에서 지운다", () => {
    expect(normalizeKey("　A01")).toBe("a01");
    expect(normalizeKey("A01 ")).toBe("a01");
  });

  it("눈에 보이지 않는 글자를 지운다", () => {
    expect(normalizeKey("A​01")).toBe("a01");
    expect(normalizeKey("﻿A01")).toBe("a01");
  });

  it("글자 사이의 공백은 그대로 둔다", () => {
    expect(normalizeKey("S 0052")).toBe("s 0052");
    expect(normalizeKey("S 0052")).not.toBe(normalizeKey("S0052"));
  });

  it("앞자리 0을 지우지 않는다", () => {
    expect(normalizeKey("00101")).toBe("00101");
    expect(normalizeKey("00101")).not.toBe(normalizeKey(101));
  });

  it("숫자와 참/거짓을 텍스트로 바꾼다", () => {
    expect(normalizeKey(101)).toBe("101");
    expect(normalizeKey(true)).toBe("true");
  });

  it("날짜는 날짜 부분만 쓴다", () => {
    expect(normalizeKey(new Date(Date.UTC(2026, 2, 1, 15, 30)))).toBe("2026-03-01");
  });

  it("한글이 자모로 풀려 있어도 같은 키로 본다", () => {
    expect(normalizeKey("홍길동".normalize("NFD"))).toBe(normalizeKey("홍길동"));
  });

  it("비어 있으면 키가 아니다(null)", () => {
    expect(normalizeKey(null)).toBeNull();
    expect(normalizeKey("")).toBeNull();
    expect(normalizeKey("   ")).toBeNull();
    expect(normalizeKey("​")).toBeNull();
  });
});

// 연습용 파일로 실제 효과를 확인한다: 정리하지 않으면 부서11의 두 키가 마스터에서 못 찾아진다.
describe("연습용 파일의 키 맞추기", () => {
  async function readKeys(relPath: string): Promise<CellValue[]> {
    const file = await readFile(path.resolve(process.cwd(), "samples", relPath));
    const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
    const result = await readWorkbookFromBuffer(buffer, path.basename(relPath));
    if (!result.ok) throw new Error(result.skipped.message);
    // 기준 열은 B열(2번째), 데이터는 4행(4번째 줄)부터
    return result.workbook.sheets[0].cells.slice(3).map((row) => row[1]);
  }

  it("부서 파일 20개의 키 중 마스터에 없는 것은 정리 후 S9999 하나뿐이다", async () => {
    const masterKeys = await readKeys("마스터.xlsx");
    const masterRaw = new Set(masterKeys.filter((key) => key !== null).map(String));
    const masterNormalized = new Set(masterKeys.map(normalizeKey).filter((key) => key !== null));

    const rawUnmatched: string[] = [];
    const normalizedUnmatched: string[] = [];
    for (let k = 1; k <= 20; k++) {
      const keys = await readKeys(`부서/부서${String(k).padStart(2, "0")}.xlsx`);
      for (const key of keys) {
        if (key === null) continue; // 병합되어 비어 있는 칸
        if (!masterRaw.has(String(key))) rawUnmatched.push(String(key));
        const normalized = normalizeKey(key);
        if (normalized !== null && !masterNormalized.has(normalized)) normalizedUnmatched.push(String(key));
      }
    }

    expect(rawUnmatched.sort()).toEqual(["S9999", "s0052 ", "Ｓ0053"].sort());
    expect(normalizedUnmatched).toEqual(["S9999"]);
  });
});

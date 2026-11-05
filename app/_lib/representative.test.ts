// 대표 파일 고르기를 시험한다. 실행: npm run test
import { describe, expect, it } from "vitest";
import type { WorkbookData } from "./types";
import { canPickAnother, pickRepresentative } from "./representative";

const book = (fileName: string): WorkbookData => ({ fileName, sheets: [] });
const [a, b, c] = [book("a"), book("b"), book("c")];

describe("pickRepresentative", () => {
  it("무작위 값에 따라 후보 중 하나를 고른다", () => {
    expect(pickRepresentative([a, b, c], undefined, () => 0)).toBe(a);
    expect(pickRepresentative([a, b, c], undefined, () => 0.5)).toBe(b);
    expect(pickRepresentative([a, b, c], undefined, () => 0.999)).toBe(c);
  });

  it("다시 뽑을 때는 지금 대표 파일을 빼고 고른다", () => {
    for (const r of [0, 0.3, 0.6, 0.999]) {
      expect(pickRepresentative([a, b, c], b, () => r)).not.toBe(b);
    }
  });

  it("파일이 없거나 하나뿐이면 다시 뽑을 수 없다", () => {
    expect(pickRepresentative([], undefined)).toBeNull();
    expect(pickRepresentative([a], a)).toBeNull();
    expect(canPickAnother([a])).toBe(false);
    expect(canPickAnother([a, b])).toBe(true);
  });

  it("random이 1을 돌려줘도 범위를 벗어나지 않는다", () => {
    expect(pickRepresentative([a, b], undefined, () => 1)).toBe(b);
  });
});

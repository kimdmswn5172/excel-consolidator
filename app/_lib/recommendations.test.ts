// AI 추천 Yes/No 확정 규칙을 시험한다. 실행: npm run test
import { describe, expect, it } from "vitest";
import { conditionsBlockedReason, decisionsToSettings, initialDecisions } from "./conditions";
import { acceptBlockedReason, acceptRecommendation, recommendedText, rejectRecommendation } from "./recommendations";
import type { AiRecommendation, Recommended } from "./types";

const rec = <T>(value: T | null, confidence: number | null): Recommended<T> => ({
  value,
  confidence,
  status: value === null || confidence === null ? "unavailable" : confidence >= 70 ? "recommended" : "needs-check",
});

const ai: AiRecommendation = {
  sheetName: rec("Sheet1", 88),
  keyColumn: rec(2, 92),
  targetColumns: rec([5, 6, 7, 8], 64), // 확인 필요
  headerRow: rec(3, 95),
  dataStartRow: rec(4, 95),
};

describe("Yes (추천 그대로 확정)", () => {
  it("시트를 먼저 확정하고 나머지를 차례로 확정하면 취합 조건이 된다", () => {
    let d = initialDecisions;
    for (const key of ["sheetName", "keyColumn", "targetColumns", "headerRow", "dataStartRow"] as const) {
      d = acceptRecommendation(d, ai, key);
    }
    expect(d.keyColumn).toEqual({ state: "confirmed", value: 2, by: "ai" });
    expect(conditionsBlockedReason(d)).toBeNull();
    expect(decisionsToSettings(d)).toEqual({ sheetName: "Sheet1", keyColumn: 2, targetColumns: [5, 6, 7, 8], headerRow: 3, dataStartRow: 4 });
  });

  it("시트를 확정하기 전에는 다른 항목을 받아들일 수 없다", () => {
    expect(acceptBlockedReason(initialDecisions, ai, "keyColumn")).toContain("시트");
    expect(acceptRecommendation(initialDecisions, ai, "keyColumn")).toBe(initialDecisions);
  });

  it("AI가 추천한 시트와 다른 시트를 직접 골랐다면 나머지 추천은 받아들일 수 없다", () => {
    const other = { ...initialDecisions, sheetName: { state: "confirmed" as const, value: "Sheet2", by: "user" as const } };
    expect(acceptBlockedReason(other, ai, "keyColumn")).toContain("다른 시트");
  });

  it("추천 불가 항목은 Yes를 누를 수 없다", () => {
    const partly: AiRecommendation = { ...ai, dataStartRow: rec<number>(null, null) };
    const d = acceptRecommendation(initialDecisions, partly, "sheetName");
    expect(acceptBlockedReason(d, partly, "dataStartRow")).toContain("직접");
    expect(acceptRecommendation(d, partly, "dataStartRow")).toBe(d);
  });

  it("신뢰도가 낮은 '확인 필요' 항목도 사용자가 Yes로 받아들일 수 있다", () => {
    const d = acceptRecommendation(initialDecisions, ai, "sheetName");
    expect(acceptBlockedReason(d, ai, "targetColumns")).toBeNull();
  });

  it("추천 대상 열이 확정한 기준 열과 겹치면 받아들이지 않는다", () => {
    const overlapping: AiRecommendation = { ...ai, targetColumns: rec([2, 3], 90) };
    let d = acceptRecommendation(initialDecisions, overlapping, "sheetName");
    d = acceptRecommendation(d, overlapping, "keyColumn");
    expect(acceptBlockedReason(d, overlapping, "targetColumns")).toContain("기준 열");
  });

  it("기준 열 추천이 이미 확정한 대상 열과 겹치면 대상 열 확정을 풀어 다시 정하게 한다", () => {
    const base = { ...initialDecisions, sheetName: { state: "confirmed" as const, value: "Sheet1", by: "user" as const }, targetColumns: { state: "confirmed" as const, value: [2, 5], by: "user" as const } };
    expect(acceptRecommendation(base, ai, "keyColumn").targetColumns).toEqual({ state: "pending" });
  });

  it("같은 시트를 다시 Yes해도 나머지 확정은 그대로 두고, 다른 시트면 나머지를 비운다", () => {
    let d = acceptRecommendation(initialDecisions, ai, "sheetName");
    d = acceptRecommendation(d, ai, "headerRow");
    expect(acceptRecommendation(d, ai, "sheetName").headerRow.state).toBe("confirmed");
    const other = { ...d, sheetName: { state: "confirmed" as const, value: "Sheet2", by: "user" as const } };
    expect(acceptRecommendation(other, ai, "sheetName").headerRow.state).toBe("pending");
  });
});

describe("No (직접 선택으로)", () => {
  it("항목 하나의 확정을 취소한다", () => {
    let d = acceptRecommendation(initialDecisions, ai, "sheetName");
    d = acceptRecommendation(d, ai, "keyColumn");
    const after = rejectRecommendation(d, "keyColumn");
    expect(after.keyColumn).toEqual({ state: "pending" });
    expect(after.sheetName.state).toBe("confirmed");
  });

  it("시트를 취소하면 모든 항목을 처음으로 돌린다", () => {
    let d = acceptRecommendation(initialDecisions, ai, "sheetName");
    d = acceptRecommendation(d, ai, "keyColumn");
    expect(rejectRecommendation(d, "sheetName")).toEqual(initialDecisions);
  });
});

describe("recommendedText", () => {
  it("추천을 화면용 글자로 바꾸고 추천 불가는 null이다", () => {
    expect(recommendedText(ai, "sheetName")).toBe('"Sheet1"');
    expect(recommendedText(ai, "keyColumn")).toBe("B열");
    expect(recommendedText(ai, "targetColumns")).toBe("E~H열");
    expect(recommendedText(ai, "headerRow")).toBe("3행");
    expect(recommendedText({ ...ai, headerRow: rec<number>(null, null) }, "headerRow")).toBeNull();
  });
});

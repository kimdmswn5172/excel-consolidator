// 조건 직접 선택 규칙을 시험한다. 실행: npm run test
import { describe, expect, it } from "vitest";
import {
  chooseSheet,
  conditionsBlockedReason,
  decisionText,
  decisionsToSettings,
  formatColumns,
  initialDecisions,
  pickKeyColumn,
  pickRow,
  toggleTargetColumn,
} from "./conditions";
import type { ConditionDecisions } from "./types";

// 연습용 파일과 같은 조건을 차례로 정한다: Sheet1, B열, E~H열, 3행, 4행
function filled(): ConditionDecisions {
  let d = chooseSheet(initialDecisions, "Sheet1");
  d = pickKeyColumn(d, 2);
  for (const column of [5, 6, 7, 8]) d = toggleTargetColumn(d, column);
  d = pickRow(d, "headerRow", 3);
  return pickRow(d, "dataStartRow", 4);
}

describe("조건 정하기", () => {
  it("처음에는 모든 항목이 정해지지 않았다", () => {
    expect(conditionsBlockedReason(initialDecisions)).toBe(
      "아직 정하지 않은 항목이 있습니다: 시트, 기준 열, 대상 열, 헤더 위치, 데이터 시작 행",
    );
    expect(decisionsToSettings(initialDecisions)).toBeNull();
  });

  it("다섯 항목을 모두 정하면 취합 조건이 된다", () => {
    const d = filled();
    expect(conditionsBlockedReason(d)).toBeNull();
    expect(decisionsToSettings(d)).toEqual({
      sheetName: "Sheet1",
      keyColumn: 2,
      targetColumns: [5, 6, 7, 8],
      headerRow: 3,
      dataStartRow: 4,
    });
  });

  it("직접 정한 항목은 사용자가 확정한 것으로 기록한다", () => {
    expect(filled().keyColumn).toEqual({ state: "confirmed", value: 2, by: "user" });
  });

  it("대상 열은 눌러서 넣고, 다시 누르면 뺀다. 모두 빼면 정하지 않은 상태가 된다", () => {
    let d = toggleTargetColumn(initialDecisions, 7);
    d = toggleTargetColumn(d, 5);
    expect(decisionText(d, "targetColumns")).toBe("E열, G열");
    d = toggleTargetColumn(d, 5);
    d = toggleTargetColumn(d, 7);
    expect(d.targetColumns).toEqual({ state: "pending" });
  });

  it("기준 열은 대상 열에 넣을 수 없다", () => {
    const d = toggleTargetColumn(pickKeyColumn(initialDecisions, 2), 2);
    expect(d.targetColumns).toEqual({ state: "pending" });
  });

  it("대상 열 중 하나를 기준 열로 바꾸면 대상 열에서 빠진다", () => {
    let d = toggleTargetColumn(toggleTargetColumn(initialDecisions, 2), 5);
    d = pickKeyColumn(d, 2);
    expect(decisionText(d, "targetColumns")).toBe("E열");
    expect(decisionText(d, "keyColumn")).toBe("B열");
  });

  it("데이터 시작 행이 헤더 행보다 위거나 같으면 시작할 수 없다", () => {
    expect(conditionsBlockedReason(pickRow(filled(), "dataStartRow", 3))).toBe("데이터 시작 행은 헤더 행보다 아래여야 합니다.");
    expect(conditionsBlockedReason(pickRow(filled(), "dataStartRow", 2))).toBe("데이터 시작 행은 헤더 행보다 아래여야 합니다.");
  });

  it("다른 시트로 바꾸면 나머지 항목을 다시 정해야 한다", () => {
    const d = chooseSheet(filled(), "Sheet2");
    expect(decisionText(d, "sheetName")).toBe('"Sheet2"');
    expect(d.keyColumn).toEqual({ state: "pending" });
    expect(d.targetColumns).toEqual({ state: "pending" });
  });

  it("같은 시트를 다시 골라도 나머지 항목은 그대로다", () => {
    const d = filled();
    expect(chooseSheet(d, "Sheet1")).toBe(d);
  });
});

describe("formatColumns", () => {
  it("이어진 열을 묶어 보여 준다", () => {
    expect(formatColumns([5, 6, 7, 8])).toBe("E~H열");
    expect(formatColumns([10, 5, 6, 7, 8])).toBe("E~H열, J열");
    expect(formatColumns([2])).toBe("B열");
    expect(formatColumns([])).toBe("");
  });
});

describe("decisionText", () => {
  it("항목마다 읽기 쉬운 글자로 보여 준다", () => {
    const d = filled();
    expect(decisionText(d, "sheetName")).toBe('"Sheet1"');
    expect(decisionText(d, "keyColumn")).toBe("B열");
    expect(decisionText(d, "targetColumns")).toBe("E~H열");
    expect(decisionText(d, "headerRow")).toBe("3행");
    expect(decisionText(d, "dataStartRow")).toBe("4행");
    expect(decisionText(initialDecisions, "keyColumn")).toBe("");
  });
});

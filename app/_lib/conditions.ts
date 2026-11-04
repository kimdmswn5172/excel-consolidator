// 2단계(조건 확인)의 규칙: 사용자가 미리보기 표에서 취합 조건을 직접 정하는 방법. (PRD 5번 must 1, DESIGN 2단계)
// 화면과 떨어진 순수 함수라서 자동 시험으로 확인할 수 있다.
//  - 다섯 항목(기준 열, 시트, 대상 열, 헤더 위치, 데이터 시작 행)이 모두 확정되어야 취합할 수 있다.
//  - 기준 열은 1개, 대상 열은 여러 개다. 기준 열은 대상 열에 넣을 수 없다.
//  - 데이터 시작 행은 헤더 행보다 아래여야 한다.
//  - 시트를 바꾸면 열·행 위치가 달라지므로 나머지 항목을 다시 정해야 한다.
import { numberToColumnLetters } from "./excel/a1";
import type { ConditionDecision, ConditionDecisions, ConditionKey, ConsolidationSettings } from "./types";

export const CONDITION_LABELS: Record<ConditionKey, string> = {
  keyColumn: "기준 열",
  sheetName: "시트",
  targetColumns: "대상 열",
  headerRow: "헤더 위치",
  dataStartRow: "데이터 시작 행",
};

// 화면에 보여 줄 순서
export const CONDITION_ORDER: ConditionKey[] = ["sheetName", "keyColumn", "targetColumns", "headerRow", "dataStartRow"];

export const initialDecisions: ConditionDecisions = {
  keyColumn: { state: "pending" },
  sheetName: { state: "pending" },
  targetColumns: { state: "pending" },
  headerRow: { state: "pending" },
  dataStartRow: { state: "pending" },
};

function byUser<T>(value: T): ConditionDecision<T> {
  return { state: "confirmed", value, by: "user" };
}

function valueOf<T>(decision: ConditionDecision<T>): T | null {
  return decision.state === "confirmed" ? decision.value : null;
}

// 시트를 정한다. 다른 시트로 바꾸면 열·행 위치가 달라지므로 나머지 항목은 다시 정하게 한다.
export function chooseSheet(decisions: ConditionDecisions, sheetName: string): ConditionDecisions {
  const current = valueOf(decisions.sheetName);
  if (current === sheetName) return decisions;
  return { ...initialDecisions, sheetName: byUser(sheetName) };
}

// 기준 열을 정한다. 그 열이 대상 열에 들어 있었다면 대상 열에서 뺀다.
export function pickKeyColumn(decisions: ConditionDecisions, column: number): ConditionDecisions {
  const targets = (valueOf(decisions.targetColumns) ?? []).filter((target) => target !== column);
  return {
    ...decisions,
    keyColumn: byUser(column),
    targetColumns: targets.length > 0 ? byUser(targets) : { state: "pending" },
  };
}

// 대상 열을 하나씩 넣거나 뺀다. 기준 열은 대상 열에 넣지 않는다. 모두 빼면 다시 "정하지 않음"이 된다.
export function toggleTargetColumn(decisions: ConditionDecisions, column: number): ConditionDecisions {
  if (valueOf(decisions.keyColumn) === column) return decisions;
  const current = valueOf(decisions.targetColumns) ?? [];
  const next = current.includes(column) ? current.filter((c) => c !== column) : [...current, column].sort((a, b) => a - b);
  return { ...decisions, targetColumns: next.length > 0 ? byUser(next) : { state: "pending" } };
}

// 헤더 행 또는 데이터 시작 행을 정한다.
export function pickRow(decisions: ConditionDecisions, item: "headerRow" | "dataStartRow", row: number): ConditionDecisions {
  return { ...decisions, [item]: byUser(row) };
}

// 아직 취합을 시작할 수 없는 이유. 시작할 수 있으면 null이다.
export function conditionsBlockedReason(decisions: ConditionDecisions): string | null {
  const pending = CONDITION_ORDER.filter((key) => decisions[key].state === "pending").map((key) => CONDITION_LABELS[key]);
  if (pending.length > 0) return `아직 정하지 않은 항목이 있습니다: ${pending.join(", ")}`;

  const header = valueOf(decisions.headerRow)!;
  const start = valueOf(decisions.dataStartRow)!;
  if (start <= header) return "데이터 시작 행은 헤더 행보다 아래여야 합니다.";
  return null;
}

// 모든 항목이 확정되고 서로 맞으면 취합 조건으로 바꾼다. 아니면 null이다.
export function decisionsToSettings(decisions: ConditionDecisions): ConsolidationSettings | null {
  if (conditionsBlockedReason(decisions) !== null) return null;
  return {
    sheetName: valueOf(decisions.sheetName)!,
    keyColumn: valueOf(decisions.keyColumn)!,
    targetColumns: valueOf(decisions.targetColumns)!,
    headerRow: valueOf(decisions.headerRow)!,
    dataStartRow: valueOf(decisions.dataStartRow)!,
  };
}

// 열 번호 목록을 읽기 쉬운 글자로 바꾼다. 이어진 열은 묶는다. (예: [5,6,7,8,10] → "E~H열, J열")
export function formatColumns(columns: number[]): string {
  if (columns.length === 0) return "";
  const sorted = [...columns].sort((a, b) => a - b);
  const groups: string[] = [];
  let start = sorted[0];
  let previous = sorted[0];
  for (const column of [...sorted.slice(1), Number.NaN]) {
    if (column === previous + 1) {
      previous = column;
      continue;
    }
    const from = numberToColumnLetters(start);
    groups.push(start === previous ? `${from}열` : `${from}~${numberToColumnLetters(previous)}열`);
    start = column;
    previous = column;
  }
  return groups.join(", ");
}

// 항목 하나의 현재 값을 화면용 글자로 바꾼다.
export function decisionText(decisions: ConditionDecisions, key: ConditionKey): string {
  switch (key) {
    case "sheetName": {
      const value = valueOf(decisions.sheetName);
      return value === null ? "" : `"${value}"`;
    }
    case "keyColumn": {
      const value = valueOf(decisions.keyColumn);
      return value === null ? "" : `${numberToColumnLetters(value)}열`;
    }
    case "targetColumns":
      return formatColumns(valueOf(decisions.targetColumns) ?? []);
    case "headerRow":
    case "dataStartRow": {
      const value = valueOf(decisions[key]);
      return value === null ? "" : `${value}행`;
    }
  }
}

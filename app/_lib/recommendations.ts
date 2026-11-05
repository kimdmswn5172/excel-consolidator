// 2단계에서 AI 추천을 항목마다 Yes/No로 확정하는 규칙. (PRD 5번 must 1의 규칙 3·4, DESIGN 2단계)
// 화면과 떨어진 순수 함수라서 자동 시험으로 확인할 수 있다.
//  - Yes: 추천값을 그대로 확정한다(by: "ai"). No: 확정을 취소하고 미리보기에서 직접 고른다.
//  - "추천 불가"인 항목은 Yes를 누를 수 없다. 70% 미만 "확인 필요"는 사용자가 보고 Yes를 누를 수 있다.
//  - 시트가 먼저다. AI가 추천한 시트를 확정해야 나머지 항목의 추천(그 시트 기준)을 받아들일 수 있다.
import { formatColumns, initialDecisions } from "./conditions";
import type { AiRecommendation, ConditionDecisions, ConditionKey, Recommended } from "./types";

export const NEEDS_CHECK_LABEL = "확인 필요";

// 항목 하나의 추천을 화면용 글자로. 추천 불가이면 null이다.
export function recommendedText(recommendation: AiRecommendation, key: ConditionKey): string | null {
  switch (key) {
    case "sheetName":
      return recommendation.sheetName.value === null ? null : `"${recommendation.sheetName.value}"`;
    case "keyColumn":
      return recommendation.keyColumn.value === null ? null : formatColumns([recommendation.keyColumn.value]);
    case "targetColumns":
      return recommendation.targetColumns.value === null ? null : formatColumns(recommendation.targetColumns.value);
    case "headerRow":
    case "dataStartRow":
      return recommendation[key].value === null ? null : `${recommendation[key].value}행`;
  }
}

// 항목 하나의 신뢰도와 상태 (신뢰도 표시에 쓴다)
export function recommendationMeta(recommendation: AiRecommendation, key: ConditionKey): Recommended<unknown> {
  return recommendation[key];
}

// Yes를 누를 수 없는 이유. 누를 수 있으면 null이다.
export function acceptBlockedReason(decisions: ConditionDecisions, recommendation: AiRecommendation, key: ConditionKey): string | null {
  if (recommendation[key].value === null) return "AI가 정하지 못했습니다. 직접 선택해 주세요.";
  if (key === "sheetName") return null;

  const confirmedSheet = decisions.sheetName.state === "confirmed" ? decisions.sheetName.value : null;
  if (confirmedSheet === null) return "먼저 시트를 정해 주세요.";
  if (confirmedSheet !== recommendation.sheetName.value) return "AI가 추천한 시트와 다른 시트를 고르셨습니다. 직접 선택해 주세요.";

  if (key === "targetColumns" && decisions.keyColumn.state === "confirmed" && recommendation.targetColumns.value!.includes(decisions.keyColumn.value)) {
    return "확정한 기준 열이 대상 열에 들어 있습니다. 직접 선택해 주세요.";
  }
  return null;
}

// Yes: 추천값을 그대로 확정한다. 막힌 경우에는 아무것도 바꾸지 않는다.
export function acceptRecommendation(decisions: ConditionDecisions, recommendation: AiRecommendation, key: ConditionKey): ConditionDecisions {
  if (acceptBlockedReason(decisions, recommendation, key) !== null) return decisions;

  switch (key) {
    case "sheetName": {
      const sheetName = recommendation.sheetName.value!;
      const current = decisions.sheetName.state === "confirmed" ? decisions.sheetName.value : null;
      // 다른 시트로 바꾸면 열·행 위치가 달라지므로 나머지는 다시 정하게 한다. 같은 시트면 나머지는 그대로 둔다.
      const base = current === sheetName ? decisions : initialDecisions;
      return { ...base, sheetName: { state: "confirmed", value: sheetName, by: "ai" } };
    }
    case "keyColumn": {
      const column = recommendation.keyColumn.value!;
      // 기준 열은 대상 열에 넣을 수 없다. 겹치면 대상 열 확정을 풀고 다시 정하게 한다.
      const targets = decisions.targetColumns;
      const overlaps = targets.state === "confirmed" && targets.value.includes(column);
      return { ...decisions, keyColumn: { state: "confirmed", value: column, by: "ai" }, targetColumns: overlaps ? { state: "pending" } : targets };
    }
    case "targetColumns": {
      // 기준 열과 겹치는 경우는 위의 acceptBlockedReason에서 이미 걸러진다
      return { ...decisions, targetColumns: { state: "confirmed", value: recommendation.targetColumns.value!, by: "ai" } };
    }
    case "headerRow":
      return { ...decisions, headerRow: { state: "confirmed", value: recommendation.headerRow.value!, by: "ai" } };
    case "dataStartRow":
      return { ...decisions, dataStartRow: { state: "confirmed", value: recommendation.dataStartRow.value!, by: "ai" } };
  }
}

// No: 이 항목의 확정을 취소해 직접 고르게 한다. 시트를 취소하면 나머지도 의미가 없어져 모두 처음으로 돌린다.
export function rejectRecommendation(decisions: ConditionDecisions, key: ConditionKey): ConditionDecisions {
  if (key === "sheetName") return initialDecisions;
  return { ...decisions, [key]: { state: "pending" } };
}

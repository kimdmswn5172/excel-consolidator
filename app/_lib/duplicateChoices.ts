// 3단계의 중복 키 처리 방법 선택 규칙. (PRD 5번 must 2의 규칙 3, DESIGN 3단계)
// 화면과 떨어진 순수 함수라서 자동 시험으로 확인할 수 있다.
//  - 같은 키가 2건 이상이면 프로그램이 임의로 고르지 않는다. 사용자가 고를 때까지 다음으로 넘어가지 못한다.
//  - "전체에 적용"하거나 "키별로 따로" 고른다. 키별로 고를 때는 모든 키를 골라야 한다.
import type { DuplicateChoices, DuplicateKey, DuplicateStrategy, KeyOccurrence } from "./types";

export const STRATEGY_ORDER: DuplicateStrategy[] = ["first", "last", "list-all", "leave-blank"];

export const STRATEGY_LABELS: Record<DuplicateStrategy, string> = {
  first: "첫 번째 값",
  last: "마지막 값",
  "list-all": "모두 나열",
  "leave-blank": "비워 두기",
};

export const STRATEGY_HINTS: Record<DuplicateStrategy, string> = {
  first: "가장 먼저 나온 행의 값을 씁니다.",
  last: "가장 나중에 나온 행의 값을 씁니다.",
  "list-all": '모든 행의 값을 " / "로 이어서 한 칸에 넣습니다.',
  "leave-blank": "칸을 채우지 않고 중복 목록에만 남깁니다.",
};

// 전체에 같은 방법을 적용한다.
export function chooseForAll(strategy: DuplicateStrategy): DuplicateChoices {
  return { mode: "all", strategy };
}

// "키별로 따로 고르기"로 바꾼다. 이미 키별이면 그대로 두고, 전체 선택이 있었다면 그 방법을 모든 키의 시작값으로 넘기지 않는다.
// (임의로 채워진 선택이 생기지 않게, 키별 선택은 항상 빈 상태에서 시작한다)
export function switchToPerKey(current: DuplicateChoices | null): DuplicateChoices {
  return current?.mode === "per-key" ? current : { mode: "per-key", byKey: {} };
}

// 키 하나의 처리 방법을 정한다. 키별 모드가 아니면 키별 모드로 바꾸고 시작한다.
export function chooseForKey(current: DuplicateChoices | null, key: string, strategy: DuplicateStrategy): DuplicateChoices {
  const base = switchToPerKey(current);
  if (base.mode !== "per-key") return base; // 위 함수가 항상 키별 모드를 돌려주므로 여기는 오지 않는다
  return { mode: "per-key", byKey: { ...base.byKey, [key]: strategy } };
}

// 아직 처리 방법을 고르지 않은 중복 키
export function unresolvedKeys(duplicates: DuplicateKey[], choices: DuplicateChoices | null): DuplicateKey[] {
  if (!choices) return duplicates;
  if (choices.mode === "all") return [];
  return duplicates.filter((duplicate) => choices.byKey[duplicate.key] === undefined);
}

// [다음]을 누를 수 없는 이유. 모두 골랐거나 중복이 없으면 null이다.
export function duplicatesBlockedReason(duplicates: DuplicateKey[], choices: DuplicateChoices | null): string | null {
  const left = unresolvedKeys(duplicates, choices).length;
  if (left === 0) return null;
  return choices?.mode === "per-key"
    ? `아직 처리 방법을 고르지 않은 중복 키가 ${left}건 있습니다.`
    : "중복 키의 처리 방법을 골라 주세요.";
}

// "부서07.xlsx 5행, 부서07.xlsx 6행"처럼 겹친 위치를 보기 좋게 적는다. 같은 파일은 묶는다.
export function describeOccurrences(occurrences: KeyOccurrence[]): string {
  const byFile = new Map<string, number[]>();
  for (const { fileName, row } of occurrences) {
    byFile.set(fileName, [...(byFile.get(fileName) ?? []), row]);
  }
  return [...byFile].map(([fileName, rows]) => `${fileName} ${rows.join("·")}행`).join(", ");
}

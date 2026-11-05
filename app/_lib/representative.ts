// 대표 파일 고르기. (PRD 5번 must 1: 부서 파일 중 무작위로 1개를 자동 지정하고, 사용자는 다른 파일로 다시 뽑을 수 있다)
// 화면과 떨어진 순수 함수라서 자동 시험으로 확인할 수 있다.
import type { WorkbookData } from "./types";

// random은 0 이상 1 미만의 수를 돌려주는 함수다. 시험에서는 정해진 값을 넣어 결과를 예측한다.
export function pickRepresentative(
  departments: WorkbookData[],
  current?: WorkbookData,
  random: () => number = Math.random,
): WorkbookData | null {
  // 다시 뽑을 때는 지금 대표 파일을 빼고 뽑는다. (같은 파일이 또 나오면 "다른 파일로"가 아니다)
  const candidates = current ? departments.filter((department) => department !== current) : departments;
  if (candidates.length === 0) return null;
  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length));
  return candidates[index];
}

// [다른 대표 파일로 다시 분석]을 누를 수 있는지. 후보가 2개 이상이어야 다른 파일이 있다.
export function canPickAnother(departments: WorkbookData[]): boolean {
  return departments.length >= 2;
}

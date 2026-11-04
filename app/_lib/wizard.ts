// 화면 4단계(파일 선택 → 조건 확인 → 점검·중복 선택 → 결과)를 오가는 규칙. (DESIGN 1번 화면 구성)
// 화면과 떨어진 순수 함수라서 자동 시험으로 확인할 수 있다.
import type { AppStep } from "./types";

export const STEP_TITLES: Record<AppStep, string> = {
  1: "파일 선택",
  2: "조건 확인",
  3: "점검·중복 선택",
  4: "결과",
};

// 각 단계에서 [다음] 버튼에 쓸 글자. 4단계(결과)에는 [다음] 대신 [처음부터 다시]가 있다.
export const NEXT_LABELS: Record<Exclude<AppStep, 4>, string> = {
  1: "분석 시작",
  2: "취합 시작",
  3: "결과 보기",
};

export type WizardState = { step: AppStep };

export type WizardAction = { type: "next" } | { type: "prev" } | { type: "reset" };

export const initialWizardState: WizardState = { step: 1 };

// 다음·이전으로 움직이되 1~4단계 밖으로는 나가지 않는다. [처음부터 다시]는 1단계로 돌아간다.
export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "next":
      return state.step < 4 ? { step: (state.step + 1) as AppStep } : state;
    case "prev":
      return state.step > 1 ? { step: (state.step - 1) as AppStep } : state;
    case "reset":
      return initialWizardState;
  }
}

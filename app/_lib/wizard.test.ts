// 화면 단계 이동 규칙을 시험한다. 실행: npm run test
import { describe, expect, it } from "vitest";
import { initialWizardState, wizardReducer } from "./wizard";

describe("wizardReducer", () => {
  it("1단계에서 시작한다", () => {
    expect(initialWizardState).toEqual({ step: 1 });
  });

  it("다음을 누르면 한 단계씩 나아가고 4단계에서 멈춘다", () => {
    let state = initialWizardState;
    const visited = [state.step];
    for (let i = 0; i < 5; i++) {
      state = wizardReducer(state, { type: "next" });
      visited.push(state.step);
    }
    expect(visited).toEqual([1, 2, 3, 4, 4, 4]);
  });

  it("이전을 누르면 한 단계씩 돌아가고 1단계에서 멈춘다", () => {
    let state = wizardReducer(wizardReducer({ step: 3 }, { type: "prev" }), { type: "prev" });
    expect(state).toEqual({ step: 1 });
    state = wizardReducer(state, { type: "prev" });
    expect(state).toEqual({ step: 1 });
  });

  it("처음부터 다시를 누르면 1단계로 돌아간다", () => {
    expect(wizardReducer({ step: 4 }, { type: "reset" })).toEqual({ step: 1 });
  });
});

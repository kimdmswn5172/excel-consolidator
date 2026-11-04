"use client";

// 서비스 전체 화면: 한 페이지 안에서 4단계가 차례로 바뀐다. (DESIGN 1번 화면 구성)
// 지금은 단계 흐름만 있는 뼈대이고, 각 단계의 내용은 PLAN.md 12번부터 채운다.
import { useReducer } from "react";
import { initialWizardState, wizardReducer } from "../_lib/wizard";
import { StepIndicator } from "./StepIndicator";
import { StepNavigation } from "./StepNavigation";
import { StepPlaceholder } from "./StepPlaceholder";

export function ConsolidationApp() {
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);

  // 단계가 바뀌면 화면 맨 위부터 보이게 한다.
  function move(type: "next" | "prev" | "reset") {
    dispatch({ type });
    window.scrollTo({ top: 0 });
  }

  // 뼈대 단계에서는 어느 단계든 넘어갈 수 있다. 실제 조건(파일 선택 여부, 항목 확정 여부)은 각 단계를 만들 때 연결한다.
  const canGoNext = true;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-medium text-zinc-900 dark:text-zinc-50">Excel 범용 취합 프로그램</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">여러 부서의 엑셀 파일을 마스터 표 하나로 모읍니다.</p>
      </header>

      <StepIndicator current={state.step} />

      <main className="flex-1 rounded-xl border border-zinc-200 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
        {state.step === 1 && (
          <StepPlaceholder
            title="1단계. 파일 선택"
            description="마스터 표와 부서별 엑셀 파일을 고르고, 개인정보 포함 여부를 체크합니다."
            items={[
              "마스터 표 선택 (.xlsx)",
              "부서 파일 선택 또는 끌어다 놓기, 폴더 선택 (최대 50개)",
              "개인정보 포함 여부 체크 (체크하면 AI에는 열 이름만 보냅니다)",
            ]}
            plannedTask="PLAN.md 12번 작업"
          />
        )}
        {state.step === 2 && (
          <StepPlaceholder
            title="2단계. 조건 확인"
            description="AI가 추천한 기준 열과 취합 범위를 확인하고, 항목마다 Yes 또는 No(직접 선택)를 고릅니다."
            items={[
              "대표 파일 이름과 [다른 대표 파일로 다시 분석] 버튼",
              "기준 열, 시트, 대상 열, 헤더 위치, 데이터 시작 행의 추천값과 신뢰도",
              "엑셀 미리보기에서 행·열 직접 선택",
            ]}
            plannedTask="PLAN.md 13번 작업"
          />
        )}
        {state.step === 3 && (
          <StepPlaceholder
            title="3단계. 점검·중복 선택"
            description="취합할 수 없는 파일과 중복된 키를 확인하고, 중복 키의 처리 방법을 고릅니다."
            items={[
              "취합에서 제외된 파일과 이유 (헤더 다름, 병합 셀, 읽기 실패)",
              "중복된 키와 처리 방법 선택 (첫 번째 값, 마지막 값, 모두 나열, 비워 두기)",
            ]}
            plannedTask="PLAN.md 15번, 16번 작업"
          />
        )}
        {state.step === 4 && (
          <StepPlaceholder
            title="4단계. 결과"
            description="취합 결과를 요약해 보여 주고 결과 엑셀 파일을 내려받습니다."
            items={[
              "처리 요약 (처리 파일, 성공·제외, 미매칭, 중복, 바뀐 칸)",
              "바뀐 칸 · 미매칭 · 중복 · 제외 파일 목록",
              "[결과 엑셀 다운로드] 버튼",
            ]}
            plannedTask="PLAN.md 17번 작업"
          />
        )}
      </main>

      <StepNavigation
        step={state.step}
        canGoNext={canGoNext}
        onPrev={() => move("prev")}
        onNext={() => move("next")}
        onReset={() => move("reset")}
      />

      <footer className="text-center text-xs text-zinc-500 dark:text-zinc-500">
        엑셀 파일은 서버에 저장되지 않고 이 브라우저 안에서만 처리됩니다.
      </footer>
    </div>
  );
}

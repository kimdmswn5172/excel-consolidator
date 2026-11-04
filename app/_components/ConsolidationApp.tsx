"use client";

// 서비스 전체 화면: 한 페이지 안에서 4단계가 차례로 바뀐다. (DESIGN 1번 화면 구성)
// 1단계(파일 선택)는 PLAN.md 12번에서 만들었고, 2~4단계는 아직 뼈대다.
import { useReducer, useState } from "react";
import { addDepartmentFiles, analysisBlockedReason, selectMasterFile } from "../_lib/fileSelection";
import { initialWizardState, wizardReducer } from "../_lib/wizard";
import { StepIndicator } from "./StepIndicator";
import { StepNavigation } from "./StepNavigation";
import { StepPlaceholder } from "./StepPlaceholder";
import { FileSelectStep } from "./steps/FileSelectStep";

// 1단계에서 고른 파일과 체크 상태
type Selection = {
  master: File | null;
  departments: File[];
  containsPersonalInfo: boolean;
  notices: string[]; // 넣지 못한 파일 안내 (다음 선택을 하면 새로 바뀐다)
};

const emptySelection: Selection = { master: null, departments: [], containsPersonalInfo: false, notices: [] };

export function ConsolidationApp() {
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);
  const [selection, setSelection] = useState<Selection>(emptySelection);

  // 단계가 바뀌면 화면 맨 위부터 보이게 한다. [처음부터 다시]는 고른 파일도 비운다.
  function move(type: "next" | "prev" | "reset") {
    dispatch({ type });
    if (type === "reset") setSelection(emptySelection);
    window.scrollTo({ top: 0 });
  }

  // 단계별로 [다음]을 누를 수 있는지. 2~4단계의 조건은 각 단계를 만들 때 연결한다.
  const blockedReason = state.step === 1 ? analysisBlockedReason(selection.master, selection.departments) : null;
  const canGoNext = blockedReason === null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-medium text-zinc-900 dark:text-zinc-50">Excel 범용 취합 프로그램</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">여러 부서의 엑셀 파일을 마스터 표 하나로 모읍니다.</p>
      </header>

      <StepIndicator current={state.step} />

      <main className="flex-1 rounded-xl border border-zinc-200 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
        {state.step === 1 && (
          <FileSelectStep
            master={selection.master}
            departments={selection.departments}
            containsPersonalInfo={selection.containsPersonalInfo}
            notices={selection.notices}
            onSelectMaster={(file) =>
              setSelection((current) => {
                const result = selectMasterFile(file, current.departments);
                return {
                  ...current,
                  master: result.master ?? current.master,
                  departments: result.departments,
                  notices: result.notices,
                };
              })
            }
            onClearMaster={() => setSelection((current) => ({ ...current, master: null, notices: [] }))}
            onAddDepartments={(files, fromFolder) =>
              setSelection((current) => {
                const result = addDepartmentFiles(current.departments, files, current.master, { fromFolder });
                return { ...current, departments: result.files, notices: result.notices };
              })
            }
            onRemoveDepartment={(index) =>
              setSelection((current) => ({
                ...current,
                departments: current.departments.filter((_, i) => i !== index),
                notices: [],
              }))
            }
            onClearDepartments={() => setSelection((current) => ({ ...current, departments: [], notices: [] }))}
            onPersonalInfoChange={(checked) => setSelection((current) => ({ ...current, containsPersonalInfo: checked }))}
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
        blockedReason={blockedReason ?? undefined}
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

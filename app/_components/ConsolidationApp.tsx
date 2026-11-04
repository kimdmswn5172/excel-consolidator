"use client";

// 서비스 전체 화면: 한 페이지 안에서 4단계가 차례로 바뀐다. (DESIGN 1번 화면 구성)
// 1단계(파일 선택)와 2단계(조건 확인, 직접 선택 모드)는 만들었고, 3~4단계는 아직 뼈대다.
import { useReducer, useState } from "react";
import {
  chooseSheet,
  conditionsBlockedReason,
  initialDecisions,
  pickKeyColumn,
  pickRow,
  toggleTargetColumn,
} from "../_lib/conditions";
import { addDepartmentFiles, analysisBlockedReason, selectMasterFile } from "../_lib/fileSelection";
import { readSelection } from "../_lib/readSelection";
import type { ConditionDecisions, SkippedFile, WorkbookData } from "../_lib/types";
import { initialWizardState, wizardReducer } from "../_lib/wizard";
import { AlertBox } from "./AlertBox";
import type { PickMode } from "./SheetPreview";
import { StepIndicator } from "./StepIndicator";
import { StepNavigation } from "./StepNavigation";
import { StepPlaceholder } from "./StepPlaceholder";
import { ConditionStep } from "./steps/ConditionStep";
import { FileSelectStep } from "./steps/FileSelectStep";

// 1단계에서 고른 파일과 체크 상태
type Selection = {
  master: File | null;
  departments: File[];
  containsPersonalInfo: boolean;
  notices: string[]; // 넣지 못한 파일 안내 (다음 선택을 하면 새로 바뀐다)
};

const emptySelection: Selection = { master: null, departments: [], containsPersonalInfo: false, notices: [] };

// [분석 시작]으로 읽어 들인 파일들
type Analysis = {
  master: WorkbookData;
  departments: WorkbookData[]; // 읽은 부서 파일
  unreadable: SkippedFile[]; // 읽지 못한 부서 파일과 이유
  representative: WorkbookData; // 조건을 정할 때 보는 대표 파일
};

// 2단계에서 정하는 조건과 화면 상태
type Conditions = {
  decisions: ConditionDecisions;
  previewSheet: string; // 미리보기로 보고 있는 시트
  mode: PickMode; // 지금 고르고 있는 항목
};

export function ConsolidationApp() {
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);
  const [selection, setSelection] = useState<Selection>(emptySelection);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [conditions, setConditions] = useState<Conditions | null>(null);
  const [reading, setReading] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 단계가 바뀌면 화면 맨 위부터 보이게 한다. [처음부터 다시]는 고른 파일과 정한 조건도 모두 비운다.
  function move(type: "next" | "prev" | "reset") {
    dispatch({ type });
    setError(null);
    if (type === "reset") {
      setSelection(emptySelection);
      setAnalysis(null);
      setConditions(null);
    }
    window.scrollTo({ top: 0 });
  }

  function updateSelection(update: (current: Selection) => Selection) {
    setError(null);
    setSelection(update);
  }

  // [분석 시작]: 고른 파일을 브라우저 안에서 읽고 2단계로 넘어간다.
  async function startAnalysis() {
    if (!selection.master) return;
    setError(null);
    const result = await readSelection(selection.master, selection.departments, (done, total) => setReading({ done, total }));
    setReading(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    // 대표 파일은 지금은 읽은 부서 파일 중 첫 번째다. 무작위 지정과 [다시 분석]은 PLAN.md 19번에서 만든다.
    const representative = result.departments[0];
    setAnalysis({ master: result.master, departments: result.departments, unreadable: result.skipped, representative });
    setConditions({ decisions: initialDecisions, previewSheet: representative.sheets[0]?.name ?? "", mode: "keyColumn" });
    move("next");
  }

  function updateDecisions(update: (decisions: ConditionDecisions) => ConditionDecisions, nextMode?: PickMode) {
    setConditions((current) => (current ? { ...current, decisions: update(current.decisions), mode: nextMode ?? current.mode } : current));
  }

  // 단계별로 [다음]을 누를 수 없는 이유. 3~4단계의 조건은 각 단계를 만들 때 연결한다.
  let blockedReason: string | null = null;
  if (reading) blockedReason = `파일을 읽는 중입니다… (${reading.done} / ${reading.total})`;
  else if (state.step === 1) blockedReason = analysisBlockedReason(selection.master, selection.departments);
  else if (state.step === 2) blockedReason = conditions ? conditionsBlockedReason(conditions.decisions) : "조건을 정할 파일이 없습니다.";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-medium text-zinc-900 dark:text-zinc-50">Excel 범용 취합 프로그램</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">여러 부서의 엑셀 파일을 마스터 표 하나로 모읍니다.</p>
      </header>

      <StepIndicator current={state.step} />

      <main className="flex min-w-0 flex-1 flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
        {error && <AlertBox tone="error">{error}</AlertBox>}

        {state.step === 1 && (
          <FileSelectStep
            master={selection.master}
            departments={selection.departments}
            containsPersonalInfo={selection.containsPersonalInfo}
            notices={selection.notices}
            onSelectMaster={(file) =>
              updateSelection((current) => {
                const result = selectMasterFile(file, current.departments);
                return {
                  ...current,
                  master: result.master ?? current.master,
                  departments: result.departments,
                  notices: result.notices,
                };
              })
            }
            onClearMaster={() => updateSelection((current) => ({ ...current, master: null, notices: [] }))}
            onAddDepartments={(files, fromFolder) =>
              updateSelection((current) => {
                const result = addDepartmentFiles(current.departments, files, current.master, { fromFolder });
                return { ...current, departments: result.files, notices: result.notices };
              })
            }
            onRemoveDepartment={(index) =>
              updateSelection((current) => ({
                ...current,
                departments: current.departments.filter((_, i) => i !== index),
                notices: [],
              }))
            }
            onClearDepartments={() => updateSelection((current) => ({ ...current, departments: [], notices: [] }))}
            onPersonalInfoChange={(checked) => updateSelection((current) => ({ ...current, containsPersonalInfo: checked }))}
          />
        )}
        {state.step === 2 && analysis && conditions && (
          <ConditionStep
            representative={analysis.representative}
            previewSheetName={conditions.previewSheet}
            decisions={conditions.decisions}
            mode={conditions.mode}
            unreadableCount={analysis.unreadable.length}
            onPreviewSheetChange={(sheetName) => setConditions((current) => (current ? { ...current, previewSheet: sheetName } : current))}
            onConfirmSheet={() => updateDecisions((decisions) => chooseSheet(decisions, conditions.previewSheet), "keyColumn")}
            onModeChange={(mode) => setConditions((current) => (current ? { ...current, mode } : current))}
            onPickColumn={(column) =>
              conditions.mode === "keyColumn"
                ? updateDecisions((decisions) => pickKeyColumn(decisions, column), "targetColumns")
                : updateDecisions((decisions) => toggleTargetColumn(decisions, column))
            }
            onPickRow={(row) =>
              conditions.mode === "headerRow"
                ? updateDecisions((decisions) => pickRow(decisions, "headerRow", row), "dataStartRow")
                : updateDecisions((decisions) => pickRow(decisions, "dataStartRow", row))
            }
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
        canGoNext={blockedReason === null}
        blockedReason={blockedReason ?? undefined}
        onPrev={() => move("prev")}
        onNext={() => (state.step === 1 ? void startAnalysis() : move("next"))}
        onReset={() => move("reset")}
      />

      <footer className="text-center text-xs text-zinc-500 dark:text-zinc-500">
        엑셀 파일은 서버에 저장되지 않고 이 브라우저 안에서만 처리됩니다.
      </footer>
    </div>
  );
}

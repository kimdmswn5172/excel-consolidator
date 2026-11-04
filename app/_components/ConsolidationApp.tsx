"use client";

// 서비스 전체 화면: 한 페이지 안에서 4단계가 차례로 바뀐다. (DESIGN 1번 화면 구성)
// 1단계(파일 선택)와 2단계(조건 확인, 직접 선택 모드)는 만들었고, 3~4단계는 아직 뼈대다.
import { useReducer, useState } from "react";
import {
  chooseSheet,
  conditionsBlockedReason,
  decisionsToSettings,
  initialDecisions,
  pickKeyColumn,
  pickRow,
  toggleTargetColumn,
} from "../_lib/conditions";
import { createWorkbookReader } from "../_lib/excel/workbookReader";
import { addDepartmentFiles, analysisBlockedReason, selectMasterFile } from "../_lib/fileSelection";
import { inspectAll, type Inspection } from "../_lib/merge/inspectAll";
import { readSelection } from "../_lib/readSelection";
import type { ConditionDecisions, SkippedFile, WorkbookData } from "../_lib/types";
import { initialWizardState, wizardReducer } from "../_lib/wizard";
import { AlertBox } from "./AlertBox";
import { ProgressPanel } from "./ProgressPanel";
import type { PickMode } from "./SheetPreview";
import { StepIndicator } from "./StepIndicator";
import { StepNavigation } from "./StepNavigation";
import { StepPlaceholder } from "./StepPlaceholder";
import { ConditionStep } from "./steps/ConditionStep";
import { FileSelectStep } from "./steps/FileSelectStep";
import { InspectionStep } from "./steps/InspectionStep";

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
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [reading, setReading] = useState<{ done: number; total: number; current?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 단계가 바뀌면 화면 맨 위부터 보이게 한다. [처음부터 다시]는 고른 파일과 정한 조건도 모두 비운다.
  function move(type: "next" | "prev" | "reset") {
    dispatch({ type });
    // 3단계를 건너뛰고 온 4단계에서 [이전]을 누르면 보지 않은 3단계가 아니라 2단계로 돌아간다.
    if (type === "prev" && state.step === 4 && inspection && !inspection.needsReview) dispatch({ type });
    setError(null);
    if (type === "reset") {
      setSelection(emptySelection);
      setAnalysis(null);
      setConditions(null);
      setInspection(null);
    }
    window.scrollTo({ top: 0 });
  }

  // 2단계의 [취합 시작]: 먼저 파일을 점검한다. 사용자가 판단할 것이 없으면 3단계를 건너뛰고 바로 4단계로 간다. (DESIGN 3단계)
  function startInspection() {
    const settings = conditions ? decisionsToSettings(conditions.decisions) : null;
    if (!analysis || !settings) return;
    const result = inspectAll({
      representative: analysis.representative,
      master: analysis.master,
      departments: analysis.departments,
      unreadable: analysis.unreadable,
      settings,
    });
    setInspection(result);
    move("next");
    if (!result.needsReview) dispatch({ type: "next" });
  }

  function updateSelection(update: (current: Selection) => Selection) {
    setError(null);
    setSelection(update);
  }

  // [분석 시작]: 고른 파일을 브라우저 안에서 읽고 2단계로 넘어간다.
  // 파일은 별도 작업 공간(Web Worker)에서 읽어서, 큰 파일을 읽는 동안에도 화면과 진행 표시가 멈추지 않는다.
  async function startAnalysis() {
    if (!selection.master || reading) return;
    setError(null);
    setReading({ done: 0, total: selection.departments.length + 1 });
    const reader = createWorkbookReader();
    const result = await readSelection(
      selection.master,
      selection.departments,
      (done, total) => setReading((current) => ({ ...current, done, total })),
      { read: reader.read, onFileStart: (fileName) => setReading((current) => (current ? { ...current, current: fileName } : current)) },
    ).finally(() => reader.dispose());
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
  else if (state.step === 3 && !inspection?.canContinue) blockedReason = "취합할 수 있는 부서 파일이 없어 계속할 수 없습니다.";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-medium text-zinc-900 dark:text-zinc-50">Excel 범용 취합 프로그램</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">여러 부서의 엑셀 파일을 마스터 표 하나로 모읍니다.</p>
      </header>

      <StepIndicator current={state.step} />

      <main className="flex min-w-0 flex-1 flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 sm:p-6 dark:border-zinc-800 dark:bg-zinc-900">
        {error && <AlertBox tone="error">{error}</AlertBox>}

        {reading && <ProgressPanel title="파일을 읽는 중입니다" done={reading.done} total={reading.total} current={reading.current} />}

        {state.step === 1 && !reading && (
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
        {state.step === 3 && inspection && <InspectionStep inspection={inspection} />}
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
        nextLabel={state.step === 3 && inspection && inspection.excludedFiles.length > 0 ? "제외하고 계속" : undefined}
        onPrev={() => move("prev")}
        onNext={() => (state.step === 1 ? void startAnalysis() : state.step === 2 ? startInspection() : move("next"))}
        onReset={() => move("reset")}
      />

      <footer className="text-center text-xs text-zinc-500 dark:text-zinc-500">
        엑셀 파일은 서버에 저장되지 않고 이 브라우저 안에서만 처리됩니다.
      </footer>
    </div>
  );
}

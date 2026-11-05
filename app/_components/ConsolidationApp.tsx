"use client";

// 서비스 전체 화면: 한 페이지 안에서 4단계가 차례로 바뀐다. (DESIGN 1번 화면 구성)
// 1단계(파일 선택)와 2단계(조건 확인, 직접 선택 모드)는 만들었고, 3~4단계는 아직 뼈대다.
import { useReducer, useRef, useState } from "react";
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
import { buildResultFileInWorker } from "../_lib/excel/resultBuilder";
import { resultFileName } from "../_lib/excel/writeResult";
import { detectUnsupportedParts } from "../_lib/excel/detectUnsupported";
import { downloadFile } from "../_lib/excel/download";
import { consolidate, type AppliedValue } from "../_lib/merge/consolidate";
import { failureMessage, requestAnalysis } from "../_lib/ai/requestAnalysis";
import { inspectAll, type Inspection } from "../_lib/merge/inspectAll";
import { buildAnalyzeRequest, type AnalyzePayload } from "../_lib/privacy/buildAnalyzeRequest";
import { buildConsolidationResult } from "../_lib/merge/summarize";
import { readSelection } from "../_lib/readSelection";
import { acceptRecommendation, rejectRecommendation } from "../_lib/recommendations";
import { canPickAnother, pickRepresentative } from "../_lib/representative";
import { chooseForAll, chooseForKey, duplicatesBlockedReason, switchToPerKey } from "../_lib/duplicateChoices";
import type { AiRecommendation, AnalyzeFailureReason, ConditionDecisions, ConditionKey, ConsolidationResult, ConsolidationSettings, DuplicateChoices, SkippedFile, WorkbookData } from "../_lib/types";
import { initialWizardState, wizardReducer } from "../_lib/wizard";
import { AlertBox } from "./AlertBox";
import { HomeHero } from "./HomeHero";
import { HowToDialog } from "./HowToDialog";
import { MascotGuide } from "./MascotGuide";
import { ProgressPanel } from "./ProgressPanel";
import { SiteNav } from "./SiteNav";
import { card } from "./ui";
import type { PickMode } from "./SheetPreview";
import { StepIndicator } from "./StepIndicator";
import { StepNavigation } from "./StepNavigation";
import { ConditionStep } from "./steps/ConditionStep";
import { FileSelectStep } from "./steps/FileSelectStep";
import { InspectionStep } from "./steps/InspectionStep";
import { ResultStep } from "./steps/ResultStep";

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
  aiPayload: AnalyzePayload; // AI에 보낸 데이터 (개인정보 체크 반영, 번호 모양 값은 가림)
  unsupportedParts: string[]; // 마스터 안의 차트·피벗 테이블 등 결과 파일에서 빠질 수 있는 요소 (없으면 빈 목록)
  ai: AiState; // AI 분석 결과. 추천을 화면에 보여 주는 것은 PLAN.md 22번에서 연결한다
};

type AiState = { status: "ok"; recommendation: AiRecommendation } | { status: "failed"; reason: AnalyzeFailureReason };

// 2단계에서 정하는 조건과 화면 상태
type Conditions = {
  decisions: ConditionDecisions;
  previewSheet: string; // 미리보기로 보고 있는 시트
  mode: PickMode; // 지금 고르고 있는 항목
};

// 대표 파일을 정한 직후의 조건 상태: 아무것도 확정하지 않은 처음 모습
// AI가 추천한 시트가 있으면 그 시트를 먼저 미리보기로 보여 준다.
function freshConditions(representative: WorkbookData, ai: AiState): Conditions {
  const recommended = ai.status === "ok" ? ai.recommendation.sheetName.value : null;
  const previewSheet = representative.sheets.find((sheet) => sheet.name === recommended)?.name ?? representative.sheets[0]?.name ?? "";
  return { decisions: initialDecisions, previewSheet, mode: "keyColumn" };
}

export function ConsolidationApp() {
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);
  const [selection, setSelection] = useState<Selection>(emptySelection);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [conditions, setConditions] = useState<Conditions | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [outcome, setOutcome] = useState<{ result: ConsolidationResult; appliedValues: AppliedValue[]; settings: ConsolidationSettings } | null>(null);
  const [applyFormat, setApplyFormat] = useState(false); // 4단계의 "기본 서식 적용" 체크 (기본 꺼짐)
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [duplicateChoices, setDuplicateChoices] = useState<DuplicateChoices | null>(null);
  const [reading, setReading] = useState<{ done: number; total: number; current?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false); // AI 응답을 기다리는 중
  const [view, setView] = useState<"home" | "work">("home"); // 처음에는 홈 화면, 시작을 누르면 작업 화면
  const [openTemplate, setOpenTemplate] = useState(false); // 홈의 [AI로 양식 만들기]로 들어왔을 때 양식 만들기를 열어 둔다
  const [howTo, setHowTo] = useState<{ open: boolean; focus: "steps" | "privacy" }>({ open: false, focus: "steps" });
  const aiRun = useRef(0); // 가장 최근 AI 요청 번호. 오래된 요청의 늦은 답을 버리는 데 쓴다

  // 단계가 바뀌면 화면 맨 위부터 보이게 한다. [처음부터 다시]는 고른 파일과 정한 조건도 모두 비운다.
  function move(type: "next" | "prev" | "reset") {
    dispatch({ type });
    // 3단계를 건너뛰고 온 4단계에서 [이전]을 누르면 보지 않은 3단계가 아니라 2단계로 돌아간다.
    if (type === "prev" && state.step === 4 && inspection && !inspection.needsReview) dispatch({ type });
    setError(null);
    if (type === "reset") {
      aiRun.current++; // 기다리던 AI 답이 늦게 와도 버린다
      setAnalyzing(false);
      setSelection(emptySelection);
      setAnalysis(null);
      setConditions(null);
      setInspection(null);
      setDuplicateChoices(null);
      setOutcome(null);
      setApplyFormat(false);
      setDownloadError(null);
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
    setDuplicateChoices(null); // 점검을 새로 했으니 이전 선택은 지운다
    if (!result.needsReview) {
      // 판단할 것이 없으면 바로 취합해서 4단계로 간다
      if (!runConsolidation(result, null)) return;
      move("next");
      dispatch({ type: "next" });
    } else {
      move("next");
    }
  }

  // 점검을 통과한 파일들을 실제로 취합한다. 성공하면 true, 실패하면 화면에 이유를 보여 주고 false.
  function runConsolidation(checked: Inspection, choices: DuplicateChoices | null): boolean {
    const settings = conditions ? decisionsToSettings(conditions.decisions) : null;
    if (!analysis || !settings) return false;
    try {
      const outcomeResult = consolidate(analysis.master, checked.passedDepartments, settings, choices ?? undefined);
      const result = buildConsolidationResult({
        outcome: outcomeResult,
        settings,
        consolidatedFileCount: checked.passedDepartments.length,
        skippedFiles: checked.excludedFiles,
      });
      setOutcome({ result, appliedValues: outcomeResult.appliedValues, settings });
      setDownloadError(null);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "취합 중 알 수 없는 오류가 났습니다.");
      return false;
    }
  }

  // [결과 엑셀 다운로드]: 원본 마스터 파일을 다시 열어 취합한 칸만 바꿔 새 파일로 내려받는다. 서식은 그대로 남는다.
  async function downloadResult() {
    if (!outcome || !selection.master || downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      // 큰 파일에서도 화면이 멈추지 않도록 별도 작업 공간에서 만든다
      const bytes = await buildResultFileInWorker(await selection.master.arrayBuffer(), outcome.appliedValues, outcome.settings, { applyBasicFormat: applyFormat });
      downloadFile(bytes, resultFileName(selection.master.name));
    } catch (caught) {
      setDownloadError(caught instanceof Error ? caught.message : "결과 파일을 만들지 못했습니다.");
    } finally {
      setDownloading(false);
    }
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
    // 대표 파일은 읽은 부서 파일 중 무작위로 1개를 자동 지정한다. (readSelection이 1개 이상을 보장한다)
    const representative = pickRepresentative(result.departments) ?? result.departments[0];
    const aiPayload = buildAnalyzeRequest(representative, selection.containsPersonalInfo);
    const unsupportedParts = await detectUnsupportedParts(await selection.master.arrayBuffer());
    const ai = await askAi(aiPayload);
    if (ai === null) return; // 기다리는 사이 [처음부터 다시]를 눌렀다
    setAnalysis({ master: result.master, departments: result.departments, unreadable: result.skipped, representative, aiPayload, unsupportedParts, ai });
    setConditions(freshConditions(representative, ai));
    move("next");
  }

  // AI에게 대표 파일 분석을 부탁한다. 실패해도 예외 없이 이유를 돌려주고, 화면은 직접 선택 모드로 간다.
  // 기다리는 사이 [처음부터 다시]를 눌렀다면 결과를 버리기 위해 null을 돌려준다.
  async function askAi(payload: AnalyzePayload): Promise<AiState | null> {
    const run = ++aiRun.current;
    setAnalyzing(true);
    const response = await requestAnalysis(payload.request);
    if (run !== aiRun.current) return null;
    setAnalyzing(false);
    return response.ok ? { status: "ok", recommendation: response.recommendation } : { status: "failed", reason: response.reason };
  }

  // [다른 대표 파일로 다시 분석]: 지금 파일을 뺀 나머지 중 무작위로 다시 뽑고, AI에게 다시 묻고, 조건은 처음부터 다시 정한다.
  async function pickAnotherRepresentative() {
    if (!analysis || analyzing) return;
    const representative = pickRepresentative(analysis.departments, analysis.representative);
    if (!representative) return;
    setError(null);
    const aiPayload = buildAnalyzeRequest(representative, selection.containsPersonalInfo);
    const ai = await askAi(aiPayload);
    if (ai === null) return;
    setAnalysis({ ...analysis, representative, aiPayload, ai });
    setConditions(freshConditions(representative, ai));
  }

  // 항목의 Yes: AI 추천을 그대로 확정한다. 시트를 확정하면 미리보기도 그 시트로 바꾼다.
  function acceptRecommendationFor(key: ConditionKey) {
    if (analysis?.ai.status !== "ok") return;
    const recommendation = analysis.ai.recommendation;
    updateDecisions((decisions) => acceptRecommendation(decisions, recommendation, key));
    if (key === "sheetName" && recommendation.sheetName.value !== null) {
      const sheetName = recommendation.sheetName.value;
      setConditions((current) => (current ? { ...current, previewSheet: sheetName } : current));
    }
  }

  // 항목의 No: 확정을 풀고 미리보기에서 직접 고르게 한다. (시트는 위의 "이 시트로 정하기"로 고른다)
  function rejectRecommendationFor(key: ConditionKey) {
    updateDecisions((decisions) => rejectRecommendation(decisions, key), key === "sheetName" ? undefined : (key as PickMode));
  }

  function updateDecisions(update: (decisions: ConditionDecisions) => ConditionDecisions, nextMode?: PickMode) {
    setConditions((current) => (current ? { ...current, decisions: update(current.decisions), mode: nextMode ?? current.mode } : current));
  }

  // 단계별로 [다음]을 누를 수 없는 이유. 3~4단계의 조건은 각 단계를 만들 때 연결한다.
  let blockedReason: string | null = null;
  if (reading) blockedReason = `파일을 읽는 중입니다… (${reading.done} / ${reading.total})`;
  else if (analyzing) blockedReason = "AI가 분석하는 중입니다…";
  else if (state.step === 1) blockedReason = analysisBlockedReason(selection.master, selection.departments);
  else if (state.step === 2) blockedReason = conditions ? conditionsBlockedReason(conditions.decisions) : "조건을 정할 파일이 없습니다.";
  else if (state.step === 3) {
    if (!inspection?.canContinue) blockedReason = "취합할 수 있는 부서 파일이 없어 계속할 수 없습니다.";
    else blockedReason = duplicatesBlockedReason(inspection.duplicateKeys, duplicateChoices);
  }

  // 홈 화면의 버튼들: 작업 화면으로 넘어간다
  function enterWork(withTemplate: boolean) {
    setOpenTemplate(withTemplate);
    setView("work");
    window.scrollTo({ top: 0 });
  }

  // 로고를 누르면 홈으로 돌아간다. 진행 중인 작업이 있으면 사라진다고 먼저 물어본다.
  function goHome() {
    const hasWork = state.step > 1 || selection.master !== null || selection.departments.length > 0;
    if (hasWork && !window.confirm("처음 화면으로 돌아가면 지금까지 고른 파일과 정한 조건이 사라져요. 돌아갈까요?")) return;
    move("reset");
    setOpenTemplate(false);
    setView("home");
  }

  // 마스코트 말풍선: 지금 단계에서 해야 할 일을 친근한 말로 알려 준다
  let tip = "마스터 표 1개와 부서 파일을 올려 주세요. 파일은 이 컴퓨터 안에서만 읽어요!";
  if (reading) tip = "파일을 읽고 있어요. 큰 파일이면 조금 걸릴 수 있으니 기다려 주세요!";
  else if (analyzing) tip = "AI와 함께 대표 파일을 살펴보는 중이에요. 잠시만요!";
  else if (state.step === 2) {
    tip =
      analysis?.ai.status === "failed"
        ? "앗, 이번에는 제가 양식을 읽지 못했어요. 아래 표에서 직접 눌러 골라 주시겠어요?"
        : "제가 대표 파일을 살펴보고 추천해 봤어요. 맞으면 Yes, 아니면 No를 눌러 주세요!";
  } else if (state.step === 3) tip = "합치기 전에 확인할 게 있어요. 제외되는 파일과 겹친 키를 살펴봐 주세요.";
  else if (state.step === 4) tip = "다 모았어요! 바뀐 칸을 확인하고 결과 파일을 내려받으세요.";

  const howToDialog = <HowToDialog open={howTo.open} focus={howTo.focus} onClose={() => setHowTo((current) => ({ ...current, open: false }))} />;
  const openHowTo = (focus: "steps" | "privacy") => setHowTo({ open: true, focus });

  if (view === "home") {
    return (
      <>
        <HomeHero onStart={() => enterWork(false)} onStartTemplate={() => enterWork(true)} onHowTo={openHowTo} />
        {howToDialog}
      </>
    );
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-paper">
      <SiteNav
        variant="light"
        links={[{ label: "사용 방법", onClick: () => openHowTo("steps") }]}
        cta={{ label: "내 파일은 안전한가요?", onClick: () => openHowTo("privacy") }}
        onLogo={goHome}
      />

      <div className="mx-auto grid w-full max-w-6xl flex-1 content-start gap-5 px-4 pb-12 pt-20 sm:px-6 sm:pt-24 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-8">
        <MascotGuide tip={tip} />

        <div className="flex min-w-0 flex-col gap-5">
          <StepIndicator current={state.step} />

          <main className={`${card} flex min-w-0 flex-col gap-4`}>
            {error && <AlertBox tone="error">{error}</AlertBox>}

            {reading && <ProgressPanel title="파일을 읽는 중입니다" done={reading.done} total={reading.total} current={reading.current} />}

            {analyzing && (
              <section className="flex flex-col items-center gap-3 py-10 text-center" aria-live="polite" aria-busy="true">
                <p className="text-base font-medium text-ink">AI가 대표 파일의 양식을 분석하는 중입니다</p>
                <div className="h-2 w-full max-w-md animate-pulse rounded-full bg-brand/60" />
                <p className="text-xs text-ink-soft">응답이 없으면 10초 뒤 한 번 더 시도하고, 그래도 안 되면 직접 선택하도록 넘어갑니다.</p>
              </section>
            )}

            {state.step === 1 && !reading && !analyzing && (
              <FileSelectStep
                master={selection.master}
                departments={selection.departments}
                containsPersonalInfo={selection.containsPersonalInfo}
                notices={selection.notices}
                templateOpen={openTemplate}
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
            {state.step === 2 && analysis && conditions && !analyzing && (
              <ConditionStep
                representative={analysis.representative}
                previewSheetName={conditions.previewSheet}
                decisions={conditions.decisions}
                mode={conditions.mode}
                unreadableCount={analysis.unreadable.length}
                aiPayload={analysis.aiPayload}
                unsupportedParts={analysis.unsupportedParts}
                aiFailure={analysis.ai.status === "failed" ? failureMessage(analysis.ai.reason) : null}
                recommendation={analysis.ai.status === "ok" ? analysis.ai.recommendation : null}
                onAcceptRecommendation={acceptRecommendationFor}
                onRejectRecommendation={rejectRecommendationFor}
                canPickAnother={canPickAnother(analysis.departments)}
                onPickAnotherRepresentative={pickAnotherRepresentative}
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
            {state.step === 3 && inspection && (
              <InspectionStep
                inspection={inspection}
                duplicateChoices={duplicateChoices}
                onChooseAll={(strategy) => setDuplicateChoices(chooseForAll(strategy))}
                onChoosePerKey={() => setDuplicateChoices((current) => switchToPerKey(current))}
                onChooseKey={(key, strategy) => setDuplicateChoices((current) => chooseForKey(current, key, strategy))}
              />
            )}
            {state.step === 4 && outcome && (
              <ResultStep
                result={outcome.result}
                duplicateChoices={duplicateChoices}
                unsupportedParts={analysis?.unsupportedParts ?? []}
                applyFormat={applyFormat}
                onApplyFormatChange={setApplyFormat}
                downloading={downloading}
                downloadError={downloadError}
                onDownload={() => void downloadResult()}
              />
            )}
          </main>

          <StepNavigation
            step={state.step}
            canGoNext={blockedReason === null}
            blockedReason={blockedReason ?? undefined}
            nextLabel={state.step === 3 && inspection && inspection.excludedFiles.length > 0 ? "제외하고 계속" : undefined}
            onPrev={() => move("prev")}
            onNext={() => {
              if (state.step === 1) void startAnalysis();
              else if (state.step === 2) startInspection();
              else if (state.step === 3 && inspection && runConsolidation(inspection, duplicateChoices)) move("next");
            }}
            onReset={() => move("reset")}
          />
        </div>
      </div>

      <footer className="px-4 pb-8 text-center text-xs text-ink-soft">엑셀 파일은 서버에 저장되지 않고 이 브라우저 안에서만 처리됩니다.</footer>
      {howToDialog}
    </div>
  );
}

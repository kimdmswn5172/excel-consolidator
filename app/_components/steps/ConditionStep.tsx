"use client";

// 2단계. 조건 확인 (직접 선택 모드): 대표 파일의 미리보기 표에서 취합 조건 다섯 가지를 직접 정한다. (DESIGN 2단계)
// AI 추천이 있으면 항목마다 Yes/No로 확정하고, No이거나 추천이 없으면(실패·추천 불가) 미리보기에서 직접 고른다.
import { CONDITION_LABELS, CONDITION_ORDER, decisionText } from "../../_lib/conditions";
import type { AnalyzePayload } from "../../_lib/privacy/buildAnalyzeRequest";
import type { AiRecommendation, ConditionDecisions, ConditionKey, WorkbookData } from "../../_lib/types";
import { RecommendationList } from "./RecommendationList";
import { AlertBox } from "../AlertBox";
import { SheetPreview, type PickMode } from "../SheetPreview";

type Props = {
  representative: WorkbookData;
  previewSheetName: string;
  decisions: ConditionDecisions;
  mode: PickMode;
  unreadableCount: number; // 읽지 못한 부서 파일 수 (3단계에서 자세히 보여 준다)
  aiPayload: AnalyzePayload; // AI에 보낼 데이터 (무엇을 보내는지 사용자에게 알려 준다)
  aiFailure: string | null; // AI 분석이 실패했을 때의 안내 문장 (없으면 null)
  recommendation: AiRecommendation | null; // AI 추천 (실패했으면 null)
  onAcceptRecommendation: (key: ConditionKey) => void; // 항목의 Yes
  onRejectRecommendation: (key: ConditionKey) => void; // 항목의 No
  canPickAnother: boolean; // 대표 파일 후보가 2개 이상인지
  onPickAnotherRepresentative: () => void;
  onPreviewSheetChange: (sheetName: string) => void;
  onConfirmSheet: () => void;
  onModeChange: (mode: PickMode) => void;
  onPickColumn: (column: number) => void;
  onPickRow: (row: number) => void;
};

const MODE_HELP: Record<PickMode, string> = {
  keyColumn: "미리보기 표의 열 머리(A, B, C…)를 눌러 기준 열 하나를 고르세요. 행마다 값이 겹치지 않는 열(사번 등)이 좋습니다.",
  targetColumns: "열 머리를 눌러 마스터에 채울 열을 고르세요. 여러 개를 고를 수 있고, 다시 누르면 빠집니다.",
  headerRow: "행 번호를 눌러 열 이름(헤더)이 적힌 행을 고르세요.",
  dataStartRow: "행 번호를 눌러 실제 데이터가 시작되는 첫 행을 고르세요.",
};

const chip =
  "rounded-full border px-3 py-1 text-sm font-medium aria-pressed:border-blue-600 aria-pressed:bg-blue-600 aria-pressed:text-white border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

function valueOf<T>(decision: { state: string; value?: T }): T | null {
  return decision.state === "confirmed" ? (decision.value as T) : null;
}

export function ConditionStep(props: Props) {
  const { representative, previewSheetName, decisions, mode } = props;
  const sheet = representative.sheets.find((candidate) => candidate.name === previewSheetName) ?? representative.sheets[0];
  const confirmedSheet = valueOf<string>(decisions.sheetName);
  const sheetConfirmed = confirmedSheet === sheet.name;

  return (
    <section className="flex flex-col gap-5" aria-labelledby="step-title">
      <div>
        <h2 id="step-title" className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          2단계. 조건 확인
        </h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          대표 파일의 미리보기 표에서 취합 조건을 정합니다. 정한 조건은 나머지 부서 파일에도 똑같이 적용됩니다.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-700 dark:text-zinc-300">
        <p>
          대표 파일(무작위로 자동 지정): <span className="font-medium">{representative.fileName}</span>
        </p>
        <button
          type="button"
          onClick={props.onPickAnotherRepresentative}
          disabled={!props.canPickAnother}
          title={props.canPickAnother ? "조건은 처음부터 다시 정합니다" : "다른 부서 파일이 없어 바꿀 수 없습니다"}
          className="rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          다른 대표 파일로 다시 분석
        </button>
      </div>

      {props.aiFailure && (
        <AlertBox tone="warning" title="AI 분석 실패">
          {props.aiFailure} 올린 파일과 개인정보 체크는 그대로이고, 아래 미리보기에서 직접 고르면 됩니다.
        </AlertBox>
      )}

      {props.aiPayload.request.headersOnly ? (
        <AlertBox tone="info">개인정보 포함으로 체크하셔서, AI에는 열 이름(헤더)만 보내고 칸의 값은 보내지 않습니다.</AlertBox>
      ) : (
        <AlertBox tone="info">AI에는 시트 위쪽 10행의 샘플만 보냅니다. 엑셀 전체는 보내지 않습니다.</AlertBox>
      )}
      {props.aiPayload.maskedCount > 0 && (
        <AlertBox tone="warning" title="개인정보로 보이는 값을 가렸습니다">
          {props.aiPayload.maskedKinds.join(", ")} 모양의 값 {props.aiPayload.maskedCount}개를 &quot;가림&quot;으로 바꿔서 AI에 보냅니다. 파일에 개인정보가 있다면 1단계에서 &quot;개인정보 포함&quot;을 체크해 다시 분석하세요.
        </AlertBox>
      )}

      {props.unreadableCount > 0 && (
        <AlertBox tone="warning">읽지 못한 부서 파일이 {props.unreadableCount}개 있습니다. 3단계에서 이유와 함께 보여 드립니다.</AlertBox>
      )}

      {/* AI 추천이 있으면 항목별 Yes/No, 없으면(실패) 현재 값만 보여 준다 */}
      {props.recommendation && (
        <RecommendationList
          recommendation={props.recommendation}
          decisions={decisions}
          onAccept={props.onAcceptRecommendation}
          onReject={props.onRejectRecommendation}
        />
      )}
      {!props.recommendation && (
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {CONDITION_ORDER.map((key: ConditionKey) => {
          const text = decisionText(decisions, key);
          const confirmed = decisions[key].state === "confirmed";
          return (
            <div key={key} className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <dt className="text-sm text-zinc-600 dark:text-zinc-400">{CONDITION_LABELS[key]}</dt>
              <dd className="flex items-center gap-2 text-sm">
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{text || "—"}</span>
                <span
                  className={
                    confirmed
                      ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                      : "rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                  }
                >
                  {confirmed ? "확정" : "미정"}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
      )}

      {/* 시트 고르기 */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          미리볼 시트
          <select
            value={sheet.name}
            onChange={(event) => props.onPreviewSheetChange(event.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            {representative.sheets.map((candidate) => (
              <option key={candidate.name} value={candidate.name}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
        {sheetConfirmed ? (
          <span className="text-sm text-emerald-700 dark:text-emerald-300">이 시트로 정했습니다.</span>
        ) : (
          <button
            type="button"
            onClick={props.onConfirmSheet}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            이 시트로 정하기
          </button>
        )}
      </div>

      {/* 무엇을 고를지 */}
      {sheetConfirmed ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="지정할 항목">
            {(["keyColumn", "targetColumns", "headerRow", "dataStartRow"] as PickMode[]).map((item) => (
              <button key={item} type="button" aria-pressed={mode === item} onClick={() => props.onModeChange(item)} className={chip}>
                {CONDITION_LABELS[item]}
              </button>
            ))}
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{MODE_HELP[mode]}</p>
          <SheetPreview
            sheet={sheet}
            mode={mode}
            keyColumn={valueOf<number>(decisions.keyColumn)}
            targetColumns={valueOf<number[]>(decisions.targetColumns) ?? []}
            headerRow={valueOf<number>(decisions.headerRow)}
            dataStartRow={valueOf<number>(decisions.dataStartRow)}
            onPickColumn={props.onPickColumn}
            onPickRow={props.onPickRow}
          />
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span>
              <span className="mr-1 inline-block h-3 w-3 rounded-sm bg-blue-100 align-middle dark:bg-blue-950" />
              기준 열
            </span>
            <span>
              <span className="mr-1 inline-block h-3 w-3 rounded-sm bg-emerald-100 align-middle dark:bg-emerald-950" />
              대상 열
            </span>
            <span>
              <span className="mr-1 inline-block h-3 w-3 rounded-sm bg-amber-100 align-middle dark:bg-amber-950" />
              헤더 행
            </span>
            <span>
              <span className="mr-1 inline-block h-0.5 w-3 bg-blue-500 align-middle" />
              데이터 시작 행
            </span>
          </p>
        </div>
      ) : (
        <SheetPreview
          sheet={sheet}
          mode="headerRow"
          keyColumn={null}
          targetColumns={[]}
          headerRow={null}
          dataStartRow={null}
          onPickColumn={() => {}}
          onPickRow={() => {}}
          readOnly
        />
      )}
    </section>
  );
}

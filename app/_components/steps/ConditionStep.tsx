"use client";

// 2단계. 조건 확인 (직접 선택 모드): 대표 파일의 미리보기 표에서 취합 조건 다섯 가지를 직접 정한다. (DESIGN 2단계)
// AI 추천이 있으면 항목마다 Yes/No로 확정하고, No이거나 추천이 없으면(실패·추천 불가) 미리보기에서 직접 고른다.
import { CONDITION_LABELS, CONDITION_ORDER, decisionText } from "../../_lib/conditions";
import type { AnalyzePayload } from "../../_lib/privacy/buildAnalyzeRequest";
import type { AiRecommendation, ConditionDecisions, ConditionKey, WorkbookData } from "../../_lib/types";
import { RecommendationList } from "./RecommendationList";
import { unsupportedMessage } from "../../_lib/excel/detectUnsupported";
import { AlertBox } from "../AlertBox";
import { btnPrimary, btnSmall, input } from "../ui";
import { SheetPreview, type PickMode } from "../SheetPreview";

type Props = {
  representative: WorkbookData;
  previewSheetName: string;
  decisions: ConditionDecisions;
  mode: PickMode;
  unreadableCount: number; // 읽지 못한 부서 파일 수 (3단계에서 자세히 보여 준다)
  aiPayload: AnalyzePayload; // AI에 보낼 데이터 (무엇을 보내는지 사용자에게 알려 준다)
  unsupportedParts: string[]; // 마스터 안의 결과 파일에서 빠질 수 있는 요소 (경고 표시용)
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
  "rounded-full border border-ink/15 bg-white px-4 py-1.5 text-sm font-medium text-ink transition-colors hover:border-ink aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-white";

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
        <h2 id="step-title" className="text-2xl text-ink">
          2단계. 조건 확인
        </h2>
        <p className="mt-1 text-sm leading-6 text-ink-soft">
          대표 파일의 미리보기 표에서 취합 조건을 정합니다. 정한 조건은 나머지 부서 파일에도 똑같이 적용됩니다.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink">
        <p>
          대표 파일(무작위로 자동 지정): <span className="font-medium">{representative.fileName}</span>
        </p>
        <button
          type="button"
          onClick={props.onPickAnotherRepresentative}
          disabled={!props.canPickAnother}
          title={props.canPickAnother ? "조건은 처음부터 다시 정합니다" : "다른 부서 파일이 없어 바꿀 수 없습니다"}
          className={btnSmall}
        >
          다른 대표 파일로 다시 분석
        </button>
      </div>

      {props.unsupportedParts.length > 0 && (
        <AlertBox tone="warning" title="마스터 표에 결과 파일에서 빠질 수 있는 요소가 있습니다">
          {unsupportedMessage(props.unsupportedParts)}
        </AlertBox>
      )}

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
            <div key={key} className="flex items-center justify-between gap-2 rounded-2xl border border-ink/10 px-3 py-2">
              <dt className="text-sm text-ink-soft">{CONDITION_LABELS[key]}</dt>
              <dd className="flex items-center gap-2 text-sm">
                <span className="font-medium text-ink">{text || "—"}</span>
                <span
                  className={
                    confirmed
                      ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800"
                      : "rounded-full bg-ink/5 px-2 py-0.5 text-xs text-ink-soft"
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
        <label className="flex items-center gap-2 text-sm text-ink">
          미리볼 시트
          <select
            value={sheet.name}
            onChange={(event) => props.onPreviewSheetChange(event.target.value)}
            className={`${input} !w-auto !py-1.5`}
          >
            {representative.sheets.map((candidate) => (
              <option key={candidate.name} value={candidate.name}>
                {candidate.name}
              </option>
            ))}
          </select>
        </label>
        {sheetConfirmed ? (
          <span className="text-sm text-emerald-700">이 시트로 정했습니다.</span>
        ) : (
          <button
            type="button"
            onClick={props.onConfirmSheet}
            className={`${btnPrimary} !px-4 !py-2`}
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
          <p className="text-sm text-ink-soft">{MODE_HELP[mode]}</p>
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
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
            <span>
              <span className="mr-1 inline-block h-3 w-3 rounded-sm bg-blue-100 align-middle" />
              기준 열
            </span>
            <span>
              <span className="mr-1 inline-block h-3 w-3 rounded-sm bg-emerald-100 align-middle" />
              대상 열
            </span>
            <span>
              <span className="mr-1 inline-block h-3 w-3 rounded-sm bg-amber-100 align-middle" />
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

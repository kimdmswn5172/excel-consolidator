// 2단계의 항목별 AI 추천 목록: 추천값, 신뢰도, Yes/No, 현재 확정 상태를 한 줄씩 보여 준다. (DESIGN 2단계)
//  - 신뢰도 70% 미만은 "확인 필요", 값이 없으면 "추천 불가"로 표시한다.
//  - Yes를 누르면 추천값이 확정되고, No를 누르면 확정이 풀려 아래 미리보기에서 직접 고른다.
import { CONDITION_LABELS, CONDITION_ORDER, decisionText } from "../../_lib/conditions";
import { acceptBlockedReason, NEEDS_CHECK_LABEL, recommendedText, recommendationMeta } from "../../_lib/recommendations";
import type { AiRecommendation, ConditionDecisions, ConditionKey } from "../../_lib/types";

type Props = {
  recommendation: AiRecommendation;
  decisions: ConditionDecisions;
  onAccept: (key: ConditionKey) => void;
  onReject: (key: ConditionKey) => void;
};

const yesNo =
  "rounded-lg border px-3 py-1 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:border-blue-600 aria-pressed:bg-blue-600 aria-pressed:text-white border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";

export function RecommendationList({ recommendation, decisions, onAccept, onReject }: Props) {
  return (
    <ul className="flex flex-col gap-2" aria-label="AI 추천 항목">
      {CONDITION_ORDER.map((key) => {
        const meta = recommendationMeta(recommendation, key);
        const text = recommendedText(recommendation, key);
        const blocked = acceptBlockedReason(decisions, recommendation, key);
        const decision = decisions[key];
        const acceptedByAi = decision.state === "confirmed" && decision.by === "ai";
        const current = decisionText(decisions, key);

        return (
          <li key={key} className="flex flex-col gap-2 rounded-lg border border-zinc-200 px-3 py-2 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{CONDITION_LABELS[key]}</span>
              <span className="flex flex-wrap items-center gap-2 text-sm">
                {text === null ? (
                  <span className="font-medium text-zinc-500 dark:text-zinc-400">추천 불가</span>
                ) : (
                  <>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">AI 추천: {text}</span>
                    <span
                      className={
                        meta.status === "needs-check"
                          ? "rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                          : "rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      }
                    >
                      신뢰도 {meta.confidence}%{meta.status === "needs-check" ? ` ⚠ ${NEEDS_CHECK_LABEL}` : ""}
                    </span>
                  </>
                )}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {decision.state === "confirmed"
                  ? `확정: ${current} (${acceptedByAi ? "AI 추천 그대로" : "직접 선택"})`
                  : blocked && text !== null
                    ? blocked
                    : text === null
                      ? "아래 미리보기에서 직접 선택해 주세요."
                      : "미정"}
              </span>
            </div>
            <div className="flex shrink-0 gap-2" role="group" aria-label={`${CONDITION_LABELS[key]} 선택`}>
              <button type="button" aria-pressed={acceptedByAi} disabled={blocked !== null} onClick={() => onAccept(key)} className={yesNo}>
                Yes
              </button>
              <button type="button" aria-pressed={false} onClick={() => onReject(key)} className={yesNo}>
                No
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

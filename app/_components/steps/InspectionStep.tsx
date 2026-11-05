// 3단계. 점검 결과 화면: 취합에서 빠지는 파일과 이유, 마스터 경고를 보여 준다. (PRD 5번, DESIGN 3단계)
// 중복 키는 처리 방법(첫 번째·마지막·모두 나열·비워 두기)을 전체에 한 번에 또는 키별로 고르게 한다. (PLAN.md 16번)
import { describeOccurrences, STRATEGY_HINTS, STRATEGY_LABELS, STRATEGY_ORDER } from "../../_lib/duplicateChoices";
import type { DuplicateChoices, DuplicateStrategy, SkipReason } from "../../_lib/types";
import type { Inspection } from "../../_lib/merge/inspectAll";
import { AlertBox } from "../AlertBox";

const REASON_LABELS: Record<SkipReason, string> = {
  "not-xlsx": ".xlsx 아님",
  unreadable: "읽을 수 없음",
  "password-protected": "비밀번호",
  "header-mismatch": "헤더 다름",
  "merged-cell-risk": "병합 셀 위험",
};

type Props = {
  inspection: Inspection;
  duplicateChoices: DuplicateChoices | null;
  onChooseAll: (strategy: DuplicateStrategy) => void;
  onChoosePerKey: () => void;
  onChooseKey: (key: string, strategy: DuplicateStrategy) => void;
};

export function InspectionStep({ inspection, duplicateChoices, onChooseAll, onChoosePerKey, onChooseKey }: Props) {
  const { excludedFiles, masterWarnings, duplicateKeys, passedDepartments, canContinue } = inspection;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium text-ink">3단계. 점검 결과</h2>
        <p className="text-sm text-ink-soft">
          취합하기 전에 파일을 점검했습니다. 취합할 수 있는 부서 파일은 <strong>{passedDepartments.length}개</strong>입니다.
        </p>
      </div>

      {!canContinue && (
        <AlertBox tone="error" title="취합할 수 있는 부서 파일이 없습니다">
          모든 부서 파일이 제외되었습니다. [이전]으로 돌아가 조건을 다시 확인하거나, [처음부터 다시]로 파일을 다시 골라 주세요.
        </AlertBox>
      )}

      {masterWarnings.length > 0 && (
        <AlertBox tone="warning" title="마스터 표를 확인해 주세요">
          <ul className="list-disc pl-5">
            {masterWarnings.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
          <p className="mt-1">마스터는 제외할 수 없습니다. 이대로 계속하면 결과가 잘못될 수 있습니다.</p>
        </AlertBox>
      )}

      {excludedFiles.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-ink">취합에서 제외된 파일 ({excludedFiles.length}개)</h3>
          <ul className="flex flex-col gap-2">
            {excludedFiles.map((file) => (
              <li
                key={`${file.fileName}-${file.reason}`}
                className="flex flex-col gap-1 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-ink">{file.fileName}</span>
                  <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs text-amber-900">
                    {REASON_LABELS[file.reason]}
                  </span>
                </div>
                <p className="leading-6 text-ink">{file.message}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {duplicateKeys.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-ink">중복된 키 ({duplicateKeys.length}건)</h3>
          <p className="text-sm text-ink-soft">
            같은 키가 여러 번 나옵니다. 어느 값을 쓸지 프로그램이 마음대로 정하지 않습니다. 처리 방법을 골라 주세요.
          </p>
          <ul className="flex flex-col gap-1 rounded-2xl border border-ink/10 p-3 text-sm">
            {duplicateKeys.map((duplicate) => (
              <li key={duplicate.key} className="flex flex-col gap-1 py-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  <span className="font-medium text-ink">키 &quot;{duplicate.displayKey}&quot;</span>
                  <span className="text-ink-soft"> — {describeOccurrences(duplicate.occurrences)}</span>
                </span>
                {duplicateChoices?.mode === "per-key" && (
                  <select
                    aria-label={`${duplicate.displayKey}의 처리 방법`}
                    value={duplicateChoices.byKey[duplicate.key] ?? ""}
                    onChange={(event) => onChooseKey(duplicate.key, event.target.value as DuplicateStrategy)}
                    className="rounded-xl border border-ink/10 bg-white px-2 py-1 text-sm"
                  >
                    <option value="" disabled>
                      선택해 주세요
                    </option>
                    {STRATEGY_ORDER.map((strategy) => (
                      <option key={strategy} value={strategy}>
                        {STRATEGY_LABELS[strategy]}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            ))}
          </ul>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-ink">처리 방법</legend>
            {STRATEGY_ORDER.map((strategy) => (
              <label key={strategy} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="duplicate-strategy"
                  className="mt-1"
                  checked={duplicateChoices?.mode === "all" && duplicateChoices.strategy === strategy}
                  onChange={() => onChooseAll(strategy)}
                />
                <span>
                  <span className="font-medium text-ink">{STRATEGY_LABELS[strategy]}</span>
                  <span className="text-ink-soft"> — {STRATEGY_HINTS[strategy]}</span>
                </span>
              </label>
            ))}
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="duplicate-strategy"
                className="mt-1"
                checked={duplicateChoices?.mode === "per-key"}
                onChange={onChoosePerKey}
              />
              <span className="font-medium text-ink">키별로 따로 고르기</span>
            </label>
          </fieldset>
        </div>
      )}
    </section>
  );
}

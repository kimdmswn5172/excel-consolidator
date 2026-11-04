// 맨 아래의 [이전] [다음] 버튼. 조건이 채워지기 전에는 [다음]이 눌리지 않고, 그 이유를 버튼 옆에 적는다.
import { NEXT_LABELS } from "../_lib/wizard";
import type { AppStep } from "../_lib/types";

type Props = {
  step: AppStep;
  canGoNext: boolean;
  blockedReason?: string; // [다음]이 눌리지 않을 때 보여 줄 이유
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
};

const secondaryButton =
  "rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";
const primaryButton =
  "rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500";

export function StepNavigation({ step, canGoNext, blockedReason, onPrev, onNext, onReset }: Props) {
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800" aria-label="단계 이동">
      <div>
        {step > 1 && (
          <button type="button" onClick={onPrev} className={secondaryButton}>
            ← 이전
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {step === 4 ? (
          <button type="button" onClick={onReset} className={secondaryButton}>
            처음부터 다시
          </button>
        ) : (
          <>
            {!canGoNext && blockedReason && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{blockedReason}</p>
            )}
            <button type="button" onClick={onNext} disabled={!canGoNext} className={primaryButton}>
              {NEXT_LABELS[step]} →
            </button>
          </>
        )}
      </div>
    </nav>
  );
}

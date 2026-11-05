// 맨 아래의 [이전] [다음] 버튼. 조건이 채워지기 전에는 [다음]이 눌리지 않고, 그 이유를 버튼 옆에 적는다.
import type { AppStep } from "../_lib/types";
import { NEXT_LABELS } from "../_lib/wizard";
import { btnPrimary, btnSecondary } from "./ui";

type Props = {
  step: AppStep;
  canGoNext: boolean;
  blockedReason?: string; // [다음]이 눌리지 않을 때 보여 줄 이유
  nextLabel?: string; // 버튼 글자를 단계 기본값 대신 쓰고 싶을 때 (예: 3단계의 [제외하고 계속])
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
};

export function StepNavigation({ step, canGoNext, blockedReason, nextLabel, onPrev, onNext, onReset }: Props) {
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="단계 이동">
      <div>
        {step > 1 && (
          <button type="button" onClick={onPrev} className={btnSecondary}>
            ← 이전
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3">
        {step === 4 ? (
          <button type="button" onClick={onReset} className={btnSecondary}>
            처음부터 다시
          </button>
        ) : (
          <>
            {!canGoNext && blockedReason && <p className="max-w-xs text-right text-sm text-ink-soft">{blockedReason}</p>}
            <button type="button" onClick={onNext} disabled={!canGoNext} className={btnPrimary}>
              {nextLabel ?? NEXT_LABELS[step]} →
            </button>
          </>
        )}
      </div>
    </nav>
  );
}

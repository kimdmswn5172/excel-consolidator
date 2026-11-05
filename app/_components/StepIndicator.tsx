// 맨 위의 단계 표시줄: 지금 몇 단계인지, 어디까지 끝났는지 보여 준다. (DESIGN 11번)
// 끝난 단계는 남색 원에 체크, 지금 단계는 빨간 원, 남은 단계는 테두리만 있는 원이고, 원 사이를 선이 잇는다.
import type { AppStep } from "../_lib/types";
import { STEP_TITLES } from "../_lib/wizard";

const STEPS: AppStep[] = [1, 2, 3, 4];

export function StepIndicator({ current }: { current: AppStep }) {
  return (
    <ol className="grid grid-cols-4" aria-label="진행 단계">
      {STEPS.map((step) => {
        const done = step < current;
        const active = step === current;
        return (
          <li key={step} aria-current={active ? "step" : undefined} className="relative flex flex-col items-center gap-2 text-center">
            {/* 앞 단계와 이어지는 선 */}
            {step > 1 && <span className={`absolute right-1/2 top-[18px] h-0.5 w-full -translate-y-1/2 ${step <= current ? "bg-ink" : "bg-ink/15"}`} aria-hidden="true" />}
            <span
              className={[
                "relative z-10 flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors",
                active && "bg-brand text-white shadow-[0_0_0_5px_rgba(228,67,42,0.18)]",
                done && "bg-ink text-white",
                !active && !done && "border-2 border-ink/20 bg-paper text-ink/40",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {done ? "✓" : step}
            </span>
            <span className={["text-xs sm:text-sm", active ? "font-medium text-ink" : "text-ink-soft"].join(" ")}>{STEP_TITLES[step]}</span>
          </li>
        );
      })}
    </ol>
  );
}

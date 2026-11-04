// 맨 위의 단계 표시줄: 지금 몇 단계인지, 어디까지 끝났는지 보여 준다.
import { STEP_TITLES } from "../_lib/wizard";
import type { AppStep } from "../_lib/types";

const STEPS: AppStep[] = [1, 2, 3, 4];

export function StepIndicator({ current }: { current: AppStep }) {
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="진행 단계">
      {STEPS.map((step) => {
        const done = step < current;
        const active = step === current;
        return (
          <li key={step} aria-current={active ? "step" : undefined} className="flex flex-col items-center gap-1.5 text-center">
            <span
              className={[
                "flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium",
                active && "bg-blue-600 text-white",
                done && "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
                !active && !done && "border border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {done ? "✓" : step}
            </span>
            <span
              className={[
                "text-xs sm:text-sm",
                active ? "font-medium text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400",
              ].join(" ")}
            >
              {STEP_TITLES[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

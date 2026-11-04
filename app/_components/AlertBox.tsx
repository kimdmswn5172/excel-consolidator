// 안내 상자: 오류와 경고는 이유와 함께 이 상자로 보여 준다. (DESIGN 1번 공통 틀)
import type { ReactNode } from "react";

type Tone = "info" | "warning" | "error";

const TONE_STYLES: Record<Tone, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-100",
  warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-100",
  error: "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/60 dark:text-red-100",
};

export function AlertBox({ tone = "info", title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm leading-6 ${TONE_STYLES[tone]}`}>
      {title && <p className="font-medium">{title}</p>}
      <div>{children}</div>
    </div>
  );
}

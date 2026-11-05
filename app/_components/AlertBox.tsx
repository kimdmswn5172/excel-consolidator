// 안내 상자: 오류와 경고는 이유와 함께 이 상자로 보여 준다. (DESIGN 1번 공통 틀, 11번 디자인)
import type { ReactNode } from "react";

type Tone = "info" | "warning" | "error";

const TONE_STYLES: Record<Tone, string> = {
  info: "border-ink/10 bg-paper text-ink",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  error: "border-brand/40 bg-brand/5 text-brand-dark",
};

const ICONS: Record<Tone, string> = { info: "💡", warning: "⚠", error: "⛔" };

export function AlertBox({ tone = "info", title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex gap-3 rounded-2xl border px-4 py-3 text-sm leading-6 ${TONE_STYLES[tone]}`}>
      <span className="select-none leading-6" aria-hidden="true">
        {ICONS[tone]}
      </span>
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}

// 아직 기능을 만들지 않은 단계에 보여 주는 자리 표시. 각 단계의 실제 기능은 PLAN.md의 다음 작업에서 채운다.
import { AlertBox } from "./AlertBox";

type Props = {
  title: string;
  description: string;
  items: string[]; // 이 단계에 들어갈 내용
  plannedTask: string; // 이 단계를 만들 PLAN.md 작업 번호
};

export function StepPlaceholder({ title, description, items, plannedTask }: Props) {
  return (
    <section className="flex flex-col gap-4" aria-labelledby="step-title">
      <div>
        <h2 id="step-title" className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{description}</p>
      </div>
      <div className="rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">이 화면에 들어갈 것</p>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <AlertBox tone="info">아직 뼈대만 있는 화면입니다. 실제 기능은 {plannedTask}에서 만듭니다.</AlertBox>
    </section>
  );
}

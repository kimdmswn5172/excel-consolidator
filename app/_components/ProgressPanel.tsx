// 오래 걸리는 작업(파일 읽기, 취합) 중에 보여 주는 진행 표시. 몇 개 중 몇 개를 끝냈는지와 지금 처리 중인 파일을 보여 준다.
type Props = {
  title: string;
  done: number;
  total: number;
  current?: string; // 지금 처리 중인 파일 이름
};

export function ProgressPanel({ title, done, total, current }: Props) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <section className="flex flex-col items-center gap-4 py-10 text-center" aria-live="polite" aria-busy="true">
      <p className="text-base font-medium text-ink">{title}</p>
      <div
        className="h-2 w-full max-w-md overflow-hidden rounded-full bg-ink/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label={title}
      >
        <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-sm text-ink-soft">
        {done} / {total}개 완료 ({percent}%)
      </p>
      {current && (
        <p className="max-w-md truncate text-xs text-ink-soft" title={current}>
          지금 읽는 파일: {current}
        </p>
      )}
      <p className="text-xs text-ink-soft">파일이 크면 시간이 걸릴 수 있습니다. 화면을 닫지 말고 기다려 주세요.</p>
    </section>
  );
}

// 화면 전체에서 같이 쓰는 모양(Tailwind 클래스 모음). 버튼·카드·입력 칸의 모양을 한 곳에서 정해서 화면마다 같은 느낌을 유지한다. (DESIGN 11번)

// 가장 중요한 버튼 (다음 단계, 다운로드 등). 평소에는 남색, 마우스를 올리면 마스코트의 빨강.
export const btnPrimary =
  "inline-flex items-center justify-center whitespace-nowrap gap-2 rounded-full bg-ink px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-brand disabled:cursor-not-allowed disabled:bg-ink/15 disabled:text-ink/40";

// 보조 버튼 (이전, 취소, 추가 등)
export const btnSecondary =
  "inline-flex items-center justify-center whitespace-nowrap gap-2 rounded-full border border-ink/15 bg-white px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-ink hover:bg-ink hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-ink/15 disabled:hover:bg-white disabled:hover:text-ink";

// 작은 보조 버튼
export const btnSmall =
  "inline-flex items-center justify-center whitespace-nowrap gap-1 rounded-full border border-ink/15 bg-white px-3.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-ink hover:bg-ink hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-ink/15 disabled:hover:bg-white disabled:hover:text-ink";

// 흰 카드 (각 단계의 본문)
export const card = "rounded-3xl bg-white p-5 shadow-[0_12px_40px_-16px_rgba(24,27,45,0.25)] sm:p-8";

// 글자 입력 칸
export const input =
  "w-full rounded-xl border border-ink/15 bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20";

// 카드 안의 연한 구역
export const panel = "rounded-2xl border border-ink/10 bg-paper/60 p-4";

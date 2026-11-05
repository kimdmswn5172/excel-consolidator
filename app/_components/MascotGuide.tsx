"use client";

// 작업 화면 옆에서 지금 해야 할 일을 말풍선으로 알려 주는 마스코트. (DESIGN 11번)
// 넓은 화면에서는 왼쪽에 고정해 스크롤해도 따라오고, 좁은 화면에서는 본문 위에 가로로 놓인다.
// 여기서는 커서를 따라 움직이지 않고, 앞모습 한 장이 위아래로 살짝 떠다니기만 한다. (움직임은 홈 화면에서 보여 준다)
import type { ReactNode } from "react";

export function MascotGuide({ tip }: { tip: ReactNode }) {
  return (
    <aside className="flex items-center gap-3 lg:sticky lg:top-24 lg:flex-col lg:items-stretch lg:gap-2" aria-label="도우미 안내">
      <div className="relative order-2 min-w-0 flex-1 rounded-3xl bg-white px-4 py-3 text-sm leading-6 text-ink shadow-[0_8px_30px_-12px_rgba(24,27,45,0.3)] lg:order-1 lg:flex-none lg:px-5 lg:py-4">
        {tip}
        {/* 말풍선 꼬리: 좁은 화면에서는 왼쪽(마스코트 쪽), 넓은 화면에서는 아래쪽 */}
        <span className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 bg-white lg:-bottom-1.5 lg:left-1/2 lg:top-auto lg:-translate-x-1/2 lg:translate-y-0" aria-hidden="true" />
      </div>
      <div className="relative order-1 h-20 w-20 shrink-0 select-none lg:order-2 lg:mx-auto lg:h-52 lg:w-52">
        {/* eslint-disable-next-line @next/next/no-img-element -- 크기가 정해진 작은 정적 그림이라 일반 img로 충분하다 */}
        <img src="/mascot/front.webp" alt="회사 마스코트" width={2000} height={2000} draggable={false} className="animate-float absolute inset-0 h-full w-full object-contain" />
      </div>
    </aside>
  );
}

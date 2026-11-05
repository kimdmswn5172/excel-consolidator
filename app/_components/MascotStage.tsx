"use client";

// 회사 마스코트. 마우스를 좌우로 움직이면(손가락으로 끌면) 앞모습 → 옆모습 → 뒷모습으로 몸을 돌린다. (DESIGN 11번)
// 그림은 3장뿐이라 가까운 모습을 보여 주고, 바뀌는 순간에는 가로로 납작해졌다가 펴지게 해서 도는 것처럼 보이게 한다.
// 움직임은 화면 갱신(React) 없이 그림의 스타일을 바로 바꿔서 부드럽게 한다.
import { useEffect, useRef } from "react";
import { easeToward, nextProgress, viewFor, type MascotView } from "../_lib/mascotTurn";

const SOURCES: Record<MascotView, string> = {
  front: "/mascot/front.webp",
  side: "/mascot/side.webp",
  back: "/mascot/back.webp",
};
const VIEWS: MascotView[] = ["front", "side", "back"];

type Props = {
  interactive?: boolean; // false이면 마우스를 따라 돌지 않고 fixedView만 보여 준다
  fixedView?: MascotView;
  className?: string; // 위치와 크기를 정한다. absolute 또는 relative가 반드시 들어 있어야 한다
};

export function MascotStage({ interactive = true, fixedView = "front", className = "" }: Props) {
  const images = useRef<Partial<Record<MascotView, HTMLImageElement | null>>>({});

  useEffect(() => {
    function apply(progress: number) {
      const { view, squeeze } = viewFor(progress);
      for (const name of VIEWS) {
        const image = images.current[name];
        if (!image) continue;
        const visible = name === view;
        image.style.opacity = visible ? "1" : "0";
        // 몸이 도는 방향으로 아주 살짝 기울여 입체감을 더한다
        image.style.transform = visible ? `scaleX(${squeeze}) rotate(${(0.5 - progress) * 4}deg)` : "scaleX(0.45)";
      }
    }

    if (!interactive) {
      for (const name of VIEWS) {
        const image = images.current[name];
        if (image) {
          image.style.opacity = name === fixedView ? "1" : "0";
          image.style.transform = "none";
        }
      }
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let target = 0; // 마우스가 만든 목표 진행 값
    let current = 0; // 지금 보이는 진행 값 (목표를 부드럽게 따라간다)
    let previousX: number | null = null;
    let pressed = false;
    let frame = 0;

    function tick() {
      current = easeToward(current, target);
      apply(current);
      frame = current === target ? 0 : requestAnimationFrame(tick);
    }
    const start = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    // 마우스는 움직이기만 해도, 터치와 펜은 누른 채 끌 때만 돈다
    function onMove(event: PointerEvent) {
      if (reduceMotion) return;
      const drives = event.pointerType === "mouse" || pressed;
      if (!drives || previousX === null) {
        previousX = event.clientX;
        return;
      }
      target = nextProgress(target, event.clientX - previousX, window.innerWidth);
      previousX = event.clientX;
      start();
    }
    function onDown(event: PointerEvent) {
      pressed = true;
      previousX = event.clientX;
    }
    function onUp() {
      pressed = false;
      previousX = null;
    }

    apply(0);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [interactive, fixedView]);

  return (
    <div className={`select-none ${className}`} style={{ touchAction: "pan-y" }} aria-hidden={!interactive}>
      <div className="animate-float absolute inset-0">
        {/* 돌지 않는 작은 마스코트는 보여 줄 모습 한 장만 불러와 메모리를 아낀다 */}
        {(interactive ? VIEWS : [fixedView]).map((name) => (
          // eslint-disable-next-line @next/next/no-img-element -- 크기가 정해진 작은 정적 그림이라 일반 img로 충분하다
          <img
            key={name}
            ref={(element) => {
              images.current[name] = element;
            }}
            src={SOURCES[name]}
            alt={name === "front" ? "회사 마스코트" : ""}
            width={2000}
            height={2000}
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain transition-opacity duration-100 will-change-transform"
            style={{ opacity: interactive ? (name === "front" ? 1 : 0) : 1 }}
          />
        ))}
      </div>
    </div>
  );
}

"use client";

// 회사 마스코트. 마우스 커서(손가락)를 따라 머리를 돌리고, 눈이 깜빡이고, 몸이 통통 튀며 입체적으로 움직인다. (DESIGN 11번)
//
// 사진은 앞·옆·뒤 3장뿐이라 진짜 3D 모델 대신 "겹친 조각" 방식으로 입체감을 만든다.
//   바탕(머리+몸, 얼굴 요소를 지운 그림) → 머리 조각을 목 뒤를 축으로 원근감 있게 기울이고,
//   얼굴(코·입·볼)과 눈 조각은 둥근 머리 위에서 미끄러지듯 움직이며(머리 모양으로 잘라 가장자리에서 사라짐),
//   커서가 화면 가장자리 쪽으로 멀어지면 실제 옆모습 사진을 섞는다.
// 움직임은 스프링(용수철) 물리로 계산해서, 목표를 살짝 지나쳤다 돌아오는 살아 있는 느낌을 준다.
// 화면 갱신(React) 없이 요소의 스타일을 직접 바꿔서 부드럽게 한다.
import { useEffect, useRef } from "react";
import {
  FEATURES,
  SIDE_OFFSET,
  blinkScale,
  clamp,
  headAngles,
  idleTarget,
  pitchFromPointer,
  projectFeature,
  sideBlend,
  stepSpring,
  yawFromPointer,
  type Spring,
} from "../_lib/mascotRig";

// 그림 안에서의 위치(그림 한 변에 대한 비율). 앞모습 사진을 재서 정했다.
const NECK_PIVOT = "49% 60.5%"; // 머리가 돌아가는 축(목)
// 머리 조각을 자르는 선: 사진을 재서 구한 실제 턱선을 따라간다(턱 아래 목·어깨는 몸 조각에 남긴다). 귀는 통째로 머리 조각에 들어간다.
// 몸 조각은 턱 아래(64%)부터 쓰되, 가운데 목 부분만 59%부터 써서 이음새를 겹쳐 가린다. (옆은 64%부터라서 머리가 움직여도 머리 테두리 조각이 삐져나오지 않는다)
const HEAD_CLIP =
  "polygon(0% 0%, 100% 0%, 100% 65%, 68% 65%, 68% 59.4%, 66% 60.5%, 64% 61.3%, 62% 62.1%, 58% 62.7%, 52% 63.6%, 47% 63.6%, 42% 63.2%, 36% 61.2%, 34% 60.5%, 30% 58.1%, 30% 65%, 0% 65%)";
const BODY_CLIP = "polygon(0% 64%, 40% 64%, 41% 59%, 59% 59%, 60% 64%, 100% 64%, 100% 100%, 0% 100%)";
const IDLE_AFTER_MS = 3500; // 커서가 이만큼 가만히 있으면 혼자 두리번거린다

const layer = "absolute inset-0 h-full w-full object-contain";

export function MascotStage({ className = "" }: { className?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const rig = useRef<HTMLDivElement>(null);
  const front = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLImageElement>(null);
  const head = useRef<HTMLDivElement>(null);
  const features = useRef<(HTMLImageElement | null)[]>([]); // FEATURES와 같은 순서
  const side = useRef<HTMLImageElement>(null);
  const shadow = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = root.current;
    if (!stage) return;
    // 움직임을 줄여 달라는 설정이면 가만히 서 있는다
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let yaw: Spring = { x: 0, v: 0 };
    let pitch: Spring = { x: 0, v: 0 };
    let bodyLag: Spring = { x: 0, v: 0 }; // 몸은 머리보다 늦게 따라온다
    let bounce: Spring = { x: 0, v: 0 }; // 통통 튀는 높이
    let pointer: { x: number; y: number } | null = null;
    let lastMove = -Infinity;
    let pressed = false;
    let blinkAt = performance.now() + 2200;
    let blinkStart = -Infinity;
    let previous = performance.now();
    let frame = 0;

    function onMove(event: PointerEvent) {
      // 마우스는 움직이기만 해도, 터치와 펜은 누른 채로 움직일 때 따라간다
      if (event.pointerType !== "mouse" && !pressed) return;
      pointer = { x: event.clientX, y: event.clientY };
      lastMove = performance.now();
    }
    function onDown(event: PointerEvent) {
      pressed = true;
      pointer = { x: event.clientX, y: event.clientY };
      lastMove = performance.now();
      // 마스코트를 누르면 폴짝 뛴다
      const box = stage?.getBoundingClientRect();
      if (box && event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom) {
        bounce = { ...bounce, v: -2.4 };
      }
    }
    function onUp() {
      pressed = false;
    }

    function tick(now: number) {
      frame = requestAnimationFrame(tick);
      if (document.hidden || !stage) return;
      const dt = Math.min(0.033, (now - previous) / 1000);
      previous = now;
      const box = stage.getBoundingClientRect();
      const size = box.width;

      // 목표 각도: 커서를 향해, 커서가 가만히 있으면 혼자 두리번
      let targetYaw: number;
      let targetPitch: number;
      if (pointer && now - lastMove < IDLE_AFTER_MS) {
        targetYaw = yawFromPointer(pointer.x - (box.left + box.width * 0.5), window.innerWidth / 2);
        targetPitch = pitchFromPointer(pointer.y - (box.top + box.height * 0.4), window.innerHeight / 2);
      } else {
        const idle = idleTarget(now / 1000);
        targetYaw = idle.yaw;
        targetPitch = idle.pitch;
      }

      yaw = stepSpring(yaw, targetYaw, dt, 110, 13);
      pitch = stepSpring(pitch, targetPitch, dt, 110, 13);
      bodyLag = stepSpring(bodyLag, yaw.x, dt, 40, 9);
      bounce = stepSpring(bounce, 0, dt, 220, 12);
      const breathe = Math.sin(now / 1000 * 2.1) * 0.004; // 숨 쉬듯 아주 조금 커졌다 작아진다

      // 눈 깜빡임: 2.5~5.5초마다
      if (now >= blinkAt) {
        blinkStart = now;
        blinkAt = now + 2500 + Math.random() * 3000;
      }

      const { side: sideWeight, mirrored } = sideBlend(yaw.x);
      const featureYaw = clamp(yaw.x * 0.85, -72, 72); // 얼굴 조각이 머리 표면을 따라 도는 각도
      const featurePitch = pitch.x * 0.26;
      const blink = blinkScale(now - blinkStart);
      const angles = headAngles(yaw.x, pitch.x);
      const lift = clamp(-bounce.x, -0.1, 0.3); // 위로 뛴 정도
      const stretch = 1 + clamp(-bounce.v, -3, 3) * 0.012; // 올라갈 때 길쭉, 내려올 때 납작

      if (rig.current) rig.current.style.transform = `translateY(${-lift * 28}%) scale(${(1 / stretch).toFixed(4)}, ${(stretch + breathe).toFixed(4)})`;
      if (front.current) front.current.style.opacity = String(1 - sideWeight);
      if (side.current) {
        side.current.style.opacity = String(sideWeight);
        side.current.style.transform = mirrored ? `translateX(${SIDE_OFFSET.mirrored * 100}%) scaleX(-1)` : `translateX(${SIDE_OFFSET.normal * 100}%)`;
      }
      if (body.current) body.current.style.transform = `translateX(${(bodyLag.x * -0.018).toFixed(3)}%) rotate(${(bodyLag.x * -0.035).toFixed(3)}deg)`;
      if (head.current) {
        // 머리는 커서 쪽으로 살짝 쏠리면서 돌고, 몸이 늦게 따라오는 차이만큼 기운다(2차 움직임)
        const lean = (yaw.x - bodyLag.x) * -0.03;
        head.current.style.transform =
          `perspective(${Math.round(size * 1.6)}px) translate(${(yaw.x * 0.022).toFixed(3)}%, ${(pitch.x * 0.6).toFixed(3)}%) ` +
          `rotateY(${angles.rotateY.toFixed(2)}deg) rotateX(${angles.rotateX.toFixed(2)}deg) rotateZ(${(angles.rotateZ + lean).toFixed(2)}deg)`;
      }
      FEATURES.forEach((feature, index) => {
        const element = features.current[index];
        if (!element) return;
        const p = projectFeature(feature, featureYaw, featurePitch);
        element.style.opacity = p.opacity.toFixed(3);
        element.style.transform = `translate(${(p.dx * 100).toFixed(3)}%, ${(p.dy * 100).toFixed(3)}%) scale(${p.scaleX.toFixed(4)}, ${(p.scaleY * (feature.isEye ? blink : 1)).toFixed(4)})`;
      });
      if (shadow.current) {
        shadow.current.style.transform = `translateX(-50%) scaleX(${(1 - lift * 0.9).toFixed(3)})`;
        shadow.current.style.opacity = String(Math.max(0.12, 0.42 - lift * 0.9));
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);

  return (
    <div ref={root} className={`relative aspect-square select-none ${className}`} style={{ touchAction: "pan-y" }} role="img" aria-label="회사 마스코트">
      {/* 바닥 그림자 */}
      <div ref={shadow} className="absolute bottom-[10%] left-1/2 h-[4.5%] w-[34%] rounded-full bg-black blur-md" style={{ transform: "translateX(-50%)", opacity: 0.42 }} aria-hidden="true" />

      {/* 앞모습: 몸 + (머리 + 얼굴 + 눈) */}
      <div ref={front} className="absolute inset-0" aria-hidden="true">
        <div ref={rig} className="absolute inset-0" style={{ transformOrigin: "50% 87%" }}>
          {/* eslint-disable @next/next/no-img-element -- 크기가 정해진 작은 정적 그림이라 일반 img로 충분하다 */}
          <img ref={body} src="/mascot/base.webp" alt="" width={1000} height={1000} draggable={false} className={layer} style={{ clipPath: BODY_CLIP, transformOrigin: "50% 90%" }} />
          <div ref={head} className="absolute inset-0 will-change-transform" style={{ transformOrigin: NECK_PIVOT }}>
            <img src="/mascot/base.webp" alt="" width={1000} height={1000} draggable={false} className={layer} style={{ clipPath: HEAD_CLIP }} />
            {FEATURES.map((feature, index) => (
              <img
                key={feature.id}
                ref={(element) => {
                  features.current[index] = element;
                }}
                src={`/mascot/${feature.file}.webp`}
                alt=""
                width={1000}
                height={1000}
                draggable={false}
                className={`${layer} will-change-transform`}
                style={{ transformOrigin: `${feature.x * 100}% ${feature.y * 100}%` }}
              />
            ))}
          </div>
          {/* eslint-enable @next/next/no-img-element */}
        </div>
      </div>

      {/* 옆모습: 커서가 멀리 있을 때 섞인다 */}
      {/* eslint-disable-next-line @next/next/no-img-element -- 위와 같은 이유 */}
      <img ref={side} src="/mascot/side.webp" alt="" width={2000} height={2000} draggable={false} className={layer} style={{ opacity: 0 }} aria-hidden="true" />
    </div>
  );
}

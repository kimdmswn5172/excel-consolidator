// 마스코트가 마우스(손가락)를 따라 도는 효과의 계산 규칙. (DESIGN 11번)
// 그림이 앞모습·옆모습·뒷모습 3장뿐이라, 진행 값(0~1)에 따라 가까운 그림을 보여 주고 그림이 바뀌는 순간에는
// 가로로 납작해졌다가 펴지게 해서 몸을 돌리는 것처럼 보이게 한다. 모르는 모습을 지어내서 그리지 않는다.
// 화면과 떨어진 순수 함수라서 자동 시험으로 확인할 수 있다.

export type MascotView = "front" | "side" | "back";

// 진행 값 0 = 앞모습, 0.5 = 옆모습, 1 = 뒷모습
export const VIEW_ANCHORS: { view: MascotView; at: number }[] = [
  { view: "front", at: 0 },
  { view: "side", at: 0.5 },
  { view: "back", at: 1 },
];

// 마우스가 화면 가로 전체를 움직였을 때 진행 값이 바뀌는 양
export const SENSITIVITY = 0.8;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

// 마우스가 deltaX만큼 움직였을 때 새 진행 값. 오른쪽으로 움직이면 앞 → 옆 → 뒤 순서로 돈다.
export function nextProgress(progress: number, deltaX: number, viewportWidth: number, sensitivity: number = SENSITIVITY): number {
  if (viewportWidth <= 0) return clamp01(progress);
  return clamp01(progress + (deltaX / viewportWidth) * sensitivity);
}

// 진행 값에서 보여 줄 모습과 가로로 눌리는 정도(1 = 그대로, 작을수록 납작)
export function viewFor(progress: number): { view: MascotView; squeeze: number } {
  const p = clamp01(progress);
  let best = VIEW_ANCHORS[0];
  for (const anchor of VIEW_ANCHORS) {
    if (Math.abs(p - anchor.at) < Math.abs(p - best.at)) best = anchor;
  }
  // 그림 사이의 한가운데(앵커에서 0.25 떨어진 곳)에서 가장 납작해진다
  const distance = Math.min(Math.abs(p - best.at) / 0.25, 1);
  return { view: best.view, squeeze: 1 - 0.55 * distance };
}

// 화면에 보이는 값이 목표 값을 부드럽게 따라가게 한다. (한 프레임에 거리의 일부만큼 이동)
export function easeToward(current: number, target: number, rate = 0.14): number {
  const next = current + (target - current) * rate;
  return Math.abs(target - next) < 0.0005 ? target : next;
}

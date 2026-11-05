// 마스코트가 마우스 커서를 따라 입체적으로 움직이는 계산 규칙. (DESIGN 11번)
// 그림은 앞·옆·뒤 사진 3장뿐이라, 앞모습을 "바탕(머리+몸) · 얼굴(코·입·볼) · 눈" 조각으로 나누어
//  - 머리를 커서 쪽으로 돌리고(원근감 있는 회전),
//  - 눈·볼·코와 입 조각이 둥근 머리 표면을 따라 돌아가며(가장자리로 갈수록 좁아지고 뒤로 넘어가면 사라짐),
//  - 눈이 깜빡이고, 몸이 살짝 늦게 따라오고, 통통 튀게(스프링) 한다.
// 커서가 화면 가장자리 쪽으로 멀어지면 실제 옆모습 사진으로 자연스럽게 바뀐다.
// 화면과 떨어진 순수 함수라서 자동 시험으로 확인할 수 있다.

export type Spring = { x: number; v: number };

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export const smoothstep = (edge0: number, edge1: number, value: number) => {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

// 스프링(용수철) 한 걸음. 목표를 향해 가다가 살짝 지나쳤다가 돌아오는 "살아 있는" 움직임을 만든다.
// stiffness가 클수록 빠르게, damping이 작을수록 더 많이 출렁인다. (반암시적 오일러 방식이라 큰 dt에서도 안정적)
export function stepSpring(spring: Spring, target: number, dt: number, stiffness: number, damping: number): Spring {
  const v = spring.v + (stiffness * (target - spring.x) - damping * spring.v) * dt;
  return { x: spring.x + v * dt, v };
}

// 커서가 마스코트 중심에서 dx(픽셀)만큼 떨어져 있을 때 몸을 돌릴 각도(도). 오른쪽이 +, 화면 반폭만큼 떨어지면 90도.
export function yawFromPointer(dx: number, halfWidth: number): number {
  if (halfWidth <= 0) return 0;
  const n = clamp(dx / halfWidth, -1, 1);
  return 90 * Math.sign(n) * Math.pow(Math.abs(n), 0.9);
}

// 커서가 위(-)·아래(+)에 있을 때 고개를 드는 정도(-1 ~ 1)
export function pitchFromPointer(dy: number, halfHeight: number): number {
  if (halfHeight <= 0) return 0;
  return clamp(dy / halfHeight, -1, 1);
}

// 옆모습 사진을 섞는 정도(0 = 앞모습만, 1 = 옆모습만). 옆모습 사진은 왼쪽을 보고 있어서, 오른쪽(+)으로 돌 때는 좌우를 뒤집어 쓴다.
export function sideBlend(yaw: number): { side: number; mirrored: boolean } {
  return { side: smoothstep(62, 86, Math.abs(yaw)), mirrored: yaw > 0 };
}

// 머리를 둥근 공(타원체)으로 보고, 얼굴 조각들이 그 표면 위에 붙어 있다고 계산한다. 값은 그림 한 변에 대한 비율이고, 앞모습 사진을 재서 정했다.
export const HEAD = { cx: 0.471, cy: 0.44, rx: 0.209, ry: 0.195 } as const;

// 얼굴 조각: 사진에서 눈·볼·코와 입을 따로 떼어 낸 그림들과 각 조각의 중심 위치.
export type FeatureId = "eyeL" | "eyeR" | "cheekL" | "cheekR" | "noseMouth";
export const FEATURES: { id: FeatureId; file: string; x: number; y: number; isEye: boolean }[] = [
  { id: "cheekL", file: "cheek-l", x: 0.3591, y: 0.5397, isEye: false },
  { id: "cheekR", file: "cheek-r", x: 0.6407, y: 0.5348, isEye: false },
  { id: "noseMouth", file: "nose-mouth", x: 0.5001, y: 0.4991, isEye: false },
  { id: "eyeL", file: "eye-l", x: 0.3958, y: 0.4747, isEye: true },
  { id: "eyeR", file: "eye-r", x: 0.6024, y: 0.4748, isEye: true },
];

const DEG = Math.PI / 180;

// 머리가 yaw(도, 오른쪽이 +)만큼 돌고 pitch(라디안, 아래가 +)만큼 숙였을 때, 얼굴 조각 하나의 새 위치·크기·투명도.
// 공 표면 위의 점이 돌아가는 것을 그대로 계산해서, 가장자리로 갈수록 좁아지고 머리 뒤로 넘어가면 사라진다.
export function projectFeature(
  feature: { x: number; y: number },
  yawDeg: number,
  pitchRad: number,
): { dx: number; dy: number; scaleX: number; scaleY: number; opacity: number } {
  const u = (feature.x - HEAD.cx) / HEAD.rx;
  const v = clamp((feature.y - HEAD.cy) / HEAD.ry, -0.98, 0.98);
  const phi0 = Math.asin(v);
  const cosPhi0 = Math.cos(phi0);
  const theta0 = Math.asin(clamp(u / cosPhi0, -0.999, 0.999));

  const theta = theta0 + yawDeg * DEG;
  const phi = phi0 + pitchRad;
  const depth = Math.cos(phi) * Math.cos(theta); // 앞쪽을 향하면 +, 머리 뒤로 넘어가면 −
  if (depth <= 0) return { dx: 0, dy: 0, scaleX: 0.05, scaleY: 1, opacity: 0 };

  return {
    dx: (Math.cos(phi) * Math.sin(theta) - u) * HEAD.rx,
    dy: (Math.sin(phi) - v) * HEAD.ry,
    scaleX: clamp(Math.cos(theta) / Math.cos(theta0), 0.05, 1.2),
    scaleY: clamp(Math.cos(phi) / cosPhi0, 0.6, 1.2),
    opacity: smoothstep(0.04, 0.26, depth),
  };
}

// 머리 전체를 기울이는 각도(도). 몸은 그대로 두고 머리만 돌아서 목 뒤에서 회전하는 느낌을 준다.
export function headAngles(yaw: number, pitch: number): { rotateY: number; rotateX: number; rotateZ: number } {
  // 얼굴 조각은 공 표면을 따라 따로 돌아가므로 머리 조각 전체는 조금만 돌린다(귀와 윤곽에 입체감을 더하는 정도)
  return { rotateY: clamp(yaw * 0.2, -18, 18), rotateX: -pitch * 8, rotateZ: yaw * 0.05 };
}

// 커서가 한동안 움직이지 않을 때 마스코트가 혼자 두리번거리는 목표
export function idleTarget(seconds: number): { yaw: number; pitch: number } {
  return { yaw: 16 * Math.sin(seconds * 0.55), pitch: 0.18 * Math.sin(seconds * 0.8 + 1) };
}

// 눈 깜빡임: 시작 후 흐른 시간(밀리초)에 대한 눈의 세로 크기(1 = 뜸, 작을수록 감음). 약 0.18초 동안 감았다 뜬다.
export function blinkScale(elapsedMs: number): number {
  if (elapsedMs < 0 || elapsedMs > 180) return 1;
  const closed = elapsedMs < 70 ? elapsedMs / 70 : 1 - (elapsedMs - 70) / 110;
  return 1 - 0.92 * clamp(closed, 0, 1);
}

// 옆모습 사진의 발 위치가 앞모습과 어긋난 만큼 옮겨 주는 값(그림 한 변에 대한 비율). 앞·옆 사진의 발 중심을 재서 정했다.
export const SIDE_OFFSET = { normal: 0.023, mirrored: -0.025 } as const;

// 마스코트 입체 움직임 계산을 시험한다. 실행: npm run test
import { describe, expect, it } from "vitest";
import {
  SIDE_OFFSET,
  blinkScale,
  FEATURES,
  HEAD,
  headAngles,
  idleTarget,
  pitchFromPointer,
  projectFeature,
  sideBlend,
  smoothstep,
  stepSpring,
  yawFromPointer,
  type Spring,
} from "./mascotRig";

describe("stepSpring", () => {
  const run = (target: number, seconds: number, stiffness = 110, damping = 13) => {
    let s: Spring = { x: 0, v: 0 };
    let peak = 0;
    for (let i = 0; i < seconds * 120; i++) {
      s = stepSpring(s, target, 1 / 120, stiffness, damping);
      peak = Math.max(peak, s.x);
    }
    return { final: s, peak };
  };

  it("목표에 가까워지고 결국 멈춘다", () => {
    const { final } = run(1, 4);
    expect(final.x).toBeCloseTo(1, 3);
    expect(Math.abs(final.v)).toBeLessThan(0.001);
  });

  it("출렁임이 작게 있다: 목표를 살짝 지나쳤다가 돌아온다(살아 있는 느낌)", () => {
    const { peak } = run(1, 4);
    expect(peak).toBeGreaterThan(1.0);
    expect(peak).toBeLessThan(1.25);
  });

  it("프레임이 느려도(큰 dt) 폭주하지 않는다", () => {
    let s: Spring = { x: 0, v: 0 };
    for (let i = 0; i < 200; i++) s = stepSpring(s, 1, 1 / 30, 110, 13);
    expect(Math.abs(s.x - 1)).toBeLessThan(0.01);
  });
});

describe("커서 → 각도", () => {
  it("오른쪽 커서는 +, 왼쪽은 −, 가운데는 0, 화면 끝은 90도다", () => {
    expect(yawFromPointer(0, 640)).toBe(0);
    expect(yawFromPointer(300, 640)).toBeGreaterThan(0);
    expect(yawFromPointer(-300, 640)).toBeLessThan(0);
    expect(yawFromPointer(640, 640)).toBeCloseTo(90);
    expect(yawFromPointer(9999, 640)).toBeCloseTo(90);
  });

  it("화면 폭이 0이어도 깨지지 않고, 위아래는 -1~1 안이다", () => {
    expect(yawFromPointer(50, 0)).toBe(0);
    expect(pitchFromPointer(-9999, 400)).toBe(-1);
    expect(pitchFromPointer(200, 400)).toBeCloseTo(0.5);
    expect(pitchFromPointer(50, 0)).toBe(0);
  });
});

describe("옆모습 섞기", () => {
  it("가운데 부근은 앞모습, 멀리 돌면 옆모습이고 오른쪽일 때만 뒤집는다", () => {
    expect(sideBlend(0).side).toBe(0);
    expect(sideBlend(40).side).toBe(0);
    expect(sideBlend(58).side).toBe(0); // 옆모습이 일찍 희미하게 겹쳐 보이지 않는다
    expect(sideBlend(90).side).toBe(1);
    expect(sideBlend(74).side).toBeGreaterThan(0.3);
    expect(sideBlend(74).side).toBeLessThan(0.7);
    expect(sideBlend(-90).mirrored).toBe(false);
    expect(sideBlend(90).mirrored).toBe(true);
  });

  it("옆모습 위치 보정값이 있다", () => {
    expect(SIDE_OFFSET.normal).toBeGreaterThan(0);
    expect(SIDE_OFFSET.mirrored).toBeLessThan(0);
  });
});

describe("얼굴 조각이 둥근 머리 표면을 따라 돌기", () => {
  const cheekR = FEATURES.find((f) => f.id === "cheekR")!;
  const eyeL = FEATURES.find((f) => f.id === "eyeL")!;
  const noseMouth = FEATURES.find((f) => f.id === "noseMouth")!;

  it("가만히 있을 때는 제자리, 원래 크기, 완전히 보인다", () => {
    for (const f of FEATURES) {
      const p = projectFeature(f, 0, 0);
      expect(p.dx).toBeCloseTo(0, 6);
      expect(p.dy).toBeCloseTo(0, 6);
      expect(p.scaleX).toBeCloseTo(1, 6);
      expect(p.opacity).toBe(1);
    }
  });

  it("오른쪽으로 돌면 조각이 오른쪽으로 가고 왼쪽으로 돌면 왼쪽으로 간다", () => {
    expect(projectFeature(noseMouth, 30, 0).dx).toBeGreaterThan(0);
    expect(projectFeature(noseMouth, -30, 0).dx).toBeLessThan(0);
  });

  it("머리 가장자리로 갈수록 좁아지고, 머리 뒤로 넘어가면 사라진다", () => {
    const side = projectFeature(cheekR, 25, 0); // 오른쪽 볼은 오른쪽으로 돌수록 가장자리로 간다
    expect(side.scaleX).toBeLessThan(1);
    const gone = projectFeature(cheekR, 60, 0);
    expect(gone.opacity).toBe(0);
    // 반대쪽으로 돌면 오른쪽 볼이 정면 쪽으로 온다
    expect(projectFeature(cheekR, -30, 0).opacity).toBe(1);
    expect(projectFeature(cheekR, -30, 0).scaleX).toBeGreaterThan(0.9);
  });

  it("고개를 숙이면 조각이 아래로, 들면 위로 간다", () => {
    expect(projectFeature(eyeL, 0, 0.25).dy).toBeGreaterThan(0);
    expect(projectFeature(eyeL, 0, -0.25).dy).toBeLessThan(0);
  });

  it("머리 모양(공)을 벗어나지 않는다: 어떤 각도에서도 이동한 조각의 가로 위치가 머리 폭 안이다", () => {
    for (const f of FEATURES) {
      for (const yaw of [-70, -40, -10, 0, 25, 55, 70]) {
        const p = projectFeature(f, yaw, 0);
        if (p.opacity === 0) continue;
        expect(Math.abs(f.x + p.dx - HEAD.cx)).toBeLessThanOrEqual(HEAD.rx + 1e-9);
      }
    }
  });

  it("조각 정의: 눈 2개와 나머지 3개, 파일 이름이 서로 다르다", () => {
    expect(FEATURES).toHaveLength(5);
    expect(FEATURES.filter((f) => f.isEye)).toHaveLength(2);
    expect(new Set(FEATURES.map((f) => f.file)).size).toBe(5);
  });
});

describe("머리 움직임", () => {
  it("머리는 커서 쪽으로 조금 돌고 고개를 들고 내린다", () => {
    expect(headAngles(60, 0).rotateY).toBeGreaterThan(0);
    expect(headAngles(-60, 0).rotateY).toBeLessThan(0);
    expect(headAngles(90, 0).rotateY).toBeLessThanOrEqual(18);
    expect(headAngles(0, 1).rotateX).toBeLessThan(0); // 아래를 볼 때
    expect(headAngles(0, -1).rotateX).toBeGreaterThan(0); // 위를 볼 때
  });
});

describe("눈 깜빡임과 혼자 두리번거리기", () => {
  it("평소에는 눈을 뜨고, 깜빡이는 동안 거의 감았다가 다시 뜬다", () => {
    expect(blinkScale(-10)).toBe(1);
    expect(blinkScale(500)).toBe(1);
    expect(blinkScale(70)).toBeCloseTo(0.08);
    expect(blinkScale(35)).toBeLessThan(1);
    expect(blinkScale(35)).toBeGreaterThan(blinkScale(70));
    expect(blinkScale(150)).toBeGreaterThan(blinkScale(110));
  });

  it("두리번거리는 각도는 작고 시간에 따라 변한다", () => {
    for (const t of [0, 1.3, 5, 11]) {
      expect(Math.abs(idleTarget(t).yaw)).toBeLessThanOrEqual(16);
      expect(Math.abs(idleTarget(t).pitch)).toBeLessThanOrEqual(0.18);
    }
    expect(idleTarget(1).yaw).not.toBe(idleTarget(3).yaw);
  });

  it("smoothstep은 0~1 사이를 부드럽게 잇는다", () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5);
  });
});

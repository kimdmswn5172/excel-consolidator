// 마스코트 회전 계산을 시험한다. 실행: npm run test
import { describe, expect, it } from "vitest";
import { easeToward, nextProgress, viewFor } from "./mascotTurn";

describe("nextProgress", () => {
  it("오른쪽으로 움직이면 늘고 왼쪽으로 움직이면 준다", () => {
    expect(nextProgress(0.5, 100, 1000)).toBeCloseTo(0.58);
    expect(nextProgress(0.5, -100, 1000)).toBeCloseTo(0.42);
  });

  it("0~1을 벗어나지 않는다", () => {
    expect(nextProgress(0.95, 1000, 1000)).toBe(1);
    expect(nextProgress(0.05, -1000, 1000)).toBe(0);
  });

  it("화면 폭이 0이어도 값이 깨지지 않는다", () => {
    expect(nextProgress(0.3, 50, 0)).toBe(0.3);
  });
});

describe("viewFor", () => {
  it("0은 앞모습, 0.5는 옆모습, 1은 뒷모습이고 그때는 눌리지 않는다", () => {
    expect(viewFor(0)).toEqual({ view: "front", squeeze: 1 });
    expect(viewFor(0.5)).toEqual({ view: "side", squeeze: 1 });
    expect(viewFor(1)).toEqual({ view: "back", squeeze: 1 });
  });

  it("그림 사이로 갈수록 납작해지고, 한가운데(0.25, 0.75)에서 가장 납작하다", () => {
    expect(viewFor(0.125).squeeze).toBeLessThan(1);
    expect(viewFor(0.25).squeeze).toBeCloseTo(0.45);
    expect(viewFor(0.75).squeeze).toBeCloseTo(0.45);
  });

  it("한가운데를 지나면 다음 그림으로 바뀐다", () => {
    expect(viewFor(0.24).view).toBe("front");
    expect(viewFor(0.26).view).toBe("side");
    expect(viewFor(0.74).view).toBe("side");
    expect(viewFor(0.76).view).toBe("back");
  });

  it("범위 밖의 값도 안전하게 처리한다", () => {
    expect(viewFor(-3).view).toBe("front");
    expect(viewFor(9).view).toBe("back");
  });
});

describe("easeToward", () => {
  it("목표에 가까워지다가 충분히 가까우면 목표 값으로 맞춘다", () => {
    let value = 0;
    for (let i = 0; i < 200; i++) value = easeToward(value, 1);
    expect(value).toBe(1);
    expect(easeToward(0, 1)).toBeGreaterThan(0);
    expect(easeToward(0, 1)).toBeLessThan(1);
  });
});

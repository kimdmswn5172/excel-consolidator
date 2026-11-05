// /api/analyze의 AI 호출 성공·실패 경로를 가짜 AI로 시험한다. 실제 AI는 부르지 않고 키도 쓰지 않는다. 실행: npm run test
import { APIConnectionTimeoutError } from "@anthropic-ai/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const parse = vi.fn();
vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  return { ...actual, default: class { messages = { parse }; } };
});

import { POST } from "../../api/analyze/route";

const body = JSON.stringify({ headersOnly: false, sheets: [{ name: "Sheet1", rows: [["사번", "이름", "점수"], ["S1", "가", 1]] }] });
const item = <T>(value: T | null, confidence: number | null) => ({ value, confidence });
const output = {
  sheetName: item("Sheet1", 99),
  keyColumn: item(1, 95),
  targetColumns: item([3], 80),
  headerRow: item(1, 90),
  dataStartRow: item(2, 90),
};
const post = () => POST(new Request("http://localhost/api/analyze", { method: "POST", body }));

describe("POST /api/analyze (가짜 AI)", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "시험용-가짜-키");
    parse.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("AI가 정상으로 답하면 추천을 돌려준다", async () => {
    parse.mockResolvedValue({ parsed_output: output });
    const response = await post();
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.recommendation.keyColumn).toEqual({ value: 1, confidence: 95, status: "recommended" });
    expect(JSON.stringify(json)).not.toContain("가짜-키"); // 키는 응답에 나가지 않는다
  });

  it("답이 약속한 모양이 아니면 invalid-response다", async () => {
    parse.mockResolvedValue({ parsed_output: { keyColumn: "B" } });
    expect(await (await post()).json()).toEqual({ ok: false, reason: "invalid-response" });
    parse.mockResolvedValue({ parsed_output: null });
    expect(await (await post()).json()).toEqual({ ok: false, reason: "invalid-response" });
  });

  it("AI 호출이 시간 초과되면 timeout(504)이다", async () => {
    parse.mockRejectedValue(new APIConnectionTimeoutError());
    const response = await post();
    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({ ok: false, reason: "timeout" });
  });
});

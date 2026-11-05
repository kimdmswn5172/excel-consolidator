// 브라우저의 AI 호출(10초 제한, 1회 재시도, 실패 안내)을 가짜 fetch로 시험한다. 실행: npm run test
import { describe, expect, it, vi } from "vitest";
import type { AnalyzeRequest, AnalyzeResponse } from "../types";
import { failureMessage, requestAnalysis } from "./requestAnalysis";

const request: AnalyzeRequest = { headersOnly: false, sheets: [{ name: "S", rows: [["a"]] }] };
const okBody: AnalyzeResponse = {
  ok: true,
  recommendation: {
    sheetName: { value: "S", confidence: 90, status: "recommended" },
    keyColumn: { value: 1, confidence: 90, status: "recommended" },
    targetColumns: { value: [2], confidence: 90, status: "recommended" },
    headerRow: { value: 1, confidence: 90, status: "recommended" },
    dataStartRow: { value: 2, confidence: 90, status: "recommended" },
  },
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("requestAnalysis", () => {
  it("성공하면 한 번만 부른다", async () => {
    const fetchImpl = vi.fn(async () => reply(okBody));
    expect(await requestAnalysis(request, { fetchImpl })).toEqual(okBody);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("첫 시도가 실패하고 두 번째가 성공하면 성공으로 돌려준다", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(reply({ ok: false, reason: "service" }, 502)).mockResolvedValueOnce(reply(okBody));
    expect((await requestAnalysis(request, { fetchImpl })).ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("계속 실패하면 재시도는 1회까지만 하고 마지막 이유를 돌려준다", async () => {
    const fetchImpl = vi.fn(async () => reply({ ok: false, reason: "service" }, 502));
    expect(await requestAnalysis(request, { fetchImpl })).toEqual({ ok: false, reason: "service" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("키 문제와 요청 모양 문제는 다시 시도하지 않는다", async () => {
    for (const reason of ["auth", "invalid-request"] as const) {
      const fetchImpl = vi.fn(async () => reply({ ok: false, reason }, 400));
      expect(await requestAnalysis(request, { fetchImpl })).toEqual({ ok: false, reason });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  });

  it("연결이 끊기면 network로 돌려주고 다시 시도한다", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await requestAnalysis(request, { fetchImpl })).toEqual({ ok: false, reason: "network" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("제한 시간 안에 응답이 없으면 timeout이고, 시도마다 제한을 둔다", async () => {
    // 신호(signal)가 취소되면 실패하는, 끝나지 않는 가짜 fetch
    const fetchImpl = vi.fn((_url: unknown, init?: RequestInit) => new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))));
    const started = Date.now();
    expect(await requestAnalysis(request, { fetchImpl: fetchImpl as unknown as typeof fetch, timeoutMs: 50 })).toEqual({ ok: false, reason: "timeout" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("JSON이 아니거나 모양이 틀린 답은 invalid-response다", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>오류</html>", { status: 500 }));
    expect(await requestAnalysis(request, { fetchImpl })).toEqual({ ok: false, reason: "invalid-response" });
    const wrong = vi.fn(async () => reply({ 뭔가: 1 }));
    expect(await requestAnalysis(request, { fetchImpl: wrong })).toEqual({ ok: false, reason: "invalid-response" });
  });
});

describe("failureMessage", () => {
  it("항상 직접 선택하라고 안내한다", () => {
    for (const reason of ["network", "timeout", "service", "auth", "invalid-response", "invalid-request"] as const) {
      expect(failureMessage(reason)).toContain("AI 분석에 실패했습니다. 직접 선택해 주세요.");
    }
  });
});

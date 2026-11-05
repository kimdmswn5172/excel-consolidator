// AI 분석 서버 쪽 규칙을 시험한다. 실제 AI는 부르지 않는다. 실행: npm run test
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../api/analyze/route";
import type { AnalyzeRequest } from "../types";
import { buildUserMessage } from "./buildPrompt";
import { reasonFromStatus } from "./openai";
import { aiOutputSchema, analyzeRequestSchema, LIMITS } from "./schemas";
import { toRecommendation } from "./toRecommendation";

// 1~2행: 제목·빈 줄, 3행 헤더(사번, 이름, 부서, 교육이수, 이수일), 4~5행 데이터
const request: AnalyzeRequest = {
  headersOnly: false,
  sheets: [
    {
      name: "Sheet1",
      rows: [
        ["교육 현황", null, null, null, null],
        [null, null, null, null, null],
        ["사번", "이름", "부서", "교육이수", "이수일"],
        ["S0001", "직원001", "부서01", "이수", "2026-03-02"],
        ["S0002", "직원002", "부서01", null, null],
      ],
    },
  ],
};

const item = <T>(value: T | null, confidence: number | null) => ({ value, confidence });
const good = {
  sheetName: item("Sheet1", 95),
  keyColumn: item(1, 90),
  targetColumns: item([5, 4], 72),
  headerRow: item(3, 88),
  dataStartRow: item(4, 60),
};

describe("toRecommendation", () => {
  it("신뢰도 70 이상은 추천, 미만은 확인 필요로 나눈다", () => {
    const result = toRecommendation(good, request);
    expect(result.keyColumn).toEqual({ value: 1, confidence: 90, status: "recommended" });
    expect(result.targetColumns).toEqual({ value: [4, 5], confidence: 72, status: "recommended" }); // 열 번호는 오름차순
    expect(result.dataStartRow).toEqual({ value: 4, confidence: 60, status: "needs-check" });
  });

  it("값이 없으면 추천 불가다", () => {
    const result = toRecommendation({ ...good, keyColumn: item(null, null) }, request);
    expect(result.keyColumn).toEqual({ value: null, confidence: null, status: "unavailable" });
  });

  it("신뢰도가 없으면 추천 불가, 범위 밖 신뢰도는 0~100으로 맞춘다", () => {
    expect(toRecommendation({ ...good, keyColumn: item(1, null) }, request).keyColumn.status).toBe("unavailable");
    expect(toRecommendation({ ...good, keyColumn: item(1, 250) }, request).keyColumn.confidence).toBe(100);
  });

  it("엑셀과 맞지 않는 값은 추천 불가로 바꾼다", () => {
    expect(toRecommendation({ ...good, sheetName: item("없는시트", 99) }, request).sheetName.status).toBe("unavailable");
    expect(toRecommendation({ ...good, keyColumn: item(9, 99) }, request).keyColumn.status).toBe("unavailable"); // 5열짜리 시트
    expect(toRecommendation({ ...good, keyColumn: item(0, 99) }, request).keyColumn.status).toBe("unavailable");
    expect(toRecommendation({ ...good, targetColumns: item([1, 4], 99) }, request).targetColumns.status).toBe("unavailable"); // 기준 열이 대상에 섞임
    expect(toRecommendation({ ...good, targetColumns: item([], 99) }, request).targetColumns.status).toBe("unavailable");
    expect(toRecommendation({ ...good, dataStartRow: item(3, 99) }, request).dataStartRow.status).toBe("unavailable"); // 헤더와 같은 행
  });
});

describe("buildUserMessage", () => {
  it("열 글자와 행 번호를 붙여 적고 빈 칸은 건너뛴다", () => {
    const text = buildUserMessage(request);
    expect(text).toContain('시트 "Sheet1"');
    expect(text).toContain("행 3 | A: 사번 | B: 이름 | C: 부서 | D: 교육이수 | E: 이수일");
    expect(text).toContain("행 5 | A: S0002 | B: 직원002 | C: 부서01");
    expect(text).toContain("행 2 | (빈 행)");
  });

  it("헤더만 보낼 때는 그 행의 실제 번호를 적는다", () => {
    const text = buildUserMessage({ headersOnly: true, sheets: [{ name: "Sheet1", headerRow: 3, rows: [["사번", "이름"]] }] });
    expect(text).toContain("행 3 | A: 사번 | B: 이름");
    expect(text).toContain("헤더 행 하나만");
  });
});

describe("요청·응답 검사 규칙", () => {
  it("정상 요청은 통과하고 너무 큰 요청은 막는다", () => {
    expect(analyzeRequestSchema.safeParse(request).success).toBe(true);
    const tooManyRows = { ...request, sheets: [{ name: "S", rows: Array.from({ length: LIMITS.rows + 1 }, () => ["a"]) }] };
    expect(analyzeRequestSchema.safeParse(tooManyRows).success).toBe(false);
    const longText = { ...request, sheets: [{ name: "S", rows: [["가".repeat(LIMITS.textLength + 1)]] }] };
    expect(analyzeRequestSchema.safeParse(longText).success).toBe(false);
    expect(analyzeRequestSchema.safeParse({ headersOnly: "예", sheets: [] }).success).toBe(false);
  });

  it("AI 답이 약속한 모양이 아니면 거부한다", () => {
    expect(aiOutputSchema.safeParse(good).success).toBe(true);
    expect(aiOutputSchema.safeParse({ ...good, keyColumn: item("B", 90) }).success).toBe(false);
    expect(aiOutputSchema.safeParse({}).success).toBe(false);
  });
});

describe("reasonFromStatus", () => {
  it("HTTP 상태 코드를 실패 이유로 바꾼다", () => {
    expect(reasonFromStatus(401)).toBe("auth");
    expect(reasonFromStatus(403)).toBe("auth");
    expect(reasonFromStatus(504)).toBe("timeout");
    expect(reasonFromStatus(429)).toBe("service"); // 사용량 한도·혼잡
    expect(reasonFromStatus(500)).toBe("service");
    expect(reasonFromStatus(400)).toBe("service");
  });
});

describe("POST /api/analyze (AI를 부르지 않는 경로)", () => {
  afterEach(() => vi.unstubAllEnvs());
  const post = (body: string) => POST(new Request("http://localhost/api/analyze", { method: "POST", body }));

  it("모양이 틀린 요청은 400, JSON이 아니면 400이다", async () => {
    const response = await post(JSON.stringify({ headersOnly: true }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, reason: "invalid-request" });
    expect((await post("이건 JSON이 아님")).status).toBe(400);
  });

  it("너무 큰 요청은 413이다", async () => {
    expect((await post("x".repeat(200_001))).status).toBe(413);
  });

  it("키가 없으면 AI를 부르지 않고 인증 실패로 돌려준다", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const response = await post(JSON.stringify(request));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, reason: "auth" });
  });
});

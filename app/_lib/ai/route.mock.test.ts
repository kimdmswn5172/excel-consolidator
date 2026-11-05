// /api/analyze의 AI 호출 성공·실패 경로를 가짜 OpenAI 응답으로 시험한다. 실제 AI는 부르지 않고 진짜 키도 쓰지 않는다. 실행: npm run test
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
const completion = (content: string | null) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
const post = () => POST(new Request("http://localhost/api/analyze", { method: "POST", body }));

describe("POST /api/analyze (가짜 OpenAI)", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "시험용-가짜-키");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("AI가 정상으로 답하면 추천을 돌려주고, 요청에는 약속한 형식과 저장 금지를 담는다", async () => {
    fetchMock.mockResolvedValue(completion(JSON.stringify(output)));
    const response = await post();
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.recommendation.keyColumn).toEqual({ value: 1, confidence: 95, status: "recommended" });
    expect(JSON.stringify(json)).not.toContain("가짜-키"); // 키는 응답에 나가지 않는다

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    const sent = JSON.parse(init.body);
    expect(sent.store).toBe(false);
    expect(sent.response_format.type).toBe("json_schema");
    expect(sent.response_format.json_schema.strict).toBe(true);
    expect(init.headers.Authorization).toBe("Bearer 시험용-가짜-키");
  });

  it("답이 약속한 모양이 아니거나 비어 있으면 invalid-response다", async () => {
    for (const content of [JSON.stringify({ keyColumn: "B" }), "JSON 아님", null, ""]) {
      fetchMock.mockResolvedValue(completion(content));
      expect(await (await post()).json()).toEqual({ ok: false, reason: "invalid-response" });
    }
  });

  it("키가 틀리면 auth(401), 한도·혼잡이면 service, 서버 오류도 service다", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 401 }));
    const unauthorized = await post();
    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.json()).toEqual({ ok: false, reason: "auth" });
    for (const status of [429, 500, 503]) {
      fetchMock.mockResolvedValue(new Response("{}", { status }));
      expect(await (await post()).json()).toEqual({ ok: false, reason: "service" });
    }
  });

  it("시간 초과는 timeout(504), 연결 오류는 network다", async () => {
    fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    const timeout = await post();
    expect(timeout.status).toBe(504);
    expect(await timeout.json()).toEqual({ ok: false, reason: "timeout" });
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    expect(await (await post()).json()).toEqual({ ok: false, reason: "network" });
  });
});

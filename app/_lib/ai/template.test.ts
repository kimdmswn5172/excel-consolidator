// AI 양식 생성(PLAN 25번)을 시험한다. 실제 AI는 부르지 않는다. 실행: npm run test
import ExcelJS from "exceljs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../api/template/route";
import { readWorkbookFromBuffer } from "../excel/readWorkbook";
import { buildTemplateFile, templateFileName } from "../excel/buildTemplate";
import { cleanProposal, templateBlockedReason } from "./templateSchemas";
import { requestTemplate, templateFailureMessage } from "./requestTemplate";
import { buildTemplatePrompt } from "./templatePrompt";

describe("cleanProposal (AI 제안 정리)", () => {
  it("공백을 줄이고, 빈 이름·중복 이름(대소문자 무시, 기준 열 이름 포함)을 뺀다", () => {
    const result = cleanProposal({ title: "  교육  현황 ", keyName: " 사번 ", fieldNames: ["교육이수", " 교육이수 ", "", "이수일", "사번", "SCORE", "score", "연번"], rowCount: 50 });
    expect(result).toEqual({ title: "교육 현황", keyName: "사번", fieldNames: ["교육이수", "이수일", "SCORE"], rowCount: 50 }); // 연번은 프로그램이 따로 넣으므로 열 이름에서 뺀다
  });

  it("너무 긴 이름은 자른다", () => {
    const result = cleanProposal({ title: "가".repeat(100), keyName: "나".repeat(50), fieldNames: ["다".repeat(50)], rowCount: null });
    expect(result?.title).toHaveLength(60);
    expect(result?.keyName).toHaveLength(30);
    expect(result?.fieldNames[0]).toHaveLength(30);
  });

  it("기준 열 이름이 없거나 작성 열이 하나도 없으면 쓸 수 없다", () => {
    expect(cleanProposal({ title: "x", keyName: "  ", fieldNames: ["a"], rowCount: null })).toBeNull();
    expect(cleanProposal({ title: "x", keyName: "사번", fieldNames: ["", " "], rowCount: null })).toBeNull();
    expect(cleanProposal({ title: "x", keyName: "사번", fieldNames: [], rowCount: null })).toBeNull();
    expect(cleanProposal({ title: "x", keyName: "연번", fieldNames: ["a"], rowCount: null })).toBeNull(); // 연번은 프로그램이 넣는 열 이름이다
  });

  it("행 수는 1~1000의 정수만 쓰고 아니면 null이다", () => {
    const base = { title: "x", keyName: "사번", fieldNames: ["a"] };
    expect(cleanProposal({ ...base, rowCount: 50 })?.rowCount).toBe(50);
    for (const bad of [0, -3, 1001, null]) expect(cleanProposal({ ...base, rowCount: bad })?.rowCount).toBeNull();
  });
});

describe("templateBlockedReason (사용자가 고친 양식 검사)", () => {
  it("정상이면 null, 문제가 있으면 이유를 돌려준다", () => {
    expect(templateBlockedReason({ keyName: "사번", fieldNames: ["교육이수"] })).toBeNull();
    expect(templateBlockedReason({ keyName: "", fieldNames: ["a"] })).toContain("기준 열");
    expect(templateBlockedReason({ keyName: "사번", fieldNames: [] })).toContain("하나 이상");
    expect(templateBlockedReason({ keyName: "사번", fieldNames: ["a", ""] })).toContain("비어");
    expect(templateBlockedReason({ keyName: "사번", fieldNames: ["a", "A"] })).toContain("같은 이름");
    expect(templateBlockedReason({ keyName: "연번", fieldNames: ["a"] })).toContain("같은 이름"); // 연번은 예약된 이름
    expect(templateBlockedReason({ keyName: "사번", fieldNames: Array.from({ length: 29 }, (_, i) => `열${i}`) })).toContain("29개");
    expect(templateBlockedReason({ keyName: "사번", fieldNames: ["a"], rowCount: 50 })).toBeNull();
    for (const bad of [0, 1001, 2.5, Number.NaN]) expect(templateBlockedReason({ keyName: "사번", fieldNames: ["a"], rowCount: bad })).toContain("행 수");
  });
});

describe("buildTemplateFile (빈 양식 파일)", () => {
  const spec = { title: "수요조사", keyName: "사번", fieldNames: ["희망 품목", "수량"], rowCount: 50 };

  it("1행 제목(병합), 3행 헤더(연번 + 기준 열 + 작성 열), 4행부터 행 수만큼 연번이 든 파일을 만든다", async () => {
    const bytes = await buildTemplateFile(spec);
    const result = await readWorkbookFromBuffer(bytes.buffer, "양식.xlsx");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sheet = result.workbook.sheets[0];
    expect(sheet.name).toBe("Sheet1");
    expect(sheet.cells[0][0]).toBe("수요조사");
    expect(sheet.cells[2]).toEqual(["연번", "사번", "희망 품목", "수량"]);
    const body = sheet.cells.slice(3);
    expect(body).toHaveLength(50); // 50명이면 50행
    expect(body.map((row) => row[0])).toEqual(Array.from({ length: 50 }, (_, i) => i + 1)); // 연번 1~50
    expect(body.flatMap((row) => row.slice(1)).filter((cell) => cell !== null)).toEqual([]); // 나머지 칸은 비어 있다
    expect(sheet.merges).toHaveLength(1); // 제목 줄 병합 A1:D1
  });

  it("헤더 행에 굵은 글씨·배경색이 있고, 헤더와 데이터 행 수만큼만 테두리가 있다", async () => {
    const bytes = await buildTemplateFile(spec);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes.buffer);
    const sheet = workbook.getWorksheet("Sheet1")!;
    for (let c = 1; c <= 4; c++) {
      const header = sheet.getCell(3, c);
      expect(header.font?.bold).toBe(true);
      expect(header.fill).toMatchObject({ type: "pattern", pattern: "solid" });
      expect(header.border?.top?.style).toBe("thin");
      expect(sheet.getCell(4, c).border?.left?.style).toBe("thin"); // 첫 데이터 행
      expect(sheet.getCell(53, c).border?.bottom?.style).toBe("thin"); // 50번째 데이터 행(4~53행)
      expect(sheet.getCell(54, c).border?.top?.style).toBeUndefined(); // 그 아래는 없음
    }
    expect(sheet.getCell(4, 2).fill).toMatchObject({ pattern: "none" }); // 데이터 칸에는 배경색이 없다
    expect(sheet.getCell(1, 1).border?.top?.style).toBeUndefined(); // 제목 줄에는 테두리가 없다
  });

  it("행 수가 1이어도, 열이 적어도 만들어진다", async () => {
    const bytes = await buildTemplateFile({ title: "", keyName: "코드", fieldNames: ["결과"], rowCount: 1 });
    const result = await readWorkbookFromBuffer(bytes.buffer, "양식.xlsx");
    expect(result.ok && result.workbook.sheets[0].cells.slice(2).map((row) => row[0])).toEqual(["연번", 1]);
  });

  it("파일 이름은 날짜가 들어간다", () => {
    expect(templateFileName(new Date(2026, 10, 5))).toBe("양식_20261105.xlsx");
  });
});

describe("POST /api/template (가짜 OpenAI)", () => {
  const fetchMock = vi.fn();
  const completion = (content: string | null) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
  const post = (body: string) => POST(new Request("http://localhost/api/template", { method: "POST", body }));
  const good = JSON.stringify({ title: "교육 현황", keyName: "사번", fieldNames: ["교육이수", "이수일"], rowCount: 50 });

  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "시험용-가짜-키");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("정상 제안을 정리해 돌려주고, 목적 글만 AI로 보낸다", async () => {
    fetchMock.mockResolvedValue(completion(good));
    const response = await post(JSON.stringify({ purpose: "직원 교육 이수 현황" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, proposal: { title: "교육 현황", keyName: "사번", fieldNames: ["교육이수", "이수일"], rowCount: 50 } });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.messages[1].content).toBe(buildTemplatePrompt("직원 교육 이수 현황"));
    expect(sent.store).toBe(false);
    expect(sent.response_format.json_schema.name).toBe("excel_template_proposal");
  });

  it("쓸 수 없는 제안(작성 열 없음)이나 JSON 아닌 답은 invalid-response다", async () => {
    for (const content of [JSON.stringify({ title: "x", keyName: "사번", fieldNames: [], rowCount: null }), "JSON 아님", null]) {
      fetchMock.mockResolvedValue(completion(content));
      expect(await (await post(JSON.stringify({ purpose: "목적" }))).json()).toEqual({ ok: false, reason: "invalid-response" });
    }
  });

  it("빈 목적·너무 긴 목적·JSON 아닌 요청은 AI를 부르지 않고 거부한다", async () => {
    expect((await post(JSON.stringify({ purpose: "   " }))).status).toBe(400);
    expect((await post(JSON.stringify({ purpose: "가".repeat(501) }))).status).toBe(400);
    expect((await post("JSON 아님")).status).toBe(400);
    expect((await post("x".repeat(5_001))).status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("키가 없으면 auth(503)로 AI를 부르지 않는다", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const response = await post(JSON.stringify({ purpose: "목적" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, reason: "auth" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("requestTemplate (브라우저 쪽)", () => {
  it("실패하면 1회 다시 시도하고, 안내에는 직접 만들기 길을 알려 준다", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: false, reason: "service" }), { status: 502 }));
    expect(await requestTemplate("목적", { fetchImpl })).toEqual({ ok: false, reason: "service" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(templateFailureMessage("timeout")).toContain("직접 써서");
  });
});

// AI 추천 정확도 측정 (PRD 3번: 서로 다른 연습용 양식 10종 중 90% 이상은 수정 없이 그대로 적용). (PLAN 23번)
// 실제 AI를 10번 부르므로 ANTHROPIC_API_KEY가 있을 때만 돌아간다. 키가 없으면 건너뛴다.
// 키는 .env에 두고, 값을 화면에 찍지 않고 이렇게 실행한다:
//   node --env-file=.env node_modules/vitest/vitest.mjs run app/_lib/ai/accuracy.eval.test.ts
// 한 양식에서 시트·기준 열·대상 열·헤더 위치·데이터 시작 행을 하나라도 틀리거나 "추천 불가"이면 그 양식은 정확하지 않은 것으로 센다.
import { describe, expect, it } from "vitest";
import { POST } from "../../api/analyze/route";
import { buildAnalyzeRequest } from "../privacy/buildAnalyzeRequest";
import type { AiRecommendation, CellValue, ConsolidationSettings, WorkbookData } from "../types";

type Form = { name: string; sheets: { name: string; cells: CellValue[][] }[]; truth: ConsolidationSettings };

// 데이터 행 n개를 만든다. make(i)는 i번째 행(0부터)의 칸들이다.
const rowsOf = (n: number, make: (i: number) => CellValue[]) => Array.from({ length: n }, (_, i) => make(i));
const pad = (i: number, w = 3) => String(i + 1).padStart(w, "0");
const blank = (w: number): CellValue[] => Array(w).fill(null);

const forms: Form[] = [
  {
    name: "1. 제목 + 빈 줄 + 헤더(3행), 사번이 B열",
    sheets: [{ name: "Sheet1", cells: [["교육 이수 현황"], blank(8), ["연번", "사번", "이름", "부서", "교육이수", "이수일", "점수", "비고"], ...rowsOf(8, (i) => [i + 1, `S${pad(i, 4)}`, `직원${pad(i)}`, "부서01", null, null, null, null])] }],
    truth: { sheetName: "Sheet1", keyColumn: 2, targetColumns: [5, 6, 7, 8], headerRow: 3, dataStartRow: 4 },
  },
  {
    name: "2. 제목 없이 1행이 헤더",
    sheets: [{ name: "Sheet1", cells: [["사번", "이름", "부서", "제출여부", "제출일"], ...rowsOf(8, (i) => [`E${pad(i)}`, `직원${pad(i)}`, "총무팀", null, null])] }],
    truth: { sheetName: "Sheet1", keyColumn: 1, targetColumns: [4, 5], headerRow: 1, dataStartRow: 2 },
  },
  {
    name: "3. 제목 2줄 + 헤더(4행), 사원번호가 C열",
    sheets: [{ name: "Sheet1", cells: [["2026년 상반기 자격증 취득 현황"], ["※ 빈 칸에 취득 여부를 기재해 주세요"], blank(6), ["순번", "성명", "사원번호", "부서", "자격증명", "취득일"], ...rowsOf(8, (i) => [i + 1, `직원${pad(i)}`, `N-${pad(i, 4)}`, "영업팀", null, null])] }],
    truth: { sheetName: "Sheet1", keyColumn: 3, targetColumns: [5, 6], headerRow: 4, dataStartRow: 5 },
  },
  {
    name: "4. 영어 헤더",
    sheets: [{ name: "Sheet1", cells: [["ID", "Name", "Dept", "Training Done", "Date", "Score"], ...rowsOf(8, (i) => [`A${pad(i)}`, `Staff ${pad(i)}`, "HR", null, null, null])] }],
    truth: { sheetName: "Sheet1", keyColumn: 1, targetColumns: [4, 5, 6], headerRow: 1, dataStartRow: 2 },
  },
  {
    name: "5. 안내 시트 + 데이터 시트(두 번째)",
    sheets: [
      { name: "안내", cells: [["작성 안내"], ["1. 데이터 시트의 빈 칸을 채워 주세요."], ["2. 제출 기한: 월말"]] },
      { name: "데이터", cells: [["사번", "이름", "교육이수", "점수"], ...rowsOf(8, (i) => [`S${pad(i, 4)}`, `직원${pad(i)}`, null, null])] },
    ],
    truth: { sheetName: "데이터", keyColumn: 1, targetColumns: [3, 4], headerRow: 1, dataStartRow: 2 },
  },
  {
    name: "6. 연번과 고유 코드가 함께 있는 표 (기준은 코드, C열)",
    sheets: [{ name: "Sheet1", cells: [["번호", "이름", "물품코드", "수량", "검수결과", "비고"], ...rowsOf(8, (i) => [i + 1, `물품${pad(i)}`, `P-${pad(i)}`, i + 10, null, null])] }],
    truth: { sheetName: "Sheet1", keyColumn: 3, targetColumns: [5, 6], headerRow: 1, dataStartRow: 2 },
  },
  {
    name: "7. 작성 항목 표시(작성)가 떨어져 있는 열",
    sheets: [{ name: "Sheet1", cells: [["사번", "이름", "부서", "입사일", "교육이수(작성)", "직급", "점수(작성)"], ...rowsOf(8, (i) => [`S${pad(i, 4)}`, `직원${pad(i)}`, "기획팀", "2020-01-01", null, "사원", null])] }],
    truth: { sheetName: "Sheet1", keyColumn: 1, targetColumns: [5, 7], headerRow: 1, dataStartRow: 2 },
  },
  {
    name: "8. 제목 + 헤더(2행) + 단위 설명 줄(3행) + 데이터(4행~)",
    sheets: [{ name: "Sheet1", cells: [["월간 실적"], ["사번", "이름", "목표", "실적"], ["", "", "(단위: 건)", "(단위: 건)"], ...rowsOf(8, (i) => [`S${pad(i, 4)}`, `직원${pad(i)}`, 100, null])] }],
    truth: { sheetName: "Sheet1", keyColumn: 1, targetColumns: [4], headerRow: 2, dataStartRow: 4 },
  },
  {
    name: "9. 세 시트 중 가운데 시트가 데이터",
    sheets: [
      { name: "표지", cells: [["2026 장비 점검표"], ["담당: 시설관리팀"]] },
      { name: "점검현황", cells: [["장비번호", "장비명", "설치위치", "점검일", "점검결과", "조치내용"], ...rowsOf(8, (i) => [`EQ-${pad(i)}`, `장비${pad(i)}`, "본관 2층", null, null, null])] },
      { name: "메모", cells: [["메모를 남겨 주세요"]] },
    ],
    truth: { sheetName: "점검현황", keyColumn: 1, targetColumns: [4, 5, 6], headerRow: 1, dataStartRow: 2 },
  },
  {
    name: "10. 열이 12개인 넓은 표, 관리번호 A열, 오른쪽 4개 열이 작성 대상",
    sheets: [{ name: "Sheet1", cells: [["관리번호", "이름", "부서", "직급", "입사일", "성별구분", "근무지", "내선", "1분기", "2분기", "3분기", "4분기"], ...rowsOf(8, (i) => [`M${pad(i, 4)}`, `직원${pad(i)}`, "연구소", "대리", "2019-05-01", "-", "본사", "1234", null, null, null, null])] }],
    truth: { sheetName: "Sheet1", keyColumn: 1, targetColumns: [9, 10, 11, 12], headerRow: 1, dataStartRow: 2 },
  },
];

function matches(rec: AiRecommendation, truth: ConsolidationSettings): string[] {
  const diffs: string[] = [];
  if (rec.sheetName.value !== truth.sheetName) diffs.push(`시트 ${rec.sheetName.value}`);
  if (rec.keyColumn.value !== truth.keyColumn) diffs.push(`기준 열 ${rec.keyColumn.value}`);
  if (JSON.stringify(rec.targetColumns.value) !== JSON.stringify(truth.targetColumns)) diffs.push(`대상 열 ${JSON.stringify(rec.targetColumns.value)}`);
  if (rec.headerRow.value !== truth.headerRow) diffs.push(`헤더 ${rec.headerRow.value}`);
  if (rec.dataStartRow.value !== truth.dataStartRow) diffs.push(`시작 행 ${rec.dataStartRow.value}`);
  return diffs;
}

describe.skipIf(!process.env.ANTHROPIC_API_KEY)("AI 추천 정확도 (실제 AI 호출)", () => {
  it("연습용 양식 10종 중 90% 이상(9종)은 모든 항목이 정답과 같다", { timeout: 300_000 }, async () => {
    let correct = 0;
    const report: string[] = [];
    for (const form of forms) {
      // 개인정보 체크 없이(샘플 10행 포함) 화면과 같은 방식으로 요청을 만든다. 첫 시트가 아니라 모든 시트를 보낸다.
      const workbook: WorkbookData = {
        fileName: `${form.name}.xlsx`,
        sheets: form.sheets.map((s) => ({ name: s.name, rowCount: s.cells.length, colCount: Math.max(...s.cells.map((r) => r.length)), cells: s.cells, merges: [] })),
      };
      const { request } = buildAnalyzeRequest(workbook, false);
      const response = await POST(new Request("http://localhost/api/analyze", { method: "POST", body: JSON.stringify(request) }));
      const json = await response.json();
      const diffs = json.ok ? matches(json.recommendation as AiRecommendation, form.truth) : [`호출 실패 ${json.reason}`];
      if (diffs.length === 0) correct++;
      report.push(`${diffs.length === 0 ? "O" : "X"} ${form.name}${diffs.length ? ` → ${diffs.join(", ")}` : ""}`);
    }
    console.info(`AI 추천 정확도: ${correct}/${forms.length}\n${report.join("\n")}`);
    expect(correct).toBeGreaterThanOrEqual(9);
  });
});

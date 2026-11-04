// 연습용 가상 엑셀 파일을 만드는 스크립트. 실행: node samples/make-samples.mjs
// 실제 업무 자료나 개인정보는 쓰지 않는다. 이름과 사번은 모두 가짜 규칙으로 만든다.
// 같은 스크립트를 다시 돌리면 같은 파일이 만들어진다(무작위 없음).
import ExcelJS from "exceljs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const DEPT_COUNT = 20;
const PER_DEPT = 5;
const TOTAL = DEPT_COUNT * PER_DEPT;
const HEADERS = ["연번", "사번", "이름", "부서", "교육이수", "이수일", "점수", "비고"];
const DATA_START_ROW = 4;

const pad = (n, len) => String(n).padStart(len, "0");
const empId = (i) => `S${pad(i, 4)}`;
const deptName = (k) => `부서${pad(k, 2)}`;

// 직원 i번의 교육 결과 (부서 파일이 채우는 값)
function result(i) {
  const passed = i % 4 !== 0;
  return {
    done: passed ? "이수" : "미이수",
    date: passed ? new Date(Date.UTC(2026, 2, 1 + (i % 28))) : null,
    score: 60 + ((i * 7) % 41),
    note: i % 11 === 0 ? "재교육 예정" : null,
  };
}

// 시트 한 장을 만든다. 제목 줄(병합) - 빈 줄 - 헤더 - 데이터 순서
function buildSheet(wb, title, rows, headers = HEADERS) {
  const ws = wb.addWorksheet("Sheet1");
  ws.addRow([title]);
  ws.mergeCells("A1:H1"); // 제목 줄 병합: 데이터 영역 밖이라 취합에 영향이 없다
  ws.addRow([]);
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r);
  ws.getColumn(6).numFmt = "yyyy-mm-dd";
  ws.getColumn(2).width = 12;
  return ws;
}

async function save(wb, relPath) {
  const full = path.join(here, relPath);
  await mkdir(path.dirname(full), { recursive: true });
  await wb.xlsx.writeFile(full);
}

// 마스터 표 한 행: 연번, 사번, 이름, 부서, (취합 대상 열은 비워 둔다)
function masterRow(i, extra = {}) {
  const k = Math.ceil(i / PER_DEPT);
  return [i, empId(i), `직원${pad(i, 3)}`, deptName(k), extra.done ?? null, extra.date ?? null, extra.score ?? null, extra.note ?? null];
}

// 부서 파일 한 행: 마스터와 같은 열 위치에 교육 결과를 채운다
function deptRow(i, { id = empId(i), blank = false, score } = {}) {
  const k = Math.ceil(i / PER_DEPT);
  const r = result(i);
  return [i, id, `직원${pad(i, 3)}`, deptName(k), blank ? null : r.done, blank ? null : r.date, blank ? null : (score ?? r.score), blank ? null : r.note];
}

// ── 마스터 표 ──
// 일부 칸은 미리 채워 둔다 (부서 값 우선 / 부서 칸이 비면 마스터 값 유지 시험용)
const prefilled = {
  1: { done: "미이수" }, // 부서 값("이수")과 다름 → 바뀐 칸
  2: { done: "이수" }, // 부서 값과 같음 → 바뀐 칸 아님
  3: { done: "이수" }, // 부서 파일 칸이 비어 있음 → 마스터 값 유지
  7: { done: "이수", date: new Date(Date.UTC(2026, 2, 1)) }, // 부서 파일 칸이 비어 있음 → 유지
  10: { score: 55 }, // 부서 값(89)과 다름 → 바뀐 칸
};
const masterRows = [];
for (let i = 1; i <= TOTAL; i++) masterRows.push(masterRow(i, prefilled[i]));
{
  const wb = new ExcelJS.Workbook();
  buildSheet(wb, "2027년 교육 이수 현황 (마스터)", masterRows);
  await save(wb, "마스터.xlsx");
}

// ── 부서 파일 20개 ──
for (let k = 1; k <= DEPT_COUNT; k++) {
  const first = (k - 1) * PER_DEPT + 1;
  const ids = Array.from({ length: PER_DEPT }, (_, n) => first + n);
  let rows = ids.map((i) => deptRow(i));
  let headers = HEADERS;

  if (k === 1) rows[2] = deptRow(3, { blank: true }); // 직원003: 취합 대상 칸이 모두 비어 있음
  if (k === 2) rows[1] = deptRow(7, { blank: true }); // 직원007: 취합 대상 칸이 모두 비어 있음
  if (k === 5) rows.push(deptRow(25, { id: "S9999" })); // 마스터에 없는 사번 → 미매칭
  if (k === 7) rows.push(deptRow(32, { score: 99 })); // 같은 파일 안 중복 키 (직원032이 두 번)
  if (k === 11) {
    rows[1] = deptRow(52, { id: "s0052 " }); // 소문자 + 뒤 공백
    rows[2] = deptRow(53, { id: "Ｓ0053" }); // 전각 영문자
  }
  if (k === 13) rows.push(deptRow(60, { score: 77 })); // 다른 부서(12) 직원이 또 들어 있음 → 파일 사이 중복
  if (k === 15) headers = ["연번", "직원번호", "이름", "부서", "교육이수", "이수일", "점수", "비고"]; // 헤더가 다름

  const wb = new ExcelJS.Workbook();
  const ws = buildSheet(wb, `${deptName(k)} 교육 이수 현황`, rows, headers);
  if (k === 9) ws.mergeCells(`B${DATA_START_ROW + 1}:B${DATA_START_ROW + 2}`); // 기준 열 데이터 영역에 병합 → 위험
  if (k === 18) {
    const last = DATA_START_ROW + rows.length + 1;
    ws.mergeCells(`A${last}:H${last}`); // 데이터 아래 안내 문구 병합 → 데이터 영역 밖이라 괜찮음
    ws.getCell(`A${last}`).value = "※ 작성 안내: 이수 여부는 이수 또는 미이수로 입력";
  }
  await save(wb, `부서/${deptName(k)}.xlsx`);
}

// ── 예외 파일 ──
// 마스터 안에 같은 사번이 두 번 있음
{
  const wb = new ExcelJS.Workbook();
  buildSheet(wb, "마스터 (중복 키 있음)", [...masterRows, masterRow(100)]);
  await save(wb, "예외/마스터_중복키.xlsx");
}
// 마스터의 헤더가 다름
{
  const wb = new ExcelJS.Workbook();
  buildSheet(wb, "마스터 (헤더 다름)", masterRows, ["연번", "직원번호", "이름", "부서", "교육이수", "이수일", "점수", "비고"]);
  await save(wb, "예외/마스터_헤더다름.xlsx");
}
// 손상된 파일: 이름만 .xlsx이고 내용은 그냥 글자
await mkdir(path.join(here, "예외"), { recursive: true });
await writeFile(path.join(here, "예외/손상.xlsx"), "이 파일은 엑셀 파일이 아니라 일부러 손상시킨 연습용 파일입니다.");
// .xlsx가 아닌 파일
await writeFile(path.join(here, "예외/목록.csv"), "사번,이름\nS0001,직원001\n", "utf8");

console.log("연습용 파일을 만들었습니다: samples/ 폴더를 확인하세요.");

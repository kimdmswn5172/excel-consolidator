// 크기가 큰 연습용 엑셀 파일을 만드는 스크립트. 화면이 멈추지 않는지 확인할 때 쓴다. (PLAN 14번)
// 파일이 커서 저장소에는 넣지 않고, 컴퓨터의 임시 폴더에 만든다.
// 실행: node samples/make-large-sample.mjs [행 수]   (기본 200000행)
import ExcelJS from "exceljs";
import { mkdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const rows = Number(process.argv[2] ?? 200_000);
const outDir = path.join(os.tmpdir(), "my-app-large-samples");
await mkdir(outDir, { recursive: true });

async function make(fileName, title) {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: path.join(outDir, fileName) });
  const sheet = workbook.addWorksheet("Sheet1");
  sheet.addRow([title]);
  sheet.mergeCells("A1:H1"); // 줄을 확정(commit)하기 전에 병합해야 한다
  sheet.getRow(1).commit();
  sheet.addRow([]).commit();
  sheet.addRow(["연번", "사번", "이름", "부서", "교육이수", "이수일", "점수", "비고"]).commit();
  for (let i = 1; i <= rows; i++) {
    const passed = i % 4 !== 0;
    sheet
      .addRow([
        i,
        `S${String(i).padStart(7, "0")}`,
        `직원${i}`,
        `부서${(i % 50) + 1}`,
        passed ? "이수" : "미이수",
        passed ? new Date(Date.UTC(2026, 2, 1 + (i % 28))) : null,
        60 + ((i * 7) % 41),
        i % 11 === 0 ? "재교육 예정" : null,
      ])
      .commit();
  }
  await workbook.commit();
  const { size } = await stat(path.join(outDir, fileName));
  console.log(`${fileName}: ${rows}행, ${(size / 1024 / 1024).toFixed(1)}MB`);
}

await make("큰마스터.xlsx", "큰 마스터 (연습용)");
await make("큰부서.xlsx", "큰 부서 파일 (연습용)");
console.log(`만든 위치: ${outDir}`);

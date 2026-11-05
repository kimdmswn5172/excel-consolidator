// 한셀(한컴오피스)로 저장한 .xlsx를 읽고 결과 파일을 만들 수 있는지 시험한다. 실행: npm run test
// 사용자 보고: 한셀로 저장한 파일을 넣으면 "손상되었거나 읽을 수 없는 파일"로 나왔다. (원인: 모든 태그에 x: 같은 접두어가 붙어 있음)
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { consolidate } from "../merge/consolidate";
import { readWorkbookFromBuffer } from "./readWorkbook";
import { repairNamespacePrefixes, stripRootPrefix } from "./repairXlsx";
import { buildResultFile } from "./writeResult";

const settings = { sheetName: "Sheet1", keyColumn: 2, targetColumns: [5, 6, 7, 8], headerRow: 3, dataStartRow: 4 };

async function bytesOf(relative: string): Promise<ArrayBuffer> {
  const buf = await readFile(path.join(process.cwd(), "samples", relative));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

describe("stripRootPrefix (태그 접두어 정리)", () => {
  it("본문 이름공간의 접두어를 기본 이름공간으로 바꾼다", () => {
    const xml = '<?xml version="1.0"?><x:sst xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="1"><x:si><x:t>가</x:t></x:si></x:sst>';
    expect(stripRootPrefix(xml)).toBe('<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="1"><si><t>가</t></si></sst>');
  });

  it("문서 정보(ep:)도 바꾼다", () => {
    const xml = '<ep:Properties xmlns:ep="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><ep:Application>Cell</ep:Application></ep:Properties>';
    expect(stripRootPrefix(xml)).toContain("<Properties xmlns=");
    expect(stripRootPrefix(xml)).toContain("<Application>Cell</Application>");
  });

  it("이미 표준 모양이거나, 모르는 이름공간이거나, 충돌할 수 있으면 건드리지 않는다", () => {
    expect(stripRootPrefix('<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si/></sst>')).toBeNull();
    expect(stripRootPrefix('<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/>')).toBeNull();
    expect(stripRootPrefix('<x:sst xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns="urn:other"/>')).toBeNull();
    expect(stripRootPrefix('<x:sst xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><x:si x:id="1"/></x:sst>')).toBeNull(); // 속성에 접두어를 쓰면 포기
  });
});

describe("한셀로 저장한 마스터 (samples/예외/마스터_한셀저장.xlsx)", async () => {
  const hancom = await bytesOf("예외/마스터_한셀저장.xlsx");
  const original = await bytesOf("마스터.xlsx");

  it("고쳐서 열 수 있다: 시트·헤더·키·미리 채운 값·병합 셀이 그대로 읽힌다", async () => {
    const result = await readWorkbookFromBuffer(hancom, "마스터_한셀저장.xlsx");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sheet = result.workbook.sheets[0];
    expect(sheet.name).toBe("Sheet1");
    expect(sheet.cells[2]).toEqual(["연번", "사번", "이름", "부서", "교육이수", "이수일", "점수", "비고"]);
    expect(sheet.cells[3].slice(0, 5)).toEqual([1, "S0001", "직원001", "부서01", "미이수"]); // 마스터에 미리 채워진 값
    expect(sheet.merges).toHaveLength(1); // 제목 줄 병합
  });

  it("엑셀로 저장한 원본 마스터와 칸 값이 같다", async () => {
    const [a, b] = [await readWorkbookFromBuffer(hancom, "a.xlsx"), await readWorkbookFromBuffer(original, "b.xlsx")];
    if (!a.ok || !b.ok) throw new Error("읽기 실패");
    // 날짜 칸의 표시만 다를 수 있어 기준 열(사번)과 헤더, 마스터에 미리 채워진 값으로 비교한다
    expect(a.workbook.sheets[0].cells.map((row) => row[1])).toEqual(b.workbook.sheets[0].cells.map((row) => row[1]));
    expect(a.workbook.sheets[0].cells[2]).toEqual(b.workbook.sheets[0].cells[2]);
  });

  it("이 마스터로 취합해 결과 파일을 만들 수 있고, 만든 파일은 다시 읽힌다", async () => {
    const master = await readWorkbookFromBuffer(hancom, "마스터_한셀저장.xlsx");
    const dept = await readWorkbookFromBuffer(await bytesOf("부서/부서01.xlsx"), "부서01.xlsx");
    if (!master.ok || !dept.ok) throw new Error("읽기 실패");
    const outcome = consolidate(master.workbook, [dept.workbook], settings);
    expect(outcome.appliedValues.length).toBeGreaterThan(0);

    const bytes = await buildResultFile(hancom, outcome.appliedValues, settings);
    const again = await readWorkbookFromBuffer(bytes.buffer, "결과.xlsx");
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    const row = again.workbook.sheets[0].cells[3]; // S0001 행: 부서01의 값으로 바뀌어 있어야 한다
    expect(row[1]).toBe("S0001");
    expect(row[4]).toBe("이수");
  });

  it("엑셀이 저장한 정상 파일은 고칠 것이 없어서 건드리지 않는다", async () => {
    expect(await repairNamespacePrefixes(original)).toBeNull();
  });

  it("zip이 아닌 내용이나 깨진 파일은 예외 없이 null이다", async () => {
    expect(await repairNamespacePrefixes(new TextEncoder().encode("엑셀이 아님").buffer as ArrayBuffer)).toBeNull();
    expect(await repairNamespacePrefixes(new ArrayBuffer(0))).toBeNull();
  });
});

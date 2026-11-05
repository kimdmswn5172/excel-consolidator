// 마스터 안의 지원 안 되는 요소(차트·피벗 테이블·도형 등) 탐지를 시험한다. 실행: npm run test
import { readFile } from "node:fs/promises";
import path from "node:path";
import { deflateRawSync } from "node:zlib";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { detectUnsupportedParts, listZipEntries, unsupportedMessage } from "./detectUnsupported";

// 시험용 zip 만들기: [이름, 내용, 저장 방식(0 그대로 / 8 deflate)]
function makeZip(entries: [string, string, 0 | 8][]): ArrayBuffer {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, content, method] of entries) {
    const nameBytes = enc.encode(name);
    const raw = enc.encode(content);
    const data = method === 8 ? new Uint8Array(deflateRawSync(raw)) : raw;
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(8, method, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, raw.length, true);
    local.setUint16(26, nameBytes.length, true);
    parts.push(new Uint8Array(local.buffer), nameBytes, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(10, method, true);
    c.setUint32(20, data.length, true);
    c.setUint32(24, raw.length, true);
    c.setUint16(28, nameBytes.length, true);
    c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const dirSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, dirSize, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of all) {
    out.set(part, at);
    at += part.length;
  }
  return out.buffer;
}

const sheet: [string, string, 0 | 8] = ["xl/worksheets/sheet1.xml", "<worksheet/>", 8];
const drawing = (body: string, method: 0 | 8 = 8): [string, string, 0 | 8] => ["xl/drawings/drawing1.xml", `<xdr:wsDr xmlns:xdr="x">${body}</xdr:wsDr>`, method];

describe("detectUnsupportedParts", () => {
  it("연습용 마스터와 그림이 든 마스터는 문제 없다 (그림은 결과 파일에 남는다)", async () => {
    const file = await readFile(path.join(process.cwd(), "samples", "마스터.xlsx"));
    expect(await detectUnsupportedParts(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer)).toEqual([]);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Sheet1");
    const png = wb.addImage({ base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", extension: "png" });
    ws.addImage(png, { tl: { col: 1, row: 1 }, ext: { width: 20, height: 20 } });
    const withImage = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    expect(await detectUnsupportedParts(withImage)).toEqual([]);
  });

  it("차트, 피벗 테이블, 슬라이서, 매크로를 파일 이름으로 알아낸다", async () => {
    expect(await detectUnsupportedParts(makeZip([sheet, ["xl/charts/chart1.xml", "<c/>", 8]]))).toEqual(["차트"]);
    expect(await detectUnsupportedParts(makeZip([sheet, ["xl/pivotTables/pivotTable1.xml", "<p/>", 8]]))).toEqual(["피벗 테이블"]);
    expect(await detectUnsupportedParts(makeZip([sheet, ["xl/pivotCache/pivotCacheDefinition1.xml", "<p/>", 8]]))).toEqual(["피벗 테이블"]);
    expect(await detectUnsupportedParts(makeZip([sheet, ["xl/slicers/slicer1.xml", "<s/>", 8]]))).toEqual(["슬라이서"]);
    expect(await detectUnsupportedParts(makeZip([sheet, ["xl/vbaProject.bin", "bin", 0]]))).toEqual(["매크로"]);
  });

  it("여러 개가 함께 있으면 모두 알려 준다", async () => {
    const found = await detectUnsupportedParts(makeZip([sheet, ["xl/charts/chart1.xml", "<c/>", 8], ["xl/pivotTables/p.xml", "<p/>", 8]]));
    expect(found.sort()).toEqual(["차트", "피벗 테이블"]);
  });

  it("그림 설명 파일 안의 도형(텍스트 상자 등)을 알아내고, 그림만 있으면 문제 없다 (deflate·그대로 저장 모두)", async () => {
    expect(await detectUnsupportedParts(makeZip([sheet, drawing("<xdr:twoCellAnchor><xdr:sp><xdr:txBody/></xdr:sp></xdr:twoCellAnchor>")]))).toEqual(["도형"]);
    expect(await detectUnsupportedParts(makeZip([sheet, drawing('<xdr:twoCellAnchor><xdr:sp macro="">x</xdr:sp></xdr:twoCellAnchor>', 0)]))).toEqual(["도형"]);
    expect(await detectUnsupportedParts(makeZip([sheet, drawing("<xdr:twoCellAnchor><xdr:pic/></xdr:twoCellAnchor>")]))).toEqual([]);
  });

  it("차트 틀(graphicFrame)은 차트 파일이 함께 있으면 차트로만 알린다", async () => {
    const withChart = makeZip([sheet, ["xl/charts/chart1.xml", "<c/>", 8], drawing("<xdr:twoCellAnchor><xdr:graphicFrame/></xdr:twoCellAnchor>")]);
    expect(await detectUnsupportedParts(withChart)).toEqual(["차트"]);
  });

  it("zip이 아니거나 깨진 파일은 예외 없이 빈 목록이다", async () => {
    expect(await detectUnsupportedParts(new TextEncoder().encode("엑셀이 아닌 글").buffer as ArrayBuffer)).toEqual([]);
    expect(await detectUnsupportedParts(new ArrayBuffer(0))).toEqual([]);
    expect(listZipEntries(makeZip([sheet]))?.map((entry) => entry.name)).toEqual(["xl/worksheets/sheet1.xml"]);
  });
});

describe("unsupportedMessage", () => {
  it("요소 이름과 확인 방법, 원본이 안전하다는 말이 들어 있다", () => {
    const message = unsupportedMessage(["차트", "피벗 테이블"]);
    expect(message).toContain("차트, 피벗 테이블");
    expect(message).toContain("엑셀에서 열어 확인");
    expect(message).toContain("원본 마스터 파일은 바뀌지 않습니다");
  });
});

// 마스터 파일 안에 결과 파일에서 빠지거나 바뀔 수 있는 요소가 있는지 미리 알아낸다. (PRD 원칙: 오류·제외는 조용히 넘기지 않고 알린다)
// 결과 파일은 엑셀 도구(ExcelJS)가 마스터를 다시 열어 저장한 것인데, 이 도구는 차트·피벗 테이블·도형·슬라이서·매크로를 지원하지 않는다.
// .xlsx는 zip 파일이라, 안에 든 파일 이름(과 그림 설명 파일의 내용)만 보고 판단한다. 파일을 읽는 것은 이 브라우저 안에서만 일어난다.

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;

type ZipEntry = { name: string; method: number; compressedSize: number; localOffset: number };

// zip 맨 뒤의 목차(중앙 디렉터리)에서 파일 목록을 읽는다. zip64처럼 지원하지 않는 모양이거나 깨져 있으면 null이다.
export function listZipEntries(buffer: ArrayBuffer): ZipEntry[] | null {
  const view = new DataView(buffer);
  const decoder = new TextDecoder();
  // 맨 뒤에서 거꾸로 올라가며 목차 끝 표시를 찾는다. (뒤에 붙는 설명 글이 있을 수 있어 최대 64KB까지 본다)
  let end = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 22 - 65535); i--) {
    if (view.getUint32(i, true) === SIG_EOCD) {
      end = i;
      break;
    }
  }
  if (end < 0) return null;

  const count = view.getUint16(end + 10, true);
  const directorySize = view.getUint32(end + 12, true);
  let offset = view.getUint32(end + 16, true);
  if (count === 0xffff || directorySize === 0xffffffff || offset === 0xffffffff) return null; // zip64

  const entries: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (offset + 46 > buffer.byteLength || view.getUint32(offset, true) !== SIG_CENTRAL) return null;
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    entries.push({
      name: decoder.decode(new Uint8Array(buffer, offset + 46, nameLength)),
      method: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      localOffset: view.getUint32(offset + 42, true),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

// 파일 하나의 내용을 글자로 꺼낸다. 저장 방식이 "그대로"(0)이거나 "deflate"(8)인 것만 지원한다.
async function readEntryText(buffer: ArrayBuffer, entry: ZipEntry): Promise<string | null> {
  const view = new DataView(buffer);
  const start = entry.localOffset + 30 + view.getUint16(entry.localOffset + 26, true) + view.getUint16(entry.localOffset + 28, true);
  const data = new Uint8Array(buffer, start, entry.compressedSize);
  if (entry.method === 0) return new TextDecoder().decode(data);
  if (entry.method !== 8) return null;
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

// 그림 설명 파일 안에서 도형·차트 틀·묶음 도형·연결선이 있는지 본다. (그림(pic)만 있으면 해당 없음 — 그림은 보존된다)
const SHAPE_TAG = /<(?:xdr:)?(?:sp|grpSp|cxnSp|graphicFrame)[\s>]/;

// 결과 파일에서 빠지거나 바뀔 수 있는 요소의 이름 목록. 없으면 빈 목록이다. 읽을 수 없는 파일이어도 예외 없이 빈 목록을 돌려준다.
export async function detectUnsupportedParts(buffer: ArrayBuffer): Promise<string[]> {
  try {
    const entries = listZipEntries(buffer);
    if (entries === null) return [];
    const names = entries.map((entry) => entry.name);
    const found = new Set<string>();

    if (names.some((name) => name.startsWith("xl/charts/"))) found.add("차트");
    if (names.some((name) => name.startsWith("xl/pivotTables/") || name.startsWith("xl/pivotCache/"))) found.add("피벗 테이블");
    if (names.some((name) => name.startsWith("xl/slicers/") || name.startsWith("xl/slicerCaches/"))) found.add("슬라이서");
    if (names.some((name) => name === "xl/vbaProject.bin")) found.add("매크로");

    // 도형(텍스트 상자 등)은 파일 이름만으로는 알 수 없어서 그림 설명 파일(drawing)을 열어 본다. 차트가 이미 있으면 "차트"만으로 충분하다.
    for (const entry of entries) {
      if (!/^xl\/drawings\/drawing\d+\.xml$/.test(entry.name)) continue;
      const text = await readEntryText(buffer, entry);
      if (text !== null && SHAPE_TAG.test(text)) {
        // 차트도 drawing 안에서는 graphicFrame으로 나온다. 차트 파일이 없는데 graphicFrame만 있으면 도형 계열로 본다.
        const onlyChartFrames = /<(?:xdr:)?graphicFrame[\s>]/.test(text) && !/<(?:xdr:)?(?:sp|grpSp|cxnSp)[\s>]/.test(text);
        if (!onlyChartFrames || !found.has("차트")) found.add("도형");
      }
    }
    return [...found];
  } catch {
    return [];
  }
}

export function unsupportedMessage(parts: string[]): string {
  return `마스터 표에 ${parts.join(", ")}이(가) 들어 있습니다. 이런 요소는 결과 파일에서 빠지거나 바뀔 수 있습니다. 결과 파일을 내려받으면 엑셀에서 열어 확인해 주세요. 원본 마스터 파일은 바뀌지 않습니다.`;
}

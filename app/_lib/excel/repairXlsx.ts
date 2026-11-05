// 한컴오피스(한셀) 등이 저장한 .xlsx를 읽을 수 있게 고친다. (사용자 보고: 한셀로 저장한 파일을 넣으면 "손상되었거나 읽을 수 없는 파일"이라고 나옴)
//
// 원인: 한셀은 모든 부분을 `<x:workbook>`, `<x:sst>`, `<ep:Properties>`처럼 접두어가 붙은 태그로 저장한다.
//       엑셀이 저장한 파일은 `<workbook>`처럼 접두어가 없고, 우리가 쓰는 엑셀 읽기 도구(ExcelJS)는 접두어 없는 태그만 알아본다.
// 해결: 파일(zip) 안의 XML 부분 중 루트 태그에 접두어가 붙은 것을 골라, 그 접두어를 기본 이름공간으로 바꿔 쓴다.
//       (`xmlns:x="…main"` + `<x:sst>` → `xmlns="…main"` + `<sst>`) 내용(값·서식)은 그대로이고 태그 이름 표기만 바뀐다.
// 평소에는 쓰지 않는다. 먼저 그대로 읽어 보고 실패했을 때만 이 함수로 고쳐서 다시 읽는다.
// 브라우저 안(작업 공간 포함)에서만 처리하고 서버로 보내지 않는다. zip64나 알 수 없는 모양이면 건드리지 않고 null을 돌려준다.

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

// 접두어를 기본 이름공간으로 바꿔도 되는 이름공간들 (엑셀 문서의 본문과 문서 정보)
const REWRITABLE_NAMESPACES = new Set([
  "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
  "http://schemas.openxmlformats.org/officeDocument/2006/extended-properties",
]);

type Entry = {
  name: string;
  central: Uint8Array; // 중앙 디렉터리의 원래 기록 (그대로 복사해 쓰기 위해)
  method: number;
  flags: number;
  compressedSize: number;
  localOffset: number;
};

// ── CRC-32 (새로 쓰는 부분의 검사 값) ──
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ── 압축 풀기·압축하기 (브라우저와 Node 모두에 있는 표준 도구) ──
async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// ── zip 구조 읽기 ──
function readEntries(bytes: Uint8Array): { entries: Entry[]; dirOffset: number; eocd: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) {
    if (view.getUint32(i, true) === SIG_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const count = view.getUint16(eocd + 10, true);
  const dirOffset = view.getUint32(eocd + 16, true);
  if (count === 0xffff || dirOffset === 0xffffffff || view.getUint32(eocd + 12, true) === 0xffffffff) return null; // zip64는 지원하지 않는다

  const decoder = new TextDecoder();
  const entries: Entry[] = [];
  let offset = dirOffset;
  for (let n = 0; n < count; n++) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== SIG_CENTRAL) return null;
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const total = 46 + nameLength + extraLength + commentLength;
    entries.push({
      name: decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)),
      central: bytes.slice(offset, offset + total),
      flags: view.getUint16(offset + 8, true),
      method: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      localOffset: view.getUint32(offset + 42, true),
    });
    offset += total;
  }
  return { entries, dirOffset, eocd };
}

async function readText(bytes: Uint8Array, entry: Entry): Promise<Uint8Array | null> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (entry.localOffset + 30 > bytes.length || view.getUint32(entry.localOffset, true) !== SIG_LOCAL) return null;
  const start = entry.localOffset + 30 + view.getUint16(entry.localOffset + 26, true) + view.getUint16(entry.localOffset + 28, true);
  const data = bytes.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return data;
  if (entry.method === 8) return inflateRaw(data);
  return null;
}

// ── XML 고치기 ──
// 루트 태그에 접두어가 붙어 있고 그 접두어가 본문·문서 정보 이름공간이면, 접두어를 없애고 기본 이름공간으로 바꾼다. 고칠 것이 없으면 null이다.
export function stripRootPrefix(xml: string): string | null {
  const body = xml.replace(/^﻿?\s*<\?xml[\s\S]*?\?>\s*/, ""); // 맨 앞의 XML 선언은 건너뛴다
  const root = /^<([A-Za-z_][\w.-]*):([A-Za-z_][\w.-]*)((?:\s[^>]*)?)>/.exec(body);
  if (!root) return null;
  const prefix = root[1];
  const declaration = new RegExp(`xmlns:${prefix}\\s*=\\s*"([^"]+)"`).exec(root[0]);
  if (!declaration || !REWRITABLE_NAMESPACES.has(declaration[1])) return null;
  if (/\sxmlns\s*=/.test(root[0])) return null; // 이미 기본 이름공간이 있으면 충돌할 수 있어 건드리지 않는다
  // 이 접두어를 속성 이름으로 쓰는 경우(<a x:id=…>)는 바꿀 수 없으므로 포기한다
  if (new RegExp(`\\s${prefix}:[\\w.-]+\\s*=`).test(xml)) return null;

  return xml
    .replace(new RegExp(`xmlns:${prefix}\\s*=\\s*"`, "g"), 'xmlns="')
    .replace(new RegExp(`<(/?)${prefix}:`, "g"), "<$1");
}

function u16(value: number) {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, value, true);
  return b;
}
function u32(value: number) {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, value >>> 0, true);
  return b;
}

// 한셀처럼 접두어가 붙은 .xlsx를 표준 모양으로 고친 새 파일 내용을 돌려준다. 고칠 것이 없거나 지원하지 않는 모양이면 null이다.
export async function repairNamespacePrefixes(buffer: ArrayBuffer): Promise<ArrayBuffer | null> {
  try {
    const bytes = new Uint8Array(buffer);
    const parsed = readEntries(bytes);
    if (!parsed) return null;
    const { entries, dirOffset, eocd } = parsed;
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    // 1) 고칠 부분 찾기
    const replaced = new Map<string, Uint8Array>();
    for (const entry of entries) {
      if (!/^(xl\/.+\.xml|docProps\/app\.xml)$/.test(entry.name) || entry.name.endsWith(".rels")) continue;
      const raw = await readText(bytes, entry);
      if (!raw) continue;
      const fixed = stripRootPrefix(decoder.decode(raw));
      if (fixed !== null) replaced.set(entry.name, encoder.encode(fixed));
    }
    if (replaced.size === 0) return null;

    // 2) 새 zip 만들기: 안 바뀐 부분은 원래 기록을 그대로 복사하고, 바뀐 부분만 새로 압축해서 쓴다
    const order = [...entries].sort((a, b) => a.localOffset - b.localOffset);
    const parts: Uint8Array[] = [];
    const newOffsets = new Map<Entry, number>();
    const newCentral = new Map<Entry, Uint8Array>();
    let position = 0;

    for (let i = 0; i < order.length; i++) {
      const entry = order[i];
      newOffsets.set(entry, position);
      const content = replaced.get(entry.name);
      if (!content) {
        const end = i + 1 < order.length ? order[i + 1].localOffset : dirOffset;
        const chunk = bytes.subarray(entry.localOffset, end);
        parts.push(chunk);
        position += chunk.length;
        continue;
      }
      const compressed = await deflateRaw(content);
      const nameBytes = encoder.encode(entry.name);
      const central = entry.central.slice();
      const cv = new DataView(central.buffer);
      const flags = entry.flags & ~0x08; // 뒤에 붙는 크기 기록(데이터 설명)을 쓰지 않는다
      const crc = crc32(content);
      cv.setUint16(8, flags, true);
      cv.setUint16(10, 8, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, compressed.length, true);
      cv.setUint32(24, content.length, true);
      newCentral.set(entry, central);

      const header = new Uint8Array([
        ...u32(SIG_LOCAL),
        ...u16(20),
        ...u16(flags),
        ...u16(8),
        ...central.subarray(12, 16), // 수정 시각·날짜는 원래 값을 그대로 쓴다
        ...u32(crc),
        ...u32(compressed.length),
        ...u32(content.length),
        ...u16(nameBytes.length),
        ...u16(0),
        ...nameBytes,
      ]);
      parts.push(header, compressed);
      position += header.length + compressed.length;
    }

    // 3) 중앙 디렉터리와 끝 표시를 새 위치로 다시 쓴다 (원래 순서 그대로)
    const newDirOffset = position;
    let directorySize = 0;
    for (const entry of entries) {
      const central = newCentral.get(entry) ?? entry.central.slice();
      new DataView(central.buffer).setUint32(42, newOffsets.get(entry)!, true);
      parts.push(central);
      directorySize += central.length;
    }
    const tail = bytes.slice(eocd);
    const tv = new DataView(tail.buffer);
    tv.setUint32(12, directorySize, true);
    tv.setUint32(16, newDirOffset, true);
    parts.push(tail);

    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let at = 0;
    for (const part of parts) {
      out.set(part, at);
      at += part.length;
    }
    return out.buffer;
  } catch {
    return null; // 고치지 못해도 원래의 오류 안내가 나오게 한다
  }
}

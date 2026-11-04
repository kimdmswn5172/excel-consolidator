// 브라우저에서 .xlsx 파일을 읽어 시트·칸 값·병합 셀 정보를 꺼낸다.
// 엑셀 전체를 서버로 보내지 않고 사용자의 브라우저 안에서만 처리한다. (PRD 7번, DESIGN 2번)
// 원본 파일은 건드리지 않고, 읽은 내용을 메모리에 복사해 둔 WorkbookData만 돌려준다.
import { formatRange, parseRange } from "./a1";
import type { CellValue, MergedRange, SheetData, SkippedFile, WorkbookData } from "../types";

// 읽기에 성공하면 워크북을, 실패하면 "제외 파일 목록"에 보여 줄 이유를 돌려준다.
export type ReadWorkbookResult =
  | { ok: true; workbook: WorkbookData }
  | { ok: false; skipped: SkippedFile };

// .xlsx는 ZIP 파일이라 맨 앞이 "PK"로 시작한다.
function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

// 비밀번호가 걸린 .xlsx는 ZIP이 아니라 옛 엑셀 묶음(OLE) 형식으로 저장된다. 맨 앞 4바이트가 D0 CF 11 E0이다.
function isOleContainer(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0;
}

// ExcelJS가 돌려주는 칸 값(글자, 숫자, 날짜, 수식, 서식 있는 글자 등)을 단순한 값으로 바꾼다.
// 빈 글자("")는 빈 칸(null)으로 본다. 수식은 계산된 결과 값을 쓴다.
function toCellValue(value: unknown): CellValue {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value === "" ? null : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.richText)) {
      const text = (obj.richText as Array<{ text?: string }>).map((part) => part.text ?? "").join("");
      return text === "" ? null : text;
    }
    if ("formula" in obj || "sharedFormula" in obj) return toCellValue(obj.result);
    if ("hyperlink" in obj) return toCellValue(obj.text);
    if ("error" in obj) return typeof obj.error === "string" ? obj.error : null;
  }
  return String(value);
}

function failure(fileName: string, reason: SkippedFile["reason"], message: string): ReadWorkbookResult {
  return { ok: false, skipped: { fileName, reason, message } };
}

// 파일 내용(바이트)을 읽어 WorkbookData로 바꾼다.
export async function readWorkbookFromBuffer(
  buffer: ArrayBuffer | Uint8Array,
  fileName: string,
): Promise<ReadWorkbookResult> {
  if (!fileName.toLowerCase().endsWith(".xlsx")) {
    return failure(fileName, "not-xlsx", `${fileName}은(는) .xlsx 파일이 아니어서 읽을 수 없습니다.`);
  }

  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (isOleContainer(bytes)) {
    return failure(fileName, "password-protected", `${fileName}은(는) 비밀번호가 걸려 있어 읽을 수 없습니다.`);
  }
  if (!isZip(bytes)) {
    return failure(fileName, "unreadable", `${fileName}은(는) 손상되었거나 읽을 수 없는 파일입니다.`);
  }

  try {
    // 엑셀 처리 도구는 크기가 커서, 파일을 읽을 때 처음으로 불러온다.
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);

    const sheets: SheetData[] = workbook.worksheets.map((worksheet) => {
      const rowCount = worksheet.rowCount;
      const colCount = worksheet.columnCount;
      const cells: CellValue[][] = Array.from({ length: rowCount }, () => Array<CellValue>(colCount).fill(null));

      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
          if (rowNumber <= rowCount && colNumber <= colCount) {
            cells[rowNumber - 1][colNumber - 1] = toCellValue(cell.value);
          }
        });
      });

      const merges: MergedRange[] = (worksheet.model.merges ?? []).map(parseRange);

      // 병합된 범위에서는 엑셀 화면처럼 왼쪽 위 칸만 값을 갖는다.
      // (ExcelJS는 나머지 칸에도 같은 값을 보여 주는데, 그대로 두면 같은 키가 여러 번 나온 것처럼 보인다)
      for (const merge of merges) {
        for (let r = merge.startRow; r <= Math.min(merge.endRow, rowCount); r++) {
          for (let c = merge.startCol; c <= Math.min(merge.endCol, colCount); c++) {
            if (r !== merge.startRow || c !== merge.startCol) cells[r - 1][c - 1] = null;
          }
        }
      }

      return { name: worksheet.name, rowCount, colCount, cells, merges };
    });

    return { ok: true, workbook: { fileName, sheets } };
  } catch {
    return failure(fileName, "unreadable", `${fileName}은(는) 손상되었거나 읽을 수 없는 파일입니다.`);
  }
}

// 사용자가 고른 파일(File)을 읽는다. 브라우저의 파일 선택·끌어다 놓기에서 쓴다.
export async function readWorkbookFromFile(file: File): Promise<ReadWorkbookResult> {
  return readWorkbookFromBuffer(await file.arrayBuffer(), file.name);
}

// 병합 범위를 안내 문장에 쓸 글자로 바꾸는 편의 함수 (예: "B5:B6")
export function describeMerge(merge: MergedRange): string {
  return formatRange(merge);
}

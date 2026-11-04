// [분석 시작]을 누르면 1단계에서 고른 파일들을 실제로 읽는다. 모두 브라우저 안에서만 읽는다. (PRD 7번)
//  - 마스터를 읽지 못하면 더 진행할 수 없다.
//  - 부서 파일은 읽지 못한 것만 건너뛰고 이유를 모아 둔다. (3단계 점검 화면에서 보여 준다)
//  - 부서 파일을 하나도 읽지 못하면 더 진행할 수 없다.
import { readWorkbookFromFile, type ReadWorkbookResult } from "./excel/readWorkbook";
import { splitReadResults } from "./merge/inspectFiles";
import type { SkippedFile, WorkbookData } from "./types";

export type ReadSelectionResult =
  | { ok: true; master: WorkbookData; departments: WorkbookData[]; skipped: SkippedFile[] }
  | { ok: false; message: string };

export type ReadSelectionOptions = {
  // 파일 하나를 읽는 방법. 화면에서는 별도 작업 공간(Web Worker)에서 읽는 도구를 넘긴다.
  read?: (file: File) => Promise<ReadWorkbookResult>;
  // 파일 하나를 읽기 시작할 때 그 파일 이름을 알려 준다. (진행 표시에 쓴다)
  onFileStart?: (fileName: string) => void;
};

// 파일을 하나씩 차례로 읽는다. 읽을 때마다 onProgress(읽은 수, 전체 수)를 부른다.
export async function readSelection(
  master: File,
  departments: File[],
  onProgress?: (done: number, total: number) => void,
  options: ReadSelectionOptions = {},
): Promise<ReadSelectionResult> {
  const read = options.read ?? readWorkbookFromFile;
  const total = departments.length + 1;
  onProgress?.(0, total);

  options.onFileStart?.(master.name);
  const masterResult = await read(master);
  onProgress?.(1, total);
  if (!masterResult.ok) {
    return { ok: false, message: `마스터 표를 읽을 수 없습니다. ${masterResult.skipped.message}` };
  }

  const results = [];
  for (const [index, file] of departments.entries()) {
    options.onFileStart?.(file.name);
    results.push(await read(file));
    onProgress?.(index + 2, total);
  }
  const { workbooks, skipped } = splitReadResults(results);
  if (workbooks.length === 0) {
    return { ok: false, message: "부서 파일을 하나도 읽을 수 없습니다. 파일이 손상되었거나 비밀번호가 걸려 있는지 확인해 주세요." };
  }

  return { ok: true, master: masterResult.workbook, departments: workbooks, skipped };
}

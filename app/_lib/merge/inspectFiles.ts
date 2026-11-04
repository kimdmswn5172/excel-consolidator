// 취합 전에 파일을 점검한다. (PRD 5번 must 1의 규칙 7, must 2의 규칙 7)
//  1) 읽을 수 없는 파일은 건너뛰고 "제외 파일 목록"에 모은다.
//  2) 마스터와 부서 파일의 헤더가 대표 파일과 같은지 확인한다.
//     다른 부서 파일은 취합하지 않고 이유와 함께 제외 목록에 넣는다. 마스터가 다르면 경고만 하고 계속할지는 사용자가 정한다.
import type { ReadWorkbookResult } from "../excel/readWorkbook";
import { numberToColumnLetters } from "../excel/a1";
import type { CellValue, ConsolidationSettings, SkippedFile, WorkbookData } from "../types";
import { displayKey, normalizeKey } from "./normalizeKey";

// ───────────────────────────────────────────────
// 1. 읽기 결과 나누기
// ───────────────────────────────────────────────

// 파일 여러 개를 읽은 결과를 "읽은 워크북"과 "읽지 못한 파일(이유 포함)"로 나눈다.
// 읽지 못한 파일이 있어도 나머지는 계속 처리한다.
export function splitReadResults(results: ReadWorkbookResult[]): {
  workbooks: WorkbookData[];
  skipped: SkippedFile[];
} {
  const workbooks: WorkbookData[] = [];
  const skipped: SkippedFile[] = [];
  for (const result of results) {
    if (result.ok) workbooks.push(result.workbook);
    else skipped.push(result.skipped);
  }
  return { workbooks, skipped };
}

// ───────────────────────────────────────────────
// 2. 헤더 비교
// ───────────────────────────────────────────────

export type HeaderSettings = Pick<ConsolidationSettings, "sheetName" | "headerRow">;

// 헤더가 다른 열 하나. column은 1부터 시작하는 열 번호다.
export type HeaderDifference = {
  column: number;
  expected: string; // 대표 파일의 헤더 (비어 있으면 "(비어 있음)")
  actual: string; // 비교한 파일의 헤더
};

const EMPTY_LABEL = "(비어 있음)";

function headerCells(workbook: WorkbookData, settings: HeaderSettings): CellValue[] | null {
  const sheet = workbook.sheets.find((candidate) => candidate.name === settings.sheetName);
  if (!sheet) return null;
  return sheet.cells[settings.headerRow - 1] ?? [];
}

function headerLabel(value: CellValue): string {
  const text = displayKey(value);
  return text === "" ? EMPTY_LABEL : text;
}

// 헤더 행을 열마다 비교해 다른 곳을 모두 돌려준다. 시트가 없으면 null이다.
// 비교할 때는 공백, 전각 문자, 대소문자 차이를 무시한다. (기준 키를 정리하는 방식과 같다)
export function compareHeaders(
  reference: WorkbookData,
  target: WorkbookData,
  settings: HeaderSettings,
): HeaderDifference[] | null {
  const referenceRow = headerCells(reference, settings);
  const targetRow = headerCells(target, settings);
  if (referenceRow === null || targetRow === null) return null;

  const differences: HeaderDifference[] = [];
  const width = Math.max(referenceRow.length, targetRow.length);
  for (let i = 0; i < width; i++) {
    const expected = referenceRow[i] ?? null;
    const actual = targetRow[i] ?? null;
    if (normalizeKey(expected) !== normalizeKey(actual)) {
      differences.push({ column: i + 1, expected: headerLabel(expected), actual: headerLabel(actual) });
    }
  }
  return differences;
}

// 안내 문장에는 다른 곳을 최대 3개까지만 보여 주고 나머지는 개수로 줄인다.
function describeDifferences(differences: HeaderDifference[]): string {
  const shown = differences
    .slice(0, 3)
    .map((d) => `${numberToColumnLetters(d.column)}열 "${d.actual}" (대표 파일: "${d.expected}")`);
  const rest = differences.length - shown.length;
  return rest > 0 ? `${shown.join(", ")} 외 ${rest}곳` : shown.join(", ");
}

export type HeaderCheckResult = {
  // 헤더가 맞아서 취합할 수 있는 부서 파일 (대표 파일 포함, 처음 순서 유지)
  passedDepartments: WorkbookData[];
  // 헤더가 달라서 제외하는 부서 파일과 이유
  excludedFiles: SkippedFile[];
  // 마스터의 헤더가 대표 파일과 다른지. 다르면 화면에서 경고하고 사용자가 계속할지 정한다.
  masterHeaderMismatch: boolean;
  // 마스터가 다를 때 어디가 다른지 (안내 문장에 쓴다)
  masterDifferences: HeaderDifference[];
  masterMessage: string | null;
};

// 마스터와 부서 파일들의 헤더를 대표 파일과 비교한다.
// representative는 부서 파일 중 하나이며, 자기 자신과는 당연히 같아서 항상 통과한다.
export function checkHeaders(
  representative: WorkbookData,
  master: WorkbookData,
  departments: WorkbookData[],
  settings: HeaderSettings,
): HeaderCheckResult {
  const passedDepartments: WorkbookData[] = [];
  const excludedFiles: SkippedFile[] = [];

  for (const department of departments) {
    if (department === representative) {
      passedDepartments.push(department);
      continue;
    }
    const differences = compareHeaders(representative, department, settings);
    if (differences === null) {
      excludedFiles.push({
        fileName: department.fileName,
        reason: "header-mismatch",
        message: `${department.fileName}에 "${settings.sheetName}" 시트가 없어 취합하지 않았습니다.`,
        sheetName: settings.sheetName,
      });
    } else if (differences.length > 0) {
      excludedFiles.push({
        fileName: department.fileName,
        reason: "header-mismatch",
        message: `${department.fileName}의 헤더가 대표 파일(${representative.fileName})과 달라 취합하지 않았습니다: ${describeDifferences(differences)}`,
        sheetName: settings.sheetName,
      });
    } else {
      passedDepartments.push(department);
    }
  }

  const masterDifferences = compareHeaders(representative, master, settings);
  let masterMessage: string | null = null;
  if (masterDifferences === null) {
    masterMessage = `${master.fileName}에 "${settings.sheetName}" 시트가 없습니다.`;
  } else if (masterDifferences.length > 0) {
    masterMessage = `${master.fileName}의 헤더가 대표 파일(${representative.fileName})과 다릅니다: ${describeDifferences(masterDifferences)}`;
  }

  return {
    passedDepartments,
    excludedFiles,
    masterHeaderMismatch: masterMessage !== null,
    masterDifferences: masterDifferences ?? [],
    masterMessage,
  };
}

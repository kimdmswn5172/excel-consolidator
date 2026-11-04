// 취합 결과를 화면에 보여 줄 모양으로 정리한다. (PRD 5번 must 2의 규칙 8, 9)
//  - 바뀐 칸 목록: 마스터에 값이 있었는데 부서 파일의 "다른" 값으로 바뀐 칸만 담는다.
//    처음부터 비어 있던 칸을 채운 것과, 같은 값을 다시 쓴 것은 넣지 않는다.
//  - 처리 요약: 처리 파일 수, 성공·제외 수, 미매칭 건수, 중복 건수, 바뀐 칸 수
import { numberToColumnLetters } from "../excel/a1";
import type {
  CellValue,
  ChangedCell,
  ConsolidationResult,
  ConsolidationSettings,
  ConsolidationSummary,
  SkippedFile,
  WorkbookData,
} from "../types";
import type { AppliedValue, ConsolidateOutcome } from "./consolidate";
import { displayKey } from "./normalizeKey";

// 두 칸의 값이 같은지. 날짜는 같은 순간이면 같은 값으로 본다.
// 숫자 89와 글자 "89"처럼 모양이 다르면 다른 값으로 본다. (엑셀에서도 다르게 저장된다)
export function isSameValue(a: CellValue, b: CellValue): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

// 열 이름: 마스터 헤더 행에 적힌 글자. 비어 있으면 "E열"처럼 열 기호를 쓴다.
function columnName(master: WorkbookData, settings: ConsolidationSettings, column: number): string {
  const sheet = master.sheets.find((candidate) => candidate.name === settings.sheetName);
  const name = displayKey(sheet?.cells[settings.headerRow - 1]?.[column - 1] ?? null);
  return name === "" ? `${numberToColumnLetters(column)}열` : name;
}

// 쓰기 기록에서 "바뀐 칸"만 골라 마스터 행 → 열 순서로 정렬한다.
export function buildChangedCells(
  appliedValues: AppliedValue[],
  master: WorkbookData,
  settings: ConsolidationSettings,
): ChangedCell[] {
  return appliedValues
    .filter((applied) => applied.previousValue !== null && !isSameValue(applied.previousValue, applied.newValue))
    .sort((a, b) => a.masterRow - b.masterRow || a.column - b.column)
    .map((applied) => ({
      key: applied.key,
      columnName: columnName(master, settings, applied.column),
      column: applied.column,
      masterValue: applied.previousValue,
      departmentValue: applied.newValue,
      sourceFile: applied.sourceFile,
    }));
}

export type SummaryInput = {
  outcome: ConsolidateOutcome;
  // 취합 조건 (열 이름을 찾을 때 쓴다)
  settings: ConsolidationSettings;
  // 실제로 취합한 부서 파일 수 (점검을 통과한 파일)
  consolidatedFileCount: number;
  // 취합하지 못한 부서 파일들 (읽기 실패, 헤더 다름, 병합 셀 위험을 모두 합친 것)
  skippedFiles: SkippedFile[];
};

// 취합 엔진의 결과를 화면용 결과(ConsolidationResult)로 만든다.
// 사용자가 처리 방법을 고르지 않은 중복 키가 남아 있으면 결과를 확정할 수 없어 오류를 던진다.
export function buildConsolidationResult({
  outcome,
  settings,
  consolidatedFileCount,
  skippedFiles,
}: SummaryInput): ConsolidationResult {
  if (outcome.unresolvedDuplicates.length > 0) {
    const keys = outcome.unresolvedDuplicates.map((duplicate) => duplicate.displayKey).join(", ");
    throw new Error(`중복 키의 처리 방법을 먼저 골라 주세요: ${keys}`);
  }

  const changedCells = buildChangedCells(outcome.appliedValues, outcome.resultMaster, settings);
  const summary: ConsolidationSummary = {
    processedFiles: consolidatedFileCount + skippedFiles.length,
    succeededFiles: consolidatedFileCount,
    skippedFiles: skippedFiles.length,
    unmatchedCount: outcome.unmatchedKeys.length,
    duplicateCount: outcome.duplicateKeys.length,
    changedCellCount: changedCells.length,
  };

  return {
    resultMaster: outcome.resultMaster,
    changedCells,
    unmatchedKeys: outcome.unmatchedKeys,
    duplicateKeys: outcome.duplicateKeys,
    skippedFiles,
    summary,
  };
}

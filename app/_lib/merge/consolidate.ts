// 부서 파일의 값을 마스터 표에 채워 넣는 취합 엔진. (PRD 5번 must 2의 규칙 1~6)
// 화면과 무관한 순수 계산이다. 원본 마스터와 부서 파일은 바꾸지 않고, 결과는 새 워크북으로 돌려준다.
//
// 규칙 요약
//  - 기준 열의 정리된 키로 마스터의 행을 찾는다.
//  - 부서 파일에 값이 있으면 마스터에 이미 값이 있어도 부서 값을 우선해 입력한다.
//  - 부서 칸이 비어 있으면 마스터 칸은 그대로 둔다. (비어 있는 것은 "입력하지 않았다"는 뜻이다)
//  - 마스터에 없는 키는 결과에 추가하지 않고 미매칭 목록으로만 돌려준다.
//  - 같은 키가 2건 이상이면 임의로 고르지 않는다. 사용자가 처리 방법을 고를 때까지 그 키는 채우지 않는다.
import type {
  CellValue,
  ConsolidationSettings,
  DuplicateChoices,
  DuplicateKey,
  DuplicateStrategy,
  UnmatchedKey,
  WorkbookData,
} from "../types";
import { listDataRows } from "./dataRows";
import { findDuplicateKeys } from "./findDuplicateKeys";
import { displayKey } from "./normalizeKey";

// 마스터 칸에 값을 써 넣은 기록 하나. "바뀐 칸" 목록과 처리 요약은 이 기록으로 만든다.
export type AppliedValue = {
  key: string; // 화면에 보여 줄 키 (마스터에 적힌 원래 모양)
  masterRow: number;
  column: number;
  previousValue: CellValue; // 쓰기 전 마스터 값 (비어 있었으면 null)
  newValue: CellValue;
  sourceFile: string; // 값을 가져온 부서 파일. 여러 파일의 값을 나열했다면 쉼표로 이어 붙인다.
};

export type ConsolidateOutcome = {
  // 값을 채운 새 마스터. 원본 마스터는 바뀌지 않는다.
  resultMaster: WorkbookData;
  appliedValues: AppliedValue[];
  unmatchedKeys: UnmatchedKey[];
  // 발견한 중복 키 전체 (결과의 "중복 목록"에 쓴다)
  duplicateKeys: DuplicateKey[];
  // 값을 채우려면 사용자가 처리 방법을 골라야 하는데 아직 고르지 않은 중복 키.
  // 이 목록이 비어 있지 않으면 화면은 취합을 끝내지 말고 사용자에게 선택을 요청해야 한다.
  unresolvedDuplicates: DuplicateKey[];
};

// 부서 파일에서 키 하나가 나온 곳
type DepartmentOccurrence = {
  fileName: string;
  cells: CellValue[]; // 그 행의 칸들
};

function valueText(value: CellValue): string {
  if (value === null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function resolveStrategy(choices: DuplicateChoices | undefined, key: string): DuplicateStrategy | undefined {
  if (!choices) return undefined;
  return choices.mode === "all" ? choices.strategy : choices.byKey[key];
}

// 부서 쪽에서 가져올 값 하나를 고른다. 가져올 값이 없으면(칸이 비어 있으면) null이다.
function pickValue(
  occurrences: DepartmentOccurrence[],
  column: number,
  strategy: DuplicateStrategy,
): { value: CellValue; sourceFile: string } | null {
  if (strategy === "list-all" && occurrences.length >= 2) {
    const filled = occurrences.filter((occ) => (occ.cells[column - 1] ?? null) !== null);
    if (filled.length === 0) return null;
    if (filled.length === 1) return { value: filled[0].cells[column - 1], sourceFile: filled[0].fileName };
    return {
      value: filled.map((occ) => valueText(occ.cells[column - 1])).join(" / "),
      sourceFile: [...new Set(filled.map((occ) => occ.fileName))].join(", "),
    };
  }
  const chosen = strategy === "last" ? occurrences[occurrences.length - 1] : occurrences[0];
  const value = chosen.cells[column - 1] ?? null;
  return value === null ? null : { value, sourceFile: chosen.fileName };
}

// 마스터에 같은 키의 행이 여럿일 때 값을 넣을 행을 고른다.
function pickMasterRows(rows: number[], strategy: DuplicateStrategy): number[] {
  if (rows.length === 1) return rows;
  if (strategy === "first") return [rows[0]];
  if (strategy === "last") return [rows[rows.length - 1]];
  if (strategy === "list-all") return rows;
  return [];
}

// 마스터와 (점검을 통과한) 부서 파일들을 받아 취합한다.
// 마스터에 지정한 시트가 없으면 오류를 던진다. 부서 파일에 시트가 없으면 그 파일은 건너뛴다.
export function consolidate(
  master: WorkbookData,
  departments: WorkbookData[],
  settings: ConsolidationSettings,
  duplicateChoices?: DuplicateChoices,
): ConsolidateOutcome {
  const resultMaster = structuredClone(master);
  const sheet = resultMaster.sheets.find((candidate) => candidate.name === settings.sheetName);
  if (!sheet) {
    throw new Error(`${master.fileName}에 "${settings.sheetName}" 시트가 없어 취합할 수 없습니다.`);
  }

  // 마스터의 키 → 행 번호들 (같은 키가 여러 행이면 여러 개)
  const masterRows = new Map<string, number[]>();
  for (const { row, key } of listDataRows(sheet, settings)) {
    const rows = masterRows.get(key);
    if (rows) rows.push(row);
    else masterRows.set(key, [row]);
  }

  // 부서 파일들에서 마스터에 있는 키를 모으고, 없는 키는 미매칭으로 기록한다.
  const departmentOccurrences = new Map<string, DepartmentOccurrence[]>();
  const unmatchedKeys: UnmatchedKey[] = [];
  for (const department of departments) {
    const departmentSheet = department.sheets.find((candidate) => candidate.name === settings.sheetName);
    if (!departmentSheet) continue;
    for (const { row, key, raw } of listDataRows(departmentSheet, settings)) {
      if (!masterRows.has(key)) {
        unmatchedKeys.push({ key: displayKey(raw), fileName: department.fileName, row });
        continue;
      }
      const occurrence = { fileName: department.fileName, cells: departmentSheet.cells[row - 1] ?? [] };
      const list = departmentOccurrences.get(key);
      if (list) list.push(occurrence);
      else departmentOccurrences.set(key, [occurrence]);
    }
  }

  const duplicateKeys = findDuplicateKeys(master, departments, settings);
  const duplicateByKey = new Map(duplicateKeys.map((duplicate) => [duplicate.key, duplicate]));

  const appliedValues: AppliedValue[] = [];
  const unresolvedDuplicates: DuplicateKey[] = [];

  for (const [key, occurrences] of departmentOccurrences) {
    const rows = masterRows.get(key) ?? [];
    let strategy: DuplicateStrategy = "first"; // 중복이 아니면 행도 값도 하나뿐이라 어느 쪽이든 같다
    let targetRows = rows;

    const duplicate = duplicateByKey.get(key);
    if (duplicate) {
      const chosen = resolveStrategy(duplicateChoices, key);
      if (chosen === undefined) {
        unresolvedDuplicates.push(duplicate);
        continue; // 사용자가 고를 때까지 채우지 않는다
      }
      if (chosen === "leave-blank") continue; // 비워 두고 중복 목록에만 남긴다
      strategy = chosen;
      targetRows = pickMasterRows(rows, strategy);
    }

    for (const masterRow of targetRows) {
      const cells = sheet.cells[masterRow - 1];
      for (const column of settings.targetColumns) {
        const picked = pickValue(occurrences, column, strategy);
        if (!picked) continue; // 부서 칸이 비어 있으면 마스터 칸을 그대로 둔다
        while (cells.length < column) cells.push(null);
        sheet.colCount = Math.max(sheet.colCount, column);
        appliedValues.push({
          key: displayKey(cells[settings.keyColumn - 1] ?? null),
          masterRow,
          column,
          previousValue: cells[column - 1] ?? null,
          newValue: picked.value,
          sourceFile: picked.sourceFile,
        });
        cells[column - 1] = picked.value;
      }
    }
  }

  return { resultMaster, appliedValues, unmatchedKeys, duplicateKeys, unresolvedDuplicates };
}

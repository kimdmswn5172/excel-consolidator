// 병합된 셀 때문에 값이 어긋날 위험이 있는지 검사한다. (PRD 5번 must 2의 규칙 10)
// 병합 셀이 있어도 기본적으로 취합은 진행한다. 다만 아래 경우는 값이 한 행씩 밀리거나 엉뚱한 칸에 들어갈 수 있어서,
// 그 파일은 취합하지 않고 이유를 알려 준다.
//   - 헤더 행에 걸친 병합      → 열 위치를 믿을 수 없다
//   - 기준 열의 데이터 영역에 걸친 병합 → 병합된 칸의 키가 비어 보여 행을 찾을 수 없다
//   - 취합 대상 열의 데이터 영역에 걸친 병합 → 값이 병합된 칸 하나에만 들어간다
// 아래 경우는 영향이 없어서 그대로 진행한다.
//   - 제목 줄처럼 헤더 행보다 위에 있는 병합
//   - 데이터가 끝난 뒤의 안내 문구 같은 병합
//   - 기준 열도 취합 대상 열도 아닌 열의 병합
import { formatRange } from "../excel/a1";
import type { ConsolidationSettings, MergedRange, SheetData, SkippedFile, WorkbookData } from "../types";
import { listDataRows } from "./dataRows";

export type MergeRiskKind = "header" | "key-column" | "target-columns";

export type MergeRisk = {
  kind: MergeRiskKind;
  sheetName: string;
  range: MergedRange;
};

function rowsOverlap(a: MergedRange, startRow: number, endRow: number): boolean {
  return a.startRow <= endRow && a.endRow >= startRow;
}

function columnsOverlap(range: MergedRange, columns: number[]): boolean {
  return columns.some((column) => column >= range.startCol && column <= range.endCol);
}

// 데이터가 끝나는 행: 기준 열에 키가 들어 있는 마지막 행.
// (세로 병합된 칸의 나머지 부분은 키가 비어 있어 들어가지 않고, 가로로 병합된 안내 문구도 키로 세지 않는다)
function lastDataRow(sheet: SheetData, settings: ConsolidationSettings): number {
  const rows = listDataRows(sheet, settings);
  return rows.length > 0 ? rows[rows.length - 1].row : settings.dataStartRow - 1; // 데이터가 하나도 없으면 시작 행 바로 위
}

// 파일 하나에서 위험한 병합 셀을 모두 찾는다. 지정한 시트가 없으면 빈 목록이다. (시트 문제는 헤더 점검이 알려 준다)
export function findMergeRisks(workbook: WorkbookData, settings: ConsolidationSettings): MergeRisk[] {
  const sheet = workbook.sheets.find((candidate) => candidate.name === settings.sheetName);
  if (!sheet) return [];

  const dataEnd = lastDataRow(sheet, settings);
  const risks: MergeRisk[] = [];
  for (const range of sheet.merges) {
    let kind: MergeRiskKind | null = null;
    if (rowsOverlap(range, settings.headerRow, settings.headerRow)) {
      kind = "header";
    } else if (rowsOverlap(range, settings.dataStartRow, dataEnd)) {
      if (columnsOverlap(range, [settings.keyColumn])) kind = "key-column";
      else if (columnsOverlap(range, settings.targetColumns)) kind = "target-columns";
    }
    if (kind) risks.push({ kind, sheetName: sheet.name, range });
  }
  return risks;
}

const REASON: Record<MergeRiskKind, string> = {
  header: "헤더 행의 열 위치가 어긋날 수 있어",
  "key-column": "기준 열의 행 위치가 어긋날 수 있어",
  "target-columns": "취합 대상 열의 값이 엉뚱한 칸에 들어갈 수 있어",
};

// 사용자에게 보여 줄 안내 문장. 첫 번째 위험만 자세히 적고 나머지는 개수로 줄인다.
function describeRisks(fileName: string, risks: MergeRisk[], outcome: string): string {
  const first = risks[0];
  const rest = risks.length - 1;
  const extra = rest > 0 ? ` (이 밖에 ${rest}곳)` : "";
  return `${fileName}의 ${first.sheetName} ${formatRange(first.range)}이(가) 병합되어 있어 ${REASON[first.kind]} ${outcome}${extra}`;
}

export type MergeCheckResult = {
  // 병합 때문에 위험하지 않아 취합할 수 있는 부서 파일 (처음 순서 유지)
  passedDepartments: WorkbookData[];
  // 위험해서 제외하는 부서 파일과 이유
  excludedFiles: SkippedFile[];
  // 마스터에 위험한 병합이 있는지. 마스터는 제외할 수 없으므로 경고만 한다.
  masterRisks: MergeRisk[];
  masterMessage: string | null;
};

// 부서 파일들과 마스터의 병합 셀을 검사한다. 이미 헤더 점검에서 빠진 파일은 미리 빼고 넘기는 것을 전제로 한다.
export function checkMergeRisks(
  master: WorkbookData,
  departments: WorkbookData[],
  settings: ConsolidationSettings,
): MergeCheckResult {
  const passedDepartments: WorkbookData[] = [];
  const excludedFiles: SkippedFile[] = [];

  for (const department of departments) {
    const risks = findMergeRisks(department, settings);
    if (risks.length === 0) {
      passedDepartments.push(department);
    } else {
      excludedFiles.push({
        fileName: department.fileName,
        reason: "merged-cell-risk",
        message: describeRisks(department.fileName, risks, "취합하지 않았습니다."),
        sheetName: risks[0].sheetName,
        mergedRange: risks[0].range,
      });
    }
  }

  const masterRisks = findMergeRisks(master, settings);
  const masterMessage =
    masterRisks.length === 0 ? null : describeRisks(master.fileName, masterRisks, "결과가 잘못될 수 있습니다.");

  return { passedDepartments, excludedFiles, masterRisks, masterMessage };
}

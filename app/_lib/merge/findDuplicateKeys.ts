// 기준 열에서 같은 키가 겹치는 경우를 찾는다. (PRD 5번 must 2의 규칙 3)
// 같은 키가 마스터와 부서 파일에 한 번씩 있는 것은 "짝이 맞는" 정상 상태이므로 중복이 아니다.
// 중복으로 보는 경우는 아래 두 가지다.
//   - 마스터 안에 같은 키가 2건 이상 (마스터 안 중복)
//   - 부서 파일들 전체에서 같은 키가 2건 이상 (한 파일 안 중복 + 파일 사이 중복)
import type { ConsolidationSettings, DuplicateKey, KeyOccurrence, WorkbookData } from "../types";
import { listDataRows } from "./dataRows";
import { displayKey } from "./normalizeKey";

// 중복을 찾는 데 필요한 조건만 골라 쓴다
export type KeySettings = Pick<ConsolidationSettings, "sheetName" | "keyColumn" | "dataStartRow">;

type Found = { key: string; display: string; occurrence: KeyOccurrence };

// 파일 하나에서 데이터 영역의 키를 위에서 아래로 모두 꺼낸다. 시트가 없거나 빈 칸이면 건너뛴다.
function collectKeys(workbook: WorkbookData, settings: KeySettings): Found[] {
  const sheet = workbook.sheets.find((candidate) => candidate.name === settings.sheetName);
  if (!sheet) return [];

  return listDataRows(sheet, settings).map(({ row, key, raw }) => ({
    key,
    display: displayKey(raw),
    occurrence: { fileName: workbook.fileName, sheetName: sheet.name, row },
  }));
}

type Group = { display: string; master: KeyOccurrence[]; departments: KeyOccurrence[] };

// 마스터와 취합할 부서 파일들에서 중복 키를 찾는다. 취합에서 제외된 파일은 미리 빼고 넘겨야 한다.
// 돌려주는 목록은 마스터 → 부서 파일 순서로 처음 나온 키 순서를 따른다.
// 각 중복 키의 occurrences에는 겹친 위치만 담는다. (마스터 안 중복이면 마스터 위치, 부서 쪽 중복이면 부서 파일 위치)
export function findDuplicateKeys(
  master: WorkbookData,
  departments: WorkbookData[],
  settings: KeySettings,
): DuplicateKey[] {
  const groups = new Map<string, Group>();

  function add(found: Found, side: "master" | "departments") {
    let group = groups.get(found.key);
    if (!group) {
      group = { display: found.display, master: [], departments: [] };
      groups.set(found.key, group);
    }
    group[side].push(found.occurrence);
  }

  for (const found of collectKeys(master, settings)) add(found, "master");
  for (const workbook of departments) {
    for (const found of collectKeys(workbook, settings)) add(found, "departments");
  }

  const duplicates: DuplicateKey[] = [];
  for (const [key, group] of groups) {
    const masterDuplicated = group.master.length >= 2;
    const departmentDuplicated = group.departments.length >= 2;
    if (!masterDuplicated && !departmentDuplicated) continue;
    duplicates.push({
      key,
      displayKey: group.display,
      occurrences: [...(masterDuplicated ? group.master : []), ...(departmentDuplicated ? group.departments : [])],
    });
  }
  return duplicates;
}

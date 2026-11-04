// [취합 시작]을 누르면 가장 먼저 하는 점검. (PRD 5번 must 1의 규칙 7, must 2의 규칙 3·10, DESIGN 3단계)
// 이미 만든 점검들을 순서대로 한 번에 돌려 3단계 화면에서 보여 줄 결과 하나로 모은다.
//   1) 읽지 못한 파일 → 2) 헤더 비교 → 3) 병합 셀 위험 → 4) 중복 키
// 앞 점검에서 빠진 파일은 뒤 점검에 넣지 않는다. (한 파일이 이유 두 개로 두 번 나오지 않게)
import type { ConsolidationSettings, DuplicateKey, SkippedFile, WorkbookData } from "../types";
import { checkMergeRisks } from "./checkMergeRisks";
import { findDuplicateKeys } from "./findDuplicateKeys";
import { checkHeaders } from "./inspectFiles";

export type InspectAllInput = {
  representative: WorkbookData;
  master: WorkbookData;
  departments: WorkbookData[]; // 읽은 부서 파일
  unreadable: SkippedFile[]; // 읽지 못한 부서 파일
  settings: ConsolidationSettings;
};

export type Inspection = {
  passedDepartments: WorkbookData[]; // 취합할 수 있는 부서 파일
  excludedFiles: SkippedFile[]; // 취합에서 빠지는 부서 파일과 이유 (읽기 실패 → 헤더 → 병합 순서)
  masterWarnings: string[]; // 마스터에 대한 경고 (헤더 다름, 위험한 병합)
  duplicateKeys: DuplicateKey[]; // 사용자가 처리 방법을 골라야 하는 중복 키
  // 3단계에서 사용자가 보고 판단할 것이 있는지. 없으면 3단계를 건너뛰고 바로 결과로 간다.
  needsReview: boolean;
  // 취합할 부서 파일이 하나도 남지 않으면 진행할 수 없다
  canContinue: boolean;
};

export function inspectAll({ representative, master, departments, unreadable, settings }: InspectAllInput): Inspection {
  const headerCheck = checkHeaders(representative, master, departments, settings);
  const mergeCheck = checkMergeRisks(master, headerCheck.passedDepartments, settings);

  const excludedFiles = [...unreadable, ...headerCheck.excludedFiles, ...mergeCheck.excludedFiles];
  const masterWarnings = [headerCheck.masterMessage, mergeCheck.masterMessage].filter(
    (message): message is string => message !== null,
  );
  const passedDepartments = mergeCheck.passedDepartments;
  const duplicateKeys = findDuplicateKeys(master, passedDepartments, settings);

  return {
    passedDepartments,
    excludedFiles,
    masterWarnings,
    duplicateKeys,
    needsReview: excludedFiles.length > 0 || masterWarnings.length > 0 || duplicateKeys.length > 0,
    canContinue: passedDepartments.length > 0,
  };
}

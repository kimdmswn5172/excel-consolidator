// 1단계(파일 선택)의 규칙. 화면과 떨어진 순수 함수라서 자동 시험으로 확인할 수 있다. (PRD 4번, 6번 / DESIGN 1단계)
//  - .xlsx 파일만 받는다. 다른 파일은 목록에 넣지 않고 이유를 알려 준다.
//  - 부서 파일은 최대 50개까지 받는다.
//  - 마스터 표로 고른 파일은 부서 파일 목록에 넣지 않는다. (폴더를 고르면 마스터가 그 안에 들어 있을 수 있다)
//  - 같은 이름의 파일은 두 번 넣지 않는다. (안내 문장에서 어느 파일인지 구분할 수 없게 되므로)
//  - 엑셀이 파일을 열고 있을 때 생기는 임시 파일(~$로 시작)은 넣지 않는다.

export const MAX_DEPARTMENT_FILES = 50;

// 브라우저의 File과 같은 모양. 시험에서는 이름·크기·수정 시각만 가진 객체로 대신한다.
export type FileLike = { name: string; size: number; lastModified: number };

export function isXlsxName(name: string): boolean {
  return /\.xlsx$/i.test(name);
}

export function isExcelLockFile(name: string): boolean {
  return name.startsWith("~$");
}

// 이름, 크기, 수정 시각이 모두 같으면 같은 파일로 본다.
export function isSameFile(a: FileLike, b: FileLike): boolean {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

// 안내 문장에 파일 이름을 5개까지만 보여 주고 나머지는 개수로 줄인다.
function listNames(names: string[]): string {
  const shown = names.slice(0, 5).join(", ");
  return names.length > 5 ? `${shown} 외 ${names.length - 5}개` : shown;
}

export type AddFilesResult<T extends FileLike> = { files: T[]; notices: string[] };

// 부서 파일 목록에 새 파일들을 더한다. 넣지 못한 파일은 이유별로 묶어 안내 문장으로 돌려준다.
// fromFolder가 true이면(폴더 선택) 폴더 안의 다른 종류 파일은 이름 대신 개수만 알려 준다.
export function addDepartmentFiles<T extends FileLike>(
  current: T[],
  incoming: T[],
  master: FileLike | null,
  options: { fromFolder?: boolean; limit?: number } = {},
): AddFilesResult<T> {
  const limit = options.limit ?? MAX_DEPARTMENT_FILES;
  const files = [...current];
  const notXlsx: string[] = [];
  const lockFiles: string[] = [];
  const sameName: string[] = [];
  const overLimit: string[] = [];
  let masterSkipped = false;

  for (const file of incoming) {
    if (isExcelLockFile(file.name)) lockFiles.push(file.name);
    else if (!isXlsxName(file.name)) notXlsx.push(file.name);
    else if (master && isSameFile(file, master)) masterSkipped = true;
    else if (files.some((existing) => existing.name === file.name)) sameName.push(file.name);
    else if (files.length >= limit) overLimit.push(file.name);
    else files.push(file);
  }

  const notices: string[] = [];
  if (notXlsx.length > 0) {
    notices.push(
      options.fromFolder
        ? `폴더 안의 .xlsx가 아닌 파일 ${notXlsx.length}개는 건너뛰었습니다.`
        : `.xlsx 파일이 아니어서 넣지 않았습니다: ${listNames(notXlsx)}`,
    );
  }
  if (lockFiles.length > 0) {
    notices.push(`엑셀이 파일을 열고 있을 때 생기는 임시 파일이라 넣지 않았습니다: ${listNames(lockFiles)}`);
  }
  if (masterSkipped && master) {
    notices.push(`마스터 표로 고른 파일(${master.name})은 부서 파일 목록에 넣지 않았습니다.`);
  }
  if (sameName.length > 0) {
    notices.push(`같은 이름의 파일이 이미 목록에 있어 넣지 않았습니다: ${listNames(sameName)}`);
  }
  if (overLimit.length > 0) {
    notices.push(`부서 파일은 최대 ${limit}개까지 넣을 수 있어 ${overLimit.length}개는 넣지 않았습니다: ${listNames(overLimit)}`);
  }
  return { files, notices };
}

export type MasterSelectResult<T extends FileLike> = {
  master: T | null; // 받아들인 마스터 (받지 못하면 null)
  departments: T[]; // 마스터와 같은 파일을 뺀 부서 파일 목록
  notices: string[];
};

// 마스터 표를 고른다. .xlsx가 아니면 받지 않는다. 같은 파일이 부서 목록에 있으면 거기서 뺀다.
export function selectMasterFile<T extends FileLike>(file: T, departments: T[]): MasterSelectResult<T> {
  if (isExcelLockFile(file.name)) {
    return { master: null, departments, notices: [`${file.name}은(는) 엑셀이 파일을 열고 있을 때 생기는 임시 파일이라 마스터 표로 쓸 수 없습니다.`] };
  }
  if (!isXlsxName(file.name)) {
    return { master: null, departments, notices: [`${file.name}은(는) .xlsx 파일이 아니어서 마스터 표로 쓸 수 없습니다.`] };
  }
  const remaining = departments.filter((department) => !isSameFile(department, file));
  const notices =
    remaining.length < departments.length ? [`${file.name}을(를) 마스터 표로 골라 부서 파일 목록에서 뺐습니다.`] : [];
  return { master: file, departments: remaining, notices };
}

// [분석 시작]을 누를 수 없는 이유. 누를 수 있으면 null이다.
export function analysisBlockedReason(master: FileLike | null, departments: FileLike[]): string | null {
  if (!master && departments.length === 0) return "마스터 표와 부서 파일을 골라 주세요.";
  if (!master) return "마스터 표를 골라 주세요.";
  if (departments.length === 0) return "부서 파일을 하나 이상 골라 주세요.";
  return null;
}

// 파일 크기를 사람이 읽기 쉬운 글자로 바꾼다. (예: 12.3KB, 1.2MB)
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

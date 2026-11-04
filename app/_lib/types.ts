// 프로그램 전체가 함께 쓰는 데이터 모양(타입) 모음.
// 엑셀 읽기, 취합 엔진, 화면, AI 서버 코드가 모두 이 파일의 모양을 기준으로 주고받는다.
// 기준 문서: DESIGN.md "2. 데이터 흐름", PRD.md "5. 주요 기능"

// ───────────────────────────────────────────────
// 1. 엑셀에서 읽은 데이터
// ───────────────────────────────────────────────

// 엑셀 칸 하나의 값. 빈 칸은 null이다. (빈 칸을 0이나 "없음"으로 바꾸지 않기 위해 구분해 둔다)
export type CellValue = string | number | boolean | Date | null;

// 병합된 셀 범위. 행·열 번호는 엑셀 화면과 같이 1부터 시작한다. (예: A1:C1 → 1,1 ~ 1,3)
export type MergedRange = {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
};

// 시트 하나. cells[행 번호 - 1][열 번호 - 1]로 칸을 찾는다.
// 행·열 번호는 엑셀 화면과 같이 1부터 시작하므로 배열 위치와 1 차이가 난다는 점에 주의한다.
export type SheetData = {
  name: string;
  rowCount: number;
  colCount: number;
  cells: CellValue[][];
  merges: MergedRange[];
};

// 엑셀 파일 하나를 메모리에 읽어 둔 모양. 원본 파일은 건드리지 않고 이 복사본으로만 작업한다.
export type WorkbookData = {
  fileName: string;
  sheets: SheetData[];
};

// 마스터 표인지, 부서 파일인지 구분
export type FileRole = "master" | "department";

// ───────────────────────────────────────────────
// 2. 취합하지 못한 파일
// ───────────────────────────────────────────────

// 파일을 취합에서 빼는 이유. 화면의 "제외 파일 목록"에 이유와 함께 보여 준다.
export type SkipReason =
  | "not-xlsx" // .xlsx가 아닌 파일
  | "unreadable" // 손상되었거나 읽을 수 없는 파일
  | "password-protected" // 비밀번호가 걸린 파일
  | "header-mismatch" // 헤더가 대표 파일과 다름
  | "merged-cell-risk"; // 병합 셀 때문에 값이 어긋날 위험이 큼

export type SkippedFile = {
  fileName: string;
  reason: SkipReason;
  // 사용자에게 그대로 보여 줄 한국어 안내 문장
  message: string;
  // 병합 셀 안내처럼 위치를 알려 줄 때만 채운다
  sheetName?: string;
  mergedRange?: MergedRange;
};

// ───────────────────────────────────────────────
// 3. 취합 조건 (AI 추천 → 사용자 확정)
// ───────────────────────────────────────────────

// 확인 화면에서 다루는 다섯 항목. "취합 범위"는 기준 열을 뺀 나머지 네 항목을 합쳐 부르는 말이다.
export type ConditionKey =
  | "keyColumn" // 기준 열 (1개 고정)
  | "sheetName" // 시트
  | "targetColumns" // 취합 대상 열 (여러 개)
  | "headerRow" // 헤더 위치(행)
  | "dataStartRow"; // 데이터 시작 행

// 취합 조건 확정본. 모든 항목이 확정되어야 취합을 실행할 수 있다.
// 열은 1부터 시작하는 번호다. (B열 = 2, E~H열 = [5, 6, 7, 8])
export type ConsolidationSettings = {
  keyColumn: number;
  sheetName: string;
  targetColumns: number[];
  headerRow: number;
  dataStartRow: number;
};

// AI가 항목 하나에 대해 내놓은 추천.
// status는 신뢰도로 정해진다: 70 이상 "recommended", 70 미만 "needs-check", 값을 못 정하면 "unavailable"(추천 불가)
export type RecommendationStatus = "recommended" | "needs-check" | "unavailable";

export type Recommended<T> = {
  value: T | null; // 추천 불가이면 null
  confidence: number | null; // 0~100, 추천 불가이면 null
  status: RecommendationStatus;
};

export type AiRecommendation = {
  keyColumn: Recommended<number>;
  sheetName: Recommended<string>;
  targetColumns: Recommended<number[]>;
  headerRow: Recommended<number>;
  dataStartRow: Recommended<number>;
};

// 확인 화면에서 항목 하나의 확정 상태. 확정되기 전(pending)에는 취합을 실행할 수 없다.
// by: "ai"는 추천을 그대로 받아들인 것(Yes), "user"는 사용자가 직접 선택한 것(No 후 직접 지정)
export type ConditionDecision<T> =
  | { state: "pending" }
  | { state: "confirmed"; value: T; by: "ai" | "user" };

export type ConditionDecisions = {
  keyColumn: ConditionDecision<number>;
  sheetName: ConditionDecision<string>;
  targetColumns: ConditionDecision<number[]>;
  headerRow: ConditionDecision<number>;
  dataStartRow: ConditionDecision<number>;
};

// ───────────────────────────────────────────────
// 4. AI 분석 요청과 응답 (브라우저 ↔ 서버 코드)
// ───────────────────────────────────────────────

// 서버로 보내는 시트 하나. 엑셀 전체가 아니라 상위 행만 보낸다.
export type AnalyzeSheetInput = {
  name: string;
  // 시트 위쪽 행들(최대 10행). headersOnly가 true이면 샘플 값 없이 열 이름만 담는다.
  rows: CellValue[][];
  // headersOnly일 때만 채운다: rows에 담긴 한 행이 시트의 몇 번째 행인지 (1부터)
  headerRow?: number;
};

export type AnalyzeRequest = {
  // 사용자가 "개인정보 포함"으로 체크했는지
  headersOnly: boolean;
  sheets: AnalyzeSheetInput[];
};

export type AnalyzeFailureReason =
  | "network" // 연결 오류
  | "service" // AI 서비스 오류
  | "timeout" // 10초 초과
  | "auth" // 인증 오류
  | "invalid-response"; // 답이 약속한 모양이 아님

// 성공하면 추천을, 실패하면 이유를 돌려준다. 실패하면 화면은 직접 선택 모드로 넘어간다.
export type AnalyzeResponse =
  | { ok: true; recommendation: AiRecommendation }
  | { ok: false; reason: AnalyzeFailureReason };

// ───────────────────────────────────────────────
// 5. 점검과 중복 키
// ───────────────────────────────────────────────

// 같은 키가 나온 위치 하나
export type KeyOccurrence = {
  fileName: string;
  sheetName: string;
  row: number;
};

// 같은 키가 2건 이상인 경우. key는 비교용으로 정리한 값, displayKey는 화면에 보여 줄 원래 값이다.
export type DuplicateKey = {
  key: string;
  displayKey: string;
  occurrences: KeyOccurrence[];
};

// 중복 키 처리 방법 (사용자가 고른다)
export type DuplicateStrategy =
  | "first" // 첫 번째 값으로 처리
  | "last" // 마지막 값으로 처리
  | "list-all" // 값을 모두 나열 (예: "값1 / 값2")
  | "leave-blank"; // 비워 두고 중복 목록에 표시

// 전체에 한 번에 적용하거나, 키별로 따로 고른다
export type DuplicateChoices =
  | { mode: "all"; strategy: DuplicateStrategy }
  | { mode: "per-key"; byKey: Record<string, DuplicateStrategy> };

// 취합 전 점검 결과
export type InspectionResult = {
  excludedFiles: SkippedFile[]; // 취합에서 빠지는 부서 파일과 이유
  masterHeaderMismatch: boolean; // 마스터의 헤더가 대표 파일과 다른지
  duplicateKeys: DuplicateKey[]; // 사용자가 처리 방법을 골라야 하는 중복 키
};

// ───────────────────────────────────────────────
// 6. 취합 결과
// ───────────────────────────────────────────────

// 마스터에 값이 있었는데 부서 파일의 다른 값으로 바뀐 칸. (처음부터 비어 있던 칸은 넣지 않는다)
export type ChangedCell = {
  key: string; // 기준 키 (화면에 보여 줄 원래 값)
  columnName: string;
  column: number;
  masterValue: CellValue;
  departmentValue: CellValue;
  sourceFile: string;
};

// 마스터에 없는 키. 결과에 몰래 추가하지 않고 목록으로만 보여 준다.
export type UnmatchedKey = {
  key: string;
  fileName: string;
  row: number;
};

export type ConsolidationSummary = {
  processedFiles: number; // 처리하려고 한 부서 파일 수
  succeededFiles: number;
  skippedFiles: number; // 읽기 실패와 점검 제외를 합친 수
  unmatchedCount: number;
  duplicateCount: number;
  changedCellCount: number;
};

export type ConsolidationResult = {
  // 결과로 내려받을 새 마스터 데이터. 원본 마스터는 바뀌지 않는다.
  resultMaster: WorkbookData;
  changedCells: ChangedCell[];
  unmatchedKeys: UnmatchedKey[];
  duplicateKeys: DuplicateKey[];
  skippedFiles: SkippedFile[];
  summary: ConsolidationSummary;
};

// ───────────────────────────────────────────────
// 7. 화면 단계
// ───────────────────────────────────────────────

// 1 파일 선택 → 2 조건 확인 → 3 점검·중복 선택 → 4 결과
export type AppStep = 1 | 2 | 3 | 4;

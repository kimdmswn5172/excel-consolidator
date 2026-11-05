// AI의 답(AiOutput)을 화면에서 쓰는 추천(AiRecommendation)으로 바꾼다. (PRD 5번 must 1, 8번 규칙)
//  - 신뢰도 70 이상 "recommended", 70 미만 "needs-check"(확인 필요), 값이 없으면 "unavailable"(추천 불가).
//  - AI가 약속한 모양으로 답했더라도 값이 엑셀과 맞지 않으면(없는 시트, 범위 밖의 열·행, 순서가 뒤바뀐 행) 그 항목은 추천 불가로 둔다.
//    틀린 추천을 그대로 보여 주는 것보다, 사용자가 직접 고르게 하는 쪽이 안전하다.
import type { AiRecommendation, AnalyzeRequest, Recommended } from "../types";
import type { AiOutput } from "./schemas";

export const CONFIDENCE_THRESHOLD = 70;

const unavailable = <T>(): Recommended<T> => ({ value: null, confidence: null, status: "unavailable" });

function recommended<T>(value: T, rawConfidence: number | null): Recommended<T> {
  if (rawConfidence === null || Number.isNaN(rawConfidence)) return unavailable<T>();
  const confidence = Math.round(Math.min(100, Math.max(0, rawConfidence)));
  return { value, confidence, status: confidence >= CONFIDENCE_THRESHOLD ? "recommended" : "needs-check" };
}

export function toRecommendation(output: AiOutput, request: AnalyzeRequest): AiRecommendation {
  const sheetNames = new Set(request.sheets.map((sheet) => sheet.name));
  const sheetName = output.sheetName.value !== null && sheetNames.has(output.sheetName.value) ? output.sheetName : null;

  // 열 번호가 시트의 실제 열 수 안인지 볼 수 있는 범위. 시트를 못 정했으면 가장 넓은 시트를 기준으로 한다.
  const sheet = request.sheets.find((candidate) => candidate.name === sheetName?.value);
  const widthOf = (rows: unknown[][]) => rows.reduce((max, row) => Math.max(max, row.length), 0);
  const maxColumn = sheet ? widthOf(sheet.rows) : Math.max(0, ...request.sheets.map((candidate) => widthOf(candidate.rows)));

  const inColumns = (n: number) => Number.isInteger(n) && n >= 1 && n <= maxColumn;
  const keyColumn = output.keyColumn.value;
  const targets = output.targetColumns.value;
  const headerRow = output.headerRow.value;
  const dataStartRow = output.dataStartRow.value;

  const keyOk = keyColumn !== null && inColumns(keyColumn);
  const targetsOk =
    targets !== null && targets.length > 0 && targets.every(inColumns) && new Set(targets).size === targets.length && !(keyOk && targets.includes(keyColumn));
  const headerOk = headerRow !== null && Number.isInteger(headerRow) && headerRow >= 1;
  const dataOk = dataStartRow !== null && Number.isInteger(dataStartRow) && dataStartRow >= 1 && (!headerOk || dataStartRow > headerRow);

  return {
    sheetName: sheetName ? recommended(sheetName.value as string, sheetName.confidence) : unavailable(),
    keyColumn: keyOk ? recommended(keyColumn, output.keyColumn.confidence) : unavailable(),
    targetColumns: targetsOk ? recommended([...targets].sort((a, b) => a - b), output.targetColumns.confidence) : unavailable(),
    headerRow: headerOk ? recommended(headerRow, output.headerRow.confidence) : unavailable(),
    dataStartRow: dataOk ? recommended(dataStartRow, output.dataStartRow.confidence) : unavailable(),
  };
}

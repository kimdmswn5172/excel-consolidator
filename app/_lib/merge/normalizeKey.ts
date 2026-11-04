// 기준 열의 값(사번 등)을 서로 비교하기 좋게 정리한다. (PRD 5번 must 2의 규칙 1)
// 정리한 값은 "같은 사람인지" 비교할 때만 쓴다. 화면에 보여 줄 값과 결과 파일에 쓸 값은 원래 값을 그대로 쓴다.
import type { CellValue } from "../types";

// 눈에 보이지 않는 글자(너비 0 공백, 바이트 순서 표시). trim()으로는 지워지지 않아서 따로 지운다.
const INVISIBLE = /[​-‍⁠﻿]/g;

// 정리 규칙
// 1) 모두 텍스트로 바꾼다. 앞자리 0은 지우지 않는다. ("00101"은 "00101"로 둔다)
// 2) 전각 문자를 반각으로 바꾼다. (Ｓ０００１ → S0001, 전각 공백·줄바꿈 없는 공백 → 보통 공백)
//    한글이 자모로 풀려 있는 경우(맥에서 온 글자)도 같은 모양으로 합친다.
// 3) 앞뒤 공백을 지운다. 글자 사이의 공백은 그대로 둔다.
// 4) 영문은 소문자로 통일한다.
// 정리하고 나서 비어 있으면 키가 아닌 것으로 보고 null을 돌려준다.
export function normalizeKey(value: CellValue): string | null {
  if (value === null) return null;

  let text: string;
  if (typeof value === "string") {
    text = value;
  } else if (value instanceof Date) {
    // 날짜가 키인 경우는 드물지만, 시간대에 따라 달라지지 않게 날짜 부분만 쓴다.
    text = value.toISOString().slice(0, 10);
  } else {
    text = String(value); // 숫자, 참/거짓
  }

  const normalized = text.normalize("NFKC").replace(INVISIBLE, "").trim().toLowerCase();
  return normalized === "" ? null : normalized;
}

// 화면의 목록에 보여 줄 키 글자. 원래 값을 그대로 보여 주되 앞뒤 공백만 뺀다.
// (대소문자와 전각 문자는 바꾸지 않아서 사용자가 엑셀에서 본 모양 그대로 나온다)
export function displayKey(value: CellValue): string {
  if (value === null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

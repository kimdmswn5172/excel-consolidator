// 중복 키 처리 방법 선택 규칙을 시험한다. 실행: npm run test
import { describe, expect, it } from "vitest";
import type { DuplicateKey } from "./types";
import {
  chooseForAll,
  chooseForKey,
  describeOccurrences,
  duplicatesBlockedReason,
  switchToPerKey,
  unresolvedKeys,
} from "./duplicateChoices";

const dup = (key: string): DuplicateKey => ({
  key,
  displayKey: key.toUpperCase(),
  occurrences: [
    { fileName: "A.xlsx", sheetName: "Sheet1", row: 5 },
    { fileName: "A.xlsx", sheetName: "Sheet1", row: 6 },
  ],
});
const dups = [dup("s1"), dup("s2")];

describe("중복 키 선택", () => {
  it("아무것도 고르지 않으면 모두 미선택이고 막힌다", () => {
    expect(unresolvedKeys(dups, null)).toHaveLength(2);
    expect(duplicatesBlockedReason(dups, null)).not.toBeNull();
  });

  it("전체 적용을 고르면 모두 해결된다", () => {
    expect(unresolvedKeys(dups, chooseForAll("first"))).toEqual([]);
    expect(duplicatesBlockedReason(dups, chooseForAll("leave-blank"))).toBeNull();
  });

  it("키별로 고를 때는 모든 키를 골라야 한다", () => {
    const one = chooseForKey(null, "s1", "last");
    expect(unresolvedKeys(dups, one).map((d) => d.key)).toEqual(["s2"]);
    expect(duplicatesBlockedReason(dups, one)).toContain("1건");
    const both = chooseForKey(one, "s2", "list-all");
    expect(duplicatesBlockedReason(dups, both)).toBeNull();
  });

  it("전체 선택에서 키별로 바꾸면 빈 상태에서 시작한다", () => {
    expect(switchToPerKey(chooseForAll("first"))).toEqual({ mode: "per-key", byKey: {} });
  });

  it("중복이 없으면 막히지 않는다", () => {
    expect(duplicatesBlockedReason([], null)).toBeNull();
  });

  it("겹친 위치를 파일별로 묶어 적는다", () => {
    expect(describeOccurrences([...dups[0].occurrences, { fileName: "B.xlsx", sheetName: "Sheet1", row: 9 }])).toBe("A.xlsx 5·6행, B.xlsx 9행");
  });
});

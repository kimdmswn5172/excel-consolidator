// 파일 선택 규칙을 시험한다. 실행: npm run test
import { describe, expect, it } from "vitest";
import {
  addDepartmentFiles,
  analysisBlockedReason,
  formatFileSize,
  isXlsxName,
  selectMasterFile,
  type FileLike,
} from "./fileSelection";

const file = (name: string, size = 100, lastModified = 1): FileLike => ({ name, size, lastModified });

describe("isXlsxName", () => {
  it(".xlsx만 받는다 (대소문자 무관)", () => {
    expect(isXlsxName("부서01.xlsx")).toBe(true);
    expect(isXlsxName("부서01.XLSX")).toBe(true);
    expect(isXlsxName("목록.csv")).toBe(false);
    expect(isXlsxName("옛날.xls")).toBe(false);
  });
});

describe("addDepartmentFiles", () => {
  it(".xlsx 파일을 순서대로 더한다", () => {
    const { files, notices } = addDepartmentFiles([file("가.xlsx")], [file("나.xlsx"), file("다.xlsx")], null);
    expect(files.map((f) => f.name)).toEqual(["가.xlsx", "나.xlsx", "다.xlsx"]);
    expect(notices).toEqual([]);
  });

  it(".xlsx가 아닌 파일은 넣지 않고 이름을 알려 준다", () => {
    const { files, notices } = addDepartmentFiles([], [file("가.xlsx"), file("목록.csv"), file("옛날.xls")], null);
    expect(files.map((f) => f.name)).toEqual(["가.xlsx"]);
    expect(notices).toEqual([".xlsx 파일이 아니어서 넣지 않았습니다: 목록.csv, 옛날.xls"]);
  });

  it("폴더에서 온 다른 종류 파일은 개수만 알려 준다", () => {
    const { notices } = addDepartmentFiles([], [file("가.xlsx"), file("메모.txt"), file("사진.png")], null, { fromFolder: true });
    expect(notices).toEqual(["폴더 안의 .xlsx가 아닌 파일 2개는 건너뛰었습니다."]);
  });

  it("엑셀 임시 파일(~$)은 넣지 않는다", () => {
    const { files, notices } = addDepartmentFiles([], [file("~$가.xlsx"), file("가.xlsx")], null);
    expect(files.map((f) => f.name)).toEqual(["가.xlsx"]);
    expect(notices[0]).toContain("임시 파일");
  });

  it("마스터 표로 고른 파일은 부서 목록에 넣지 않는다", () => {
    const master = file("마스터.xlsx", 500, 9);
    const { files, notices } = addDepartmentFiles([], [file("마스터.xlsx", 500, 9), file("가.xlsx")], master, { fromFolder: true });
    expect(files.map((f) => f.name)).toEqual(["가.xlsx"]);
    expect(notices).toEqual(["마스터 표로 고른 파일(마스터.xlsx)은 부서 파일 목록에 넣지 않았습니다."]);
  });

  it("이름만 같고 내용이 다른 파일도 두 번 넣지 않는다", () => {
    const { files, notices } = addDepartmentFiles([file("가.xlsx", 100)], [file("가.xlsx", 200)], null);
    expect(files).toHaveLength(1);
    expect(notices).toEqual(["같은 이름의 파일이 이미 목록에 있어 넣지 않았습니다: 가.xlsx"]);
  });

  it("50개를 넘으면 나머지는 넣지 않고 개수를 알려 준다", () => {
    const incoming = Array.from({ length: 53 }, (_, i) => file(`부서${i + 1}.xlsx`));
    const { files, notices } = addDepartmentFiles([], incoming, null);
    expect(files).toHaveLength(50);
    expect(notices[0]).toBe(
      "부서 파일은 최대 50개까지 넣을 수 있어 3개는 넣지 않았습니다: 부서51.xlsx, 부서52.xlsx, 부서53.xlsx",
    );
  });

  it("이름이 많으면 5개까지만 보여 준다", () => {
    const incoming = Array.from({ length: 7 }, (_, i) => file(`메모${i + 1}.txt`));
    expect(addDepartmentFiles([], incoming, null).notices[0]).toContain("외 2개");
  });

  it("원래 목록을 바꾸지 않는다", () => {
    const current = [file("가.xlsx")];
    addDepartmentFiles(current, [file("나.xlsx")], null);
    expect(current).toHaveLength(1);
  });
});

describe("selectMasterFile", () => {
  it(".xlsx를 마스터로 받는다", () => {
    const result = selectMasterFile(file("마스터.xlsx"), []);
    expect(result.master?.name).toBe("마스터.xlsx");
    expect(result.notices).toEqual([]);
  });

  it(".xlsx가 아니면 받지 않는다", () => {
    const result = selectMasterFile(file("마스터.csv"), []);
    expect(result.master).toBeNull();
    expect(result.notices[0]).toContain(".xlsx 파일이 아니어서");
  });

  it("같은 파일이 부서 목록에 있으면 거기서 뺀다", () => {
    const master = file("마스터.xlsx", 500, 9);
    const result = selectMasterFile(master, [file("가.xlsx"), file("마스터.xlsx", 500, 9)]);
    expect(result.departments.map((f) => f.name)).toEqual(["가.xlsx"]);
    expect(result.notices[0]).toContain("부서 파일 목록에서 뺐습니다");
  });
});

describe("analysisBlockedReason", () => {
  it("마스터와 부서 파일이 모두 있어야 분석을 시작할 수 있다", () => {
    expect(analysisBlockedReason(null, [])).toBe("마스터 표와 부서 파일을 골라 주세요.");
    expect(analysisBlockedReason(null, [file("가.xlsx")])).toBe("마스터 표를 골라 주세요.");
    expect(analysisBlockedReason(file("마스터.xlsx"), [])).toBe("부서 파일을 하나 이상 골라 주세요.");
    expect(analysisBlockedReason(file("마스터.xlsx"), [file("가.xlsx")])).toBeNull();
  });
});

describe("formatFileSize", () => {
  it("크기를 읽기 쉽게 바꾼다", () => {
    expect(formatFileSize(500)).toBe("500B");
    expect(formatFileSize(12_595)).toBe("12.3KB");
    expect(formatFileSize(1_258_291)).toBe("1.2MB");
  });
});

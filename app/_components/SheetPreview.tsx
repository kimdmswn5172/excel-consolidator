// 엑셀 미리보기 표. 열 머리(A, B, C…)와 행 번호를 눌러 기준 열·대상 열·헤더 행·데이터 시작 행을 정한다.
// 정해진 열과 행은 색으로 표시한다: 기준 열(파랑), 대상 열(초록), 헤더 행(노랑).
import { numberToColumnLetters } from "../_lib/excel/a1";
import type { CellValue, SheetData } from "../_lib/types";

export const PREVIEW_ROW_LIMIT = 30;
export const PREVIEW_COLUMN_LIMIT = 30;

// 지금 무엇을 고르는 중인지: 열을 고르는 중이면 열 머리를, 행을 고르는 중이면 행 번호를 누를 수 있다.
export type PickMode = "keyColumn" | "targetColumns" | "headerRow" | "dataStartRow";

type Props = {
  sheet: SheetData;
  mode: PickMode;
  keyColumn: number | null;
  targetColumns: number[];
  headerRow: number | null;
  dataStartRow: number | null;
  onPickColumn: (column: number) => void;
  onPickRow: (row: number) => void;
  readOnly?: boolean; // 보기만 하고 누를 수 없게 할 때 (시트를 정하기 전)
};

function cellText(value: CellValue): string {
  if (value === null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value);
}

export function SheetPreview(props: Props) {
  const { sheet, mode, keyColumn, targetColumns, headerRow, dataStartRow, onPickColumn, onPickRow, readOnly = false } = props;
  const rowCount = Math.min(sheet.rowCount, PREVIEW_ROW_LIMIT);
  const colCount = Math.min(sheet.colCount, PREVIEW_COLUMN_LIMIT);
  const pickingColumn = !readOnly && (mode === "keyColumn" || mode === "targetColumns");
  const pickingRow = !readOnly && (mode === "headerRow" || mode === "dataStartRow");
  const columns = Array.from({ length: colCount }, (_, i) => i + 1);
  const rows = Array.from({ length: rowCount }, (_, i) => i + 1);

  function columnTone(column: number): string {
    if (column === keyColumn) return "bg-blue-100";
    if (targetColumns.includes(column)) return "bg-emerald-100";
    return "";
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-2xl border border-ink/10">
        <table className="border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-ink/5 px-2 py-1" />
              {columns.map((column) => {
                const disabled = !pickingColumn || (mode === "targetColumns" && column === keyColumn);
                const selected = column === keyColumn || targetColumns.includes(column);
                return (
                  <th key={column} className={`border-l border-ink/10 p-0 ${columnTone(column) || "bg-ink/5"}`}>
                    <button
                      type="button"
                      disabled={disabled}
                      aria-pressed={selected}
                      aria-label={`${numberToColumnLetters(column)}열`}
                      onClick={() => onPickColumn(column)}
                      className="w-full min-w-10 px-2 py-1 font-medium text-ink enabled:hover:bg-blue-200 disabled:cursor-default"
                    >
                      {numberToColumnLetters(column)}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isHeader = row === headerRow;
              const beforeData = dataStartRow !== null && row < dataStartRow && !isHeader;
              const isDataStart = row === dataStartRow;
              return (
                <tr key={row} className={isDataStart ? "border-t-2 border-blue-500" : ""}>
                  <th className="sticky left-0 z-10 border-t border-ink/10 bg-ink/5 p-0">
                    <button
                      type="button"
                      disabled={!pickingRow}
                      aria-pressed={isHeader || isDataStart}
                      aria-label={`${row}행`}
                      onClick={() => onPickRow(row)}
                      className="w-full px-2 py-1 font-medium text-ink enabled:hover:bg-blue-200 disabled:cursor-default"
                    >
                      {row}
                    </button>
                  </th>
                  {columns.map((column) => (
                    <td
                      key={column}
                      title={cellText(sheet.cells[row - 1]?.[column - 1] ?? null)}
                      className={[
                        "max-w-40 truncate border-l border-t border-ink/10 px-2 py-1",
                        isHeader ? "bg-amber-100 font-medium" : columnTone(column),
                        beforeData ? "text-ink/40" : "text-ink",
                      ].join(" ")}
                    >
                      {cellText(sheet.cells[row - 1]?.[column - 1] ?? null)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-soft">
        {sheet.rowCount > rowCount || sheet.colCount > colCount
          ? `앞쪽 ${rowCount}행 × ${colCount}열만 보여 줍니다. (전체 ${sheet.rowCount}행 × ${sheet.colCount}열)`
          : `전체 ${sheet.rowCount}행 × ${sheet.colCount}열`}
      </p>
    </div>
  );
}

// 4단계. 결과 화면: 처리 요약, 바뀐 칸·미매칭·중복·제외 파일 목록, 결과 엑셀 다운로드. (PRD 5번 must 2, DESIGN 4단계)
import { describeOccurrences, STRATEGY_LABELS } from "../../_lib/duplicateChoices";
import type { CellValue, ConsolidationResult, DuplicateChoices } from "../../_lib/types";
import { unsupportedMessage } from "../../_lib/excel/detectUnsupported";
import { AlertBox } from "../AlertBox";

// 목록이 아주 길어도 화면이 느려지지 않게 처음 일부만 그린다. 전체는 결과 파일에서 볼 수 있다.
const MAX_ROWS = 200;

type Props = {
  result: ConsolidationResult;
  duplicateChoices: DuplicateChoices | null;
  unsupportedParts: string[]; // 마스터 안의 결과 파일에서 빠질 수 있는 요소 (다운로드 전에 한 번 더 알린다)
  applyFormat: boolean; // 기본 서식 적용 체크
  onApplyFormatChange: (checked: boolean) => void;
  downloading: boolean;
  downloadError: string | null;
  onDownload: () => void;
};

function formatValue(value: CellValue): string {
  if (value === null) return "(빈 칸)";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {title} ({count}건)
      </h3>
      {children}
    </div>
  );
}

function Limit({ total }: { total: number }) {
  return total > MAX_ROWS ? (
    <p className="text-xs text-zinc-500 dark:text-zinc-400">처음 {MAX_ROWS}건만 보여 드립니다. (전체 {total}건)</p>
  ) : null;
}

const listBox = "max-h-64 overflow-auto rounded-lg border border-zinc-200 text-sm dark:border-zinc-800";
const cell = "px-3 py-1.5 text-left align-top";

export function ResultStep({ result, duplicateChoices, unsupportedParts, applyFormat, onApplyFormatChange, downloading, downloadError, onDownload }: Props) {
  const { summary, changedCells, unmatchedKeys, duplicateKeys, skippedFiles } = result;
  const cards: [string, number][] = [
    ["처리한 부서 파일", summary.processedFiles],
    ["취합 성공", summary.succeededFiles],
    ["제외", summary.skippedFiles],
    ["미매칭 키", summary.unmatchedCount],
    ["중복 키", summary.duplicateCount],
    ["바뀐 칸", summary.changedCellCount],
  ];

  function strategyLabel(key: string): string {
    if (!duplicateChoices) return "";
    const strategy = duplicateChoices.mode === "all" ? duplicateChoices.strategy : duplicateChoices.byKey[key];
    return strategy ? STRATEGY_LABELS[strategy] : "";
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">4단계. 취합 결과</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">취합을 마쳤습니다. 원본 파일은 바뀌지 않았고, 결과는 새 파일로 내려받습니다.</p>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
            <dd className="text-xl font-medium text-zinc-900 dark:text-zinc-50">{value}</dd>
          </div>
        ))}
      </dl>

      {unsupportedParts.length > 0 && (
        <AlertBox tone="warning" title="결과 파일을 엑셀에서 꼭 확인해 주세요">
          {unsupportedMessage(unsupportedParts)}
        </AlertBox>
      )}

      <div className="flex flex-col gap-2">
        <label className="flex cursor-pointer items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1 h-4 w-4" checked={applyFormat} onChange={(event) => onApplyFormatChange(event.target.checked)} />
          <span>
            <span className="text-zinc-800 dark:text-zinc-200">기본 서식 적용</span>
            <span className="block text-zinc-500 dark:text-zinc-400">
              헤더 굵게·배경색, 테두리, 열 너비 맞춤, 머리글 행 고정을 더합니다. 값과 행 순서는 그대로입니다. 체크하지 않으면 마스터의 원래 서식을 그대로 둡니다.
            </span>
          </span>
        </label>
        <div>
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500"
          >
            {downloading ? "결과 파일을 만드는 중…" : "결과 엑셀 다운로드"}
          </button>
        </div>
        {downloadError && <AlertBox tone="error">{downloadError}</AlertBox>}
      </div>

      <Section title="바뀐 칸" count={changedCells.length}>
        {changedCells.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">마스터에 있던 값이 바뀐 칸은 없습니다.</p>
        ) : (
          <>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">마스터에 값이 있었는데 부서 파일의 다른 값으로 바뀐 칸입니다.</p>
            <div className={listBox}>
              <table className="w-full">
                <thead className="sticky top-0 bg-zinc-100 text-xs dark:bg-zinc-800">
                  <tr>
                    {["키", "열", "마스터 값", "부서 값", "출처"].map((head) => (
                      <th key={head} className={`${cell} font-medium`}>
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {changedCells.slice(0, MAX_ROWS).map((c) => (
                    <tr key={`${c.key}-${c.column}`} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className={cell}>{c.key}</td>
                      <td className={cell}>{c.columnName}</td>
                      <td className={cell}>{formatValue(c.masterValue)}</td>
                      <td className={cell}>{formatValue(c.departmentValue)}</td>
                      <td className={cell}>{c.sourceFile}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Limit total={changedCells.length} />
          </>
        )}
      </Section>

      <Section title="마스터에 없는 키 (미매칭)" count={unmatchedKeys.length}>
        {unmatchedKeys.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">없습니다.</p>
        ) : (
          <>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">결과에 몰래 추가하지 않았습니다. 마스터에 필요한 행인지 확인해 주세요.</p>
            <ul className={`${listBox} divide-y divide-zinc-200 dark:divide-zinc-800`}>
              {unmatchedKeys.slice(0, MAX_ROWS).map((u) => (
                <li key={`${u.fileName}-${u.row}`} className="px-3 py-1.5">
                  {u.key} — {u.fileName} {u.row}행
                </li>
              ))}
            </ul>
            <Limit total={unmatchedKeys.length} />
          </>
        )}
      </Section>

      <Section title="중복된 키" count={duplicateKeys.length}>
        {duplicateKeys.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">없습니다.</p>
        ) : (
          <>
            <ul className={`${listBox} divide-y divide-zinc-200 dark:divide-zinc-800`}>
              {duplicateKeys.slice(0, MAX_ROWS).map((d) => (
                <li key={d.key} className="px-3 py-1.5">
                  {d.displayKey} — {describeOccurrences(d.occurrences)}
                  <span className="text-zinc-500 dark:text-zinc-400"> · 처리: {strategyLabel(d.key)}</span>
                </li>
              ))}
            </ul>
            <Limit total={duplicateKeys.length} />
          </>
        )}
      </Section>

      <Section title="제외된 파일" count={skippedFiles.length}>
        {skippedFiles.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">없습니다.</p>
        ) : (
          <ul className={`${listBox} divide-y divide-zinc-200 dark:divide-zinc-800`}>
            {skippedFiles.map((s) => (
              <li key={`${s.fileName}-${s.reason}`} className="px-3 py-1.5">
                <span className="font-medium">{s.fileName}</span> — {s.message}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </section>
  );
}

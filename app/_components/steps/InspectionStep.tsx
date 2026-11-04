// 3단계. 점검 결과 화면: 취합에서 빠지는 파일과 이유, 마스터 경고를 보여 준다. (PRD 5번, DESIGN 3단계)
// 중복 키 처리 방법을 고르는 부분은 PLAN.md 16번에서 만든다. 여기서는 중복이 있다는 안내만 한다.
import type { SkipReason } from "../../_lib/types";
import type { Inspection } from "../../_lib/merge/inspectAll";
import { AlertBox } from "../AlertBox";

const REASON_LABELS: Record<SkipReason, string> = {
  "not-xlsx": ".xlsx 아님",
  unreadable: "읽을 수 없음",
  "password-protected": "비밀번호",
  "header-mismatch": "헤더 다름",
  "merged-cell-risk": "병합 셀 위험",
};

export function InspectionStep({ inspection }: { inspection: Inspection }) {
  const { excludedFiles, masterWarnings, duplicateKeys, passedDepartments, canContinue } = inspection;

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">3단계. 점검 결과</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          취합하기 전에 파일을 점검했습니다. 취합할 수 있는 부서 파일은 <strong>{passedDepartments.length}개</strong>입니다.
        </p>
      </div>

      {!canContinue && (
        <AlertBox tone="error" title="취합할 수 있는 부서 파일이 없습니다">
          모든 부서 파일이 제외되었습니다. [이전]으로 돌아가 조건을 다시 확인하거나, [처음부터 다시]로 파일을 다시 골라 주세요.
        </AlertBox>
      )}

      {masterWarnings.length > 0 && (
        <AlertBox tone="warning" title="마스터 표를 확인해 주세요">
          <ul className="list-disc pl-5">
            {masterWarnings.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
          <p className="mt-1">마스터는 제외할 수 없습니다. 이대로 계속하면 결과가 잘못될 수 있습니다.</p>
        </AlertBox>
      )}

      {excludedFiles.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">취합에서 제외된 파일 ({excludedFiles.length}개)</h3>
          <ul className="flex flex-col gap-2">
            {excludedFiles.map((file) => (
              <li
                key={`${file.fileName}-${file.reason}`}
                className="flex flex-col gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-900 dark:bg-amber-950/60"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{file.fileName}</span>
                  <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                    {REASON_LABELS[file.reason]}
                  </span>
                </div>
                <p className="leading-6 text-zinc-700 dark:text-zinc-300">{file.message}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {duplicateKeys.length > 0 && (
        <AlertBox tone="info" title={`중복된 키가 ${duplicateKeys.length}건 있습니다`}>
          같은 키가 여러 번 나오는 경우입니다. 처리 방법을 고르는 화면은 다음 작업(PLAN.md 16번)에서 만듭니다.
        </AlertBox>
      )}
    </section>
  );
}

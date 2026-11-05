"use client";

// 1단계 아래쪽의 "AI로 양식 만들기". 업무 목적을 쓰면 AI가 열 이름을 제안하고, 사용자가 고친 뒤 빈 양식(.xlsx)을 내려받는다. (PLAN 25번, DESIGN 10번)
// 접어 둔 영역이라 쓰지 않으면 기존 흐름에 영향이 없다. 목적 글만 서버로 가고, 엑셀 내용은 가지 않는다.
import { useState } from "react";
import { requestTemplate, templateFailureMessage } from "../_lib/ai/requestTemplate";
import { TEMPLATE_LIMITS, templateBlockedReason } from "../_lib/ai/templateSchemas";
import { downloadFile } from "../_lib/excel/download";
import { buildTemplateFile, templateFileName } from "../_lib/excel/buildTemplate";
import { AlertBox } from "./AlertBox";
import { btnPrimary, btnSmall as secondary, input } from "./ui";

// rowCount는 입력 칸의 글자 그대로 들고 있다가(지우는 중에도 편하게), 검사할 때 숫자로 바꾼다.
type Draft = { title: string; keyName: string; fieldNames: string[]; rowCount: string };

const toRowCount = (text: string) => (/^[0-9]+$/.test(text.trim()) ? Number(text.trim()) : Number.NaN);

export function TemplateMaker({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [purpose, setPurpose] = useState("");
  const [asking, setAsking] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);

  async function ask() {
    if (asking || purpose.trim() === "") return;
    setAsking(true);
    setError(null);
    const response = await requestTemplate(purpose);
    setAsking(false);
    if (response.ok) {
      const { rowCount, ...rest } = response.proposal;
      // 목적 글에 인원·건수가 있으면 그 숫자, 없으면 기본 행 수에서 시작한다. 사용자가 고칠 수 있다.
      setDraft({ ...rest, rowCount: String(rowCount ?? TEMPLATE_LIMITS.defaultRows) });
    }
    else setError(templateFailureMessage(response.reason));
  }

  async function download() {
    if (!draft || building || templateBlockedReason({ ...draft, rowCount: toRowCount(draft.rowCount) }) !== null) return;
    setBuilding(true);
    try {
      const bytes = await buildTemplateFile({
        title: draft.title.trim(),
        keyName: draft.keyName.trim(),
        fieldNames: draft.fieldNames.map((name) => name.trim()),
        rowCount: toRowCount(draft.rowCount),
      });
      downloadFile(bytes, templateFileName());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "양식 파일을 만들지 못했습니다.");
    } finally {
      setBuilding(false);
    }
  }

  const update = (change: Partial<Draft>) => setDraft((current) => (current ? { ...current, ...change } : current));
  const blocked = draft ? templateBlockedReason({ ...draft, rowCount: toRowCount(draft.rowCount) }) : null;

  return (
    <details open={defaultOpen} className="rounded-2xl border border-ink/10 bg-paper/60 px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-ink">양식이 없나요? AI로 양식 만들기</summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-sm text-ink-soft">
          어떤 자료를 받고 싶은지 적으면 AI가 열 이름을 제안합니다. 고친 뒤 빈 양식을 내려받아 부서에 나눠 주세요.
          <strong> 개인정보는 적지 마세요.</strong> 적은 글만 AI로 보내고 저장하지 않습니다.
        </p>

        <label className="flex flex-col gap-1 text-sm text-ink">
          업무 목적
          <textarea
            value={purpose}
            onChange={(event) => setPurpose(event.target.value.slice(0, TEMPLATE_LIMITS.purpose))}
            rows={3}
            placeholder="예: 2026년 하반기 직원 교육 이수 현황을 부서별로 받고 싶습니다."
            className={input}
          />
          <span className="text-xs text-ink-soft">
            {purpose.length} / {TEMPLATE_LIMITS.purpose}자
          </span>
        </label>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void ask()} disabled={asking || purpose.trim() === ""} className={secondary}>
            {asking ? "AI가 제안하는 중…" : "양식 제안 받기"}
          </button>
          {!draft && (
            <button type="button" onClick={() => setDraft({ title: "", keyName: "", fieldNames: [""], rowCount: String(TEMPLATE_LIMITS.defaultRows) })} className={secondary}>
              직접 만들기
            </button>
          )}
        </div>

        {error && <AlertBox tone="warning">{error}</AlertBox>}

        {draft && (
          <div className="flex flex-col gap-3 border-t border-ink/10 pt-3">
            <label className="flex flex-col gap-1 text-sm text-ink">
              제목
              <input value={draft.title} onChange={(event) => update({ title: event.target.value })} className={input} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink">
              기준 열 이름 (행을 구분하는 열, 예: 사번)
              <input value={draft.keyName} onChange={(event) => update({ keyName: event.target.value })} className={input} />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink">
              행 수 (테두리와 연번을 넣을 칸 수, 예: 50명이면 50)
              <input
                inputMode="numeric"
                value={draft.rowCount}
                onChange={(event) => update({ rowCount: event.target.value })}
                className={`${input} max-w-32`}
              />
            </label>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm text-ink">작성 열 (부서가 채울 항목)</legend>
              {draft.fieldNames.map((name, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    aria-label={`작성 열 ${index + 1}`}
                    value={name}
                    onChange={(event) => update({ fieldNames: draft.fieldNames.map((current, i) => (i === index ? event.target.value : current)) })}
                    className={input}
                  />
                  <button type="button" onClick={() => update({ fieldNames: draft.fieldNames.filter((_, i) => i !== index) })} className={secondary} aria-label={`작성 열 ${index + 1} 지우기`}>
                    지우기
                  </button>
                </div>
              ))}
              <div>
                <button type="button" onClick={() => update({ fieldNames: [...draft.fieldNames, ""] })} className={secondary}>
                  열 추가
                </button>
              </div>
            </fieldset>

            <p className="text-xs text-ink-soft">
              파일 모양: 1행 제목, 3행 열 이름(색이 들어갑니다), 4행부터 행 수만큼 테두리와 연번이 들어갑니다. 연번 열은 자동으로 맨 앞에 붙습니다. 기준 열(사번 등)의 값은 마스터 표에서 채워 주세요.
            </p>
            {blocked && <p className="text-sm text-amber-700">{blocked}</p>}
            <div>
              <button
                type="button"
                onClick={() => void download()}
                disabled={blocked !== null || building}
                className={btnPrimary}
              >
                {building ? "양식을 만드는 중…" : "양식 .xlsx 내려받기"}
              </button>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

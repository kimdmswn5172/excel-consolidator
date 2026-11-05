"use client";

// "사용 방법" 창. 처음 쓰는 사람이 전체 흐름과 개인정보 처리 방식을 한눈에 볼 수 있게 한다. (DESIGN 11번)
// 브라우저 기본 <dialog>를 써서 Esc로 닫히고, 열려 있는 동안 뒤쪽 화면은 눌러지지 않는다.
import { useEffect, useRef } from "react";
import { btnPrimary } from "./ui";

type Props = {
  open: boolean;
  focus?: "steps" | "privacy"; // 열 때 먼저 보여 줄 부분
  onClose: () => void;
};

const STEPS: [string, string][] = [
  ["파일 고르기", "마스터 표 1개와 부서에서 받은 엑셀 파일(최대 50개)을 올려요. 폴더째 고를 수도 있어요."],
  ["조건 확인", "AI가 대표 파일 하나를 살펴보고 기준 열과 취합 범위를 추천해요. 맞으면 Yes, 아니면 No를 눌러 직접 고르세요."],
  ["점검·중복 선택", "합칠 수 없는 파일은 이유와 함께 알려 드려요. 같은 키가 겹치면 어떻게 처리할지 직접 골라 주세요."],
  ["결과 받기", "바뀐 칸 목록을 확인하고 결과 엑셀 파일을 내려받아요. 원본 파일은 바뀌지 않아요."],
];

const PRIVACY = [
  "엑셀 파일 전체는 서버로 보내지 않고, 이 브라우저 안에서만 읽고 합쳐요.",
  "AI에는 열 이름과 위쪽 10행의 샘플만 보내요. 개인정보 포함을 체크하면 열 이름만 보내요.",
  "주민등록번호·전화번호 모양의 값은 가려서 보내요.",
  "보낸 내용은 서버에 저장하지 않아요.",
];

export function HowToDialog({ open, focus = "steps", onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // 사용 방법은 맨 위(제목부터)에서, 개인정보 안내는 해당 부분이 보이도록 스크롤한다
      if (focus === "privacy") document.getElementById("howto-privacy")?.scrollIntoView({ block: "start" });
      else dialog.scrollTop = 0;
    }
    if (!open && dialog.open) dialog.close();
  }, [open, focus]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()} // 바깥 어두운 곳을 누르면 닫힌다
      className="m-auto max-h-[85vh] w-[min(92vw,40rem)] overflow-y-auto rounded-3xl border-0 bg-white p-0 text-ink shadow-2xl backdrop:bg-night/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-xl font-medium">이렇게 쓰면 돼요</h2>
          <button type="button" onClick={onClose} aria-label="닫기" className="-mr-2 -mt-2 rounded-full p-2 text-xl leading-none text-ink/50 hover:bg-ink/5 hover:text-ink">
            ✕
          </button>
        </div>

        <ol id="howto-steps" className="flex flex-col gap-4">
          {STEPS.map(([title, text], index) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-medium text-white">{index + 1}</span>
              <span className="text-sm leading-6">
                <strong className="font-medium">{title}</strong>
                <span className="block text-ink-soft">{text}</span>
              </span>
            </li>
          ))}
        </ol>

        <section id="howto-privacy" className="rounded-2xl bg-blush/60 p-4">
          <h3 className="mb-2 text-sm font-medium">내 파일은 이렇게 다뤄요</h3>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-6 text-ink-soft">
            {PRIVACY.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>

        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={btnPrimary}>
            알겠어요
          </button>
        </div>
      </div>
    </dialog>
  );
}

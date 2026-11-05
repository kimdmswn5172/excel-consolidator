"use client";

// 처음 보이는 홈 화면. 어두운 배경 한가운데에 마스코트가 서서 커서를 따라 머리를 돌리고, 그 아래에 제목, 한 글자씩 나타나는 인사말, 시작 버튼들이 이어진다. (DESIGN 11번)
import { useEffect, useState } from "react";
import { MascotStage } from "./MascotStage";
import { SiteNav } from "./SiteNav";
import { useTypewriter } from "./useTypewriter";

type Props = {
  onStart: () => void; // 파일 올리고 시작하기
  onStartTemplate: () => void; // 양식 만들기로 시작하기
  onHowTo: (focus: "steps" | "privacy") => void; // 사용 방법 창 열기
};

const GREETING = "흩어진 엑셀 파일, 제가 한 번에 모아 드릴게요. 어떤 작업부터 시작해 볼까요?";

const whitePill =
  "mx-[0.2em] mb-[0.4em] inline-flex items-center justify-center whitespace-nowrap rounded-full border border-black/10 bg-white px-4 py-[0.35em] text-[13px] font-semibold text-black transition-colors duration-200 hover:bg-black hover:text-white sm:px-5 sm:text-[15px]";

export function HomeHero({ onStart, onStartTemplate, onHowTo }: Props) {
  const { displayed, done } = useTypewriter(GREETING);
  const [pillsVisible, setPillsVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  // 시작 버튼들은 타자기 효과가 끝나기를 기다리지 않고 0.4초 뒤에 떠오른다
  useEffect(() => {
    const timer = setTimeout(() => setPillsVisible(true), 400);
    return () => clearTimeout(timer);
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("이 주소를 복사해 주세요", window.location.href); // 복사 권한이 없을 때를 위한 대비
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-night text-white">
      {/* 마스코트 뒤의 은은한 빛 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(48% 42% at 50% 36%, rgba(228,67,42,0.30) 0%, rgba(228,67,42,0.09) 48%, transparent 78%)" }}
        aria-hidden="true"
      />

      {/* 위쪽에는 로고만 둔다. 시작하기·양식 만들기·사용 방법은 아래 버튼들과 같은 일이라 겹치지 않게 뺐다 */}
      <SiteNav variant="dark" onLogo={() => window.scrollTo({ top: 0 })} />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-2 px-5 pb-6 pt-[76px] text-center sm:gap-3">
        {/* 마스코트: 화면 한가운데. 폭은 화면의 가로·세로 중 작은 쪽에 맞춘다 */}
        <MascotStage className="w-[min(76vw,43vh,520px)] shrink-0" />

        {/* 장식용 흐린 소개 글 (같은 내용이 아래에 또렷하게 있어서 화면 읽기 도구에는 건너뛴다) */}
        <p className="pointer-events-none select-none text-[15px] font-light sm:text-lg" style={{ filter: "blur(2.5px)" }} aria-hidden="true">
          안녕하세요, 취합 도우미예요 · 여러 부서의 엑셀을 한 표로 모아 드려요
        </p>

        <h1 className="text-[clamp(30px,6vw,54px)] leading-[1.15]">Excel 범용 취합 프로그램</h1>

        <p className="min-h-[1.5em] max-w-2xl text-[clamp(16px,2.6vw,21px)] font-medium leading-[1.5] text-white/85" aria-label={GREETING}>
          <span aria-hidden="true">{displayed}</span>
          {!done && <span className="animate-blink ml-[2px] inline-block h-[1.1em] w-[2px] bg-white align-middle" aria-hidden="true" />}
        </p>

        <div
          className="flex flex-wrap justify-center gap-y-1 transition-all duration-[400ms] ease-out"
          style={{ opacity: pillsVisible ? 1 : 0, transform: pillsVisible ? "translateY(0)" : "translateY(8px)" }}
        >
          <button type="button" onClick={onStart} className={whitePill}>
            파일 올리고 시작하기
          </button>
          <button type="button" onClick={onStartTemplate} className={whitePill}>
            AI로 양식 만들기
          </button>
          <button type="button" onClick={() => onHowTo("steps")} className={whitePill}>
            사용 방법 보기
          </button>
          <button type="button" onClick={() => onHowTo("privacy")} className={whitePill}>
            내 파일은 안전한가요?
          </button>
          <button
            type="button"
            onClick={() => void copyLink()}
            className="mx-[0.2em] mb-[0.4em] inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white bg-transparent px-4 py-[0.35em] text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-white hover:text-black sm:gap-3 sm:px-5 sm:text-[15px]"
          >
            <span aria-live="polite">{copied ? "복사했어요!" : "동료에게 주소 공유하기"}</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" stroke="currentColor" />
              <path d="M8.5 2.5V2a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v5.5a1 1 0 0 0 1 1h.5" stroke="currentColor" />
            </svg>
          </button>
        </div>
      </main>
    </div>
  );
}

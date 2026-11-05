"use client";

// 처음 보이는 홈 화면. 어두운 배경 위에서 마스코트가 마우스를 따라 몸을 돌리고, 인사말이 한 글자씩 나타난 뒤 시작 버튼들이 떠오른다. (DESIGN 11번)
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
  "mx-[0.2em] mb-[0.4em] inline-flex items-center justify-center whitespace-nowrap rounded-full border border-black/10 bg-white px-4 py-[0.3em] text-[13px] text-black transition-colors duration-200 hover:bg-black hover:text-white sm:px-5 sm:text-[15px]";

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
    <div className="relative h-screen min-h-[560px] overflow-hidden bg-night text-white">
      {/* 마스코트 뒤의 은은한 빛 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(60% 60% at 72% 55%, rgba(228,67,42,0.28) 0%, rgba(228,67,42,0.08) 45%, transparent 75%)" }}
        aria-hidden="true"
      />

      <SiteNav
        variant="dark"
        links={[
          { label: "시작하기", onClick: onStart },
          { label: "양식 만들기", onClick: onStartTemplate },
          { label: "사용 방법", onClick: () => onHowTo("steps") },
        ]}
        cta={{ label: "개인정보는 안전해요", onClick: () => onHowTo("privacy") }}
        onLogo={() => window.scrollTo({ top: 0 })}
      />

      {/* 마스코트: 넓은 화면에서는 오른쪽, 좁은 화면에서는 글 위쪽 */}
      <MascotStage className="absolute right-[2vw] top-16 h-[46vh] w-[46vh] sm:top-20 md:bottom-0 md:top-auto md:h-[min(88vh,52vw)] md:w-[min(88vh,52vw)] lg:right-[6vw]" />

      <section className="relative z-10 flex h-full flex-col justify-end overflow-hidden px-5 pb-12 sm:px-8 md:justify-center md:px-10 md:pb-0">
        <div className="relative z-10 max-w-xl">
          {/* 장식용 흐린 소개 글 (같은 내용이 아래 인사말에도 있어서 화면 읽기 도구에는 건너뛴다) */}
          <p
            className="pointer-events-none mb-5 select-none sm:mb-6"
            style={{ fontSize: "clamp(18px, 4vw, 26px)", lineHeight: 1.3, fontWeight: 400, filter: "blur(3px)" }}
            aria-hidden="true"
          >
            안녕하세요, 취합 도우미예요,
            <br />
            여러 부서의 엑셀을 한 표로 모아 드려요
          </p>

          <h1 className="sr-only">Excel 범용 취합 프로그램</h1>
          <p className="mb-5 min-h-[54px] sm:mb-6" style={{ fontSize: "clamp(18px, 4vw, 26px)", lineHeight: 1.35, fontWeight: 400 }} aria-label={GREETING}>
            <span aria-hidden="true">{displayed}</span>
            {!done && <span className="animate-blink ml-[2px] inline-block h-[1.1em] w-[2px] bg-white align-middle" aria-hidden="true" />}
          </p>

          <div className="flex flex-wrap gap-y-1 transition-all duration-[400ms] ease-out" style={{ opacity: pillsVisible ? 1 : 0, transform: pillsVisible ? "translateY(0)" : "translateY(8px)" }}>
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
              className="mx-[0.2em] mb-[0.4em] inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white bg-transparent px-4 py-[0.3em] text-[13px] text-white transition-colors duration-200 hover:bg-white hover:text-black sm:gap-3 sm:px-5 sm:text-[15px]"
            >
              <span aria-live="polite">{copied ? "복사했어요!" : "동료에게 주소 공유하기"}</span>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" stroke="currentColor" />
                <path d="M8.5 2.5V2a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v5.5a1 1 0 0 0 1 1h.5" stroke="currentColor" />
              </svg>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

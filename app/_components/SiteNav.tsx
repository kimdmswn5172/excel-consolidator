"use client";

// 맨 위 메뉴. 로고, 바로가기 링크, 오른쪽 강조 링크로 이루어져 있고, 좁은 화면에서는 햄버거 버튼과 전체 화면 메뉴로 바뀐다. (DESIGN 11번)
// variant "dark"는 홈 화면(어두운 배경 위의 흰 글자), "light"는 작업 화면(밝은 배경 위의 남색 글자)이다.
import { useState } from "react";

export type NavLink = { label: string; onClick: () => void };

type Props = {
  variant: "dark" | "light";
  links: NavLink[];
  cta: NavLink;
  onLogo: () => void;
};

export function SiteNav({ variant, links, cta, onLogo }: Props) {
  const [open, setOpen] = useState(false);
  // 작업 화면의 메뉴는 스크롤해도 본문 글자와 겹쳐 보이지 않도록 흐린 배경을 깐다
  const color = variant === "dark" ? "text-white" : "bg-paper/90 text-ink shadow-[0_1px_0_rgba(24,27,45,0.08)] backdrop-blur-md";
  const bar = variant === "dark" ? "bg-white" : "bg-ink";

  const choose = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <>
      <nav className={`fixed inset-x-0 top-0 z-20 flex items-center justify-between px-5 py-4 sm:px-8 sm:py-5 ${color}`} aria-label="주 메뉴">
        <button type="button" onClick={onLogo} className="flex items-center gap-2 text-left" aria-label="처음 화면으로">
          <span className="text-[21px] font-black tracking-tight sm:text-[26px]">취합 도우미</span>
          <span className="select-none text-[25px] text-brand sm:text-[30px]" aria-hidden="true">
            ✳︎
          </span>
        </button>

        <div className="hidden items-center text-[19px] md:flex lg:text-[21px]">
          {links.map((link, index) => (
            <span key={link.label}>
              <button type="button" onClick={link.onClick} className="transition-opacity hover:opacity-60">
                {link.label}
              </button>
              {index < links.length - 1 && (
                <span aria-hidden="true" className="mr-[0.35em]">
                  ,
                </span>
              )}
            </span>
          ))}
        </div>

        <button type="button" onClick={cta.onClick} className="hidden text-[19px] underline underline-offset-2 transition-opacity hover:opacity-60 md:block lg:text-[21px]">
          {cta.label}
        </button>

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
          aria-expanded={open}
          className="relative z-30 flex flex-col gap-[5px] p-2 md:hidden"
        >
          <span className={`h-[2px] w-6 transition-transform duration-300 ${open ? "translate-y-[7px] rotate-45 bg-white" : bar}`} />
          <span className={`h-[2px] w-6 transition-opacity duration-300 ${open ? "opacity-0" : "opacity-100"} ${bar}`} />
          <span className={`h-[2px] w-6 transition-transform duration-300 ${open ? "-translate-y-[7px] -rotate-45 bg-white" : bar}`} />
        </button>
      </nav>

      <div
        className={`fixed inset-0 z-10 flex flex-col justify-center gap-8 bg-night/95 px-8 text-white backdrop-blur-md transition-opacity duration-300 md:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        aria-hidden={!open}
      >
        {links.map((link) => (
          <button key={link.label} type="button" onClick={choose(link.onClick)} tabIndex={open ? 0 : -1} className="text-left text-[32px] font-medium">
            {link.label}
          </button>
        ))}
        <button type="button" onClick={choose(cta.onClick)} tabIndex={open ? 0 : -1} className="text-left text-[32px] underline underline-offset-4">
          {cta.label}
        </button>
      </div>
    </>
  );
}

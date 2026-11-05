import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Pretendard(가변 글꼴). 글꼴 파일을 프로젝트 안에 직접 넣어 두었기 때문에, 어느 PC·휴대폰에서 접속해도 설치 없이 같은 글꼴로 보인다.
// 파일 하나에 가는 글씨(45)부터 가장 굵은 글씨(920)까지 모두 들어 있어서 굵기를 자유롭게 쓸 수 있다.
// 라이선스: SIL Open Font License 1.1 (app/fonts/LICENSE-Pretendard.txt)
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap", // 글꼴을 내려받는 동안에는 임시 글꼴로 먼저 보여 주고, 도착하면 바꾼다
  fallback: ["Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Excel 범용 취합 프로그램",
  description: "여러 부서의 엑셀 파일을 AI 추천으로 마스터 표 하나에 취합합니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${pretendard.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

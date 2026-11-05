import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Excel 범용 취합 프로그램",
  description: "여러 부서의 엑셀 파일을 AI 추천으로 마스터 표 하나에 취합합니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Slide Editor - PDF to PPT",
  description: "NotebookLM PDF 슬라이드를 편집하고 PPT로 내보내기",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Noto+Sans+JP:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}

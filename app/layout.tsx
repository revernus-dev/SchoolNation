import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SchoolNation | 우리 반의 작은 나라",
  description: "학생과 함께 만드는 안전한 학급 운영 공간",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ClassMate — 학교 일정·과제 관리',
  description:
    '학생을 위한 스마트 일정·과제 관리 앱. 과제, 시험, 수행평가를 한눈에 관리하고 마감일을 절대 놓치지 마세요.',
  keywords: ['일정관리', '과제관리', '학생', '학교', '공부'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}

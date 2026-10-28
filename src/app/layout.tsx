import type { Metadata, Viewport } from 'next';
import './globals.css';
import { APPEARANCE_BOOT_SCRIPT } from '@/lib/appearance';

export const metadata: Metadata = {
  title: 'ClassMate — 학교 일정·과제 관리',
  description:
    '학생을 위한 스마트 일정·과제 관리 앱. 과제, 시험, 수행평가를 한눈에 관리하고 마감일을 절대 놓치지 마세요.',
  keywords: ['일정관리', '과제관리', '학생', '학교', '공부'],
};

export const viewport: Viewport = {
  themeColor: '#f4f6fb',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // 테마·모드는 아래 스크립트가 그리기 전에 <html>에 붙이므로 서버 HTML과 달라도 경고하지 않음
    <html lang="ko" data-theme="default" data-mode="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOT_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

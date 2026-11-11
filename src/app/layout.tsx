import type { Metadata, Viewport } from 'next';
import './globals.css';
import { APPEARANCE_BOOT_SCRIPT } from '@/lib/appearance';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    'ClassMate', '클래스메이트', '학생 일정관리', '과제 관리', '수행평가', '시험 일정', '학교 시간표',
    '학사일정', '클래스 공지', '학급 공지방', '공부 플래너', '스터디 플래너',
  ],
  // 같은 앱이 여러 주소로 열려도 검색 결과에는 이 주소 하나만 나오도록
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: '/',
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: '/icon-512.png', width: 512, height: 512, alt: 'ClassMate' }],
  },
  twitter: { card: 'summary', title: SITE_TITLE, description: SITE_DESCRIPTION, images: ['/icon-512.png'] },
  // 구글 서치 콘솔·네이버 서치어드바이저 소유 확인 코드 (Vercel 환경 변수로 넣으면 다시 배포할 때 적용)
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.NAVER_SITE_VERIFICATION
      ? { 'naver-site-verification': process.env.NAVER_SITE_VERIFICATION }
      : undefined,
  },
  icons: { icon: '/icon-192.png', apple: '/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'ClassMate', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#f4f6fb',
};

// 검색 결과에 앱 정보를 정확히 보여 주기 위한 구조화 데이터 (schema.org)
const STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: SITE_NAME,
  alternateName: '클래스메이트',
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: 'EducationalApplication',
  operatingSystem: 'Web',
  inLanguage: 'ko',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' },
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
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

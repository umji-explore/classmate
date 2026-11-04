import type { MetadataRoute } from 'next';

// 홈 화면에 앱처럼 추가할 수 있게 해 준다 (아이폰은 홈 화면에 추가해야 푸시 알림을 받을 수 있음)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ClassMate — 학교 일정·과제 관리',
    short_name: 'ClassMate',
    description: '학생을 위한 일정·과제 관리와 학교 시간표·학사일정 알림',
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f4f6fb',
    theme_color: '#536dfe',
    lang: 'ko',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}

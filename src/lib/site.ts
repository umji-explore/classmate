// 검색 엔진·공유 미리보기에 쓰는 사이트 정보
// 도메인을 바꾸면 Vercel 환경 변수 NEXT_PUBLIC_SITE_URL 만 바꾸면 된다
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://classmate-explore.vercel.app').replace(/\/$/, '');

export const SITE_NAME = 'ClassMate';
export const SITE_TITLE = 'ClassMate(클래스메이트) — 학생 일정·과제 관리, 학교 시간표, 클래스 공지방';
export const SITE_DESCRIPTION =
  '학생을 위한 무료 일정·과제 관리 앱 ClassMate. 과제·시험·수행평가 마감일을 달력으로 정리하고, ' +
  '학교 시간표·학사일정 알림과 선생님이 만든 클래스 공지방까지 한 곳에서 관리하세요.';

import { BarChart2, Bell, BookOpen, CalendarDays, Users } from 'lucide-react';

// 시작 화면의 로고·소개 문구 — 로그인 화면과, 서버가 처음 보내는 HTML(검색 엔진이 읽는 화면)에서 함께 쓴다

const FEATURES = [
  { icon: <CalendarDays size={18} />, title: '한눈에 보는 달력', desc: '과제·시험·수행평가를 날짜별로 정리해요.' },
  { icon: <Bell size={18} />, title: '마감 알림', desc: '3일 이내 마감 일정을 놓치지 않게 알려줘요.' },
  { icon: <Users size={18} />, title: '클래스 공지방', desc: '선생님이 만든 클래스에 코드로 들어와 공지를 한 번에 받아요.' },
  { icon: <BarChart2 size={18} />, title: '학습 통계', desc: '과목별 진행 상황과 나의 습관을 분석해요.' },
];

export function AuthBrand() {
  return (
    <div className="auth-brand">
      <div className="brand-mark">
        <BookOpen size={22} color="white" strokeWidth={2.2} />
      </div>
      <div className="brand-text">
        <strong>ClassMate</strong>
        <small>STUDY SMARTER</small>
      </div>
    </div>
  );
}

export function WelcomeIntro() {
  return (
    <>
      <h1 className="auth-title">학교 일정, 이제 한 곳에서 관리해요</h1>
      <p className="auth-sub">과제·시험·수행평가 마감일을 등록하고 차근차근 완료해 보세요.</p>

      <ul className="auth-features">
        {FEATURES.map((f) => (
          <li key={f.title}>
            <span className="auth-feature-ico">{f.icon}</span>
            <div>
              <strong>{f.title}</strong>
              <p>{f.desc}</p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

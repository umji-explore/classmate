'use client';

import { useState } from 'react';
import { BookOpen, CalendarDays, BarChart2, Bell, ArrowLeft } from 'lucide-react';
import { api, ApiError, User } from '@/lib/client';

type Mode = 'welcome' | 'login' | 'signup';

interface AuthScreenProps {
  onAuthed: (user: User) => void;
  notice?: string | null; // 서버 연결 오류 등 시작 화면에 보여줄 안내
}

const FEATURES = [
  { icon: <CalendarDays size={18} />, title: '한눈에 보는 달력', desc: '과제·시험·수행평가를 날짜별로 정리해요.' },
  { icon: <Bell size={18} />, title: '마감 알림', desc: '3일 이내 마감 일정을 놓치지 않게 알려줘요.' },
  { icon: <BarChart2 size={18} />, title: '학습 통계', desc: '과목별 진행 상황과 나의 습관을 분석해요.' },
];

export default function AuthScreen({ onAuthed, notice }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>('welcome');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    const fd = new FormData(e.currentTarget);
    const username = String(fd.get('username') ?? '').trim();
    const password = String(fd.get('password') ?? '');

    if (mode === 'signup' && password !== fd.get('password_confirm')) {
      setError('비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const body =
        mode === 'signup'
          ? { username, password, nickname: String(fd.get('nickname') ?? '').trim() }
          : { username, password };
      const { user } = await api<{ user: User }>(`/api/auth/${mode}`, { method: 'POST', body });
      onAuthed(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '요청에 실패했습니다. 다시 시도해 주세요.');
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">
            <BookOpen size={22} color="white" strokeWidth={2.2} />
          </div>
          <div className="brand-text">
            <strong>ClassMate</strong>
            <small>STUDY SMARTER</small>
          </div>
        </div>

        {notice && <div className="auth-error" role="alert">{notice}</div>}

        {mode === 'welcome' ? (
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

            <div className="auth-actions">
              <button className="btn-primary auth-btn" onClick={() => switchMode('signup')}>회원가입</button>
              <button className="btn-secondary auth-btn" onClick={() => switchMode('login')}>로그인</button>
            </div>
          </>
        ) : (
          <>
            <button className="text-btn auth-back" onClick={() => switchMode('welcome')}>
              <ArrowLeft size={14} /> 처음으로
            </button>
            <h1 className="auth-title">{mode === 'signup' ? '회원가입' : '로그인'}</h1>
            <p className="auth-sub">
              {mode === 'signup' ? '아이디와 비밀번호를 만들어 주세요.' : '가입한 아이디와 비밀번호를 입력해 주세요.'}
            </p>

            {/* key로 모드가 바뀔 때 입력값 초기화 */}
            <form key={mode} className="auth-form" onSubmit={handleSubmit}>
              {mode === 'signup' && (
                <div className="field">
                  <label htmlFor="auth-nickname">이름 (화면에 표시)</label>
                  <input id="auth-nickname" name="nickname" required maxLength={20} placeholder="예: 김민지" autoComplete="nickname" />
                </div>
              )}
              <div className="field">
                <label htmlFor="auth-username">아이디</label>
                <input
                  id="auth-username"
                  name="username"
                  required
                  autoFocus
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  {...(mode === 'signup'
                    ? { minLength: 4, maxLength: 20, pattern: '[a-z0-9_]{4,20}', title: '영문 소문자, 숫자, 밑줄(_) 4~20자' }
                    : {})}
                  placeholder={mode === 'signup' ? '영문 소문자·숫자·_ 4~20자' : '아이디'}
                />
              </div>
              <div className="field">
                <label htmlFor="auth-password">비밀번호</label>
                <input
                  id="auth-password"
                  name="password"
                  type="password"
                  required
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  {...(mode === 'signup' ? { minLength: 8, maxLength: 64 } : {})}
                  placeholder={mode === 'signup' ? '영문+숫자 포함 8자 이상' : '비밀번호'}
                />
              </div>
              {mode === 'signup' && (
                <div className="field">
                  <label htmlFor="auth-password2">비밀번호 확인</label>
                  <input id="auth-password2" name="password_confirm" type="password" required autoComplete="new-password" placeholder="비밀번호를 한 번 더 입력" />
                </div>
              )}

              {error && <div className="auth-error" role="alert">{error}</div>}

              <button type="submit" className="btn-primary auth-btn" disabled={submitting}>
                {submitting ? '처리 중…' : mode === 'signup' ? '가입하고 시작하기' : '로그인'}
              </button>
            </form>

            <p className="auth-switch">
              {mode === 'signup' ? '이미 계정이 있나요?' : '아직 계정이 없나요?'}{' '}
              <button className="text-btn" onClick={() => switchMode(mode === 'signup' ? 'login' : 'signup')}>
                {mode === 'signup' ? '로그인' : '회원가입'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { BookOpen, CalendarDays, BarChart2, Bell, ArrowLeft } from 'lucide-react';
import { api, ApiError, User } from '@/lib/client';

// welcome: 첫 화면, reset: 비밀번호 찾기, resetSent: 임시 비밀번호 메일 발송 안내
type Mode = 'welcome' | 'login' | 'signup' | 'reset' | 'resetSent';

interface AuthScreenProps {
  onAuthed: (user: User) => void;
  notice?: string | null; // 서버 연결 오류 등 시작 화면에 보여줄 안내
}

const FEATURES = [
  { icon: <CalendarDays size={18} />, title: '한눈에 보는 달력', desc: '과제·시험·수행평가를 날짜별로 정리해요.' },
  { icon: <Bell size={18} />, title: '마감 알림', desc: '3일 이내 마감 일정을 놓치지 않게 알려줘요.' },
  { icon: <BarChart2 size={18} />, title: '학습 통계', desc: '과목별 진행 상황과 나의 습관을 분석해요.' },
];

const TITLES: Record<'login' | 'signup' | 'reset', [string, string]> = {
  login: ['로그인', '가입한 아이디와 비밀번호를 입력해 주세요.'],
  signup: ['회원가입', '비밀번호를 잊어버렸을 때를 위해 이메일도 함께 입력해 주세요.'],
  reset: ['비밀번호 찾기', '아이디와 가입할 때 입력한 이메일을 적으면 임시 비밀번호를 메일로 보내 드려요.'],
};

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : '요청에 실패했습니다. 다시 시도해 주세요.';

export default function AuthScreen({ onAuthed, notice }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>('welcome');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState(''); // 임시 비밀번호를 보낸 이메일 (일부 가림)
  const [lastUsername, setLastUsername] = useState(''); // 비밀번호 찾기 후 로그인 폼에 미리 채움

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? '');
    const username = get('username').trim();
    const password = get('password');

    if (mode === 'signup' && password !== get('password_confirm')) {
      setError('비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'signup') {
        const { user } = await api<{ user: User }>('/api/auth/signup', {
          method: 'POST',
          body: { username, password, nickname: get('nickname').trim(), email: get('email').trim() },
        });
        onAuthed(user);
      } else if (mode === 'login') {
        const { user } = await api<{ user: User }>('/api/auth/login', { method: 'POST', body: { username, password } });
        onAuthed(user);
      } else if (mode === 'reset') {
        const res = await api<{ email: string }>('/api/auth/find-password', {
          method: 'POST',
          body: { username, email: get('email').trim() },
        });
        setLastUsername(username);
        setSentTo(res.email);
        switchMode('resetSent');
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSubmitting(false);
    }
  };

  const renderBody = () => {
    // ── 첫 화면 ──
    if (mode === 'welcome') {
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

          <div className="auth-actions">
            <button className="btn-primary auth-btn" onClick={() => switchMode('signup')}>회원가입</button>
            <button className="btn-secondary auth-btn" onClick={() => switchMode('login')}>로그인</button>
          </div>
        </>
      );
    }

    // ── 비밀번호 찾기 완료: 메일 발송 안내 ──
    if (mode === 'resetSent') {
      return (
        <>
          <h1 className="auth-title">메일을 보냈어요 ✉️</h1>
          <p className="auth-sub">
            <strong>{sentTo}</strong> 으로 임시 비밀번호를 보냈어요.
          </p>
          <div className="recovery-box" style={{ marginTop: 20 }}>
            <p className="recovery-note" style={{ fontSize: 12 }}>
              · 메일에 있는 임시 비밀번호로 로그인해 주세요. <b>30분 동안</b> 사용할 수 있어요.<br />
              · 메일이 안 보이면 스팸함도 확인해 주세요.<br />
              · 원래 비밀번호가 기억났다면 그대로 로그인해도 돼요.<br />
              · 로그인한 뒤 설정 → 내 계정에서 원하는 비밀번호로 바꿀 수 있어요.
            </p>
          </div>
          <button className="btn-primary auth-btn" style={{ marginTop: 20 }} onClick={() => switchMode('login')}>
            로그인하러 가기
          </button>
        </>
      );
    }

    // ── 로그인 / 회원가입 / 비밀번호 찾기 폼 ──
    const [title, sub] = TITLES[mode];
    const isSignup = mode === 'signup';

    return (
      <>
        <button className="text-btn auth-back" onClick={() => switchMode('welcome')}>
          <ArrowLeft size={14} /> 처음으로
        </button>
        <h1 className="auth-title">{title}</h1>
        <p className="auth-sub">{sub}</p>

        {/* key로 모드가 바뀔 때 입력값 초기화 */}
        <form key={mode} className="auth-form" onSubmit={handleSubmit}>
          {isSignup && (
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
              defaultValue={mode === 'login' ? lastUsername : undefined}
              {...(isSignup
                ? { minLength: 4, maxLength: 20, pattern: '[a-z0-9_]{4,20}', title: '영문 소문자, 숫자, 밑줄(_) 4~20자' }
                : {})}
              placeholder={isSignup ? '영문 소문자·숫자·_ 4~20자' : '아이디'}
            />
          </div>
          {(isSignup || mode === 'reset') && (
            <div className="field">
              <label htmlFor="auth-email">이메일</label>
              <input
                id="auth-email"
                name="email"
                type="email"
                required
                maxLength={100}
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="example@gmail.com"
              />
            </div>
          )}
          {mode !== 'reset' && (
            <div className="field">
              <label htmlFor="auth-password">비밀번호</label>
              <input
                id="auth-password"
                name="password"
                type="password"
                required
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                {...(isSignup ? { minLength: 8, maxLength: 64 } : {})}
                placeholder={isSignup ? '영문+숫자 포함 8자 이상' : '비밀번호'}
              />
            </div>
          )}
          {isSignup && (
            <div className="field">
              <label htmlFor="auth-password2">비밀번호 확인</label>
              <input id="auth-password2" name="password_confirm" type="password" required autoComplete="new-password" placeholder="비밀번호를 한 번 더 입력" />
            </div>
          )}

          {error && <div className="auth-error" role="alert">{error}</div>}

          <button type="submit" className="btn-primary auth-btn" disabled={submitting}>
            {submitting
              ? '처리 중…'
              : isSignup ? '가입하고 시작하기' : mode === 'reset' ? '임시 비밀번호 메일 받기' : '로그인'}
          </button>
        </form>

        {mode === 'login' && (
          <p className="auth-switch" style={{ marginTop: 12 }}>
            비밀번호를 잊어버렸나요?{' '}
            <button className="text-btn" onClick={() => switchMode('reset')}>비밀번호 찾기</button>
          </p>
        )}
        <p className="auth-switch">
          {isSignup ? '이미 계정이 있나요?' : mode === 'reset' ? '비밀번호가 기억났나요?' : '아직 계정이 없나요?'}{' '}
          <button className="text-btn" onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>
            {mode === 'login' ? '회원가입' : '로그인'}
          </button>
        </p>
      </>
    );
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

        {notice && mode !== 'resetSent' && <div className="auth-error" role="alert">{notice}</div>}

        {renderBody()}
      </div>
    </div>
  );
}

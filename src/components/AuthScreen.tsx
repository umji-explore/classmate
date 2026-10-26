'use client';

import { useState } from 'react';
import { BookOpen, CalendarDays, BarChart2, Bell, ArrowLeft } from 'lucide-react';
import { api, ApiError, User } from '@/lib/client';

// welcome: 첫 화면, created: 가입 직후 고유 코드 안내, reset: 비밀번호 찾기, resetDone: 찾은 비밀번호 안내
type Mode = 'welcome' | 'login' | 'signup' | 'reset' | 'created' | 'resetDone';

interface AuthScreenProps {
  onAuthed: (user: User) => void;
  notice?: string | null; // 서버 연결 오류 등 시작 화면에 보여줄 안내
}

const FEATURES = [
  { icon: <CalendarDays size={18} />, title: '한눈에 보는 달력', desc: '과제·시험·수행평가를 날짜별로 정리해요.' },
  { icon: <Bell size={18} />, title: '마감 알림', desc: '3일 이내 마감 일정을 놓치지 않게 알려줘요.' },
  { icon: <BarChart2 size={18} />, title: '학습 통계', desc: '과목별 진행 상황과 나의 습관을 분석해요.' },
];

const TITLES: Record<Exclude<Mode, 'welcome' | 'created' | 'resetDone'>, [string, string]> = {
  login: ['로그인', '가입한 아이디와 비밀번호를 입력해 주세요.'],
  signup: ['회원가입', '아이디와 비밀번호를 만들어 주세요.'],
  reset: ['비밀번호 찾기', '아이디와 가입할 때 받은 고유 코드를 입력하면 비밀번호를 알려 드려요.'],
};

const errorText = (err: unknown) =>
  err instanceof ApiError ? err.message : '요청에 실패했습니다. 다시 시도해 주세요.';

export default function AuthScreen({ onAuthed, notice }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>('welcome');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdUser, setCreatedUser] = useState<User | null>(null);
  const [copied, setCopied] = useState(false);
  const [foundPassword, setFoundPassword] = useState<string | null>(null); // 비밀번호 찾기 결과 (원래 비밀번호)
  const [lastUsername, setLastUsername] = useState(''); // 비밀번호 찾기 후 로그인 폼에 미리 채움

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setCopied(false);
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
          body: { username, password, nickname: get('nickname').trim() },
        });
        // 바로 앱으로 들어가지 않고 고유 코드를 먼저 보여준다
        setCreatedUser(user);
        switchMode('created');
      } else if (mode === 'login') {
        const { user } = await api<{ user: User }>('/api/auth/login', { method: 'POST', body: { username, password } });
        onAuthed(user);
      } else if (mode === 'reset') {
        const res = await api<{ password: string }>('/api/auth/find-password', {
          method: 'POST',
          body: { username, recovery_code: get('recovery_code') },
        });
        setLastUsername(username);
        setFoundPassword(res.password);
        switchMode('resetDone');
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSubmitting(false);
    }
  };

  const copyText = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      setError('복사하지 못했어요. 코드를 직접 적어 두세요.');
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

    // ── 가입 완료: 고유 코드 안내 ──
    if (mode === 'created' && createdUser) {
      return (
        <>
          <h1 className="auth-title">가입을 축하해요, {createdUser.nickname}님! 🎉</h1>
          <p className="auth-sub">아래는 나만의 고유 코드예요. 비밀번호를 잊어버렸을 때 필요해요.</p>

          <div className="recovery-box" style={{ marginTop: 20 }}>
            <div className="recovery-head">
              <strong style={{ fontSize: 13 }}>고유 코드</strong>
              <button className="text-btn" onClick={() => copyText(createdUser.recovery_code)}>
                {copied ? '복사됨 ✓' : '복사'}
              </button>
            </div>
            <div className="recovery-code">{createdUser.recovery_code}</div>
            <p className="recovery-note">
              이 코드와 아이디로 비밀번호를 다시 설정할 수 있어요. 다른 사람에게 알려 주지 말고 꼭 따로 기록해 두세요.
              (나중에 설정 화면에서도 다시 확인할 수 있어요)
            </p>
          </div>

          {error && <div className="auth-error" role="alert" style={{ marginTop: 12 }}>{error}</div>}

          <button className="btn-primary auth-btn" style={{ marginTop: 20 }} onClick={() => onAuthed(createdUser)}>
            기록했어요, 시작하기
          </button>
        </>
      );
    }

    // ── 비밀번호 찾기 완료: 찾은 비밀번호 안내 ──
    if (mode === 'resetDone' && foundPassword) {
      return (
        <>
          <h1 className="auth-title">비밀번호를 찾았어요</h1>
          <p className="auth-sub">{lastUsername} 계정에 설정한 비밀번호예요.</p>

          <div className="recovery-box" style={{ marginTop: 20 }}>
            <div className="recovery-head">
              <strong style={{ fontSize: 13 }}>비밀번호</strong>
              <button className="text-btn" onClick={() => copyText(foundPassword)}>
                {copied ? '복사됨 ✓' : '복사'}
              </button>
            </div>
            <div className="recovery-code found-password">{foundPassword}</div>
            <p className="recovery-note">주변에 다른 사람이 없는지 확인하고, 확인한 뒤에는 이 화면을 닫아 주세요.</p>
          </div>

          {error && <div className="auth-error" role="alert" style={{ marginTop: 12 }}>{error}</div>}

          <button className="btn-primary auth-btn" style={{ marginTop: 20 }} onClick={() => switchMode('login')}>
            로그인하러 가기
          </button>
        </>
      );
    }

    // ── 로그인 / 회원가입 / 비밀번호 찾기 폼 ──
    const formMode = mode as keyof typeof TITLES;
    const [title, sub] = TITLES[formMode];
    const isNewPassword = mode === 'signup';

    return (
      <>
        <button className="text-btn auth-back" onClick={() => switchMode('welcome')}>
          <ArrowLeft size={14} /> 처음으로
        </button>
        <h1 className="auth-title">{title}</h1>
        <p className="auth-sub">{sub}</p>

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
              defaultValue={mode === 'login' ? lastUsername : undefined}
              {...(mode === 'signup'
                ? { minLength: 4, maxLength: 20, pattern: '[a-z0-9_]{4,20}', title: '영문 소문자, 숫자, 밑줄(_) 4~20자' }
                : {})}
              placeholder={mode === 'signup' ? '영문 소문자·숫자·_ 4~20자' : '아이디'}
            />
          </div>
          {mode === 'reset' && (
            <div className="field">
              <label htmlFor="auth-code">고유 코드</label>
              <input
                id="auth-code"
                name="recovery_code"
                required
                maxLength={6}
                minLength={6}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                placeholder="영문+숫자 6자리 (예: A7K2Q9)"
                style={{ textTransform: 'uppercase', letterSpacing: 2 }}
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
                autoComplete={isNewPassword ? 'new-password' : 'current-password'}
                {...(isNewPassword ? { minLength: 8, maxLength: 64 } : {})}
                placeholder={isNewPassword ? '영문+숫자 포함 8자 이상' : '비밀번호'}
              />
            </div>
          )}
          {isNewPassword && (
            <div className="field">
              <label htmlFor="auth-password2">비밀번호 확인</label>
              <input id="auth-password2" name="password_confirm" type="password" required autoComplete="new-password" placeholder="비밀번호를 한 번 더 입력" />
            </div>
          )}

          {error && <div className="auth-error" role="alert">{error}</div>}

          <button type="submit" className="btn-primary auth-btn" disabled={submitting}>
            {submitting
              ? '처리 중…'
              : mode === 'signup' ? '가입하기' : mode === 'reset' ? '비밀번호 찾기' : '로그인'}
          </button>
        </form>

        {mode === 'login' && (
          <p className="auth-switch" style={{ marginTop: 12 }}>
            비밀번호를 잊어버렸나요?{' '}
            <button className="text-btn" onClick={() => switchMode('reset')}>비밀번호 찾기</button>
          </p>
        )}
        <p className="auth-switch">
          {mode === 'signup' ? '이미 계정이 있나요?' : mode === 'reset' ? '비밀번호가 기억났나요?' : '아직 계정이 없나요?'}{' '}
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

        {notice && mode !== 'created' && mode !== 'resetDone' && <div className="auth-error" role="alert">{notice}</div>}

        {renderBody()}
      </div>
    </div>
  );
}

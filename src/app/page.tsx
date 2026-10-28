'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  LayoutDashboard, CalendarDays, ListChecks, ListTodo, BarChart2, Settings,
  Search, Bell, Plus, ChevronLeft, ChevronRight, Pencil, Trash2, CheckCheck,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import TaskModal from '@/components/TaskModal';
import Toast from '@/components/Toast';
import {
  Task, TaskFormData, TaskStatus, SUBJECT_COLORS, STATUS_LABEL, KIND_COLOR,
} from '@/types/task';
import { dayDiff, fmtDate, getTodayISO, offsetDate, toLocalISO } from '@/lib/date';
import { api, ApiError, UNAUTHORIZED_EVENT, User } from '@/lib/client';
import AuthScreen from '@/components/AuthScreen';
import AppearanceSettings from '@/components/AppearanceSettings';
import { applyAppearance, calendarBackgroundCss, Preferences } from '@/lib/appearance';

// ─── Helpers ──────────────────────────────────────────────────
type Page = 'dashboard' | 'checklist' | 'calendar' | 'tasks' | 'stats' | 'settings';

const dueText = (t: Task): string => {
  const d = dayDiff(t.due_date);
  if (d < 0) return `${Math.abs(d)}일 지남`;
  if (d === 0) return '오늘 마감';
  if (d === 1) return '내일 마감';
  return `${d}일 후 마감`;
};

const isOverdue = (t: Task) => t.status !== 'done' && t.due_date < getTodayISO();

const errorMessage = (e: unknown, fallback: string) =>
  e instanceof ApiError ? e.message : fallback;

const TIPS = [
  '과제에 예상 시간을 적어두면 하루 계획을 세우기 쉬워요.',
  '마감이 가까운 과제부터 처리하면 불안감이 줄어들어요.',
  '큰 과제는 작게 나눠서 매일 조금씩 진행해 보세요.',
  '완료한 과제를 체크하는 습관이 성취감을 높여줘요.',
];

// ─── Entry: 브라우저에서만 앱을 렌더링 ────────────────────────────
// 이 앱은 "오늘 날짜"와 로그인 상태에 의존하므로, 빌드 시점 prerender에서는
// 날짜를 읽지 않는 로딩 화면만 그리고 실제 앱은 브라우저에서 렌더링한다.
const subscribeNoop = () => () => {};

export default function Home() {
  const isClient = useSyncExternalStore(subscribeNoop, () => true, () => false);
  if (!isClient) return <LoadingScreen />;
  return <AuthGate />;
}

function LoadingScreen() {
  return (
    <div className="auth-page">
      <div className="spinner" aria-label="로딩 중" />
    </div>
  );
}

// ─── 로그인 확인: 로그인했으면 앱, 아니면 시작 화면(회원가입/로그인) ─────
function AuthGate() {
  // undefined = 확인 중, null = 로그인 안 됨
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api<{ user: User }>('/api/auth/me')
      .then(({ user }) => setUser(user))
      .catch((e) => {
        // 401(로그인 안 됨)이 아닌 오류는 서버/DB 문제이므로 시작 화면에 안내
        if (!(e instanceof ApiError && e.status === 401)) setNotice(e.message);
        setUser(null);
      });

    // 사용 중 로그인이 풀리면 시작 화면으로 (안내 문구 없이 조용히 이동)
    const onUnauthorized = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  if (user === undefined) return <LoadingScreen />;
  if (!user) {
    return (
      <AuthScreen
        notice={notice}
        onAuthed={(u) => {
          setNotice(null);
          setUser(u);
        }}
      />
    );
  }
  // key: 다른 계정으로 로그인하면 앱 상태를 완전히 새로 시작
  return <ClassMateApp key={user.id} user={user} onUserChange={setUser} onSignedOut={() => setUser(null)} />;
}

// ─── Main Component ────────────────────────────────────────────
function ClassMateApp({
  user, onUserChange, onSignedOut,
}: {
  user: User;
  onUserChange: (user: User) => void;
  onSignedOut: () => void;
}) {
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [defaultDate, setDefaultDate] = useState<string>(getTodayISO);
  const [toast, setToast] = useState<{ msg: string; id: number } | null>(null);
  const [toastShow, setToastShow] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // Calendar state
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [hideDone, setHideDone] = useState(false);

  // ── Toast helper ──────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToast({ msg, id: Date.now() });
    setToastShow(true);
  }, []);

  // 새 토스트가 뜰 때마다 2.6초 뒤 자동으로 숨김
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToastShow(false), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  // ── 꾸미기: 계정에 저장된 색 테마·화면 모드를 화면에 적용 ─────────────
  const preferences = user.preferences;
  const { theme, mode } = preferences;
  useEffect(() => {
    applyAppearance(theme, mode);
    if (mode !== 'system') return;
    // '기기 설정 따르기'일 때는 기기의 다크 모드 전환을 바로 따라간다
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = () => applyAppearance(theme, mode);
    media.addEventListener('change', onSystemChange);
    return () => media.removeEventListener('change', onSystemChange);
  }, [theme, mode]);

  const setPreferences = (next: Preferences) => onUserChange({ ...user, preferences: next });

  // ── Load tasks ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api<Task[]>('/api/tasks');
        if (cancelled) return;
        setTasks(data);
        setLoadError(null);
      } catch (e) {
        if (!cancelled) setLoadError(errorMessage(e, '일정을 불러오지 못했습니다.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const retryLoad = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  // ── Account ───────────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      // 서버 오류가 나도 화면에서는 로그아웃 처리
    }
    onSignedOut();
  };

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? '');
    if (get('new_password') !== get('new_password_confirm')) {
      return showToast('새 비밀번호 확인이 일치하지 않습니다.');
    }
    try {
      await api('/api/auth/password', {
        method: 'PUT',
        body: { current_password: get('current_password'), new_password: get('new_password') },
      });
      setPwOpen(false);
      showToast('비밀번호를 변경했어요.');
    } catch (err) {
      showToast(errorMessage(err, '비밀번호를 변경하지 못했습니다.'));
    }
  };

  const handleChangeEmail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      const res = await api<{ user: User }>('/api/auth/email', {
        method: 'PUT',
        body: { email: String(fd.get('email') ?? '').trim(), password: String(fd.get('password') ?? '') },
      });
      onUserChange(res.user);
      setEmailOpen(false);
      showToast('이메일을 저장했어요.');
    } catch (err) {
      showToast(errorMessage(err, '이메일을 저장하지 못했습니다.'));
    }
  };

  const handleWithdraw = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get('password') ?? '');
    if (!confirm('정말 탈퇴할까요? 계정과 모든 일정이 삭제되며 되돌릴 수 없어요.')) return;
    try {
      await api('/api/auth/me', { method: 'DELETE', body: { password } });
      onSignedOut();
    } catch (err) {
      showToast(errorMessage(err, '회원 탈퇴에 실패했습니다.'));
    }
  };

  // ── CRUD ──────────────────────────────────────────────────────
  const replaceTask = (task: Task) =>
    setTasks((prev) => prev.map((t) => (t._id === task._id ? task : t)));

  const handleSaveTask = async (data: TaskFormData) => {
    if (saving) return;
    setSaving(true);
    try {
      if (editTask) {
        replaceTask(await api<Task>(`/api/tasks/${editTask._id}`, { method: 'PUT', body: data }));
        showToast('일정을 수정했어요.');
      } else {
        const created = await api<Task>('/api/tasks', { method: 'POST', body: data });
        setTasks((prev) => [...prev, created]);
        showToast('새 일정을 추가했어요.');
      }
    } catch (e) {
      // 실패하면 모달을 닫지 않아 입력한 내용을 잃지 않도록 함
      showToast(errorMessage(e, '저장에 실패했습니다. 다시 시도해 주세요.'));
      return;
    } finally {
      setSaving(false);
    }
    setModalOpen(false);
    setEditTask(null);
  };

  // 화면을 먼저 바꾸고(낙관적 업데이트) 서버 저장이 실패하면 원래대로 되돌린다
  const updateStatus = async (task: Task, newStatus: TaskStatus, successMsg?: string, completedAt?: string) => {
    const completed_at = newStatus === 'done' ? (completedAt ?? task.completed_at ?? getTodayISO()) : null;
    replaceTask({ ...task, status: newStatus, completed_at });
    if (successMsg) showToast(successMsg);
    try {
      await api(`/api/tasks/${task._id}`, { method: 'PUT', body: { status: newStatus, completed_at } });
    } catch (e) {
      replaceTask(task);
      showToast(errorMessage(e, '상태 업데이트에 실패했습니다.'));
    }
  };

  const handleToggle = (task: Task) => {
    const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';
    updateStatus(
      task,
      newStatus,
      newStatus === 'done' ? '과제를 완료했어요! 🎉' : '완료 상태를 해제했어요.',
      getTodayISO()
    );
  };

  // 삭제를 진행했으면 true, 확인 창에서 취소했으면 false
  const handleDelete = async (task: Task) => {
    if (!confirm(`"${task.title}"를 삭제할까요?`)) return false;
    setTasks((prev) => prev.filter((t) => t._id !== task._id));
    showToast('일정을 삭제했어요.');
    try {
      await api(`/api/tasks/${task._id}`, { method: 'DELETE' });
    } catch (e) {
      setTasks((prev) => [...prev, task]);
      showToast(errorMessage(e, '삭제에 실패했습니다.'));
    }
    return true;
  };

  // 수정 창의 삭제 버튼: 확인 창에서 취소하면 수정 창을 그대로 둔다
  const handleDeleteFromModal = async () => {
    if (editTask && (await handleDelete(editTask))) closeModal();
  };

  const handleDeleteAll = async () => {
    if (!tasks.length) return showToast('삭제할 일정이 없어요.');
    if (!confirm(`등록된 일정 ${tasks.length}개를 모두 삭제할까요? 이 작업은 되돌릴 수 없어요.`)) return;
    try {
      await api('/api/tasks', { method: 'DELETE' });
    } catch (e) {
      return showToast(errorMessage(e, '삭제에 실패했습니다.'));
    }
    setTasks([]);
    showToast('모든 일정을 삭제했어요.');
  };

  const handleExportCSV = () => {
    const header = ['title', 'subject', 'kind', 'due_date', 'estimated_minutes', 'status', 'priority', 'notes'] as const;
    const rows = [header as readonly string[], ...tasks.map((t) => header.map((k) => String(t[k] ?? '')))];
    const csv = '﻿' + rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `classmate_tasks_${getTodayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV 파일을 내보냈어요.');
  };

  const openAdd = (date?: string) => {
    setEditTask(null);
    setDefaultDate(date ?? getTodayISO());
    setModalOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditTask(task);
    setModalOpen(true);
  };

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setEditTask(null);
  }, []);

  // ── Derived data ──────────────────────────────────────────────
  const todayISO = getTodayISO();
  const completed = tasks.filter((t) => t.status === 'done').length;
  const totalPercent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  const overdueCount = tasks.filter(isOverdue).length;

  // 알림: 기한이 지났거나 3일 이내에 마감되는 미완료 일정
  const alerts = tasks
    .filter((t) => t.status !== 'done' && dayDiff(t.due_date) <= 2)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  const filteredTasks = tasks
    .filter((t) => {
      const matchStatus = statusFilter === 'all' || t.status === statusFilter;
      const q = searchTerm.trim().toLowerCase();
      const matchSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.kind.toLowerCase().includes(q) ||
        (t.notes ?? '').toLowerCase().includes(q);
      return matchStatus && matchSearch;
    })
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  // 최근 7일 막대 그래프 데이터
  const weekBars = (completedOnly = false) => {
    const days: { label: string; count: number; iso: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = toLocalISO(d);
      const count = tasks.filter((t) =>
        completedOnly ? t.status === 'done' && t.completed_at === iso : t.due_date === iso
      ).length;
      days.push({ label: d.toLocaleDateString('ko-KR', { weekday: 'short' }), count, iso });
    }
    return days;
  };

  // ── Calendar helpers ─────────────────────────────────────────
  const calDays = (() => {
    const startDay = new Date(calYear, calMonth, 1).getDay();
    const cells: { iso: string; day: number; isCurrentMonth: boolean; isToday: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(calYear, calMonth, 1 - startDay + i);
      const iso = toLocalISO(d);
      cells.push({ iso, day: d.getDate(), isCurrentMonth: d.getMonth() === calMonth, isToday: iso === todayISO });
    }
    return cells;
  })();

  // ── Pages ─────────────────────────────────────────────────────
  const PAGE_TITLES: Record<Page, [string, string]> = {
    dashboard: ['대시보드', 'WORKSPACE / OVERVIEW'],
    checklist: ['체크판', 'WORKSPACE / CHECKLIST'],
    calendar: ['일정 달력', 'WORKSPACE / CALENDAR'],
    tasks: ['과제 관리', 'WORKSPACE / TASKS'],
    stats: ['학습 통계', 'WORKSPACE / ANALYTICS'],
    settings: ['설정', 'PREFERENCES / SETTINGS'],
  };
  const [pageTitle, breadcrumb] = PAGE_TITLES[activePage];

  const navigate = (page: Page) => {
    setActivePage(page);
    setNotifOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderStatCards = (cards: { label: string; value: string | number; foot: string; icon: string; color: string }[]) => (
    <div className="stats-grid">
      {cards.map(({ label, value, foot, icon, color }) => (
        <div className="stat-card" key={label}>
          <div className="stat-head">
            <span>{label}</span>
            <span className={`stat-ico ${color}`}>{icon}</span>
          </div>
          <div className="stat-value">{value}</div>
          <div className="stat-foot">{foot}</div>
        </div>
      ))}
    </div>
  );

  const renderWeekChart = (bars: ReturnType<typeof weekBars>, suffix: string) => {
    const max = Math.max(1, ...bars.map((b) => b.count));
    return (
      <div className="week-chart">
        {bars.map((b, i) => (
          <div key={b.iso} className="bar-col">
            <div
              className={`bar ${i === 6 ? 'today-bar' : ''}`}
              style={{ height: `${Math.max(4, (b.count / max) * 88)}%` }}
              title={`${b.iso}: ${b.count}개${suffix}`}
            />
            <div className="bar-label">{b.label}</div>
          </div>
        ))}
      </div>
    );
  };

  // ── Dashboard Page ────────────────────────────────────────────
  const renderDashboard = () => {
    const pending = tasks
      .filter((t) => t.status !== 'done')
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    const upcoming = pending.slice(0, 4);
    // 과제를 제외한 시험·수행평가·행사·개인 일정 중 오늘 이후 일정
    const events = pending.filter((t) => t.kind !== '과제' && t.due_date >= todayISO).slice(0, 3);

    const imminent = pending.filter((t) => dayDiff(t.due_date) >= 0 && dayDiff(t.due_date) <= 2).length;

    // 이번 주(월~일) 진행률
    const weekday = (new Date().getDay() + 6) % 7;
    const wsISO = offsetDate(-weekday);
    const weISO = offsetDate(6 - weekday);
    const weekTasks = tasks.filter((t) => t.due_date >= wsISO && t.due_date <= weISO);
    const weekDone = weekTasks.filter((t) => t.status === 'done').length;
    const weekPct = weekTasks.length ? Math.round((weekDone / weekTasks.length) * 100) : 0;

    const tipIndex = new Date().getDate() % TIPS.length;

    return (
      <section className="page-section">
        <div className="welcome-row">
          <div>
            <h2>안녕하세요, 오늘도 한 걸음씩! ✦</h2>
            <p>오늘의 할 일을 확인하고 차근차근 완료해 봐요.</p>
          </div>
          <div className="date-pill">
            📅 {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
          </div>
        </div>

        {renderStatCards([
          { label: '전체 과제', value: tasks.length, foot: '등록한 일정 전체', icon: '📋', color: 'blue' },
          { label: '진행 중', value: tasks.filter((t) => t.status === 'doing').length, foot: '현재 집중하고 있어요', icon: '⏳', color: 'teal' },
          { label: '마감 임박', value: imminent, foot: `오늘부터 3일 이내 (기한 초과 ${overdueCount}개)`, icon: '⚡', color: 'amber' },
          { label: '완료율', value: `${totalPercent}%`, foot: `${completed}개 완료`, icon: '✅', color: 'red' },
        ])}

        <div className="content-grid">
          {/* Upcoming tasks */}
          <div className="card card-body">
            <div className="card-header">
              <div>
                <h3>오늘 & 다가오는 과제</h3>
                <p>마감일이 가까운 일정부터 보여줘요.</p>
              </div>
              <button className="text-btn" onClick={() => navigate('tasks')}>전체 보기 →</button>
            </div>
            <div className="task-list">
              {tasks.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📝</div>
                  아직 등록된 일정이 없어요.
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
                    <button className="btn-primary" onClick={() => openAdd()}>＋ 첫 일정 추가</button>
                  </div>
                </div>
              ) : upcoming.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">🎉</div>남은 과제가 없어요. 멋져요!</div>
              ) : (
                upcoming.map((t) => (
                  <TaskRow key={t._id} task={t} onToggle={handleToggle} onOpen={openEdit} showDate />
                ))
              )}
            </div>
          </div>

          {/* Week progress */}
          <div className="card card-body">
            <div className="card-header">
              <div>
                <h3>이번 주 진행률</h3>
                <p>이번 주 마감 과제 완료 현황</p>
              </div>
              <span className="tag blue">주간 리포트</span>
            </div>
            <div className="progress-area">
              <div className="progress-top">
                <span style={{ color: 'var(--muted)' }}>완료한 과제 {weekDone}/{weekTasks.length}</span>
                <strong>{weekPct}%</strong>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${weekPct}%` }} />
              </div>
            </div>
            {renderWeekChart(weekBars(false), ' 마감')}
          </div>
        </div>

        <div className="content-grid">
          {/* Next events */}
          <div className="card card-body">
            <div className="card-header">
              <div>
                <h3>곧 다가오는 일정</h3>
                <p>시험·수행평가·행사를 미리 확인해요.</p>
              </div>
              <button className="text-btn" onClick={() => navigate('calendar')}>달력 보기 →</button>
            </div>
            <div className="task-list">
              {events.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>다가오는 일정이 없습니다.</div>
              ) : (
                events.map((t) => (
                  <button key={t._id} className="task-row task-row-btn" onClick={() => openEdit(t)}>
                    <div className={`stat-ico ${KIND_COLOR[t.kind]}`} style={{ width: 34, height: 34, flexShrink: 0, fontSize: 14 }}>
                      {t.kind === '시험' ? '✎' : t.kind === '수행평가' ? '◆' : '📋'}
                    </div>
                    <div className="task-main">
                      <div className="task-title">{t.title}</div>
                      <div className="task-meta">{t.subject} · {t.kind} · {fmtDate(t.due_date, { month: 'long', day: 'numeric' })}</div>
                    </div>
                    <span className={`tag ${KIND_COLOR[t.kind]}`}>{dueText(t)}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Quick start */}
          <div className="card card-body">
            <div className="card-header">
              <div>
                <h3>빠른 시작</h3>
                <p>지금 바로 할 수 있는 작업</p>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '9px', marginBottom: '16px' }}>
              <button className="btn-secondary" style={{ textAlign: 'left', padding: '13px' }} onClick={() => openAdd()}>
                ＋ 새 과제 등록
              </button>
              <button className="btn-secondary" style={{ textAlign: 'left', padding: '13px' }} onClick={() => navigate('checklist')}>
                ☑ 오늘 할 일 체크하기
              </button>
              <button className="btn-secondary" style={{ textAlign: 'left', padding: '13px' }} onClick={() => navigate('calendar')}>
                ▦ 이번 달 일정 확인
              </button>
              <button className="btn-secondary" style={{ textAlign: 'left', padding: '13px' }} onClick={() => navigate('stats')}>
                ↗ 나의 진행 상황 보기
              </button>
            </div>
            <div className="insight-box">
              <strong>작은 팁 💡</strong>
              <p>{TIPS[tipIndex]}</p>
            </div>
          </div>
        </div>
      </section>
    );
  };

  // ── Checklist Page ────────────────────────────────────────────
  const renderChecklist = () => {
    const tomorrowISO = offsetDate(1);
    const weekday = (new Date().getDay() + 6) % 7;
    const weekEndISO = offsetDate(6 - weekday); // 이번 주 일요일
    const byDue = (a: Task, b: Task) => a.due_date.localeCompare(b.due_date) || a.title.localeCompare(b.title);
    const visible = (t: Task) => !hideDone || t.status !== 'done';

    const todayTasks = tasks.filter((t) => t.due_date === todayISO).sort(byDue);
    const todayDone = todayTasks.filter((t) => t.status === 'done').length;
    const todayPct = todayTasks.length ? Math.round((todayDone / todayTasks.length) * 100) : 0;
    const weekTasks = tasks.filter((t) => t.due_date >= todayISO && t.due_date <= weekEndISO);
    const weekDone = weekTasks.filter((t) => t.status === 'done').length;
    const dayLabel = (iso: string) => fmtDate(iso, { month: 'long', day: 'numeric', weekday: 'short' });

    // empty가 빈 문자열인 칸은 일정이 없으면 아예 숨긴다
    const sections: { key: string; title: string; hint: string; items: Task[]; empty: string; addDate?: string }[] = [
      { key: 'overdue', title: '⚠️ 기한 지남', hint: '마감일이 지났지만 아직 끝내지 못한 일', items: tasks.filter(isOverdue).sort(byDue), empty: '' },
      { key: 'today', title: '오늘', hint: dayLabel(todayISO), items: todayTasks.filter(visible), empty: '오늘 마감인 일정이 없어요.', addDate: todayISO },
      { key: 'tomorrow', title: '내일', hint: dayLabel(tomorrowISO), items: tasks.filter((t) => t.due_date === tomorrowISO && visible(t)).sort(byDue), empty: '내일 마감인 일정이 없어요.', addDate: tomorrowISO },
      { key: 'week', title: '이번 주 남은 날', hint: '모레부터 이번 주 일요일까지', items: tasks.filter((t) => t.due_date > tomorrowISO && t.due_date <= weekEndISO && visible(t)).sort(byDue), empty: '' },
    ];

    return (
      <section className="page-section">
        <div className="welcome-row">
          <div>
            <h2>오늘 할 일을 하나씩 체크해요 ✔</h2>
            <p>네모를 누르면 바로 완료 처리되고, 이름을 누르면 수정할 수 있어요.</p>
          </div>
          <button className={`filter-btn ${hideDone ? 'active' : ''}`} aria-pressed={hideDone} onClick={() => setHideDone((v) => !v)}>
            {hideDone ? '완료한 일정 보이기' : '완료한 일정 숨기기'}
          </button>
        </div>

        <div className="card card-body checklist-summary">
          <div className="progress-top">
            <span style={{ color: 'var(--muted)' }}>오늘 {todayDone}/{todayTasks.length} 완료</span>
            <strong>{todayPct}%</strong>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${todayPct}%` }} />
          </div>
          <p className="checklist-foot">
            {todayTasks.length === 0
              ? '오늘 마감인 일정이 없어요. 내일 일정을 미리 챙겨 볼까요?'
              : todayDone === todayTasks.length
                ? '오늘 할 일을 모두 끝냈어요! 🎉'
                : `오늘 ${todayTasks.length - todayDone}개 남았어요. 조금만 더 힘내요!`}
            {` · 이번 주 ${weekDone}/${weekTasks.length} 완료`}
          </p>
        </div>

        <div className="checklist-grid">
          {sections
            .filter((sec) => sec.items.length > 0 || sec.empty)
            .map((sec) => (
              <div key={sec.key} className={`card card-body ${sec.key === 'overdue' ? 'checklist-overdue' : ''}`}>
                <div className="card-header">
                  <div>
                    <h3>{sec.title} <span className="checklist-count">{sec.items.length}</span></h3>
                    <p>{sec.hint}</p>
                  </div>
                  {sec.addDate && (
                    <button className="text-btn" onClick={() => openAdd(sec.addDate)}>＋ 추가</button>
                  )}
                </div>
                <div className="task-list">
                  {sec.items.length === 0 ? (
                    <div className="empty-state" style={{ padding: '20px 12px' }}>{sec.empty}</div>
                  ) : (
                    sec.items.map((t) => (
                      <TaskRow key={t._id} task={t} onToggle={handleToggle} onOpen={openEdit} showDate={sec.key !== 'today'} />
                    ))
                  )}
                </div>
              </div>
            ))}
        </div>
      </section>
    );
  };

  // ── Calendar Page ─────────────────────────────────────────────
  const renderCalendar = () => {
    // 일정이 있는 날짜는 첫 일정 수정 창을, 빈 날짜는 그 날짜로 추가 창을 연다
    const openDay = (iso: string, dayTasks: Task[]) =>
      dayTasks.length ? openEdit(dayTasks[0]) : openAdd(iso);

    const moveMonth = (delta: number) => {
      const d = new Date(calYear, calMonth + delta, 1);
      setCalYear(d.getFullYear());
      setCalMonth(d.getMonth());
    };
    const goToday = () => {
      const now = new Date();
      setCalYear(now.getFullYear());
      setCalMonth(now.getMonth());
    };
    const calBg = calendarBackgroundCss(preferences);

    return (
      <section className="page-section">
        <div className="welcome-row">
          <div>
            <h2>한눈에 보는 나의 일정</h2>
            <p>빈 날짜를 누르면 일정을 추가하고, 일정을 누르면 수정하거나 삭제할 수 있어요.</p>
          </div>
          <div className="date-pill">일정 {tasks.length}개</div>
        </div>

        <div className="card card-body">
          <div className="card-header">
            <div>
              <h3>월간 달력</h3>
              <p>색상으로 일정 유형을 구분해요.</p>
            </div>
            <div className="calendar-controls">
              <button className="cal-nav-btn" onClick={() => moveMonth(-1)} aria-label="이전 달"><ChevronLeft size={16} /></button>
              <h3 style={{ minWidth: 110, textAlign: 'center' }}>{calYear}년 {calMonth + 1}월</h3>
              <button className="cal-nav-btn" onClick={() => moveMonth(1)} aria-label="다음 달"><ChevronRight size={16} /></button>
              <button className="text-btn" onClick={goToday}>오늘</button>
              <button className="text-btn" onClick={() => navigate('settings')}>🎨 꾸미기</button>
            </div>
          </div>

          <div className={`cal-canvas ${calBg ? 'has-bg' : ''}`} style={calBg ? { background: calBg } : undefined}>
            <div className="cal-grid">
              {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
                <div key={w} className="cal-weekday">{w}</div>
              ))}
              {calDays.map(({ iso, day, isCurrentMonth, isToday }) => {
                const dayTasks = tasks.filter((t) => t.due_date === iso);
                return (
                  // 안에 일정 버튼이 들어가므로 칸 자체는 div로 두고 버튼 역할을 부여한다
                  <div
                    key={iso}
                    role="button"
                    tabIndex={0}
                    className={`cal-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'is-today' : ''}`}
                    onClick={() => openDay(iso, dayTasks)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
                      e.preventDefault();
                      openDay(iso, dayTasks);
                    }}
                    aria-label={`${iso}, 일정 ${dayTasks.length}개, ${dayTasks.length ? '눌러서 일정 수정' : '눌러서 일정 추가'}`}
                  >
                    <span className="day-num">{day}</span>
                    <div className="day-events">
                      {dayTasks.map((t) => (
                        <button
                          key={t._id}
                          className={`day-event-pill ${KIND_COLOR[t.kind]}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(t);
                          }}
                          aria-label={`${t.title} 수정`}
                        >
                          {t.title}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    );
  };

  // ── Tasks Page ────────────────────────────────────────────────
  const renderTasks = () => (
    <section className="page-section">
      <div className="welcome-row">
        <div>
          <h2>과제와 일정을 관리해요</h2>
          <p>상태를 변경하고 마감일을 놓치지 않도록 확인해요.</p>
        </div>
        <div className="date-pill">전체 {tasks.length}개 · 표시 {filteredTasks.length}개</div>
      </div>

      <div className="page-tools">
        <div className="filters">
          {(['all', 'todo', 'doing', 'done'] as const).map((s) => (
            <button
              key={s}
              className={`filter-btn ${statusFilter === s ? 'active' : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? '전체' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <button
          className="btn-secondary"
          onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
        >
          {searchTerm ? `"${searchTerm}" 검색 초기화 ↺` : '검색 초기화 ↺'}
        </button>
      </div>

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table className="task-table">
            <thead>
              <tr>
                <th>과제 / 일정</th>
                <th>과목</th>
                <th>마감일</th>
                <th>상태</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="empty-state" style={{ margin: '16px 0' }}>
                      <div className="empty-icon">📋</div>
                      조건에 맞는 과제가 없어요.
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((t) => (
                  <tr key={t._id}>
                    <td>
                      <div className="task-name">{t.title}</div>
                      <div className="task-meta" style={{ marginTop: 4 }}>
                        {t.kind}
                        {t.priority === 'high' && <span className="tag red" style={{ marginLeft: 6 }}>중요</span>}
                        <span className="mobile-only" style={{ marginLeft: 6 }}>· {dueText(t)}</span>
                      </div>
                    </td>
                    <td>
                      <span className="subject-chip">
                        <span className="subject-dot" style={{ background: SUBJECT_COLORS[t.subject] }} />
                        {t.subject}
                      </span>
                    </td>
                    <td>
                      <span className={isOverdue(t) ? 'overdue' : ''}>
                        {fmtDate(t.due_date, { year: 'numeric', month: '2-digit', day: '2-digit' })}
                      </span>
                    </td>
                    <td>
                      <select
                        className="status-select"
                        value={t.status}
                        aria-label={`${t.title} 상태`}
                        onChange={(e) => updateStatus(t, e.target.value as TaskStatus)}
                      >
                        <option value="todo">대기 중</option>
                        <option value="doing">진행 중</option>
                        <option value="done">완료</option>
                      </select>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="table-action" onClick={() => openEdit(t)} aria-label={`${t.title} 수정`}>
                          <Pencil size={14} />
                        </button>
                        <button className="table-action danger" onClick={() => handleDelete(t)} aria-label={`${t.title} 삭제`}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );

  // ── Stats Page ────────────────────────────────────────────────
  const renderStats = () => {
    const pending = tasks.filter((t) => t.status !== 'done');
    const totalMin = pending.reduce((s, t) => s + (t.estimated_minutes || 0), 0);
    const highPending = pending.filter((t) => t.priority === 'high').length;
    const subjects = [...new Set(tasks.map((t) => t.subject))];

    // 저장된 데이터를 바탕으로 계산한 학습 습관 분석
    const insights: string[] = [];
    if (overdueCount) insights.push(`기한이 지난 미완료 일정이 ${overdueCount}개 있어요. 새로운 계획을 세우기 전에 마감일을 확인해 보세요.`);
    if (highPending) insights.push(`중요 표시가 있는 미완료 과제가 ${highPending}개 있어요. 오늘 할 일에 포함할지 확인해 보세요.`);
    if (!overdueCount && !highPending) insights.push('현재 우선 확인이 필요한 일정이 많지 않아요. 다음 주 일정을 미리 살펴보세요.');
    const busiest = subjects
      .map((s) => ({ s, n: pending.filter((t) => t.subject === s).length }))
      .sort((a, b) => b.n - a.n)[0];
    if (busiest && busiest.n >= 2) insights.push(`남은 과제가 가장 많은 과목은 ${busiest.s}(${busiest.n}개)이에요. 조금씩 나눠서 진행해 보세요.`);
    insights.push(`예상 소요 시간을 입력한 미완료 과제의 합계는 약 ${Math.round((totalMin / 60) * 10) / 10}시간입니다.`);

    return (
      <section className="page-section">
        <div className="welcome-row">
          <div>
            <h2>나의 학습 리포트</h2>
            <p>기록이 쌓일수록 나의 계획 패턴을 알 수 있어요.</p>
          </div>
          <div className="date-pill">📈 누적 기록</div>
        </div>

        {renderStatCards([
          { label: '전체 일정', value: tasks.length, foot: '등록된 모든 일정', icon: '📋', color: 'blue' },
          { label: '완료 과제', value: completed, foot: `전체의 ${totalPercent}%`, icon: '✅', color: 'teal' },
          { label: '기한 경과', value: overdueCount, foot: '확인 후 일정 조정', icon: '⚡', color: 'red' },
          { label: '예상 남은 시간', value: `${Math.round((totalMin / 60) * 10) / 10}h`, foot: '미완료 과제 기준', icon: '⏰', color: 'amber' },
        ])}

        <div className="chart-grid">
          {/* Subject bars */}
          <div className="card card-body">
            <div className="card-header">
              <div>
                <h3>과목별 과제 현황</h3>
                <p>등록한 일정 중 완료 vs 남은 과제</p>
              </div>
            </div>
            <div className="subject-bars">
              {subjects.length === 0 ? (
                <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '20px' }}>데이터가 없습니다.</div>
              ) : (
                subjects.map((s) => {
                  const ts = tasks.filter((t) => t.subject === s);
                  const done = ts.filter((t) => t.status === 'done').length;
                  return (
                    <div key={s} className="subject-row">
                      <span>{s}</span>
                      <div className="subject-track">
                        <div
                          className="subject-fill"
                          style={{ width: `${ts.length ? (done / ts.length) * 100 : 0}%`, background: SUBJECT_COLORS[s] }}
                        />
                      </div>
                      <span className="subject-count">{done}/{ts.length}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Week chart */}
          <div className="card card-body">
            <div className="card-header">
              <div>
                <h3>최근 7일 완료 기록</h3>
                <p>날짜별로 완료 처리한 과제 수</p>
              </div>
            </div>
            {renderWeekChart(weekBars(true), ' 완료')}
            <div className="insight-box">
              <strong>이번 주 돌아보기</strong>
              <p>
                {tasks.length
                  ? `현재 ${tasks.length}개 일정 중 ${completed}개를 완료했어요. ${overdueCount ? `기한이 지난 미완료 일정 ${overdueCount}개를 먼저 확인해 보세요.` : '기한이 지난 미완료 일정은 없어요. 좋아요!'}`
                  : '과제를 등록하면 나의 진행 상황을 분석할 수 있어요.'}
              </p>
            </div>
          </div>
        </div>

        <div className="card card-body" style={{ marginTop: 18 }}>
          <div className="card-header">
            <div>
              <h3>데이터로 확인하는 나의 습관</h3>
              <p>현재 저장된 과제 정보를 바탕으로 계산한 내용입니다.</p>
            </div>
            <span className="tag green">자동 계산</span>
          </div>
          <div className="task-list">
            {insights.map((text, i) => (
              <div key={i} className="task-row">
                <div className={`stat-ico ${i === 0 ? 'blue' : 'teal'}`} style={{ width: 34, height: 34, flexShrink: 0, fontSize: 14 }}>
                  {i === 0 ? '💡' : '✓'}
                </div>
                <div className="task-main">
                  <div className="task-title" style={{ whiteSpace: 'normal', fontWeight: 600 }}>{text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  };

  // ── Settings Page ─────────────────────────────────────────────
  const renderSettings = () => (
    <section className="page-section">
      <div className="welcome-row">
        <div>
          <h2>설정</h2>
          <p>앱을 꾸미고, 내 계정과 일정 데이터를 관리합니다.</p>
        </div>
      </div>
      <div className="settings-grid">
        <AppearanceSettings
          preferences={preferences}
          onChange={setPreferences}
          showToast={showToast}
          onOpenCalendar={() => navigate('calendar')}
        />
        <div className="card card-body">
          <div className="card-header">
            <div>
              <h3>내 계정</h3>
              <p>로그인한 계정 정보입니다.</p>
            </div>
            <span className="tag green">로그인됨</span>
          </div>
          <div>
            {[
              { label: '이름', value: user.nickname },
              { label: '아이디', value: user.username },
              { label: '저장 위치', value: '클라우드(MongoDB Atlas) — 어느 기기에서든 로그인하면 같은 일정을 볼 수 있어요.' },
            ].map(({ label, value }) => (
              <div key={label} className="setting-row">
                <div>
                  <strong style={{ fontSize: 13 }}>{label}</strong>
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{value}</p>
                </div>
              </div>
            ))}
            <div className="setting-row">
              <div>
                <strong style={{ fontSize: 13 }}>이메일</strong>
                <p style={{ fontSize: 12, color: user.email ? 'var(--muted)' : 'var(--red)', marginTop: 4 }}>
                  {user.email ?? '등록되지 않았어요. 비밀번호를 잊어버렸을 때 찾으려면 이메일을 등록해 주세요.'}
                </p>
              </div>
              {!emailOpen && (
                <button className="text-btn" style={{ flexShrink: 0 }} onClick={() => setEmailOpen(true)}>
                  {user.email ? '변경' : '등록'}
                </button>
              )}
            </div>
          </div>
          {emailOpen && (
            <form className="account-form" style={{ marginTop: 12 }} onSubmit={handleChangeEmail}>
              <strong style={{ fontSize: 13 }}>이메일 {user.email ? '변경' : '등록'}</strong>
              <input name="email" type="email" required maxLength={100} autoComplete="email" defaultValue={user.email ?? ''} placeholder="example@gmail.com" aria-label="이메일" />
              <input name="password" type="password" required autoComplete="current-password" placeholder="비밀번호 확인" aria-label="비밀번호" />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn-secondary" onClick={() => setEmailOpen(false)}>취소</button>
                <button type="submit" className="btn-primary">저장</button>
              </div>
            </form>
          )}
          <div style={{ display: 'grid', gap: '10px', marginTop: 16 }}>
            {pwOpen ? (
              <form className="account-form" onSubmit={handleChangePassword}>
                <strong style={{ fontSize: 13 }}>비밀번호 변경</strong>
                <input name="current_password" type="password" required autoComplete="current-password" placeholder="현재 비밀번호" aria-label="현재 비밀번호" />
                <input name="new_password" type="password" required minLength={8} maxLength={64} autoComplete="new-password" placeholder="새 비밀번호 (영문+숫자 8자 이상)" aria-label="새 비밀번호" />
                <input name="new_password_confirm" type="password" required autoComplete="new-password" placeholder="새 비밀번호 확인" aria-label="새 비밀번호 확인" />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn-secondary" onClick={() => setPwOpen(false)}>취소</button>
                  <button type="submit" className="btn-primary">변경하기</button>
                </div>
              </form>
            ) : (
              <button className="btn-secondary" style={{ textAlign: 'left', padding: '13px' }} onClick={() => setPwOpen(true)}>
                🔑 비밀번호 변경
              </button>
            )}
            <button className="btn-secondary" style={{ textAlign: 'left', padding: '13px' }} onClick={handleLogout}>
              ↪ 로그아웃
            </button>
            {withdrawOpen ? (
              <form className="withdraw-form" onSubmit={handleWithdraw}>
                <label htmlFor="withdraw-password">회원 탈퇴 — 비밀번호를 입력해 주세요</label>
                <input id="withdraw-password" name="password" type="password" required autoComplete="current-password" />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn-secondary" onClick={() => setWithdrawOpen(false)}>취소</button>
                  <button type="submit" className="btn-secondary danger-btn">탈퇴하기</button>
                </div>
              </form>
            ) : (
              <button className="btn-secondary danger-btn" style={{ textAlign: 'left', padding: '13px' }} onClick={() => setWithdrawOpen(true)}>
                회원 탈퇴
              </button>
            )}
          </div>
        </div>
        <div className="card card-body">
          <div className="card-header">
            <div>
              <h3>데이터 관리</h3>
              <p>과제 데이터를 내보내거나 초기화합니다.</p>
            </div>
          </div>
          <div style={{ display: 'grid', gap: '10px' }}>
            <button className="btn-secondary" style={{ textAlign: 'left', padding: '13px' }} onClick={handleExportCSV}>
              ↓ 과제 목록 CSV 내보내기
            </button>
            <button className="btn-secondary danger-btn" style={{ textAlign: 'left', padding: '13px' }} onClick={handleDeleteAll}>
              🗑 모든 일정 삭제
            </button>
          </div>
        </div>
      </div>
    </section>
  );

  // ── Mobile nav icons ──────────────────────────────────────────
  const mobileNavItems: { page: Page; label: string; icon: React.ReactNode }[] = [
    { page: 'dashboard', label: '홈', icon: <LayoutDashboard size={20} /> },
    { page: 'checklist', label: '체크', icon: <ListChecks size={20} /> },
    { page: 'calendar', label: '달력', icon: <CalendarDays size={20} /> },
    { page: 'tasks', label: '과제', icon: <ListTodo size={20} /> },
    { page: 'stats', label: '통계', icon: <BarChart2 size={20} /> },
    { page: 'settings', label: '설정', icon: <Settings size={20} /> },
  ];

  // ─────────────────────────────────────────────────────────────
  return (
    <>
      <div className="app-layout">
        <Sidebar activePage={activePage} onNavigate={navigate} user={user} onLogout={handleLogout} />

        <main className="main-content">
          {/* Topbar */}
          <header className="topbar">
            <div className="topbar-left">
              <div className="eyebrow">{breadcrumb}</div>
              <h1>{pageTitle}</h1>
            </div>
            <div className="topbar-actions">
              <label className="search-bar" aria-label="과제 검색">
                <Search size={16} color="var(--muted)" />
                <input
                  placeholder="과제나 과목 검색"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    // 검색 결과는 과제 관리 화면에서 보여준다
                    if (activePage !== 'tasks') setActivePage('tasks');
                  }}
                  aria-label="검색어 입력"
                />
              </label>
              <div className="notif-wrap">
                <button
                  className="btn-icon"
                  aria-label={`알림 ${alerts.length}개`}
                  aria-expanded={notifOpen}
                  onClick={() => setNotifOpen((v) => !v)}
                >
                  <Bell size={17} />
                  {alerts.length > 0 && <span className="notification-dot" />}
                </button>
                {notifOpen && (
                  <>
                    <div className="notif-overlay" onClick={() => setNotifOpen(false)} />
                    <div className="notif-panel" role="dialog" aria-label="마감 알림">
                      <div className="notif-head">
                        <strong>마감 알림</strong>
                        <span>{alerts.length}개</span>
                      </div>
                      {alerts.length === 0 ? (
                        <div className="notif-empty">3일 이내에 마감되는 일정이 없어요. 🙌</div>
                      ) : (
                        alerts.slice(0, 8).map((t) => (
                          <button
                            key={t._id}
                            className="notif-item"
                            onClick={() => { setNotifOpen(false); openEdit(t); }}
                          >
                            <span className="subject-dot" style={{ background: SUBJECT_COLORS[t.subject] }} />
                            <span className="notif-title">{t.title}</span>
                            <span className={`tag ${isOverdue(t) ? 'red' : 'orange'}`}>{dueText(t)}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
              <button className="btn-primary" id="add-task-btn" onClick={() => openAdd()}>
                <Plus size={16} />
                일정 추가
              </button>
            </div>
          </header>

          {/* Page content */}
          {loading ? (
            <div className="spinner" aria-label="로딩 중" />
          ) : loadError ? (
            <div className="card card-body" style={{ textAlign: 'center' }}>
              <div className="empty-icon">⚠️</div>
              <p style={{ margin: '8px 0 16px', color: 'var(--muted)' }}>{loadError}</p>
              <button className="btn-primary" onClick={retryLoad}>다시 시도</button>
            </div>
          ) : (
            <>
              {activePage === 'dashboard' && renderDashboard()}
              {activePage === 'checklist' && renderChecklist()}
              {activePage === 'calendar' && renderCalendar()}
              {activePage === 'tasks' && renderTasks()}
              {activePage === 'stats' && renderStats()}
              {activePage === 'settings' && renderSettings()}
            </>
          )}

          <div className="footer-note">ClassMate · 학생을 위한 일정·과제 관리</div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="mobile-nav" aria-label="모바일 메뉴">
        {mobileNavItems.map(({ page, label, icon }) => (
          <button
            key={page}
            className={activePage === page ? 'active' : ''}
            onClick={() => navigate(page)}
            aria-label={label}
          >
            {icon}
            <span style={{ fontSize: 9 }}>{label}</span>
          </button>
        ))}
      </nav>

      {/* Task Modal */}
      <TaskModal
        isOpen={modalOpen}
        onClose={closeModal}
        onSave={handleSaveTask}
        onDelete={handleDeleteFromModal}
        editTask={editTask}
        defaultDate={defaultDate}
        saving={saving}
      />

      {/* Toast */}
      <Toast message={toast?.msg ?? ''} show={toastShow} />
    </>
  );
}

// ─── TaskRow sub-component ────────────────────────────────────
function TaskRow({
  task, onToggle, onOpen, showDate,
}: {
  task: Task;
  onToggle: (t: Task) => void;
  onOpen: (t: Task) => void;
  showDate: boolean;
}) {
  return (
    <div className="task-row">
      <button
        className={`task-check ${task.status === 'done' ? 'done' : ''}`}
        onClick={() => onToggle(task)}
        aria-label={task.status === 'done' ? '완료 해제' : '완료 처리'}
      >
        {task.status === 'done' && <CheckCheck size={12} />}
      </button>
      <button className="task-main task-main-btn" onClick={() => onOpen(task)} aria-label={`${task.title} 수정`}>
        <div className={`task-title ${task.status === 'done' ? 'is-done' : ''}`}>{task.title}</div>
        <div className="task-meta">
          <span>
            <span className="subject-dot" style={{ background: SUBJECT_COLORS[task.subject] }} />
            {task.subject}
          </span>
          <span>·</span>
          <span>{task.kind}</span>
          {task.priority === 'high' && <span className="tag red">중요</span>}
        </div>
      </button>
      {showDate && (
        <span className={`task-due ${isOverdue(task) ? 'overdue' : ''}`}>{dueText(task)}</span>
      )}
    </div>
  );
}

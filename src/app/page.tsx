'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard, CalendarDays, ListTodo, BarChart2, Settings,
  Search, Bell, Plus, ChevronLeft, ChevronRight, Pencil, Trash2, CheckCheck,
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import TaskModal from '@/components/TaskModal';
import Toast from '@/components/Toast';
import {
  Task, TaskFormData, TaskStatus, SUBJECT_COLORS, STATUS_LABEL, KIND_COLOR,
} from '@/types/task';

// ─── Helpers ──────────────────────────────────────────────────
type Page = 'dashboard' | 'calendar' | 'tasks' | 'stats' | 'settings';

const todayISO = (() => {
  const d = new Date();
  return d.toISOString().slice(0, 10);
})();

const offsetDate = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const fmtDate = (iso: string, opts?: Intl.DateTimeFormatOptions) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('ko-KR', opts ?? { month: 'short', day: 'numeric' });

const dayDiff = (iso: string) =>
  Math.round((new Date(iso + 'T12:00:00').getTime() - new Date(todayISO + 'T12:00:00').getTime()) / 86400000);

const dueText = (t: Task): string => {
  const d = dayDiff(t.due_date);
  if (d < 0) return `${Math.abs(d)}일 지남`;
  if (d === 0) return '오늘 마감';
  if (d === 1) return '내일 마감';
  return `${d}일 후 마감`;
};

const isOverdue = (t: Task) => t.status !== 'done' && t.due_date < todayISO;

// Demo seed data for when DB is empty / loading
const DEMO_TASKS: Omit<Task, '_id'>[] = [
  { title: '수학 문제집 5단원 풀기', subject: '수학', kind: '과제', due_date: offsetDate(0), estimated_minutes: 40, status: 'doing', priority: 'normal', notes: '짝수 번호 풀이', completed_at: null },
  { title: '과학 실험 보고서 제출', subject: '과학', kind: '수행평가', due_date: offsetDate(1), estimated_minutes: 60, status: 'todo', priority: 'high', notes: '실험 사진 포함', completed_at: null },
  { title: '영어 단어 3과 암기', subject: '영어', kind: '과제', due_date: offsetDate(2), estimated_minutes: 25, status: 'todo', priority: 'normal', notes: '단어 30개', completed_at: null },
  { title: '역사 발표 자료 준비', subject: '사회', kind: '수행평가', due_date: offsetDate(3), estimated_minutes: 90, status: 'doing', priority: 'high', notes: '초안 완성', completed_at: null },
  { title: '독서 기록장 작성', subject: '국어', kind: '과제', due_date: offsetDate(-1), estimated_minutes: 30, status: 'done', priority: 'normal', notes: '인상 깊은 문장 포함', completed_at: offsetDate(-1) },
  { title: '정보 시간 프로젝트 아이디어', subject: '정보', kind: '개인 일정', due_date: offsetDate(5), estimated_minutes: 45, status: 'todo', priority: 'normal', notes: '아이디어 3개', completed_at: null },
  { title: '영어 듣기 평가 복습', subject: '영어', kind: '시험', due_date: offsetDate(6), estimated_minutes: 35, status: 'todo', priority: 'high', notes: '교재 2~3회 듣기', completed_at: null },
  { title: '체육 준비물 확인', subject: '기타', kind: '학교 행사', due_date: offsetDate(4), estimated_minutes: 10, status: 'done', priority: 'normal', notes: '운동복 챙기기', completed_at: offsetDate(-2) },
];

const TIPS = [
  '과제에 예상 시간을 적어두면 하루 계획을 세우기 쉬워요.',
  '마감이 가까운 과제부터 처리하면 불안감이 줄어들어요.',
  '큰 과제는 작게 나눠서 매일 조금씩 진행해 보세요.',
  '완료한 과제를 체크하는 습관이 성취감을 높여줘요.',
];

// ─── Main Component ────────────────────────────────────────────
export default function ClassMateApp() {
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [defaultDate, setDefaultDate] = useState<string>(todayISO);
  const [toastMsg, setToastMsg] = useState('');
  const [toastShow, setToastShow] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Calendar state
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [isDBMode, setIsDBMode] = useState(false);

  // ── Toast helper ──────────────────────────────────────────────
  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setToastShow(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastShow(false), 2600);
  }, []);

  // ── Load tasks ────────────────────────────────────────────────
  const loadTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks');
      if (!res.ok) throw new Error('API error');
      const data: Task[] = await res.json();
      if (data.length === 0) {
        // Seed demo data on first load
        await Promise.all(
          DEMO_TASKS.map((t) =>
            fetch('/api/tasks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(t),
            })
          )
        );
        const seeded = await fetch('/api/tasks').then((r) => r.json());
        setTasks(seeded);
      } else {
        setTasks(data);
      }
      setIsDBMode(true);
    } catch {
      // Fallback to demo data with fake IDs
      setTasks(DEMO_TASKS.map((t, i) => ({ ...t, _id: `demo-${i}` } as Task)));
      setIsDBMode(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // ── CRUD ──────────────────────────────────────────────────────
  const handleSaveTask = async (data: TaskFormData) => {
    if (isDBMode) {
      try {
        if (editTask) {
          const res = await fetch(`/api/tasks/${editTask._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          const updated = await res.json();
          setTasks((prev) => prev.map((t) => (t._id === editTask._id ? updated : t)));
          showToast('일정을 수정했어요.');
        } else {
          const res = await fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });
          const created = await res.json();
          setTasks((prev) => [...prev, created]);
          showToast('새 일정을 추가했어요.');
        }
      } catch {
        showToast('저장에 실패했습니다. 다시 시도해 주세요.');
      }
    } else {
      // Demo mode
      if (editTask) {
        setTasks((prev) => prev.map((t) => (t._id === editTask._id ? { ...t, ...data } : t)));
        showToast('일정을 수정했어요. (데모 모드)');
      } else {
        const fake: Task = { _id: `demo-${Date.now()}`, ...data };
        setTasks((prev) => [...prev, fake]);
        showToast('새 일정을 추가했어요. (데모 모드)');
      }
    }
    setModalOpen(false);
    setEditTask(null);
  };

  const handleToggle = async (task: Task) => {
    const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';
    const updated = {
      ...task,
      status: newStatus,
      completed_at: newStatus === 'done' ? todayISO : null,
    };
    setTasks((prev) => prev.map((t) => (t._id === task._id ? updated : t)));
    showToast(newStatus === 'done' ? '과제를 완료했어요! 🎉' : '완료 상태를 해제했어요.');
    if (isDBMode) {
      await fetch(`/api/tasks/${task._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, completed_at: updated.completed_at }),
      }).catch(() => showToast('상태 업데이트에 실패했습니다.'));
    }
  };

  const handleStatusChange = async (task: Task, newStatus: TaskStatus) => {
    const updated = {
      ...task,
      status: newStatus,
      completed_at: newStatus === 'done' ? (task.completed_at ?? todayISO) : null,
    };
    setTasks((prev) => prev.map((t) => (t._id === task._id ? updated : t)));
    if (isDBMode) {
      await fetch(`/api/tasks/${task._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, completed_at: updated.completed_at }),
      }).catch(() => {});
    }
  };

  const handleDelete = async (task: Task) => {
    if (!confirm(`"${task.title}"를 삭제할까요?`)) return;
    setTasks((prev) => prev.filter((t) => t._id !== task._id));
    showToast('일정을 삭제했어요.');
    if (isDBMode) {
      await fetch(`/api/tasks/${task._id}`, { method: 'DELETE' }).catch(() => {});
    }
  };

  const openAdd = (date?: string) => {
    setEditTask(null);
    setDefaultDate(date ?? todayISO);
    setModalOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditTask(task);
    setModalOpen(true);
  };

  // ── Derived data ──────────────────────────────────────────────
  const completed = tasks.filter((t) => t.status === 'done').length;
  const totalPercent = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  const filteredTasks = tasks
    .filter((t) => {
      const matchStatus = statusFilter === 'all' || t.status === statusFilter;
      const q = searchTerm.toLowerCase();
      const matchSearch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.kind.toLowerCase().includes(q) ||
        (t.notes ?? '').toLowerCase().includes(q);
      return matchStatus && matchSearch;
    })
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  // Week bars helper
  const weekBars = (completedOnly = false) => {
    const days: { label: string; count: number; iso: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const count = tasks.filter((t) =>
        completedOnly
          ? t.status === 'done' && t.completed_at === iso
          : t.due_date === iso
      ).length;
      days.push({ label: d.toLocaleDateString('ko-KR', { weekday: 'short' }), count, iso });
    }
    const max = Math.max(1, ...days.map((d) => d.count));
    return days;
  };

  // ── Calendar helpers ─────────────────────────────────────────
  const calDays = (() => {
    const first = new Date(calYear, calMonth, 1);
    const startDay = first.getDay();
    const start = new Date(calYear, calMonth, 1 - startDay);
    const cells: { iso: string; day: number; isCurrentMonth: boolean; isToday: boolean }[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      cells.push({
        iso,
        day: d.getDate(),
        isCurrentMonth: d.getMonth() === calMonth,
        isToday: iso === todayISO,
      });
    }
    return cells;
  })();

  // ── Pages ─────────────────────────────────────────────────────
  const PAGE_TITLES: Record<Page, [string, string]> = {
    dashboard: ['대시보드', 'WORKSPACE / OVERVIEW'],
    calendar: ['일정 달력', 'WORKSPACE / CALENDAR'],
    tasks: ['과제 관리', 'WORKSPACE / TASKS'],
    stats: ['학습 통계', 'WORKSPACE / ANALYTICS'],
    settings: ['설정', 'PREFERENCES / SETTINGS'],
  };
  const [pageTitle, breadcrumb] = PAGE_TITLES[activePage];

  const navigate = (page: Page) => {
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Dashboard Page ────────────────────────────────────────────
  const DashboardPage = () => {
    const upcoming = [...tasks]
      .filter((t) => t.status !== 'done')
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 4);

    const overdue = tasks.filter(isOverdue).length;
    const imminent = tasks.filter(
      (t) => t.status !== 'done' && dayDiff(t.due_date) >= 0 && dayDiff(t.due_date) <= 2
    ).length;

    // Week progress
    const weekday = (new Date().getDay() + 6) % 7;
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekday);
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
    const wsISO = weekStart.toISOString().slice(0, 10);
    const weISO = weekEnd.toISOString().slice(0, 10);
    const weekTasks = tasks.filter((t) => t.due_date >= wsISO && t.due_date <= weISO);
    const weekDone = weekTasks.filter((t) => t.status === 'done').length;
    const weekPct = weekTasks.length ? Math.round((weekDone / weekTasks.length) * 100) : 0;

    const bars = weekBars(false);
    const barsMax = Math.max(1, ...bars.map((b) => b.count));

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

        {/* Stats */}
        <div className="stats-grid">
          {[
            { label: '전체 과제', value: tasks.length, foot: '등록한 일정 전체', icon: '📋', color: 'blue' },
            { label: '진행 중', value: tasks.filter((t) => t.status === 'doing').length, foot: '현재 집중하고 있어요', icon: '⏳', color: 'teal' },
            { label: '마감 임박', value: imminent, foot: `오늘부터 3일 이내 (기한 초과 ${overdue}개)`, icon: '⚡', color: 'amber' },
            { label: '완료율', value: `${totalPercent}%`, foot: `${completed}개 완료`, icon: '✅', color: 'red' },
          ].map(({ label, value, foot, icon, color }) => (
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
              {upcoming.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">🎉</div>남은 과제가 없어요. 멋져요!</div>
              ) : (
                upcoming.map((t) => (
                  <TaskRow key={t._id} task={t} onToggle={handleToggle} showDate />
                ))
              )}
            </div>
          </div>

          {/* Week progress */}
          <div className="card card-body">
            <div className="card-header">
              <div>
                <h3>이번 주 진행률</h3>
                <p>이번 주 과제 완료 현황</p>
              </div>
              <span className="tag blue">주간 리포트</span>
            </div>
            <div className="progress-area">
              <div className="progress-top">
                <span style={{ color: 'var(--muted)' }}>완료한 과제</span>
                <strong>{weekPct}%</strong>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${weekPct}%` }} />
              </div>
            </div>
            <div className="week-chart">
              {bars.map((b, i) => (
                <div key={b.iso} className="bar-col">
                  <div
                    className={`bar ${i === 6 ? 'today-bar' : ''}`}
                    style={{ height: `${Math.max(4, (b.count / barsMax) * 88)}%` }}
                    title={`${b.iso}: ${b.count}개`}
                  />
                  <div className="bar-label">{b.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="content-grid">
          {/* Next events */}
          <div className="card card-body">
            <div className="card-header">
              <div>
                <h3>곧 다가오는 일정</h3>
                <p>놓치지 않도록 미리 확인해요.</p>
              </div>
              <button className="text-btn" onClick={() => navigate('calendar')}>달력 보기 →</button>
            </div>
            <div className="task-list">
              {tasks.filter((t) => t.status !== 'done').slice(0, 3).length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>다가오는 일정이 없습니다.</div>
              ) : (
                [...tasks].filter((t) => t.status !== 'done')
                  .sort((a, b) => a.due_date.localeCompare(b.due_date))
                  .slice(0, 3)
                  .map((t) => (
                    <div key={t._id} className="task-row">
                      <div className={`stat-ico ${KIND_COLOR[t.kind]}`} style={{ width: 34, height: 34, flexShrink: 0, fontSize: 14 }}>
                        {t.kind === '시험' ? '✎' : t.kind === '수행평가' ? '◆' : '📋'}
                      </div>
                      <div className="task-main">
                        <div className="task-title">{t.title}</div>
                        <div className="task-meta">{t.subject} · {fmtDate(t.due_date, { month: 'long', day: 'numeric' })}</div>
                      </div>
                      <span className={`tag ${isOverdue(t) ? 'red' : KIND_COLOR[t.kind]}`}>{isOverdue(t) ? '기한 지남' : dueText(t)}</span>
                    </div>
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

  // ── Calendar Page ─────────────────────────────────────────────
  const CalendarPage = () => {
    const selectedTasks = tasks
      .filter((t) => t.due_date === selectedDate)
      .sort((a, b) => a.title.localeCompare(b.title));

    const prevMonth = () => {
      if (calMonth === 0) { setCalYear(calYear - 1); setCalMonth(11); }
      else setCalMonth(calMonth - 1);
    };
    const nextMonth = () => {
      if (calMonth === 11) { setCalYear(calYear + 1); setCalMonth(0); }
      else setCalMonth(calMonth + 1);
    };

    return (
      <section className="page-section">
        <div className="welcome-row">
          <div>
            <h2>한눈에 보는 나의 일정</h2>
            <p>날짜를 선택하면 해당 날짜의 과제를 확인할 수 있어요.</p>
          </div>
          <div className="date-pill">일정 {tasks.length}개</div>
        </div>

        <div className="calendar-grid-wrapper">
          <div className="card card-body">
            <div className="card-header">
              <div>
                <h3>월간 달력</h3>
                <p>색상으로 일정 유형을 구분해요.</p>
              </div>
              <div className="calendar-controls">
                <button className="cal-nav-btn" onClick={prevMonth} aria-label="이전 달"><ChevronLeft size={16} /></button>
                <h3 style={{ minWidth: 120, textAlign: 'center' }}>{calYear}년 {calMonth + 1}월</h3>
                <button className="cal-nav-btn" onClick={nextMonth} aria-label="다음 달"><ChevronRight size={16} /></button>
              </div>
            </div>

            <div className="cal-grid">
              {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
                <div key={w} className="cal-weekday">{w}</div>
              ))}
              {calDays.map(({ iso, day, isCurrentMonth, isToday }) => {
                const dayTasks = tasks.filter((t) => t.due_date === iso);
                return (
                  <button
                    key={iso}
                    className={`cal-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'is-today' : ''} ${iso === selectedDate ? 'selected' : ''}`}
                    onClick={() => setSelectedDate(iso)}
                    aria-label={`${iso}, 일정 ${dayTasks.length}개`}
                  >
                    <span className="day-num">{day}</span>
                    <div className="day-events">
                      {dayTasks.slice(0, 2).map((t) => (
                        <div key={t._id} className={`day-event-pill ${KIND_COLOR[t.kind]}`}>{t.title}</div>
                      ))}
                      {dayTasks.length > 2 && <div className="day-more">+{dayTasks.length - 2}개 더</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected date */}
          <div className="card card-body">
            <div className="card-header">
              <div>
                <h3>선택한 날짜</h3>
                <p>날짜를 누르면 일정이 바뀝니다.</p>
              </div>
              <button className="text-btn" onClick={() => openAdd(selectedDate)}>＋ 추가</button>
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>
              {new Date(selectedDate + 'T12:00:00').toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            </div>
            <div className="task-list">
              {selectedTasks.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">☀️</div>이 날짜에는 등록된 일정이 없어요.</div>
              ) : (
                selectedTasks.map((t) => (
                  <TaskRow key={t._id} task={t} onToggle={handleToggle} showDate={false} />
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    );
  };

  // ── Tasks Page ────────────────────────────────────────────────
  const TasksPage = () => (
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
          검색 초기화 ↺
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
                        {t.kind}{t.priority === 'high' && <span className="tag red" style={{ marginLeft: 6 }}>중요</span>}
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
                        onChange={(e) => handleStatusChange(t, e.target.value as TaskStatus)}
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
  const StatsPage = () => {
    const overdue = tasks.filter(isOverdue).length;
    const totalMin = tasks.filter((t) => t.status !== 'done').reduce((s, t) => s + (t.estimated_minutes || 0), 0);
    const subjects = [...new Set(tasks.map((t) => t.subject))];
    const bars = weekBars(true);
    const barsMax = Math.max(1, ...bars.map((b) => b.count));

    return (
      <section className="page-section">
        <div className="welcome-row">
          <div>
            <h2>나의 학습 리포트</h2>
            <p>기록이 쌓일수록 나의 계획 패턴을 알 수 있어요.</p>
          </div>
          <div className="date-pill">📈 누적 기록</div>
        </div>

        <div className="stats-grid">
          {[
            { label: '전체 일정', value: tasks.length, foot: '등록된 모든 일정', icon: '📋', color: 'blue' },
            { label: '완료 과제', value: completed, foot: `전체의 ${totalPercent}%`, icon: '✅', color: 'teal' },
            { label: '기한 경과', value: overdue, foot: '확인 후 일정 조정', icon: '⚡', color: 'red' },
            { label: '예상 남은 시간', value: `${Math.round(totalMin / 60 * 10) / 10}h`, foot: '미완료 과제 기준', icon: '⏰', color: 'amber' },
          ].map(({ label, value, foot, icon, color }) => (
            <div className="stat-card" key={label}>
              <div className="stat-head"><span>{label}</span><span className={`stat-ico ${color}`}>{icon}</span></div>
              <div className="stat-value">{value}</div>
              <div className="stat-foot">{foot}</div>
            </div>
          ))}
        </div>

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
                          style={{ width: `${ts.length ? (done / ts.length) * 100 : 0}%`, background: SUBJECT_COLORS[s as keyof typeof SUBJECT_COLORS] ?? '#536dfe' }}
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
            <div className="week-chart">
              {bars.map((b, i) => (
                <div key={b.iso} className="bar-col">
                  <div
                    className={`bar ${i === 6 ? 'today-bar' : ''}`}
                    style={{ height: `${Math.max(4, (b.count / barsMax) * 88)}%` }}
                    title={`${b.iso}: ${b.count}개 완료`}
                  />
                  <div className="bar-label">{b.label}</div>
                </div>
              ))}
            </div>
            <div className="insight-box">
              <strong>이번 주 돌아보기</strong>
              <p>
                {tasks.length
                  ? `현재 ${tasks.length}개 일정 중 ${completed}개를 완료했어요. ${overdue ? `기한이 지난 미완료 일정 ${overdue}개를 먼저 확인해 보세요.` : '기한이 지난 미완료 일정은 없어요. 좋아요!'}`
                  : '과제를 등록하면 나의 진행 상황을 분석할 수 있어요.'}
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  };

  // ── Settings Page ─────────────────────────────────────────────
  const SettingsPage = () => (
    <section className="page-section">
      <div className="welcome-row">
        <div>
          <h2>설정</h2>
          <p>ClassMate 앱의 연결 상태와 데이터를 관리합니다.</p>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
        <div className="card card-body">
          <div className="card-header">
            <div>
              <h3>연결 상태</h3>
              <p>현재 동작 방식을 확인합니다.</p>
            </div>
          </div>
          <div>
            {[
              { label: 'MongoDB Atlas', desc: isDBMode ? '연결됨 — 데이터가 클라우드에 저장됩니다.' : 'MONGODB_URI가 설정되지 않아 데모 모드로 동작합니다.', tag: isDBMode ? 'green' : 'orange', tagText: isDBMode ? '연결됨' : '데모 모드' },
              { label: '반응형 디자인', desc: '모바일 우선 반응형 레이아웃을 지원합니다.', tag: 'green', tagText: '지원' },
              { label: 'Vercel 배포', desc: 'GitHub와 연결하면 Vercel에서 자동 배포됩니다.', tag: 'blue', tagText: '준비됨' },
            ].map(({ label, desc, tag, tagText }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #f0f2f7' }}>
                <div>
                  <strong style={{ fontSize: 13 }}>{label}</strong>
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{desc}</p>
                </div>
                <span className={`tag ${tag}`}>{tagText}</span>
              </div>
            ))}
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
            <button
              className="btn-secondary"
              style={{ textAlign: 'left', padding: '13px' }}
              onClick={() => {
                const header = ['title', 'subject', 'kind', 'due_date', 'estimated_minutes', 'status', 'priority', 'notes'];
                const rows = [header, ...tasks.map((t) => header.map((k) => String(t[k as keyof Task] ?? '')))];
                const csv = '\ufeff' + rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\r\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'classmate_tasks.csv'; a.click();
                URL.revokeObjectURL(url);
                showToast('CSV 파일을 내보냈어요.');
              }}
            >
              ↓ 과제 목록 CSV 내보내기
            </button>
          </div>
          <div className="insight-box">
            <strong>MongoDB 연결 방법</strong>
            <p>
              <code>.env.local</code> 파일에 <code>MONGODB_URI</code>를 설정하면 클라우드 DB와 연결됩니다.<br /><br />
              MongoDB Atlas에서 무료 클러스터를 생성한 후 연결 문자열을 복사해 붙여넣으세요.
            </p>
          </div>
        </div>
      </div>
    </section>
  );

  // ── Mobile nav icons ──────────────────────────────────────────
  const mobileNavItems: { page: Page; label: string; icon: React.ReactNode }[] = [
    { page: 'dashboard', label: '홈', icon: <LayoutDashboard size={20} /> },
    { page: 'calendar', label: '달력', icon: <CalendarDays size={20} /> },
    { page: 'tasks', label: '과제', icon: <ListTodo size={20} /> },
    { page: 'stats', label: '통계', icon: <BarChart2 size={20} /> },
    { page: 'settings', label: '설정', icon: <Settings size={20} /> },
  ];

  // ─────────────────────────────────────────────────────────────
  return (
    <>
      <div className="app-layout">
        <Sidebar activePage={activePage} onNavigate={navigate} />

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
                  onChange={(e) => setSearchTerm(e.target.value)}
                  aria-label="검색어 입력"
                />
              </label>
              <button className="btn-icon" aria-label="알림" title="알림 (준비 중)">
                <Bell size={17} />
                <span className="notification-dot" />
              </button>
              <button className="btn-primary" id="add-task-btn" onClick={() => openAdd()}>
                <Plus size={16} />
                일정 추가
              </button>
            </div>
          </header>

          {/* Page content */}
          {loading ? (
            <div className="spinner" aria-label="로딩 중" />
          ) : (
            <>
              {activePage === 'dashboard' && <DashboardPage />}
              {activePage === 'calendar' && <CalendarPage />}
              {activePage === 'tasks' && <TasksPage />}
              {activePage === 'stats' && <StatsPage />}
              {activePage === 'settings' && <SettingsPage />}
            </>
          )}
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
        onClose={() => { setModalOpen(false); setEditTask(null); }}
        onSave={handleSaveTask}
        editTask={editTask}
        defaultDate={defaultDate}
      />

      {/* Toast */}
      <Toast message={toastMsg} show={toastShow} />
    </>
  );
}

// ─── TaskRow sub-component ────────────────────────────────────
function TaskRow({ task, onToggle, showDate }: { task: Task; onToggle: (t: Task) => void; showDate: boolean }) {
  return (
    <div className="task-row">
      <button
        className={`task-check ${task.status === 'done' ? 'done' : ''}`}
        onClick={() => onToggle(task)}
        aria-label={task.status === 'done' ? '완료 해제' : '완료 처리'}
      >
        {task.status === 'done' && <CheckCheck size={12} />}
      </button>
      <div className="task-main">
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
      </div>
      {showDate && (
        <span className={`task-due ${isOverdue(task) ? 'overdue' : ''}`}>{dueText(task)}</span>
      )}
    </div>
  );
}

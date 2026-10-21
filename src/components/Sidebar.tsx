'use client';

import { LayoutDashboard, CalendarDays, ListTodo, BarChart2, Settings, BookOpen } from 'lucide-react';

type Page = 'dashboard' | 'calendar' | 'tasks' | 'stats' | 'settings';

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { page: Page; label: string; icon: React.ReactNode }[] = [
  { page: 'dashboard', label: '대시보드', icon: <LayoutDashboard size={18} /> },
  { page: 'calendar', label: '일정 달력', icon: <CalendarDays size={18} /> },
  { page: 'tasks', label: '과제 관리', icon: <ListTodo size={18} /> },
  { page: 'stats', label: '학습 통계', icon: <BarChart2 size={18} /> },
];

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="brand-mark">
          <BookOpen size={20} color="white" strokeWidth={2.2} />
        </div>
        <div className="brand-text">
          <strong>ClassMate</strong>
          <small>STUDY SMARTER</small>
        </div>
      </div>

      {/* Nav */}
      <div className="sidebar-section">
        <div className="sidebar-label">WORKSPACE</div>
        <nav aria-label="주 메뉴" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map(({ page, label, icon }) => (
            <button
              key={page}
              className={`nav-btn ${activePage === page ? 'active' : ''}`}
              onClick={() => onNavigate(page)}
              aria-current={activePage === page ? 'page' : undefined}
            >
              <span className="nav-icon">{icon}</span>
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Bottom section */}
      <div className="sidebar-bottom">
        <div className="sidebar-label" style={{ paddingBottom: '8px' }}>PREFERENCES</div>
        <button
          className={`nav-btn ${activePage === 'settings' ? 'active' : ''}`}
          onClick={() => onNavigate('settings')}
          aria-current={activePage === 'settings' ? 'page' : undefined}
        >
          <span className="nav-icon"><Settings size={18} /></span>
          설정
        </button>

        <div className="focus-card" style={{ marginTop: '16px' }}>
          <div className="spark">✦</div>
          <strong>조금씩, 꾸준하게</strong>
          <p>오늘 할 일을 하나씩 끝내면<br />목표에 한 걸음 더 가까워져요.</p>
          <button className="focus-card-btn" onClick={() => onNavigate('tasks')}>
            오늘 할 일 보기 →
          </button>
        </div>

        <div className="profile-row">
          <div className="avatar">학</div>
          <div>
            <strong>학생 사용자</strong>
            <span>ClassMate 앱</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

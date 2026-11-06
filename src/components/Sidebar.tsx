'use client';

import { LayoutDashboard, CalendarDays, ListChecks, ListTodo, School, BarChart2, Settings, BookOpen, LogOut, Users } from 'lucide-react';
import type { User } from '@/lib/client';

type Page = 'dashboard' | 'school' | 'classes' | 'checklist' | 'calendar' | 'tasks' | 'stats' | 'settings';

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  user?: User;
  showSchool?: boolean; // 학생용 계정이면 '학교생활' 메뉴 표시
  onLogout?: () => void;
  classUnread?: number; // 클래스 새 공지 수
}

const navItems: { page: Page; label: string; icon: React.ReactNode }[] = [
  { page: 'dashboard', label: '대시보드', icon: <LayoutDashboard size={18} /> },
  { page: 'checklist', label: '체크판', icon: <ListChecks size={18} /> },
  { page: 'calendar', label: '일정 달력', icon: <CalendarDays size={18} /> },
  { page: 'tasks', label: '과제 관리', icon: <ListTodo size={18} /> },
  { page: 'stats', label: '학습 통계', icon: <BarChart2 size={18} /> },
  { page: 'classes', label: '클래스', icon: <Users size={18} /> },
];

export default function Sidebar({ activePage, onNavigate, user, onLogout, showSchool, classUnread = 0 }: SidebarProps) {
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
          {(showSchool ? [{ page: 'school' as const, label: '학교생활', icon: <School size={18} /> }, ...navItems] : navItems).map(({ page, label, icon }) => (
            <button
              key={page}
              className={`nav-btn ${activePage === page ? 'active' : ''}`}
              onClick={() => onNavigate(page)}
              aria-current={activePage === page ? 'page' : undefined}
            >
              <span className="nav-icon">{icon}</span>
              {label}
              {page === 'classes' && classUnread > 0 && <span className="nav-badge">{classUnread > 99 ? '99+' : classUnread}</span>}
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
          <button className="focus-card-btn" onClick={() => onNavigate('checklist')}>
            오늘 할 일 보기 →
          </button>
        </div>

        <div className="profile-row">
          <div className="avatar">{user?.nickname.slice(0, 1) ?? '학'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong>{user?.nickname ?? '학생 사용자'}</strong>
            <span>{user ? `@${user.username}` : 'ClassMate 앱'}</span>
          </div>
          {onLogout && (
            <button className="logout-btn" onClick={onLogout} aria-label="로그아웃" title="로그아웃">
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, X } from 'lucide-react';
import { api, ApiError } from '@/lib/client';
import { dayDiff, fmtDate, getTodayISO, toLocalISO } from '@/lib/date';
import { CATEGORY_LABEL, EventCategory, outfitLabel, SchoolDay, SchoolEvent, SchoolInfo } from '@/lib/school';

interface Summary {
  today: SchoolDay;
  tomorrow: SchoolDay;
  upcoming: SchoolEvent[];
  vacation: { name: string; start: string; end: string } | null;
}

const CATEGORY_COLOR: Record<EventCategory, string> = {
  vacation: 'green',
  exam: 'red',
  trip: 'orange',
  holiday: 'purple',
  event: 'blue',
};

const errorMessage = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);
const dLabel = (date: string) => {
  const d = dayDiff(date);
  return d === 0 ? 'D-DAY' : d > 0 ? `D-${d}` : `D+${-d}`;
};

// ─── 학교생활: 오늘·내일 시간표와 준비물, 다가오는 일정, 학사일정·시간표 달력 ───
export default function SchoolPage({ school }: { school: SchoolInfo }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [days, setDays] = useState<Record<string, SchoolDay>>({});
  const [daysLoading, setDaysLoading] = useState(true);
  const [daysError, setDaysError] = useState<string | null>(null);
  const [openDay, setOpenDay] = useState<SchoolDay | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Summary>('/api/school/summary')
      .then((s) => {
        if (cancelled) return;
        setSummary(s);
        setSummaryError(null);
      })
      .catch((e) => !cancelled && setSummaryError(errorMessage(e, '학교 정보를 불러오지 못했어요.')));
    return () => { cancelled = true; };
  }, [reloadKey]);

  // 달력 6주(42칸): 그 달 1일이 있는 주의 일요일부터
  const gridStart = new Date(calYear, calMonth, 1 - new Date(calYear, calMonth, 1).getDay());
  const fromISO = toLocalISO(gridStart);
  const toISO = toLocalISO(new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + 41));

  useEffect(() => {
    let cancelled = false;
    api<{ days: SchoolDay[] }>(`/api/school/days?from=${fromISO}&to=${toISO}`)
      .then(({ days }) => {
        if (cancelled) return;
        setDays(Object.fromEntries(days.map((d) => [d.date, d])));
        setDaysError(null);
      })
      .catch((e) => !cancelled && setDaysError(errorMessage(e, '학교 달력을 불러오지 못했어요.')))
      .finally(() => !cancelled && setDaysLoading(false));
    return () => { cancelled = true; };
  }, [fromISO, toISO, reloadKey]);

  const moveMonth = (delta: number) => {
    const d = new Date(calYear, calMonth + delta, 1);
    setDaysLoading(true);
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
  };

  const reload = () => {
    setSummary(null);
    setSummaryError(null);
    setDaysLoading(true);
    setReloadKey((k) => k + 1);
  };

  const closeDay = useCallback(() => setOpenDay(null), []);
  const todayISO = getTodayISO();

  return (
    <section className="page-section">
      <div className="welcome-row">
        <div>
          <h2>{school.school_name} {school.grade}학년 {school.class_nm}반</h2>
          <p>나이스에 올라온 학사일정과 우리 반 시간표로 매일 챙길 것을 정리해요.</p>
        </div>
        <button className="filter-btn" onClick={reload} aria-label="새로 불러오기">
          <RefreshCw size={13} style={{ verticalAlign: -2 }} /> 새로 불러오기
        </button>
      </div>

      {summaryError ? (
        <div className="card card-body" style={{ textAlign: 'center', marginBottom: 18 }}>
          <div className="empty-icon">⚠️</div>
          <p style={{ margin: '8px 0 16px', color: 'var(--muted)' }}>{summaryError}</p>
          <button className="btn-primary" onClick={reload} style={{ margin: '0 auto' }}>다시 시도</button>
        </div>
      ) : !summary ? (
        <div className="card card-body school-loading">
          <div className="spinner" aria-label="불러오는 중" />
          <p>나이스에서 학사일정과 시간표를 불러오는 중이에요. 처음 한 번은 조금 걸릴 수 있어요.</p>
        </div>
      ) : (
        <>
          <div className="content-grid school-days">
            <DayCard title="오늘" day={summary.today} kind={school.school_kind} />
            <DayCard title="내일" day={summary.tomorrow} kind={school.school_kind} />
          </div>

          <div className="card card-body" style={{ marginBottom: 18 }}>
            <div className="card-header">
              <div>
                <h3>다가오는 중요 일정</h3>
                <p>시험·체험학습은 3일 전 저녁에 알림으로도 알려 줘요.</p>
              </div>
            </div>
            <div className="upcoming-list">
              {summary.vacation && (
                <div className="upcoming-item vacation">
                  <span className={`tag ${CATEGORY_COLOR.vacation}`}>방학</span>
                  <strong>{summary.vacation.name}</strong>
                  <span className="upcoming-date">
                    {fmtDate(summary.vacation.start, { month: 'long', day: 'numeric' })} ~ {fmtDate(summary.vacation.end, { month: 'long', day: 'numeric' })}
                  </span>
                  <span className="upcoming-d">{summary.vacation.start <= todayISO ? '방학 중 🎉' : dLabel(summary.vacation.start)}</span>
                </div>
              )}
              {summary.upcoming.map((e) => (
                <div key={`${e.date}-${e.name}`} className="upcoming-item">
                  <span className={`tag ${CATEGORY_COLOR[e.category]}`}>{CATEGORY_LABEL[e.category]}</span>
                  <strong>{e.name}</strong>
                  <span className="upcoming-date">{fmtDate(e.date, { month: 'long', day: 'numeric', weekday: 'short' })}</span>
                  <span className="upcoming-d">{dLabel(e.date)}</span>
                </div>
              ))}
              {!summary.vacation && summary.upcoming.length === 0 && (
                <div className="empty-state" style={{ padding: '20px 12px' }}>앞으로 90일 안에 등록된 시험·체험학습이 없어요.</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 학사일정·시간표 달력 */}
      <div className="card card-body">
        <div className="card-header">
          <div>
            <h3>학사일정 · 시간표 달력</h3>
            <p>날짜를 누르면 그날의 교시별 과목과 챙길 것을 볼 수 있어요. 👕 = 체육 있는 날</p>
          </div>
          <div className="calendar-controls">
            <button className="cal-nav-btn" onClick={() => moveMonth(-1)} aria-label="이전 달"><ChevronLeft size={16} /></button>
            <h3 style={{ minWidth: 110, textAlign: 'center' }}>{calYear}년 {calMonth + 1}월</h3>
            <button className="cal-nav-btn" onClick={() => moveMonth(1)} aria-label="다음 달"><ChevronRight size={16} /></button>
          </div>
        </div>

        {daysError && <div className="auth-error" role="alert" style={{ marginBottom: 12 }}>{daysError}</div>}
        <div className={`cal-grid ${daysLoading ? 'is-loading' : ''}`}>
          {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
            <div key={w} className="cal-weekday">{w}</div>
          ))}
          {Array.from({ length: 42 }, (_, i) => {
            const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
            const iso = toLocalISO(d);
            const day = days[iso];
            const isCurrentMonth = d.getMonth() === calMonth;
            return (
              <button
                key={iso}
                className={`cal-day school-cal-day ${!isCurrentMonth ? 'other-month' : ''} ${iso === todayISO ? 'is-today' : ''} ${day?.day_off ? 'day-off' : ''}`}
                onClick={() => day && setOpenDay(day)}
                disabled={!day}
                aria-label={`${iso}${day?.events.length ? `, ${day.events.map((e) => e.name).join(', ')}` : ''}${day?.pe ? ', 체육 있음' : ''}`}
              >
                <span className="day-num">{d.getDate()}</span>
                {day?.pe && <span className="pe-mark" aria-hidden>👕</span>}
                <div className="day-events">
                  {day?.events.map((e) => (
                    <div key={e.name} className={`day-event-pill school-pill ${CATEGORY_COLOR[e.category]}`}>{e.name}</div>
                  ))}
                  {day && !day.day_off && day.periods.length > 0 && (
                    <div className="day-periods">{day.periods.length}교시</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <p className="school-note">
          시간표는 학교가 나이스에 올린 주부터 보여요. 선택 과목·이동 수업은 반 시간표와 다를 수 있어요.
        </p>
      </div>

      {openDay && <SchoolDayModal day={openDay} kind={school.school_kind} onClose={closeDay} />}
    </section>
  );
}

// 오늘·내일 카드
function DayCard({ title, day, kind }: { title: string; day: SchoolDay; kind: string }) {
  return (
    <div className="card card-body">
      <div className="card-header">
        <div>
          <h3>{title} <span className="school-date">{fmtDate(day.date, { month: 'long', day: 'numeric', weekday: 'short' })}</span></h3>
        </div>
        {day.day_off ? (
          <span className="tag purple">쉬는 날</span>
        ) : (
          <span className={`tag ${day.pe ? 'orange' : 'blue'}`}>{outfitLabel(day.pe, kind)}</span>
        )}
      </div>
      <DayDetail day={day} />
    </div>
  );
}

// 하루 상세: 행사, 교시별 과목, 챙길 것
function DayDetail({ day }: { day: SchoolDay }) {
  return (
    <>
      {day.events.length > 0 && (
        <div className="school-events">
          {day.events.map((e) => (
            <span key={e.name} className={`tag ${CATEGORY_COLOR[e.category]}`}>
              {CATEGORY_LABEL[e.category]} · {e.name}
            </span>
          ))}
        </div>
      )}
      {day.day_off ? (
        <div className="empty-state" style={{ padding: '20px 12px' }}>등교하지 않는 날이에요. 푹 쉬어요! 🌿</div>
      ) : (
        <>
          {day.periods.length > 0 ? (
            <ol className="period-list">
              {day.periods.map((p) => (
                <li key={p.period} className={/체육|스포츠/.test(p.subject) ? 'is-pe' : ''}>
                  <span className="period-no">{p.period}교시</span>
                  <span>{p.subject}</span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="empty-state" style={{ padding: '20px 12px' }}>시간표가 아직 나이스에 올라오지 않았어요.</div>
          )}
          {day.items.length > 0 && (
            <div className="prep-box">
              <strong>🎒 챙길 것</strong>
              <ul>
                {day.items.map((i) => <li key={i}>{i}</li>)}
              </ul>
            </div>
          )}
        </>
      )}
    </>
  );
}

function SchoolDayModal({ day, kind, onClose }: { day: SchoolDay; kind: string; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="school-day-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal">
        <div className="modal-header">
          <div>
            <h2 id="school-day-title">{fmtDate(day.date, { month: 'long', day: 'numeric', weekday: 'long' })}</h2>
            <p>{day.day_off ? '쉬는 날' : outfitLabel(day.pe, kind)}</p>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="닫기"><X size={18} /></button>
        </div>
        <DayDetail day={day} />
      </div>
    </div>
  );
}

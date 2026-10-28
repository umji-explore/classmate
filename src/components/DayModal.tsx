'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Task, TaskFormData, TaskKind, TaskSubject, SUBJECTS, KINDS, KIND_COLOR } from '@/types/task';
import { fmtDate } from '@/lib/date';

const MAX_ROWS = 20;

interface Row {
  id: number;
  title: string;
  subject: TaskSubject;
  kind: TaskKind;
}

interface DayModalProps {
  date: string | null; // null이면 닫힘
  dayTasks: Task[];
  saving: boolean;
  onClose: () => void;
  onEdit: (task: Task) => void;
  onAddMany: (items: TaskFormData[]) => Promise<boolean>; // 저장에 성공하면 true
  onOpenDetail: (date: string) => void;
}

// 달력에서 날짜를 누르면 뜨는 창: 그날 일정 목록 + 여러 개를 한 번에 추가하는 입력칸
export default function DayModal(props: DayModalProps) {
  if (!props.date) return null;
  // key: 다른 날짜를 열면 입력칸을 새로 시작
  return <DayModalContent key={props.date} {...props} date={props.date} />;
}

function DayModalContent({
  date, dayTasks, saving, onClose, onEdit, onAddMany, onOpenDetail,
}: DayModalProps & { date: string }) {
  const nextId = useRef(1);
  const [rows, setRows] = useState<Row[]>([{ id: 0, title: '', subject: '기타', kind: '과제' }]);
  const inputRefs = useRef(new Map<number, HTMLInputElement>());
  const focusId = useRef<number | null>(0);

  // 새 줄을 추가하면 그 줄의 이름 칸으로 커서를 옮긴다
  useEffect(() => {
    if (focusId.current === null) return;
    const el = inputRefs.current.get(focusId.current);
    if (el) {
      el.focus();
      focusId.current = null;
    }
  }, [rows]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const updateRow = (id: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // 새 줄은 바로 위 줄의 과목·유형을 이어받는다 (같은 과목 과제를 여러 개 넣기 편하게)
  const addRow = (after?: Row) => {
    if (rows.length >= MAX_ROWS) return;
    const base = after ?? rows[rows.length - 1];
    const row: Row = { id: nextId.current++, title: '', subject: base.subject, kind: base.kind };
    focusId.current = row.id;
    setRows((prev) => {
      const index = after ? prev.findIndex((r) => r.id === after.id) + 1 : prev.length;
      return [...prev.slice(0, index), row, ...prev.slice(index)];
    });
  };

  const removeRow = (id: number) => {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.id !== id)));
  };

  const filled = rows.filter((r) => r.title.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filled.length || saving) return;
    const items: TaskFormData[] = filled.map((r) => ({
      title: r.title.trim(),
      subject: r.subject,
      kind: r.kind,
      due_date: date,
      estimated_minutes: 30,
      status: 'todo',
      priority: 'normal',
      notes: '',
      completed_at: null,
    }));
    if (await onAddMany(items)) onClose();
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="day-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <div>
            <h2 id="day-modal-title">
              {fmtDate(date, { month: 'long', day: 'numeric', weekday: 'short' })} 일정
            </h2>
            <p>여러 일정을 한 번에 추가할 수 있어요. 이름 칸에서 Enter를 누르면 새 줄이 생겨요.</p>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        {dayTasks.length > 0 && (
          <div className="day-existing">
            <strong>등록된 일정 {dayTasks.length}개</strong>
            <div className="day-existing-list">
              {dayTasks.map((t) => (
                <button
                  key={t._id}
                  className={`day-event-pill ${KIND_COLOR[t.kind]} ${t.status === 'done' ? 'is-done' : ''}`}
                  onClick={() => onEdit(t)}
                  aria-label={`${t.title} 수정`}
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="quick-rows">
            {rows.map((r, i) => (
              <div key={r.id} className="quick-row">
                <input
                  ref={(el) => {
                    if (el) inputRefs.current.set(r.id, el);
                    else inputRefs.current.delete(r.id);
                  }}
                  value={r.title}
                  maxLength={100}
                  placeholder={i === 0 ? '예: 영어 단어 30개 외우기' : '일정 이름'}
                  aria-label={`${i + 1}번째 일정 이름`}
                  onChange={(e) => updateRow(r.id, { title: e.target.value })}
                  onKeyDown={(e) => {
                    // 한글 조합 중 Enter는 무시 (마지막 글자가 다음 줄로 넘어가는 문제 방지)
                    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
                    e.preventDefault();
                    if (r.title.trim()) addRow(r);
                  }}
                />
                <select
                  value={r.subject}
                  aria-label={`${i + 1}번째 일정 과목`}
                  onChange={(e) => updateRow(r.id, { subject: e.target.value as TaskSubject })}
                >
                  {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  value={r.kind}
                  aria-label={`${i + 1}번째 일정 유형`}
                  onChange={(e) => updateRow(r.id, { kind: e.target.value as TaskKind })}
                >
                  {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
                <button
                  type="button"
                  className="table-action danger"
                  onClick={() => removeRow(r.id)}
                  disabled={rows.length === 1}
                  aria-label={`${i + 1}번째 줄 지우기`}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="quick-tools">
            <button type="button" className="text-btn" onClick={() => addRow()} disabled={rows.length >= MAX_ROWS}>
              <Plus size={13} style={{ verticalAlign: -2 }} /> 줄 추가
            </button>
            <button type="button" className="text-btn" onClick={() => onOpenDetail(date)}>
              예상 시간·메모까지 자세히 입력 →
            </button>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              닫기
            </button>
            <button type="submit" className="btn-primary" disabled={saving || !filled.length}>
              {saving ? '저장 중…' : filled.length > 1 ? `${filled.length}개 한 번에 추가` : '추가하기'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

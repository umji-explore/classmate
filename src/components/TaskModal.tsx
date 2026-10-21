'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Task, TaskFormData, SUBJECTS, KINDS } from '@/types/task';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: TaskFormData) => void;
  editTask?: Task | null;
  defaultDate?: string;
}

const todayISO = () => {
  const d = new Date();
  return d.toISOString().slice(0, 10);
};

export default function TaskModal({
  isOpen,
  onClose,
  onSave,
  editTask,
  defaultDate,
}: TaskModalProps) {
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => titleRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // ESC 키로 닫기
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    const status = fd.get('status') as TaskFormData['status'];
    const data: TaskFormData = {
      title: (fd.get('title') as string).trim(),
      subject: fd.get('subject') as TaskFormData['subject'],
      kind: fd.get('kind') as TaskFormData['kind'],
      due_date: fd.get('due_date') as string,
      estimated_minutes: Math.max(0, Number(fd.get('estimated_minutes')) || 0),
      status,
      priority: fd.get('priority') as TaskFormData['priority'],
      notes: (fd.get('notes') as string).trim(),
      completed_at: status === 'done' ? (editTask?.completed_at ?? todayISO()) : null,
    };

    onSave(data);
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal">
        <div className="modal-header">
          <div>
            <h2 id="modal-title">{editTask ? '일정 수정' : '새 일정 추가'}</h2>
            <p>기억해야 할 과제와 일정을 입력해 주세요.</p>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        <form id="task-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            {/* 과제명 */}
            <div className="field full">
              <label htmlFor="task-title">과제 / 일정 이름 *</label>
              <input
                ref={titleRef}
                id="task-title"
                name="title"
                required
                maxLength={100}
                placeholder="예: 과학 실험 보고서"
                defaultValue={editTask?.title ?? ''}
              />
            </div>

            {/* 과목 */}
            <div className="field">
              <label htmlFor="task-subject">과목 *</label>
              <select id="task-subject" name="subject" required defaultValue={editTask?.subject ?? '수학'}>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* 유형 */}
            <div className="field">
              <label htmlFor="task-kind">일정 유형</label>
              <select id="task-kind" name="kind" defaultValue={editTask?.kind ?? '과제'}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>{k}</option>
                ))}
              </select>
            </div>

            {/* 마감일 */}
            <div className="field">
              <label htmlFor="task-due">마감일 *</label>
              <input
                id="task-due"
                name="due_date"
                type="date"
                required
                defaultValue={editTask?.due_date ?? defaultDate ?? todayISO()}
              />
            </div>

            {/* 예상 시간 */}
            <div className="field">
              <label htmlFor="task-time">예상 소요 시간 (분)</label>
              <input
                id="task-time"
                name="estimated_minutes"
                type="number"
                min={0}
                max={1440}
                step={5}
                defaultValue={editTask?.estimated_minutes ?? 30}
              />
            </div>

            {/* 상태 */}
            <div className="field">
              <label htmlFor="task-status">진행 상태</label>
              <select id="task-status" name="status" defaultValue={editTask?.status ?? 'todo'}>
                <option value="todo">대기 중</option>
                <option value="doing">진행 중</option>
                <option value="done">완료</option>
              </select>
            </div>

            {/* 중요도 */}
            <div className="field">
              <label htmlFor="task-priority">중요도</label>
              <select id="task-priority" name="priority" defaultValue={editTask?.priority ?? 'normal'}>
                <option value="normal">보통</option>
                <option value="high">높음</option>
              </select>
            </div>

            {/* 메모 */}
            <div className="field full">
              <label htmlFor="task-notes">메모 (선택)</label>
              <textarea
                id="task-notes"
                name="notes"
                maxLength={500}
                placeholder="준비할 내용이나 제출 방법을 적어 주세요."
                defaultValue={editTask?.notes ?? ''}
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn-primary">
              저장하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

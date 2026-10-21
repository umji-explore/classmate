// 클라이언트에서 사용하는 Task 타입 (MongoDB _id 포함)
export type TaskStatus = 'todo' | 'doing' | 'done';
export type TaskPriority = 'normal' | 'high';
export type TaskKind = '과제' | '수행평가' | '시험' | '학교 행사' | '개인 일정';
export type TaskSubject = '국어' | '수학' | '영어' | '과학' | '사회' | '정보' | '기타';

export interface Task {
  _id: string;
  title: string;
  subject: TaskSubject;
  kind: TaskKind;
  due_date: string;
  estimated_minutes: number;
  status: TaskStatus;
  priority: TaskPriority;
  notes: string;
  completed_at: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type TaskFormData = Omit<Task, '_id' | 'createdAt' | 'updatedAt'>;

export const SUBJECTS: TaskSubject[] = ['국어', '수학', '영어', '과학', '사회', '정보', '기타'];
export const KINDS: TaskKind[] = ['과제', '수행평가', '시험', '학교 행사', '개인 일정'];

export const SUBJECT_COLORS: Record<TaskSubject, string> = {
  수학: '#536dfe',
  과학: '#29a994',
  영어: '#efa63b',
  국어: '#d977a5',
  사회: '#8e78d3',
  정보: '#28a2bd',
  기타: '#9ca3af',
};

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: '대기 중',
  doing: '진행 중',
  done: '완료',
};

export const KIND_COLOR: Record<TaskKind, 'blue' | 'orange' | 'green'> = {
  과제: 'blue',
  수행평가: 'orange',
  시험: 'orange',
  '학교 행사': 'green',
  '개인 일정': 'blue',
};

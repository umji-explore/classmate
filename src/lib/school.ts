// 학생용 계정: 학교 정보·학사일정·시간표 공용 타입과 규칙 (서버와 브라우저에서 함께 사용)

export type AccountType = 'personal' | 'student';

export interface SchoolInfo {
  office_code: string; // 시도교육청 코드 (예: B10)
  school_code: string; // 표준 학교 코드 (7자리)
  school_name: string;
  school_kind: string; // 초등학교 / 중학교 / 고등학교 / 특수학교 ...
  grade: number;
  class_nm: string; // 반 (보통 숫자)
}

// 학교 검색 결과
export interface SchoolSearchResult {
  office_code: string;
  school_code: string;
  school_name: string;
  school_kind: string;
  address: string;
}

export type EventCategory = 'vacation' | 'exam' | 'trip' | 'holiday' | 'event';

export interface SchoolEvent {
  date: string; // YYYY-MM-DD
  name: string;
  detail: string;
  category: EventCategory;
  day_off: boolean; // 휴업일·공휴일·방학 (등교하지 않는 날)
}

export interface Period {
  period: number;
  subject: string;
}

export interface SchoolDay {
  date: string;
  events: SchoolEvent[];
  periods: Period[]; // 나이스에 시간표가 올라오지 않은 날은 빈 배열
  day_off: boolean;
  pe: boolean; // 체육 수업이 있어 체육복을 입는 날
  items: string[]; // 챙길 것
}

export const CATEGORY_LABEL: Record<EventCategory, string> = {
  vacation: '방학',
  exam: '시험',
  trip: '체험학습',
  holiday: '쉬는 날',
  event: '행사',
};

// 학교 종류별 학년 수
export const maxGrade = (kind: string) => (kind.includes('초등') ? 6 : 3);

// ── 학사일정 분류 ───────────────────────────────────────────────
const VACATION = /방학(?!식)/;
const EXAM = /고사|시험|지필|평가(?!회)|모의고사|학력평가|수능/;
const TRIP = /체험\s*학습|현장\s*체험|수학\s*여행|수련\s*활동|수련회|소풍|견학|야영/;

export function classifyEvent(name: string, dayOffType: string): { category: EventCategory; day_off: boolean } {
  const holidayType = dayOffType === '공휴일' || dayOffType === '휴업일';
  if (VACATION.test(name)) return { category: 'vacation', day_off: true };
  if (TRIP.test(name)) return { category: 'trip', day_off: false };
  if (EXAM.test(name)) return { category: 'exam', day_off: false };
  if (holidayType) return { category: 'holiday', day_off: true };
  return { category: 'event', day_off: false };
}

// 중요 일정(미리 알림 대상): 시험, 체험학습, 방학 시작
export const isImportant = (e: SchoolEvent) => e.category === 'exam' || e.category === 'trip' || e.category === 'vacation';

// 같은 이름이 연달아 이어지는 방학 날짜들을 기간으로 묶는다
export function vacationRanges(events: SchoolEvent[]): { name: string; start: string; end: string }[] {
  const days = events
    .filter((e) => e.category === 'vacation')
    .sort((a, b) => a.date.localeCompare(b.date));
  const ranges: { name: string; start: string; end: string }[] = [];
  for (const e of days) {
    const last = ranges[ranges.length - 1];
    // 방학 중 주말은 학사일정에 빠져 있을 수 있어 4일 이내 간격이면 같은 방학으로 본다
    if (last && last.name === e.name && dayGap(last.end, e.date) <= 4) last.end = e.date;
    else ranges.push({ name: e.name, start: e.date, end: e.date });
  }
  return ranges;
}

const dayGap = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);

// ── 준비물·체육복 ───────────────────────────────────────────────
const PE = /체육|스포츠/;

// 과목 이름에 따라 챙기면 좋은 것
const SUBJECT_ITEMS: { match: RegExp; item: string }[] = [
  { match: /미술/, item: '미술 도구' },
  { match: /음악/, item: '음악 교과서·악기' },
  { match: /기술|가정|실과/, item: '실습 준비물' },
];

// 교과서가 없는 시간 (창체·자율·동아리 등)
const NO_TEXTBOOK = /창체|창의적|체험활동|자율|동아리|봉사|진로|스포츠클럽/;

const EVENT_ITEMS: { category: EventCategory; items: string[] }[] = [
  { category: 'exam', items: ['필기구·컴퓨터용 사인펜', '수정 테이프', '시험 범위 정리 노트'] },
  { category: 'trip', items: ['편한 복장·운동화', '물·간식', '안내문의 준비물 확인'] },
];

export function buildSchoolDay(date: string, events: SchoolEvent[], periods: Period[]): SchoolDay {
  const sorted = [...periods].sort((a, b) => a.period - b.period);
  const weekend = [0, 6].includes(new Date(`${date}T00:00:00`).getDay());
  const day_off = events.some((e) => e.day_off) || (weekend && sorted.length === 0);
  const pe = !day_off && sorted.some((p) => PE.test(p.subject));

  const items = new Set<string>();
  if (!day_off) {
    if (pe) items.add('체육복');
    for (const p of sorted) {
      for (const rule of SUBJECT_ITEMS) if (rule.match.test(p.subject)) items.add(rule.item);
    }
    for (const e of events) {
      for (const rule of EVENT_ITEMS) if (rule.category === e.category) rule.items.forEach((i) => items.add(i));
    }
    // 시간표에 있는 과목의 교과서
    const subjects = [...new Set(sorted.map((p) => p.subject).filter((s) => !PE.test(s) && !NO_TEXTBOOK.test(s)))];
    if (subjects.length) items.add(`교과서: ${subjects.join(', ')}`);
  }
  return { date, events, periods: sorted, day_off, pe, items: [...items] };
}

// 옷차림 안내 (초등학교는 교복이 없으므로 체육 여부만)
export const outfitLabel = (pe: boolean, kind: string) =>
  pe ? '👕 체육복' : kind.includes('초등') ? '체육 없음' : '👔 교복';

// 알림·화면에 쓰는 한 줄 요약 (예: "1 국어 · 2 수학 · 3 체육")
export const periodsLine = (periods: Period[]) => periods.map((p) => `${p.period} ${p.subject}`).join(' · ');

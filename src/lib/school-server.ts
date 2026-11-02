// 학사일정 + 시간표를 날짜별로 묶어 화면·알림에 쓰는 형태로 만든다 (서버 전용)
import { findSchool, getEvents, getTimetable } from '@/lib/neis';
import { addDays, buildSchoolDay, isImportant, maxGrade, SchoolDay, SchoolEvent, SchoolInfo, vacationRanges } from '@/lib/school';

export { addDays };

// 회원가입·설정에서 받은 학교 정보를 검사하고, 학교 이름·종류는 나이스에서 다시 확인한 값으로 저장한다
export async function verifySchoolInput(raw: unknown): Promise<SchoolInfo | string> {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const officeCode = String(s.office_code ?? '');
  const schoolCode = String(s.school_code ?? '');
  const grade = Number(s.grade);
  const classNm = String(s.class_nm ?? '').trim();
  if (!/^[A-Z]\d{2}$/.test(officeCode) || !/^\d{7}$/.test(schoolCode)) return '학교를 검색해서 선택해 주세요.';
  if (!classNm || classNm.length > 10) return '반을 입력해 주세요.';

  const found = await findSchool(officeCode, schoolCode);
  if (!found) return '선택한 학교를 나이스에서 찾지 못했어요. 다시 검색해 주세요.';
  if (!Number.isInteger(grade) || grade < 1 || grade > maxGrade(found.school_kind)) return '학년을 다시 선택해 주세요.';
  return {
    office_code: officeCode,
    school_code: schoolCode,
    school_name: found.school_name,
    school_kind: found.school_kind,
    grade,
    // '03'처럼 입력해도 나이스 형식('3')에 맞춘다
    class_nm: /^\d+$/.test(classNm) ? String(Number(classNm)) : classNm,
  };
}

// 서버는 UTC로 돌기 때문에 '오늘'은 항상 한국 시간 기준으로 계산한다
export function kstDate(offsetDays = 0): string {
  const now = new Date(Date.now() + 9 * 3600000 + offsetDays * 86400000);
  return now.toISOString().slice(0, 10);
}

export async function getSchoolDays(school: SchoolInfo, from: string, to: string): Promise<SchoolDay[]> {
  const [events, timetable] = await Promise.all([getEvents(school, from, to), getTimetable(school, from, to)]);
  const days: SchoolDay[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    days.push(buildSchoolDay(date, events.filter((e) => e.date === date), timetable[date] ?? []));
  }
  return days;
}

export interface SchoolSummary {
  today: SchoolDay;
  tomorrow: SchoolDay;
  upcoming: SchoolEvent[]; // 앞으로 90일 안의 시험·체험학습 (방학은 vacation에)
  vacation: { name: string; start: string; end: string } | null; // 지금 진행 중이거나 다음 방학
}

export async function getSchoolSummary(school: SchoolInfo, today = kstDate()): Promise<SchoolSummary> {
  const tomorrow = addDays(today, 1);
  // 방학은 몇 달 뒤일 수 있어 7개월 앞까지 학사일정을 본다
  const [days, events] = await Promise.all([
    getSchoolDays(school, today, tomorrow),
    getEvents(school, addDays(today, -60), addDays(today, 210)),
  ]);
  const upcoming = events.filter(
    (e) => e.date >= today && e.date <= addDays(today, 90) && isImportant(e) && e.category !== 'vacation'
  );
  // 같은 이름의 연속 일정(예: 3일간의 기말고사)은 첫날만 보여준다
  const firstDays = upcoming.filter(
    (e, i) => !upcoming.slice(0, i).some((p) => p.name === e.name && addDays(p.date, 7) >= e.date)
  );
  const vacation = vacationRanges(events).find((r) => r.end >= today) ?? null;
  return { today: days[0], tomorrow: days[1], upcoming: firstDays, vacation };
}

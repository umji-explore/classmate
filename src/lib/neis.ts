// 나이스 교육정보 개방 포털(open.neis.go.kr) API — 학교 검색, 학사일정, 반별 시간표
// NEIS_API_KEY가 없으면 어떤 페이지를 요청해도 첫 5건만 오기 때문에 학교 검색에만 쓸 수 있다
import { connectToDatabase } from '@/lib/mongodb';
import SchoolCache from '@/models/SchoolCache';
import { addDays, classifyEvent, inferVacationDays, Period, SchoolEvent, SchoolInfo, SchoolSearchResult } from '@/lib/school';

const BASE = 'https://open.neis.go.kr/hub';
const TIMEOUT_MS = 10000;

export class NeisError extends Error {}

type Row = Record<string, string | null>;

async function neisFetch(service: string, params: Record<string, string>, maxRows = 1000): Promise<Row[]> {
  const key = process.env.NEIS_API_KEY;
  if (!key && service !== 'schoolInfo') {
    throw new NeisError('서버에 나이스 인증키(NEIS_API_KEY)가 아직 설정되지 않아 학사일정·시간표를 불러올 수 없어요.');
  }
  const pageSize = key ? 1000 : 5;
  const rows: Row[] = [];
  for (let page = 1; rows.length < maxRows; page++) {
    const query = new URLSearchParams({ Type: 'json', pIndex: String(page), pSize: String(pageSize), ...params });
    if (key) query.set('KEY', key);
    let data: Record<string, unknown>;
    try {
      const res = await fetch(`${BASE}/${service}?${query}`, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
      data = await res.json();
    } catch {
      throw new NeisError('나이스 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.');
    }
    // 데이터가 없으면 { RESULT: { CODE: 'INFO-200' } } 형태로 온다
    const result = (data.RESULT as { CODE?: string; MESSAGE?: string } | undefined);
    if (result) {
      if (result.CODE === 'INFO-200') break;
      throw new NeisError(`나이스 오류: ${result.MESSAGE ?? result.CODE}`);
    }
    const body = data[service] as [{ head: [{ list_total_count: number }] }, { row: Row[] }] | undefined;
    if (!body) throw new NeisError('나이스 응답 형식이 올바르지 않아요.');
    rows.push(...body[1].row);
    // 키가 없으면 다음 페이지도 같은 5건이 오므로 한 번만 받는다
    if (!key || rows.length >= body[0].head[0].list_total_count || body[1].row.length < pageSize) break;
  }
  return rows;
}

// ── 캐시 ────────────────────────────────────────────────────────
async function cached<T>(key: string, ttlMs: (data: T) => number, load: () => Promise<T>): Promise<T> {
  await connectToDatabase();
  const hit = await SchoolCache.findOne({ key, expires_at: { $gt: new Date() } }).lean();
  if (hit) return hit.data as T;
  const data = await load();
  await SchoolCache.updateOne(
    { key },
    { $set: { data, expires_at: new Date(Date.now() + ttlMs(data)) } },
    { upsert: true }
  );
  return data;
}

const HOUR = 3600000;
const ymd = (iso: string) => iso.replaceAll('-', '');
const iso = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;

// YYYY-MM 달의 첫날·마지막 날
function monthRange(month: string): [string, string] {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [`${month}-01`, `${month}-${String(last).padStart(2, '0')}`];
}

// from~to 사이에 걸친 달 목록 (YYYY-MM)
export function monthsBetween(from: string, to: string): string[] {
  const months: string[] = [];
  let [y, m] = from.slice(0, 7).split('-').map(Number);
  const end = to.slice(0, 7);
  while (true) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    months.push(key);
    if (key >= end) break;
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

// ── 학교 검색 ───────────────────────────────────────────────────
const toSearchResult = (r: Row): SchoolSearchResult => ({
  office_code: r.ATPT_OFCDC_SC_CODE ?? '',
  school_code: r.SD_SCHUL_CODE ?? '',
  school_name: r.SCHUL_NM ?? '',
  school_kind: r.SCHUL_KND_SC_NM ?? '',
  address: (r.ORG_RDNMA ?? '').trim(),
});

export async function searchSchools(name: string): Promise<SchoolSearchResult[]> {
  const rows = await neisFetch('schoolInfo', { SCHUL_NM: name }, 20);
  return rows.slice(0, 20).map(toSearchResult);
}

export async function findSchool(officeCode: string, schoolCode: string): Promise<SchoolSearchResult | null> {
  const rows = await neisFetch('schoolInfo', { ATPT_OFCDC_SC_CODE: officeCode, SD_SCHUL_CODE: schoolCode }, 1);
  return rows[0] ? toSearchResult(rows[0]) : null;
}

// ── 학사일정 ────────────────────────────────────────────────────
const GRADE_FLAGS = ['ONE', 'TW', 'THREE', 'FR', 'FIV', 'SIX'].map((n) => `${n}_GRADE_EVENT_YN`);

// 한 달 치 학사일정 (모든 학년 행사 포함, 학년 필터는 getEvents에서)
async function scheduleMonth(school: SchoolInfo, month: string) {
  const [from, to] = monthRange(month);
  return cached(
    `sched:${school.office_code}:${school.school_code}:${month}`,
    () => 12 * HOUR,
    async () => {
      const rows = await neisFetch('SchoolSchedule', {
        ATPT_OFCDC_SC_CODE: school.office_code,
        SD_SCHUL_CODE: school.school_code,
        AA_FROM_YMD: ymd(from),
        AA_TO_YMD: ymd(to),
      });
      return rows.map((r) => ({
        date: iso(r.AA_YMD ?? ''),
        name: (r.EVENT_NM ?? '').trim(),
        detail: (r.EVENT_CNTNT ?? '').trim(),
        type: r.SBTR_DD_SC_NM ?? '',
        grades: GRADE_FLAGS.map((f) => r[f] ?? '*'),
      }));
    }
  );
}

// 방학식이 범위보다 몇 달 앞에 있을 수 있어 앞뒤로 넉넉히 받아 방학을 계산한다
const VACATION_PAD_DAYS = 100;

export async function getEvents(school: SchoolInfo, from: string, to: string): Promise<SchoolEvent[]> {
  const padFrom = addDays(from, -VACATION_PAD_DAYS);
  const padTo = addDays(to, VACATION_PAD_DAYS);
  const months = await Promise.all(monthsBetween(padFrom, padTo).map((m) => scheduleMonth(school, m)));
  const events: SchoolEvent[] = [];
  const seen = new Set<string>();
  for (const r of months.flat()) {
    if (!r.name || r.name === '토요휴업일') continue;
    // 내 학년이 'N'으로 표시된 행사는 제외 (전 학년 공통·공휴일은 '*' 또는 'Y')
    if (r.grades[school.grade - 1] === 'N') continue;
    const dedupe = `${r.date}|${r.name}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    events.push({ date: r.date, name: r.name, detail: r.detail, ...classifyEvent(r.name, r.type) });
  }
  return [...events, ...inferVacationDays(events)]
    .filter((e) => e.date >= from && e.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── 반별 시간표 ─────────────────────────────────────────────────
function timetableService(kind: string) {
  if (kind.includes('초등')) return 'elsTimetable';
  if (kind.includes('중학')) return 'misTimetable';
  if (kind.includes('특수')) return 'spsTimetable';
  return 'hisTimetable';
}

async function timetableMonth(school: SchoolInfo, month: string) {
  const [from, to] = monthRange(month);
  return cached<Record<string, Period[]>>(
    `tt:${school.office_code}:${school.school_code}:${school.grade}:${school.class_nm}:${month}`,
    // 시간표는 학교가 주마다 올리므로, 아직 비어 있는 달은 금방 다시 확인한다
    (data) => (Object.keys(data).length ? 6 * HOUR : HOUR),
    async () => {
      const rows = await neisFetch(timetableService(school.school_kind), {
        ATPT_OFCDC_SC_CODE: school.office_code,
        SD_SCHUL_CODE: school.school_code,
        GRADE: String(school.grade),
        CLASS_NM: school.class_nm,
        TI_FROM_YMD: ymd(from),
        TI_TO_YMD: ymd(to),
      }, 2000);
      const byDate: Record<string, Period[]> = {};
      for (const r of rows) {
        const date = iso(r.ALL_TI_YMD ?? '');
        const period = Number(r.PERIO);
        const subject = (r.ITRT_CNTNT ?? '').replace(/^-/, '').trim();
        if (!period || !subject) continue;
        const list = (byDate[date] ??= []);
        if (!list.some((p) => p.period === period)) list.push({ period, subject });
      }
      return byDate;
    }
  );
}

export async function getTimetable(school: SchoolInfo, from: string, to: string): Promise<Record<string, Period[]>> {
  const months = await Promise.all(monthsBetween(from, to).map((m) => timetableMonth(school, m)));
  const result: Record<string, Period[]> = {};
  for (const month of months) {
    for (const [date, periods] of Object.entries(month)) {
      if (date >= from && date <= to) result[date] = periods.sort((a, b) => a.period - b.period);
    }
  }
  return result;
}

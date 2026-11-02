// 학생용 알림 문구 만들기 (서버 전용)
import type { PushMessage } from '@/lib/push';
import { CATEGORY_LABEL, isImportant, outfitLabel, periodsLine, SchoolDay, SchoolInfo } from '@/lib/school';
import { addDays, getSchoolDays, kstDate } from '@/lib/school-server';
import { getEvents } from '@/lib/neis';

const dayLabel = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${'일월화수목금토'[d.getUTCDay()]})`;
};

// 하루 안내: 시간표·체육복·준비물·행사 (쉬는 날이면 이유만, 평범한 주말은 null)
export function dayBriefing(day: SchoolDay, when: '오늘' | '내일', schoolKind: string): PushMessage | null {
  const eventNames = day.events.map((e) => e.name);
  if (day.day_off) {
    if (!eventNames.length) return null;
    return {
      title: `${when}은 쉬는 날이에요 🌿`,
      body: `${dayLabel(day.date)} ${eventNames.join(', ')}`,
      url: '/?page=school',
      tag: `day-${day.date}`,
    };
  }
  const lines: string[] = [];
  if (eventNames.length) lines.push(`📌 ${eventNames.join(', ')}`);
  if (day.periods.length) lines.push(periodsLine(day.periods));
  else lines.push('시간표가 아직 나이스에 올라오지 않았어요.');
  const items = day.items.filter((i) => i !== '체육복');
  if (items.length) lines.push(`챙길 것: ${items.join(', ')}`);
  return {
    title: `${when} ${dayLabel(day.date)} · ${outfitLabel(day.pe, schoolKind)}`,
    body: lines.join('\n'),
    url: '/?page=school',
    tag: `day-${day.date}`,
  };
}

// 저녁 알림: 내일 안내 + 3일 뒤 중요 일정(시험·체험학습·방학 시작) 미리 알림
export async function eveningMessages(school: SchoolInfo, today = kstDate()): Promise<PushMessage[]> {
  const messages: PushMessage[] = [];
  const [tomorrow] = await getSchoolDays(school, addDays(today, 1), addDays(today, 1));
  const briefing = dayBriefing(tomorrow, '내일', school.school_kind);
  if (briefing) messages.push(briefing);

  const target = addDays(today, 3);
  // 하루 전 일정과 이름이 같으면(여러 날 이어지는 시험·방학) 첫날만 알린다
  const events = await getEvents(school, addDays(target, -1), target);
  for (const e of events.filter((e) => e.date === target && isImportant(e))) {
    if (events.some((p) => p.date < target && p.name === e.name)) continue;
    messages.push({
      title: `D-3 ${CATEGORY_LABEL[e.category]}: ${e.name}`,
      body: `${dayLabel(e.date)}에 ${e.name}${e.category === 'vacation' ? '이 시작돼요. 🎉' : '이 있어요. 미리 준비해요!'}`,
      url: '/?page=school',
      tag: `important-${e.date}-${e.name}`,
    });
  }
  return messages;
}

// 아침 알림: 오늘 안내
export async function morningMessages(school: SchoolInfo, today = kstDate()): Promise<PushMessage[]> {
  const [day] = await getSchoolDays(school, today, today);
  const briefing = dayBriefing(day, '오늘', school.school_kind);
  return briefing ? [briefing] : [];
}

// 날짜는 모두 사용자 기기의 "현지 시간" 기준 YYYY-MM-DD 문자열로 다룬다.
// (toISOString()은 UTC 기준이라 한국 시간 오전 9시 이전에는 하루 전 날짜가 나온다)

export const toLocalISO = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const getTodayISO = (): string => toLocalISO(new Date());

export const offsetDate = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toLocalISO(d);
};

export const fmtDate = (iso: string, opts?: Intl.DateTimeFormatOptions) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('ko-KR', opts ?? { month: 'short', day: 'numeric' });

export const dayDiff = (iso: string) =>
  Math.round(
    (new Date(iso + 'T12:00:00').getTime() - new Date(getTodayISO() + 'T12:00:00').getTime()) / 86400000
  );

// 꾸미기 설정 (색 테마·화면 모드·달력 배경) — 서버(입력값 검사)와 브라우저(화면 적용)에서 함께 사용

export const THEMES = [
  { id: 'default', label: '기본 블루', color: '#536dfe' },
  { id: 'lavender', label: '라벤더', color: '#8b6cf0' },
  { id: 'mint', label: '민트', color: '#1fa79a' },
  { id: 'peach', label: '피치', color: '#f07a5a' },
  { id: 'forest', label: '포레스트', color: '#3f9a5b' },
  { id: 'cherry', label: '체리', color: '#e0567f' },
] as const;

export const MODES = [
  { id: 'light', label: '라이트' },
  { id: 'dark', label: '다크' },
  { id: 'system', label: '기기 설정 따르기' },
] as const;

// 준비된 달력 배경 (CSS background 값)
export const CAL_BACKGROUNDS = [
  { id: 'none', label: '기본', css: '' },
  { id: 'sky', label: '하늘', css: 'linear-gradient(160deg, #cfe3ff 0%, #e9e4ff 55%, #fde7f1 100%)' },
  { id: 'sunset', label: '노을', css: 'linear-gradient(160deg, #ffd8b5 0%, #ffc1cc 50%, #d9c8ff 100%)' },
  { id: 'meadow', label: '초원', css: 'linear-gradient(160deg, #d6f5e3 0%, #e4f7c9 55%, #fff3c4 100%)' },
  { id: 'dots', label: '도트', css: 'radial-gradient(#c6cdf5 1.5px, transparent 1.6px) 0 0 / 16px 16px, #f3f5ff' },
  { id: 'check', label: '체크', css: 'repeating-conic-gradient(#fde6d8 0 25%, #fff6ef 0 50%) 0 0 / 28px 28px' },
  {
    id: 'night',
    label: '밤하늘',
    css:
      'radial-gradient(#ffffffcc 1px, transparent 1.4px) 0 0 / 46px 46px, ' +
      'radial-gradient(#ffffff88 1px, transparent 1.4px) 23px 17px / 46px 46px, ' +
      'linear-gradient(160deg, #1d2552 0%, #3b2f6e 60%, #5a3d7a 100%)',
  },
] as const;

export type ThemeId = (typeof THEMES)[number]['id'];
export type ModeId = (typeof MODES)[number]['id'];
// 'color' = 직접 고른 색, 'image' = 올린 사진
export type CalendarBg = (typeof CAL_BACKGROUNDS)[number]['id'] | 'color' | 'image';

export interface Preferences {
  theme: ThemeId;
  mode: ModeId;
  calendar_bg: CalendarBg;
  calendar_bg_color: string; // #rrggbb
  calendar_bg_image_version: number | null; // 사진을 올린 시각 (없으면 null, 주소 캐시 갱신용)
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'default',
  mode: 'light',
  calendar_bg: 'none',
  calendar_bg_color: '#e8ecff',
  calendar_bg_image_version: null,
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const isOneOf = <T extends string>(list: readonly { id: T }[], v: unknown): v is T =>
  list.some((item) => item.id === v);

export const isThemeId = (v: unknown): v is ThemeId => isOneOf(THEMES, v);
export const isModeId = (v: unknown): v is ModeId => isOneOf(MODES, v);
export const isCalendarBg = (v: unknown): v is CalendarBg =>
  v === 'color' || v === 'image' || isOneOf(CAL_BACKGROUNDS, v);
export const isHexColor = (v: unknown): v is string => typeof v === 'string' && HEX_COLOR.test(v);

// DB에 저장된 값이 비어 있거나 잘못되어도 항상 올바른 설정을 돌려준다
export function normalizePreferences(raw: unknown): Preferences {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const version = typeof p.calendar_bg_image_version === 'number' ? p.calendar_bg_image_version : null;
  let calendarBg = isCalendarBg(p.calendar_bg) ? p.calendar_bg : DEFAULT_PREFERENCES.calendar_bg;
  if (calendarBg === 'image' && version === null) calendarBg = 'none';
  return {
    theme: isThemeId(p.theme) ? p.theme : DEFAULT_PREFERENCES.theme,
    mode: isModeId(p.mode) ? p.mode : DEFAULT_PREFERENCES.mode,
    calendar_bg: calendarBg,
    calendar_bg_color: isHexColor(p.calendar_bg_color) ? p.calendar_bg_color.toLowerCase() : DEFAULT_PREFERENCES.calendar_bg_color,
    calendar_bg_image_version: version,
  };
}

// 달력에 칠할 CSS background 값 (기본 배경이면 빈 문자열)
export function calendarBackgroundCss(p: Preferences): string {
  if (p.calendar_bg === 'color') return p.calendar_bg_color;
  if (p.calendar_bg === 'image') {
    return p.calendar_bg_image_version
      ? `center / cover no-repeat url("/api/preferences/background?v=${p.calendar_bg_image_version}")`
      : '';
  }
  return CAL_BACKGROUNDS.find((b) => b.id === p.calendar_bg)?.css ?? '';
}

// ── 브라우저: <html>에 테마·모드 적용 ─────────────────────────────
export const APPEARANCE_STORAGE_KEY = 'classmate:appearance';

export const resolveMode = (mode: ModeId): 'light' | 'dark' =>
  mode === 'system'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    : mode;

export function applyAppearance(theme: ThemeId, mode: ModeId) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.mode = resolveMode(mode);
  try {
    // 다음 접속 때 로그인 확인 전에도 같은 분위기로 보이도록 기억해 둔다
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify({ theme, mode }));
  } catch {
    // 저장소를 쓸 수 없는 환경이면 무시
  }
}

// 페이지가 그려지기 전에 <head>에서 실행하는 스크립트 (화면 깜빡임 방지)
export const APPEARANCE_BOOT_SCRIPT = `(function(){try{var a=JSON.parse(localStorage.getItem('${APPEARANCE_STORAGE_KEY}')||'{}');var r=document.documentElement;r.dataset.theme=a.theme||'default';var m=a.mode||'light';if(m==='system')m=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';r.dataset.mode=m;}catch(e){}})();`;

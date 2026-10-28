'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Palette, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/client';
import {
  CAL_BACKGROUNDS, MODES, THEMES, CalendarBg, Preferences, calendarBackgroundCss,
} from '@/lib/appearance';

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_SIDE = 1600;

// 올린 사진을 긴 변 1600px 이하 JPEG로 줄인다 (서버 저장 용량·로딩 속도 절약)
async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.82, 0.65, 0.5]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
    if (blob && blob.size <= MAX_UPLOAD_BYTES) return blob;
  }
  throw new Error('too large');
}

const errorMessage = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

export default function AppearanceSettings({
  preferences, onChange, showToast, onOpenCalendar,
}: {
  preferences: Preferences;
  onChange: (preferences: Preferences) => void;
  showToast: (msg: string) => void;
  onOpenCalendar: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const colorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => () => {
    if (colorTimer.current) clearTimeout(colorTimer.current);
  }, []);

  // 화면에 먼저 반영하고(낙관적 업데이트) 저장에 실패하면 원래대로 되돌린다
  const save = async (patch: Partial<Preferences>) => {
    const before = preferences;
    onChange({ ...preferences, ...patch });
    try {
      const res = await api<{ preferences: Preferences }>('/api/preferences', { method: 'PUT', body: patch });
      onChange(res.preferences);
    } catch (e) {
      onChange(before);
      showToast(errorMessage(e, '꾸미기 설정을 저장하지 못했습니다.'));
    }
  };

  const selectBackground = (calendar_bg: CalendarBg) => {
    if (calendar_bg === preferences.calendar_bg) return;
    save({ calendar_bg });
  };

  // 색을 고르는 동안에는 화면만 바꾸고, 손을 뗀 뒤 0.5초 후에 한 번만 저장
  const pickColor = (calendar_bg_color: string) => {
    onChange({ ...preferences, calendar_bg: 'color', calendar_bg_color });
    if (colorTimer.current) clearTimeout(colorTimer.current);
    colorTimer.current = setTimeout(() => {
      api('/api/preferences', { method: 'PUT', body: { calendar_bg: 'color', calendar_bg_color } })
        .catch((e) => showToast(errorMessage(e, '색상을 저장하지 못했습니다.')));
    }, 500);
  };

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith('image/')) return showToast('사진 파일만 올릴 수 있어요.');
    setUploading(true);
    try {
      let blob: Blob;
      try {
        blob = await shrinkImage(file);
      } catch {
        return showToast('이 사진은 사용할 수 없어요. JPG나 PNG 사진으로 다시 시도해 주세요.');
      }
      const res = await api<{ preferences: Preferences }>('/api/preferences/background', { method: 'PUT', body: blob });
      onChange(res.preferences);
      showToast('달력 배경 사진을 적용했어요.');
    } catch (e) {
      showToast(errorMessage(e, '사진을 올리지 못했습니다.'));
    } finally {
      setUploading(false);
    }
  };

  const removeImage = async () => {
    if (!confirm('올린 배경 사진을 지울까요?')) return;
    try {
      const res = await api<{ preferences: Preferences }>('/api/preferences/background', { method: 'DELETE' });
      onChange(res.preferences);
      showToast('배경 사진을 지웠어요.');
    } catch (e) {
      showToast(errorMessage(e, '사진을 지우지 못했습니다.'));
    }
  };

  const hasImage = preferences.calendar_bg_image_version !== null;
  const imageCss = calendarBackgroundCss({ ...preferences, calendar_bg: 'image' });

  return (
    <div className="card card-body settings-wide">
      <div className="card-header">
        <div>
          <h3>꾸미기</h3>
          <p>앱의 분위기와 달력 배경을 바꿔요. 내 계정에 저장되어 다른 기기에서도 같이 적용돼요.</p>
        </div>
        <button className="text-btn" onClick={onOpenCalendar}>달력에서 보기 →</button>
      </div>

      <div className="deco-section">
        <strong className="deco-title">앱 분위기</strong>
        <p className="deco-sub">버튼·강조 색과 사이드바 색이 함께 바뀌어요.</p>
        <div className="deco-options">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className="deco-chip"
              aria-pressed={preferences.theme === t.id}
              onClick={() => preferences.theme !== t.id && save({ theme: t.id })}
            >
              <span className="theme-dot" style={{ background: t.color }} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="deco-section">
        <strong className="deco-title">화면 모드</strong>
        <p className="deco-sub">다크 모드는 밤에 눈이 덜 부셔요.</p>
        <div className="deco-options">
          {MODES.map((m) => (
            <button
              key={m.id}
              className="deco-chip"
              aria-pressed={preferences.mode === m.id}
              onClick={() => preferences.mode !== m.id && save({ mode: m.id })}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="deco-section">
        <strong className="deco-title">달력 배경</strong>
        <p className="deco-sub">준비된 배경, 직접 고른 색, 내 사진 중에서 골라요.</p>
        <div className="bg-options">
          {CAL_BACKGROUNDS.map((b) => (
            <button
              key={b.id}
              className="bg-tile"
              aria-pressed={preferences.calendar_bg === b.id}
              onClick={() => selectBackground(b.id)}
            >
              <span className="bg-swatch" style={b.css ? { background: b.css } : undefined} />
              {b.label}
            </button>
          ))}

          {/* 직접 고른 색: 칸을 누르면 (label이 안의 input을 눌러) 색 선택 창이 열린다 */}
          <label className={`bg-tile ${preferences.calendar_bg === 'color' ? 'active' : ''}`}>
            <span className="bg-swatch" style={{ background: preferences.calendar_bg_color }}>
              <Palette size={16} />
              <input
                type="color"
                value={preferences.calendar_bg_color}
                onClick={() => selectBackground('color')}
                onChange={(e) => pickColor(e.target.value)}
                aria-label="달력 배경 색 고르기"
              />
            </span>
            원하는 색
          </label>

          {/* 내 사진: 올린 사진이 없으면 사진 고르기 창을 연다 */}
          <button
            className="bg-tile"
            aria-pressed={preferences.calendar_bg === 'image'}
            onClick={() => (hasImage ? selectBackground('image') : fileRef.current?.click())}
            disabled={uploading}
          >
            <span className="bg-swatch" style={hasImage ? { background: imageCss } : undefined}>
              {!hasImage && <ImagePlus size={18} />}
            </span>
            {uploading ? '올리는 중…' : '내 사진'}
          </button>
        </div>

        <div className="bg-actions">
          <button className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <ImagePlus size={14} /> {hasImage ? '사진 바꾸기' : '사진 올리기'}
          </button>
          {hasImage && (
            <button className="btn-secondary danger-btn" onClick={removeImage} disabled={uploading}>
              <Trash2 size={14} /> 사진 지우기
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ''; // 같은 사진을 다시 골라도 올라가도록
            if (file) uploadImage(file);
          }}
        />
      </div>
    </div>
  );
}

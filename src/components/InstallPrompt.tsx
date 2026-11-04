'use client';

import { useEffect, useState } from 'react';
import { Share, SquarePlus, X } from 'lucide-react';

// 홈 화면에 ClassMate를 앱처럼 설치하도록 안내하는 카드
// - 아이폰/아이패드 사파리: '공유 → 홈 화면에 추가' 방법 안내
// - 카카오톡 등 앱 안의 브라우저: 홈 화면 추가가 안 되므로 사파리(외부 브라우저)로 열도록 안내
// - 안드로이드 크롬 등: 브라우저의 설치 창을 바로 띄우는 버튼

export const SHOW_INSTALL_EVENT = 'classmate:show-install'; // 설정 화면 등에서 안내를 다시 열 때
const DISMISS_KEY = 'classmate_install_dismissed_at';
const DISMISS_DAYS = 7;

type Platform = 'ios' | 'ios-inapp' | 'android-inapp' | 'installable' | null;

// 크롬의 설치 이벤트 (표준 타입에 아직 없음)
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1); // 아이패드 (데스크톱 모드)

const isInAppBrowser = () => /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\/|everytimeApp|DaumApps/i.test(navigator.userAgent);
const isKakaoTalk = () => /KAKAOTALK/i.test(navigator.userAgent);

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return !!at && Date.now() - at < DISMISS_DAYS * 86400000;
  } catch {
    return false;
  }
}

export default function InstallPrompt() {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>(null);
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // 서비스 워커를 미리 등록해 두면 안드로이드에서 '앱 설치'가 가능해지고 알림 켜기도 빨라진다
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

    if (isStandalone()) return; // 이미 홈 화면 앱으로 실행 중

    const ios = isIOS();
    const inApp = isInAppBrowser();
    const detected: Platform = inApp ? (ios ? 'ios-inapp' : 'android-inapp') : ios ? 'ios' : null;

    // 렌더 중이 아니라 이벤트 콜백에서 상태를 바꾸도록 한 번 미뤄서 처리
    const timer = window.setTimeout(() => {
      if (detected) {
        setPlatform(detected);
        if (!recentlyDismissed()) setOpen(true);
      }
    }, 0);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault(); // 크롬 기본 미니 배너 대신 우리 카드로 안내
      setInstallEvent(e as BeforeInstallPromptEvent);
      setPlatform('installable');
      if (!recentlyDismissed()) setOpen(true);
    };
    const onInstalled = () => setOpen(false);
    const onShow = () => {
      setPlatform((p) => p ?? (isIOS() ? 'ios' : null));
      setOpen(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener(SHOW_INSTALL_EVENT, onShow);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener(SHOW_INSTALL_EVENT, onShow);
    };
  }, []);

  if (!open) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // 저장이 안 되면 이번에만 닫힘
    }
    setOpen(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    setInstallEvent(null);
    if (outcome === 'accepted') setOpen(false);
  };

  const openInExternalBrowser = () => {
    // 카카오톡은 이 주소로 외부 브라우저(사파리/크롬)에서 열 수 있다
    window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(window.location.href)}`;
  };

  return (
    <div className="install-card" role="dialog" aria-label="ClassMate 앱 설치 안내">
      <button className="install-close" onClick={dismiss} aria-label="닫기">
        <X size={16} />
      </button>
      <div className="install-head">
        {/* 작은 아이콘 하나라 이미지 최적화(next/image) 없이 그대로 표시 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/apple-touch-icon.png" alt="" width={40} height={40} />
        <div>
          <strong>ClassMate를 앱으로 설치하세요</strong>
          <p>홈 화면에서 바로 열고, 전체 화면과 알림까지 쓸 수 있어요.</p>
        </div>
      </div>

      {platform === 'ios' && (
        <ol className="install-steps">
          <li>
            사파리 화면 아래(또는 위)의 <b>공유 버튼</b> <Share size={14} aria-label="공유" /> 을 눌러요.
            <span className="install-hint">버튼이 안 보이면 ⋯ 버튼을 먼저 눌러 주세요.</span>
          </li>
          <li>
            목록을 내려서 <b>홈 화면에 추가</b> <SquarePlus size={14} aria-label="홈 화면에 추가" /> 를 눌러요.
          </li>
          <li>오른쪽 위 <b>추가</b>를 누르면 홈 화면에 ClassMate 아이콘이 생겨요.</li>
        </ol>
      )}

      {(platform === 'ios-inapp' || platform === 'android-inapp') && (
        <>
          <p className="install-text">
            지금은 앱 안의 브라우저(카카오톡 등)로 열려 있어서 설치할 수 없어요.{' '}
            {platform === 'ios-inapp' ? <b>사파리</b> : <b>크롬</b>}로 열어서 설치해 주세요.
          </p>
          {isKakaoTalk() ? (
            <button className="btn-primary install-btn" onClick={openInExternalBrowser}>
              {platform === 'ios-inapp' ? '사파리로 열기' : '크롬으로 열기'}
            </button>
          ) : (
            <p className="install-hint">오른쪽 위(또는 아래) ⋯ 메뉴에서 &apos;다른 브라우저로 열기&apos;를 눌러 주세요.</p>
          )}
        </>
      )}

      {platform === 'installable' && (
        <button className="btn-primary install-btn" onClick={install}>
          앱 설치하기
        </button>
      )}

      {platform === null && (
        <p className="install-text">
          휴대폰 브라우저(아이폰은 사파리, 안드로이드는 크롬)에서 이 주소를 열면 홈 화면에 설치할 수 있어요.
        </p>
      )}
    </div>
  );
}

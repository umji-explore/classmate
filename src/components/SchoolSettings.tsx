'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, Send } from 'lucide-react';
import { api, ApiError, User } from '@/lib/client';
import type { AccountType } from '@/lib/school';
import { currentSubscription, disablePush, enablePush, pushSupport, PushSupport } from '@/lib/push-client';
import SchoolPicker, { draftFromSchool, draftToPayload, SchoolDraft } from '@/components/SchoolPicker';

const errorMessage = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

// 설정 > 계정 유형·학교 정보·학교 알림
export default function SchoolSettings({
  user, onUserChange, showToast,
}: {
  user: User;
  onUserChange: (user: User) => void;
  showToast: (msg: string) => void;
}) {
  const [accountType, setAccountType] = useState<AccountType>(user.account_type);
  const [draft, setDraft] = useState<SchoolDraft>(() => draftFromSchool(user.school));
  const [saving, setSaving] = useState(false);

  const [support, setSupport] = useState<PushSupport | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    // 브라우저 기능 확인은 화면이 뜬 뒤에만 할 수 있다
    const s = pushSupport();
    currentSubscription().then((sub) => {
      setSupport(s);
      setSubscribed(!!sub);
    });
  }, []);

  const changed =
    accountType !== user.account_type ||
    (accountType === 'student' &&
      JSON.stringify(draftToPayload(draft)) !== JSON.stringify(draftToPayload(draftFromSchool(user.school))));

  const save = async () => {
    const school = draftToPayload(draft);
    if (accountType === 'student' && (!school || !school.class_nm)) {
      return showToast('학교를 검색해서 고르고 반을 입력해 주세요.');
    }
    setSaving(true);
    try {
      const res = await api<{ user: User }>('/api/school', {
        method: 'PUT',
        body: { account_type: accountType, school: accountType === 'student' ? school : null },
      });
      onUserChange(res.user);
      setDraft(draftFromSchool(res.user.school));
      showToast(res.user.account_type === 'student' ? '학교 정보를 저장했어요.' : '개인용 계정으로 바꿨어요.');
    } catch (e) {
      showToast(errorMessage(e, '학교 정보를 저장하지 못했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (subscribed) {
        await disablePush();
        setSubscribed(false);
        showToast('이 기기의 알림을 껐어요.');
      } else {
        await enablePush();
        setSubscribed(true);
        showToast('이 기기에서 학교 알림을 받아요. 🔔');
      }
    } catch (e) {
      showToast(errorMessage(e, '알림 설정을 바꾸지 못했습니다.'));
    } finally {
      setPushBusy(false);
    }
  };

  const sendTest = async () => {
    setPushBusy(true);
    try {
      await api('/api/push/test', { method: 'POST' });
      showToast('알림을 보냈어요. 잠시 후 도착해요.');
    } catch (e) {
      showToast(errorMessage(e, '테스트 알림을 보내지 못했습니다.'));
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <div className="card card-body settings-wide">
      <div className="card-header">
        <div>
          <h3>계정 유형 · 학교</h3>
          <p>학생용은 나이스(교육정보 개방 포털)에서 우리 반 시간표와 학사일정을 받아와요.</p>
        </div>
        <span className={`tag ${user.account_type === 'student' ? 'blue' : 'green'}`}>
          {user.account_type === 'student' ? '학생용' : '개인용'}
        </span>
      </div>

      <div className="account-type" role="radiogroup" aria-label="계정 유형">
        {([
          ['personal', '개인용', '과제·일정을 직접 관리해요'],
          ['student', '학생용', '학교 시간표·학사일정·준비물을 알려줘요'],
        ] as const).map(([type, label, desc]) => (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={accountType === type}
            className="account-type-btn"
            onClick={() => setAccountType(type)}
          >
            <strong>{label}</strong>
            <span>{desc}</span>
          </button>
        ))}
      </div>

      {accountType === 'student' && (
        <div style={{ marginTop: 14 }}>
          <SchoolPicker value={draft} onChange={setDraft} />
        </div>
      )}

      {changed && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button
            className="btn-secondary"
            onClick={() => {
              setAccountType(user.account_type);
              setDraft(draftFromSchool(user.school));
            }}
          >
            취소
          </button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? '저장 중…' : '저장하기'}</button>
        </div>
      )}

      {user.account_type === 'student' && (
        <div className="deco-section" style={{ marginTop: 20 }}>
          <strong className="deco-title">학교 알림</strong>
          <p className="deco-sub">
            전날 저녁 8시에 내일 시간표·준비물·체육복, 아침 7시에 오늘 안내, 시험·체험학습·방학 3일 전에 미리 알려 줘요.
            알림은 기기마다 따로 켜야 해요.
          </p>
          {support === 'ios-install' ? (
            <p className="push-hint">
              아이폰·아이패드는 사파리에서 <b>공유 버튼 → 홈 화면에 추가</b>를 한 뒤, 홈 화면의 ClassMate 앱을 열어 알림을 켜 주세요.
            </p>
          ) : support === 'unsupported' ? (
            <p className="push-hint">이 브라우저는 푸시 알림을 지원하지 않아요. 크롬·엣지·사파리 최신 버전에서 열어 주세요.</p>
          ) : (
            <div className="bg-actions">
              <button className={subscribed ? 'btn-secondary' : 'btn-primary'} onClick={togglePush} disabled={pushBusy || support === null}>
                {subscribed ? <BellOff size={14} /> : <Bell size={14} />}
                {subscribed ? '이 기기 알림 끄기' : '이 기기에서 알림 받기'}
              </button>
              {subscribed && (
                <button className="btn-secondary" onClick={sendTest} disabled={pushBusy}>
                  <Send size={14} /> 내일 안내 미리 받아 보기
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

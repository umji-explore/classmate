'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, Bell, BellOff, Copy, Crown, LogIn, Pencil, Pin, Plus, RefreshCw, Share2, Trash2, UserMinus, Users,
} from 'lucide-react';
import { api, ApiError } from '@/lib/client';
import { currentSubscription, disablePush, enablePush, pushSupport, PushSupport } from '@/lib/push-client';
import {
  AnnouncementItem, CLASS_DESC_MAX, CLASS_NAME_MAX, ClassDetail, ClassSummary, NOTICE_BODY_MAX, NOTICE_TITLE_MAX,
} from '@/lib/classes';

const errorMessage = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' });
};

interface ClassPageProps {
  showToast: (msg: string) => void;
  initialClassId?: string | null; // 공지 알림을 눌러 들어온 경우 바로 그 클래스를 연다
  onUnreadChange?: (count: number) => void; // 메뉴에 새 공지 표시
}

// ─── 공동체용 클래스: 클래스장이 만들고 참여 코드로 학생들이 들어와 공지를 함께 본다 ───
export default function ClassPage({ showToast, initialClassId, onUnreadChange }: ClassPageProps) {
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [listKey, setListKey] = useState(0);
  const [openId, setOpenId] = useState<string | null>(initialClassId ?? null);

  useEffect(() => {
    let cancelled = false;
    api<{ classes: ClassSummary[] }>('/api/classes')
      .then(({ classes }) => {
        if (cancelled) return;
        setClasses(classes);
        setListError(null);
        onUnreadChange?.(classes.reduce((n, c) => n + c.unread, 0));
      })
      .catch((e) => !cancelled && setListError(errorMessage(e, '클래스 목록을 불러오지 못했어요.')));
    return () => { cancelled = true; };
  }, [listKey, onUnreadChange]);

  const reloadList = () => setListKey((k) => k + 1);
  const openClass = (id: string) => {
    setOpenId(id);
    window.scrollTo({ top: 0 });
  };
  const closeClass = () => {
    setOpenId(null);
    reloadList();
  };

  if (openId) {
    return <ClassDetailView key={openId} classId={openId} showToast={showToast} onBack={closeClass} />;
  }

  // 참여·만들기 카드와 알림 켜기
  const actions = (
    <>
      <div className="class-actions">
        <JoinCard
          onJoined={(c, already) => {
            showToast(already ? `이미 참여 중인 클래스예요: ${c.name}` : `'${c.name}' 클래스에 참여했어요.`);
            openClass(c.id);
          }}
        />
        <CreateCard
          onCreated={(c) => {
            showToast(`'${c.name}' 클래스를 만들었어요. 참여 코드를 학생들에게 알려 주세요.`);
            openClass(c.id);
          }}
        />
      </div>
      <PushCard showToast={showToast} />
    </>
  );

  // 내 클래스 목록
  const list = (
    <>
      <h3 className="class-section-title">내 클래스</h3>
      {listError ? (
        <div className="card card-body" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--muted)', marginBottom: 12 }}>{listError}</p>
          <button className="btn-primary" onClick={reloadList}>다시 시도</button>
        </div>
      ) : classes === null ? (
        <div className="spinner" aria-label="로딩 중" />
      ) : classes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏫</div>
          아직 참여한 클래스가 없어요.<br />
          선생님께 받은 <b>참여 코드</b>를 입력하거나, 직접 클래스를 만들어 보세요.
        </div>
      ) : (
        <div className="class-grid">
          {classes.map((c) => (
            <button key={c.id} className="class-card" onClick={() => openClass(c.id)}>
              <div className="class-card-top">
                <strong>{c.name}</strong>
                {c.unread > 0 && <span className="class-unread">새 공지 {c.unread}</span>}
              </div>
              <div className="class-card-meta">
                <span className={`tag ${c.role === 'owner' ? 'purple' : 'blue'}`}>{c.role === 'owner' ? '클래스장' : '참여 중'}</span>
                <span><Users size={12} /> {c.member_count}명</span>
                {c.role === 'member' && <span>클래스장 {c.owner_name}</span>}
                {c.code && <span className="class-code-mini">코드 {c.code}</span>}
              </div>
              <p className="class-card-latest">
                {c.latest ? (
                  <>📢 {c.latest.title} <span>· {fmtWhen(c.latest.created_at)}</span></>
                ) : (
                  <span>아직 공지가 없어요.</span>
                )}
              </p>
            </button>
          ))}
        </div>
      )}
    </>
  );

  // 참여한 클래스가 있으면 목록을 먼저, 처음 쓰는 사람에게는 참여·만들기를 먼저 보여준다
  const hasClasses = !!classes && classes.length > 0;

  return (
    <section className="page-section">
      <div className="welcome-row">
        <div>
          <h2>클래스 공지방</h2>
          <p>선생님(클래스장)이 클래스를 만들고 참여 코드를 알려 주면, 학생들은 코드로 들어와 공지를 한 번에 받아요.</p>
        </div>
        <button className="btn-secondary class-refresh" onClick={reloadList} aria-label="새로고침">
          <RefreshCw size={14} /> <span>새로고침</span>
        </button>
      </div>

      {hasClasses ? (
        <>
          {list}
          <div className="class-actions-gap" />
          {actions}
        </>
      ) : (
        <>
          {actions}
          {list}
        </>
      )}
    </section>
  );
}

// ─── 코드로 참여하기 ────────────────────────────────────────────
function JoinCard({ onJoined }: { onJoined: (c: ClassSummary, already: boolean) => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ class: ClassSummary; already: boolean }>('/api/classes/join', { method: 'POST', body: { code } });
      setCode('');
      onJoined(res.class, res.already);
    } catch (err) {
      setError(errorMessage(err, '참여하지 못했어요.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card card-body class-action-card" onSubmit={submit}>
      <div className="class-action-head">
        <span className="stat-ico blue"><LogIn size={16} /></span>
        <div>
          <h3>코드로 참여하기</h3>
          <p>선생님께 받은 6자리 코드를 입력하세요.</p>
        </div>
      </div>
      <div className="class-join-row">
        <input
          className="class-code-input"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          placeholder="예: A7K2Q9"
          aria-label="참여 코드"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
        />
        <button type="submit" className="btn-primary" disabled={busy || code.length !== 6}>
          {busy ? '확인 중…' : '참여'}
        </button>
      </div>
      {error && <div className="auth-error" role="alert" style={{ marginTop: 10 }}>{error}</div>}
    </form>
  );
}

// ─── 클래스 만들기 ──────────────────────────────────────────────
function CreateCard({ onCreated }: { onCreated: (c: ClassSummary) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ class: ClassSummary }>('/api/classes', {
        method: 'POST',
        body: { name: String(fd.get('name') ?? '').trim(), description: String(fd.get('description') ?? '').trim() },
      });
      setOpen(false);
      onCreated(res.class);
    } catch (err) {
      setError(errorMessage(err, '클래스를 만들지 못했어요.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card card-body class-action-card">
      <div className="class-action-head">
        <span className="stat-ico amber"><Crown size={16} /></span>
        <div>
          <h3>클래스 만들기</h3>
          <p>만든 사람이 클래스장이 되고, 참여 코드가 자동으로 만들어져요.</p>
        </div>
      </div>
      {open ? (
        <form className="class-form" onSubmit={submit}>
          <input name="name" required maxLength={CLASS_NAME_MAX} placeholder="클래스 이름 (예: 2학년 3반, 수학 동아리)" aria-label="클래스 이름" autoFocus />
          <input name="description" maxLength={CLASS_DESC_MAX} placeholder="소개 (선택)" aria-label="클래스 소개" />
          {error && <div className="auth-error" role="alert">{error}</div>}
          <div className="class-form-actions">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>취소</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? '만드는 중…' : '만들기'}</button>
          </div>
        </form>
      ) : (
        <button className="btn-secondary class-open-btn" onClick={() => setOpen(true)}>
          <Plus size={14} /> 새 클래스 만들기
        </button>
      )}
    </div>
  );
}

// ─── 이 기기에서 공지 알림 받기 ──────────────────────────────────
function PushCard({ showToast }: { showToast: (msg: string) => void }) {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = pushSupport();
    currentSubscription().then((sub) => {
      setSupport(s);
      setSubscribed(!!sub);
    });
  }, []);

  if (support === null || support === 'unsupported') return null;

  const toggle = async () => {
    setBusy(true);
    try {
      if (subscribed) {
        await disablePush();
        setSubscribed(false);
        showToast('이 기기에서 알림을 껐어요.');
      } else {
        await enablePush();
        setSubscribed(true);
        showToast('이제 새 공지가 올라오면 이 기기로 알려 드려요.');
      }
    } catch (e) {
      showToast(errorMessage(e, '알림 설정을 바꾸지 못했어요.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="class-push">
      <Bell size={16} />
      <span>
        {support === 'ios-install'
          ? '아이폰·아이패드는 사파리에서 공유 → 홈 화면에 추가한 뒤, 홈 화면의 ClassMate에서 알림을 켤 수 있어요.'
          : subscribed
            ? '이 기기로 새 공지 알림을 받고 있어요.'
            : '새 공지가 올라오면 바로 알림을 받아 보세요.'}
      </span>
      {support === 'supported' && (
        <button className={subscribed ? 'btn-secondary' : 'btn-primary'} onClick={toggle} disabled={busy}>
          {subscribed ? <><BellOff size={14} /> 알림 끄기</> : <><Bell size={14} /> 알림 켜기</>}
        </button>
      )}
    </div>
  );
}

// ─── 클래스 안: 공지 목록, (클래스장) 공지 쓰기·참여 코드·참여자 관리 ───
function ClassDetailView({ classId, showToast, onBack }: { classId: string; showToast: (msg: string) => void; onBack: () => void }) {
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<AnnouncementItem | null>(null);
  const [tab, setTab] = useState<'notices' | 'members' | 'settings'>('notices');

  useEffect(() => {
    let cancelled = false;
    api<ClassDetail>(`/api/classes/${classId}`)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        setError(null);
      })
      .catch((e) => !cancelled && setError(errorMessage(e, '클래스를 불러오지 못했어요.')));
    return () => { cancelled = true; };
  }, [classId, reloadKey]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  if (error) {
    return (
      <section className="page-section">
        <button className="text-btn class-back" onClick={onBack}><ArrowLeft size={14} /> 클래스 목록</button>
        <div className="card card-body" style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--muted)', marginBottom: 12 }}>{error}</p>
          <button className="btn-primary" onClick={reload}>다시 시도</button>
        </div>
      </section>
    );
  }
  if (!detail) return <div className="spinner" aria-label="로딩 중" />;

  const c = detail.class;
  const isOwner = c.role === 'owner';

  const copyCode = async () => {
    if (!c.code) return;
    const text = `ClassMate '${c.name}' 클래스 참여 코드: ${c.code}\n${window.location.origin}`;
    try {
      if (navigator.share) await navigator.share({ title: 'ClassMate 클래스 참여 코드', text });
      else {
        await navigator.clipboard.writeText(text);
        showToast('참여 코드 안내를 복사했어요. 학생들에게 보내 주세요.');
      }
    } catch {
      // 공유 창을 닫은 경우 등
    }
  };

  const deleteNotice = async (n: AnnouncementItem) => {
    if (!confirm(`'${n.title}' 공지를 삭제할까요?`)) return;
    try {
      await api(`/api/classes/${classId}/announcements/${n.id}`, { method: 'DELETE' });
      showToast('공지를 삭제했어요.');
      reload();
    } catch (e) {
      showToast(errorMessage(e, '공지를 삭제하지 못했어요.'));
    }
  };

  const leave = async () => {
    if (!confirm(`'${c.name}' 클래스에서 나갈까요? 다시 들어오려면 참여 코드가 필요해요.`)) return;
    try {
      await api(`/api/classes/${classId}/members/me`, { method: 'DELETE' });
      showToast('클래스에서 나갔어요.');
      onBack();
    } catch (e) {
      showToast(errorMessage(e, '나가지 못했어요.'));
    }
  };

  return (
    <section className="page-section">
      <button className="text-btn class-back" onClick={onBack}><ArrowLeft size={14} /> 클래스 목록</button>

      <div className="class-hero card card-body">
        <div className="class-hero-main">
          <div>
            <span className={`tag ${isOwner ? 'purple' : 'blue'}`}>{isOwner ? '클래스장' : '참여 중'}</span>
            <h2>{c.name}</h2>
            {c.description && <p>{c.description}</p>}
            <div className="class-card-meta">
              <span><Crown size={12} /> {c.owner_name}</span>
              <span><Users size={12} /> {c.member_count}명</span>
            </div>
          </div>
          <button className="btn-icon" onClick={reload} aria-label="새로고침" title="새로고침"><RefreshCw size={15} /></button>
        </div>

        {isOwner && c.code && (
          <div className="class-code-box">
            <div>
              <span>참여 코드</span>
              <strong aria-label="참여 코드">{c.code}</strong>
              <small>학생들에게 이 코드를 알려 주면 클래스에 들어올 수 있어요.</small>
            </div>
            <button className="btn-primary" onClick={copyCode}>
              {typeof navigator !== 'undefined' && 'share' in navigator ? <Share2 size={14} /> : <Copy size={14} />} 코드 보내기
            </button>
          </div>
        )}
      </div>

      {isOwner && (
        <div className="filters class-tabs">
          {([['notices', '공지'], ['members', `참여자 ${c.member_count}`], ['settings', '클래스 설정']] as const).map(([key, label]) => (
            <button key={key} className={`filter-btn ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>
      )}

      {tab === 'notices' && (
        <>
          {isOwner && (
            <NoticeComposer
              key={editing?.id ?? 'new'}
              classId={classId}
              editing={editing}
              onDone={(msg) => {
                setEditing(null);
                showToast(msg);
                reload();
              }}
              onCancel={() => setEditing(null)}
            />
          )}

          <div className="notice-list">
            {detail.announcements.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📢</div>
                {isOwner ? '첫 공지를 올려 보세요. 참여한 모든 학생에게 한 번에 전달돼요.' : '아직 올라온 공지가 없어요.'}
              </div>
            ) : (
              detail.announcements.map((n) => (
                <article key={n.id} className={`notice-card ${n.pinned ? 'pinned' : ''} ${n.is_new ? 'is-new' : ''}`}>
                  <header>
                    <div className="notice-title">
                      {n.pinned && <Pin size={13} aria-label="상단 고정" />}
                      <strong>{n.title}</strong>
                      {n.is_new && <span className="notice-new">NEW</span>}
                    </div>
                    {isOwner && (
                      <div className="row-actions">
                        <button className="table-action" onClick={() => { setEditing(n); window.scrollTo({ top: 0, behavior: 'smooth' }); }} aria-label="공지 수정"><Pencil size={14} /></button>
                        <button className="table-action danger" onClick={() => deleteNotice(n)} aria-label="공지 삭제"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </header>
                  {n.body && <p className="notice-body">{n.body}</p>}
                  <footer>
                    {n.author_name} · {fmtWhen(n.created_at)}
                    {n.updated_at !== n.created_at && ' (수정됨)'}
                  </footer>
                </article>
              ))
            )}
          </div>

          {!isOwner && (
            <button className="btn-secondary danger-btn class-leave" onClick={leave}>클래스 나가기</button>
          )}
        </>
      )}

      {isOwner && tab === 'members' && detail.members && (
        <MemberList classId={classId} members={detail.members} showToast={showToast} onChange={reload} />
      )}

      {isOwner && tab === 'settings' && (
        <ClassSettings classSummary={c} showToast={showToast} onChange={reload} onDeleted={onBack} />
      )}
    </section>
  );
}

// ─── (클래스장) 공지 쓰기·수정 ──────────────────────────────────
function NoticeComposer({
  classId, editing, onDone, onCancel,
}: {
  classId: string;
  editing: AnnouncementItem | null;
  onDone: (msg: string) => void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body = {
      title: String(fd.get('title') ?? '').trim(),
      body: String(fd.get('body') ?? '').trim(),
      pinned: fd.get('pinned') === 'on',
    };
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await api(`/api/classes/${classId}/announcements/${editing.id}`, { method: 'PUT', body });
        onDone('공지를 수정했어요.');
      } else {
        await api(`/api/classes/${classId}/announcements`, { method: 'POST', body });
        form.reset();
        onDone('공지를 올렸어요. 참여한 모든 학생에게 전달돼요.');
      }
    } catch (err) {
      setError(errorMessage(err, '공지를 저장하지 못했어요.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card card-body notice-composer" onSubmit={submit}>
      <h3>{editing ? '공지 수정' : '새 공지 쓰기'}</h3>
      <input name="title" required maxLength={NOTICE_TITLE_MAX} defaultValue={editing?.title} placeholder="제목 (예: 내일 체육복 챙겨 오세요)" aria-label="공지 제목" />
      <textarea name="body" maxLength={NOTICE_BODY_MAX} defaultValue={editing?.body} placeholder="내용 (선택)" aria-label="공지 내용" rows={4} />
      <div className="notice-composer-foot">
        <label className="notice-pin">
          <input type="checkbox" name="pinned" defaultChecked={editing?.pinned} /> 상단 고정
        </label>
        {error && <span className="notice-error" role="alert">{error}</span>}
        <div className="class-form-actions">
          {editing && <button type="button" className="btn-secondary" onClick={onCancel}>취소</button>}
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? '저장 중…' : editing ? '수정하기' : '모두에게 공지하기'}
          </button>
        </div>
      </div>
    </form>
  );
}

// ─── (클래스장) 참여자 목록 ─────────────────────────────────────
function MemberList({
  classId, members, showToast, onChange,
}: {
  classId: string;
  members: NonNullable<ClassDetail['members']>;
  showToast: (msg: string) => void;
  onChange: () => void;
}) {
  const remove = async (userId: string, nickname: string) => {
    if (!confirm(`${nickname}님을 클래스에서 내보낼까요?`)) return;
    try {
      await api(`/api/classes/${classId}/members/${userId}`, { method: 'DELETE' });
      showToast(`${nickname}님을 내보냈어요.`);
      onChange();
    } catch (e) {
      showToast(errorMessage(e, '내보내지 못했어요.'));
    }
  };

  return (
    <div className="card card-body">
      {members.length <= 1 && (
        <p className="class-hint">아직 참여한 학생이 없어요. 위의 참여 코드를 학생들에게 알려 주세요.</p>
      )}
      <ul className="member-list">
        {members.map((m) => (
          <li key={m.user_id}>
            <div className="avatar">{m.nickname.slice(0, 1)}</div>
            <div className="member-main">
              <strong>{m.nickname}</strong>
              <span>@{m.username} · {new Date(m.joined_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} 참여</span>
            </div>
            {m.role === 'owner' ? (
              <span className="tag purple">클래스장</span>
            ) : (
              <button className="table-action danger" onClick={() => remove(m.user_id, m.nickname)} aria-label={`${m.nickname} 내보내기`}>
                <UserMinus size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── (클래스장) 이름·소개 수정, 코드 새로 만들기, 클래스 삭제 ─────────
function ClassSettings({
  classSummary, showToast, onChange, onDeleted,
}: {
  classSummary: ClassSummary;
  showToast: (msg: string) => void;
  onChange: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const patch = async (body: Record<string, unknown>, msg: string) => {
    setBusy(true);
    try {
      await api(`/api/classes/${classSummary.id}`, { method: 'PATCH', body });
      showToast(msg);
      onChange();
    } catch (e) {
      showToast(errorMessage(e, '바꾸지 못했어요.'));
    } finally {
      setBusy(false);
    }
  };

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    patch({ name: String(fd.get('name') ?? ''), description: String(fd.get('description') ?? '') }, '클래스 정보를 저장했어요.');
  };

  const regenerate = () => {
    if (!confirm('참여 코드를 새로 만들까요? 예전 코드로는 더 이상 들어올 수 없어요. (이미 들어온 학생은 그대로예요)')) return;
    patch({ regenerate_code: true }, '새 참여 코드를 만들었어요.');
  };

  const remove = async () => {
    if (!confirm(`'${classSummary.name}' 클래스를 삭제할까요? 모든 공지와 참여자 정보가 지워지고 되돌릴 수 없어요.`)) return;
    try {
      await api(`/api/classes/${classSummary.id}`, { method: 'DELETE' });
      showToast('클래스를 삭제했어요.');
      onDeleted();
    } catch (e) {
      showToast(errorMessage(e, '삭제하지 못했어요.'));
    }
  };

  return (
    <div className="card card-body class-settings">
      <form className="class-form" onSubmit={save}>
        <label htmlFor="class-name">클래스 이름</label>
        <input id="class-name" name="name" required maxLength={CLASS_NAME_MAX} defaultValue={classSummary.name} />
        <label htmlFor="class-desc">소개</label>
        <input id="class-desc" name="description" maxLength={CLASS_DESC_MAX} defaultValue={classSummary.description} />
        <div className="class-form-actions">
          <button type="submit" className="btn-primary" disabled={busy}>저장</button>
        </div>
      </form>
      <div className="class-danger">
        <button className="btn-secondary" onClick={regenerate} disabled={busy}><RefreshCw size={14} /> 참여 코드 새로 만들기</button>
        <button className="btn-secondary danger-btn" onClick={remove}><Trash2 size={14} /> 클래스 삭제</button>
      </div>
    </div>
  );
}

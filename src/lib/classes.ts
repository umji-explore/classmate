// 공동체용 클래스 — 서버 응답과 화면에서 함께 쓰는 타입 (서버 전용 코드를 넣지 말 것)

export type ClassRole = 'owner' | 'member';

export interface ClassSummary {
  id: string;
  name: string;
  description: string;
  role: ClassRole;
  owner_name: string;
  member_count: number; // 클래스장 포함
  unread: number; // 아직 안 본 새 공지 수
  latest: { title: string; created_at: string } | null;
  code: string | null; // 참여 코드 (클래스장에게만 보임)
}

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  author_name: string;
  created_at: string;
  updated_at: string;
  is_new: boolean; // 내가 마지막으로 본 뒤에 올라온 공지
}

export interface MemberItem {
  user_id: string;
  nickname: string;
  username: string;
  role: ClassRole;
  joined_at: string;
}

export interface ClassDetail {
  class: ClassSummary;
  announcements: AnnouncementItem[];
  members: MemberItem[] | null; // 참여자 목록 (클래스장에게만 보임)
}

export const CLASS_NAME_MAX = 30;
export const CLASS_DESC_MAX = 200;
export const NOTICE_TITLE_MAX = 60;
export const NOTICE_BODY_MAX = 2000;

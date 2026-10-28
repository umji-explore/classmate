import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { connectToDatabase } from '@/lib/mongodb';
import Session from '@/models/Session';
import User, { IUser, IUserDocument } from '@/models/User';
import { normalizePreferences, Preferences } from '@/lib/appearance';

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = 'cm_session';
const SESSION_DAYS = 30;

// ── 비밀번호 ────────────────────────────────────────────────────
// 저장 형식: scrypt$<salt hex>$<hash hex>  (되돌릴 수 없는 해시 — 원래 비밀번호는 어디에도 저장하지 않음)
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const [algo, saltHex, hashHex] = (stored ?? '').split('$');
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(expected, actual);
}

// 존재하지 않는 아이디로 로그인할 때도 비슷한 시간이 걸리게 해 아이디 존재 여부를 숨긴다
const DUMMY_HASH = `scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`;
export const verifyDummyPassword = (password: string) => verifyPassword(password, DUMMY_HASH);

// 비밀번호 찾기 때 이메일로 보내는 임시 비밀번호 (헷갈리는 0/O, 1/l/I 제외, 영문+숫자 10자리)
const TEMP_LETTERS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
const TEMP_DIGITS = '23456789';
export function generateTempPassword(): string {
  const chars = TEMP_LETTERS + TEMP_DIGITS;
  while (true) {
    let pw = '';
    for (let i = 0; i < 10; i++) pw += chars[randomInt(chars.length)];
    if (/[a-zA-Z]/.test(pw) && /[0-9]/.test(pw)) return pw;
  }
}

// ── 입력값 검사 ─────────────────────────────────────────────────
export const USERNAME_RULE = /^[a-z0-9_]{4,20}$/;
export const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export function validatePassword(password: string): string | null {
  if (password.length < 8 || password.length > 64) return '비밀번호는 8~64자여야 합니다.';
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return '비밀번호에 영문과 숫자를 모두 포함해 주세요.';
  return null;
}

export function validateEmail(email: string): string | null {
  if (!EMAIL_RULE.test(email) || email.length > 100) return '이메일 주소를 정확히 입력해 주세요.';
  return null;
}

export function validateSignup(username: string, password: string, nickname: string, email: string): string | null {
  if (!USERNAME_RULE.test(username)) return '아이디는 영문 소문자, 숫자, 밑줄(_)로 4~20자여야 합니다.';
  const invalidPassword = validatePassword(password);
  if (invalidPassword) return invalidPassword;
  if (!nickname || nickname.length > 20) return '이름은 1~20자로 입력해 주세요.';
  return validateEmail(email);
}

// MongoDB unique 인덱스 충돌 에러인지 (field를 주면 그 필드의 충돌인지까지 확인)
export function isDuplicateKeyError(error: unknown, field?: string): boolean {
  const e = error as { code?: number; keyPattern?: Record<string, unknown> };
  return e?.code === 11000 && (!field || !!e.keyPattern?.[field]);
}

// ── 세션 ────────────────────────────────────────────────────────
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createSession(userId: IUserDocument['_id']) {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  await Session.create({ token_hash: hashToken(token), user: userId, expires_at: expires });

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, // 자바스크립트로 쿠키를 읽을 수 없게 (XSS 대비)
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await connectToDatabase();
    await Session.deleteOne({ token_hash: hashToken(token) });
  }
  store.delete(SESSION_COOKIE);
}

export interface SessionUser {
  id: string;
  username: string;
  nickname: string;
  email: string | null; // 이메일 기능 전에 가입한 계정은 null
  preferences: Preferences; // 꾸미기 설정
}

export const toSessionUser = (user: {
  _id: unknown;
  username: string;
  nickname: string;
  email?: string | null;
  preferences?: IUser['preferences'];
}): SessionUser => ({
  id: String(user._id),
  username: user.username,
  nickname: user.nickname,
  email: user.email ?? null,
  preferences: normalizePreferences(user.preferences),
});

// 현재 요청의 로그인 사용자 (없으면 null)
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  await connectToDatabase();
  const session = await Session.findOne({ token_hash: hashToken(token), expires_at: { $gt: new Date() } }).lean();
  if (!session) return null;

  const user = await User.findById(session.user).select('username nickname email preferences').lean();
  return user ? toSessionUser(user) : null;
}

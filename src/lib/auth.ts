import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { connectToDatabase } from '@/lib/mongodb';
import Session from '@/models/Session';
import User, { IUserDocument } from '@/models/User';

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const SESSION_COOKIE = 'cm_session';
const SESSION_DAYS = 30;

// ── 비밀번호 ────────────────────────────────────────────────────
// 저장 형식: scrypt$<salt hex>$<hash hex>
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltHex, hashHex] = stored.split('$');
  if (algo !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(expected, actual);
}

// 존재하지 않는 아이디로 로그인할 때도 비슷한 시간이 걸리게 해 아이디 존재 여부를 숨긴다
const DUMMY_HASH = `scrypt$${'0'.repeat(32)}$${'0'.repeat(128)}`;
export const verifyDummyPassword = (password: string) => verifyPassword(password, DUMMY_HASH);

// ── 입력값 검사 ─────────────────────────────────────────────────
export const USERNAME_RULE = /^[a-z0-9_]{4,20}$/;

export function validatePassword(password: string): string | null {
  if (password.length < 8 || password.length > 64) return '비밀번호는 8~64자여야 합니다.';
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return '비밀번호에 영문과 숫자를 모두 포함해 주세요.';
  return null;
}

export function validateSignup(username: string, password: string, nickname: string): string | null {
  if (!USERNAME_RULE.test(username)) return '아이디는 영문 소문자, 숫자, 밑줄(_)로 4~20자여야 합니다.';
  const invalidPassword = validatePassword(password);
  if (invalidPassword) return invalidPassword;
  if (!nickname || nickname.length > 20) return '이름은 1~20자로 입력해 주세요.';
  return null;
}

// ── 고유 코드 (비밀번호 찾기용) ─────────────────────────────────
// 헷갈리기 쉬운 글자(0/O, 1/I/L)는 빼고, 영문 대문자와 숫자를 반드시 하나 이상 섞은 6자리
const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_DIGITS = '23456789';
const CODE_CHARS = CODE_LETTERS + CODE_DIGITS;
export const RECOVERY_CODE_RULE = /^[A-Z0-9]{6}$/;

export function generateRecoveryCode(): string {
  while (true) {
    let code = '';
    for (let i = 0; i < 6; i++) code += CODE_CHARS[randomInt(CODE_CHARS.length)];
    if (/[A-Z]/.test(code) && /[0-9]/.test(code)) return code;
  }
}

export const normalizeRecoveryCode = (code: string) => code.replace(/[\s-]/g, '').toUpperCase();

// MongoDB unique 인덱스 충돌 에러인지 (field를 주면 그 필드의 충돌인지까지 확인)
export function isDuplicateKeyError(error: unknown, field?: string): boolean {
  const e = error as { code?: number; keyPattern?: Record<string, unknown> };
  return e?.code === 11000 && (!field || !!e.keyPattern?.[field]);
}

// 다른 계정과 겹치지 않는 코드를 만든다. 아주 드물게 겹치면 새 코드로 다시 시도.
// (최종 보장은 DB의 unique 인덱스가 하고, 저장할 때 충돌하면 호출하는 쪽에서 다시 시도한다)
export async function generateUniqueRecoveryCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateRecoveryCode();
    if (!(await User.exists({ recovery_code: code }))) return code;
  }
  throw new Error('고유 코드를 만들지 못했습니다.');
}

// 고유 코드 기능이 생기기 전에 가입한 계정에는 코드를 새로 발급
export async function ensureRecoveryCode(userId: string, current?: string | null): Promise<string> {
  if (current) return current;
  for (let i = 0; i < 5; i++) {
    const code = await generateUniqueRecoveryCode();
    try {
      const updated = await User.findOneAndUpdate(
        { _id: userId, recovery_code: { $exists: false } },
        { $set: { recovery_code: code } },
        { returnDocument: 'after' }
      ).lean();
      if (updated?.recovery_code) return updated.recovery_code;
      // 동시에 다른 요청이 먼저 발급한 경우
      const existing = await User.findById(userId).select('recovery_code').lean();
      if (existing?.recovery_code) return existing.recovery_code;
    } catch (error) {
      if (!isDuplicateKeyError(error, 'recovery_code')) throw error;
    }
  }
  throw new Error('고유 코드를 발급하지 못했습니다.');
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
  recovery_code: string;
}

// 현재 요청의 로그인 사용자 (없으면 null)
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  await connectToDatabase();
  const session = await Session.findOne({ token_hash: hashToken(token), expires_at: { $gt: new Date() } }).lean();
  if (!session) return null;

  const user = await User.findById(session.user).select('username nickname recovery_code').lean();
  if (!user) return null;
  const id = String(user._id);
  const recovery_code = await ensureRecoveryCode(id, user.recovery_code);
  return { id, username: user.username, nickname: user.nickname, recovery_code };
}

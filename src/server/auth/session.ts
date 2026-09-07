import { randomBytes } from 'node:crypto';
import type { APIContext } from 'astro';
import { and, eq, gt, lt } from 'drizzle-orm';
import { getDb } from '../db/client';
import { sessions, users, type User } from '../db/schema';
import { verifyPassword } from './password';

/**
 * سشن‌های ورود به پنل.
 *
 * جایگزین Basic Auth قبلی: آن روش یک رمز مشترک برای همه داشت، خروج از
 * حساب نداشت، و هیچ راهی برای فهمیدن این‌که چه کسی چه کاری کرده باقی
 * نمی‌گذاشت.
 *
 * شناسهٔ سشن یک رشتهٔ تصادفی ۲۵۶ بیتی است که در کوکی می‌نشیند و رکوردش در
 * دیتابیس است — پس ابطال سشن (خروج، یا غیرفعال‌کردن کاربر) بلافاصله عمل
 * می‌کند، برخلاف توکن امضاشده که تا انقضا معتبر می‌ماند.
 */

export const COOKIE_NAME = 'nn_session';
const LIFETIME_MS = 30 * 24 * 60 * 60 * 1000; // ۳۰ روز

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'sales';
}

function toSessionUser(user: User): SessionUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

/**
 * بررسی نام کاربری و رمز. در صورت درستی سشن می‌سازد و شناسه‌اش را
 * برمی‌گرداند.
 */
export async function login(
  email: string,
  password: string,
): Promise<{ sessionId: string; user: SessionUser } | null> {
  const db = await getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);

  /* حتی وقتی کاربر وجود ندارد رمز را بررسی می‌کنیم تا زمان پاسخ در دو حالت
     یکسان بماند و نشود از روی سرعت پاسخ فهمید کدام ایمیل ثبت شده است. */
  const hash = user?.passwordHash ?? 'scrypt$00$00';
  const valid = await verifyPassword(password, hash);

  if (!user || !user.active || !valid) return null;

  const sessionId = randomBytes(32).toString('base64url');
  await db.insert(sessions).values({
    id: sessionId,
    userId: user.id,
    expiresAt: new Date(Date.now() + LIFETIME_MS),
  });

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

  return { sessionId, user: toSessionUser(user) };
}

/** کاربر متناظر با سشن، یا null اگر سشن نامعتبر یا منقضی باشد. */
export async function resolveSession(sessionId: string | undefined): Promise<SessionUser | null> {
  if (!sessionId) return null;

  const db = await getDb();
  const [row] = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
    .limit(1);

  if (!row || !row.user.active) return null;
  return toSessionUser(row.user);
}

export async function logout(sessionId: string | undefined): Promise<void> {
  if (!sessionId) return;
  const db = await getDb();
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/** سشن‌های منقضی را پاک می‌کند؛ هر از چندگاهی از worker صدا زده می‌شود. */
export async function pruneSessions(): Promise<void> {
  const db = await getDb();
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

/* ============================================================
   کوکی
   ============================================================ */

export function setSessionCookie(context: APIContext, sessionId: string): void {
  context.cookies.set(COOKIE_NAME, sessionId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    // روی HTTP محلی کوکی امن ارسال نمی‌شود، پس فقط در production فعال است
    secure: import.meta.env.PROD,
    maxAge: LIFETIME_MS / 1000,
  });
}

export function clearSessionCookie(context: APIContext): void {
  context.cookies.delete(COOKIE_NAME, { path: '/' });
}

export function readSessionCookie(context: APIContext): string | undefined {
  return context.cookies.get(COOKIE_NAME)?.value;
}

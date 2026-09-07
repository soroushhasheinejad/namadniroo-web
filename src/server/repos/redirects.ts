import { desc, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { redirects, type Redirect } from '../db/schema';
import { TAGS, cached, invalidate } from '../cache';

/**
 * ریدایرکت‌های مدیریت‌شده از پنل.
 *
 * چرا در دیتابیس و نه در `astro.config.mjs`: مهم‌ترین کاربردشان لحظه‌ای است
 * که ویراستار نشانی یک مطلب را عوض می‌کند. اگر ساخت ریدایرکت به کامیت و
 * دیپلوی نیاز داشته باشد، در عمل انجام نمی‌شود و لینک‌های ایندکس‌شده در
 * گوگل می‌شکنند.
 *
 * کل جدول یک‌جا کش می‌شود: تعدادشان کم است و در ازای آن، هر درخواست به سایت
 * بدون کوئری بررسی می‌شود.
 */

function allRedirects(): Promise<Map<string, Redirect>> {
  return cached('redirects:map', [TAGS.redirects], async () => {
    const db = await getDb();
    const rows = await db.select().from(redirects);
    return new Map(rows.map((r) => [normalizePath(r.fromPath), r]));
  });
}

/** بدون اسلش انتهایی و بدون حروف بزرگ، تا `/About/` و `/about` یکی شوند */
function normalizePath(path: string): string {
  const trimmed = path.replace(/\/+$/, '').toLowerCase();
  return trimmed || '/';
}

export async function lookupRedirect(pathname: string): Promise<Redirect | null> {
  const map = await allRedirects();
  const hit = map.get(normalizePath(pathname));
  if (!hit) return null;

  /* شمارنده در پس‌زمینه بالا می‌رود و درخواست منتظرش نمی‌ماند — عددی که
     فقط برای گزارش است نباید ریدایرکت را کند کند. */
  bumpHits(hit.id);
  return hit;
}

function bumpHits(id: number): void {
  void getDb()
    .then((db) =>
      db.update(redirects).set({ hits: sql`${redirects.hits} + 1` }).where(eq(redirects.id, id)),
    )
    .catch(() => {});
}

export async function listRedirects(): Promise<Redirect[]> {
  const db = await getDb();
  return db.select().from(redirects).orderBy(desc(redirects.createdAt));
}

export async function createRedirect(
  fromPath: string,
  toPath: string,
  options: { statusCode?: number; auto?: boolean } = {},
): Promise<void> {
  const from = normalizePath(fromPath);
  const to = toPath.startsWith('/') ? toPath : `/${toPath}`;

  // ریدایرکت به خودش حلقه می‌سازد
  if (from === normalizePath(to)) return;

  const db = await getDb();
  await db
    .insert(redirects)
    .values({
      fromPath: from,
      toPath: to,
      statusCode: options.statusCode ?? 301,
      auto: options.auto ?? false,
    })
    .onConflictDoUpdate({
      target: redirects.fromPath,
      set: { toPath: to, statusCode: options.statusCode ?? 301 },
    });

  /* اگر نشانی مقصد خودش قبلاً مبدأ یک ریدایرکت بوده، زنجیره ساخته می‌شود و
     گوگل زنجیره را دوست ندارد. مقصد ریدایرکت‌های قبلی را به مقصد تازه
     به‌روز می‌کنیم تا همیشه یک پرش بیشتر لازم نباشد. */
  await db.update(redirects).set({ toPath: to }).where(eq(redirects.toPath, from));

  // ردیفی که بعد از اصلاح زنجیره به خودش اشاره کند حلقه می‌سازد
  await db.delete(redirects).where(eq(redirects.fromPath, normalizePath(to)));

  invalidate(TAGS.redirects);
}

/**
 * ریدایرکتی که از این نشانی شروع می‌شود را حذف می‌کند.
 *
 * لازم است چون نشانی‌ای که زمانی منتقل شده ممکن است دوباره صفحهٔ واقعی
 * شود — مثلاً وقتی ویراستار نشانی را عوض می‌کند و بعد پشیمان می‌شود و
 * برش می‌گرداند. بدون این، آن نشانی برای همیشه به جای دیگری می‌رفت.
 */
export async function clearRedirectFrom(path: string): Promise<void> {
  const db = await getDb();
  const result = await db.delete(redirects).where(eq(redirects.fromPath, normalizePath(path)));
  invalidate(TAGS.redirects);
  return void result;
}

export async function deleteRedirect(id: number): Promise<void> {
  const db = await getDb();
  await db.delete(redirects).where(eq(redirects.id, id));
  invalidate(TAGS.redirects);
}

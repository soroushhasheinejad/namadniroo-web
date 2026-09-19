import { desc, eq, notInArray, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { notFound, type NotFound } from '../db/schema';

/**
 * ثبت و خواندن نشانی‌هایی که به ۴۰۴ رسیدند.
 */

/** سقف ردیف‌ها — ربات‌هایی که نشانی تصادفی می‌سازند نباید جدول را بی‌انتها کنند */
const MAX_ROWS = 2000;
/** نشانی بلندتر از این تقریباً همیشه اسکن ربات است، نه پیوند واقعی */
const MAX_PATH = 300;

/**
 * نشانی‌هایی که ثبتشان فقط نویز است: ربات‌هایی که دنبال صفحهٔ ورود وردپرس،
 * فایل‌های پیکربندی یا اسکریپت‌های آسیب‌پذیر می‌گردند. ریدایرکت برای این‌ها
 * معنا ندارد و فهرست را از پیوندهای واقعی پر می‌کردند.
 *
 * `/wp-content/uploads/…` عمداً اینجا نیست: سایت قبلی وردپرس بود و پیوند
 * تصاویرش ممکن است هنوز در جست‌وجوی تصاویر گوگل و سایت‌های دیگر باشد —
 * این‌ها پیوند واقعیِ ازدست‌رفته‌اند، نه کاوش ربات.
 */
const NOISE = /\.(php|env|asp|aspx|jsp|cgi|ini|bak|sql)(\/|$|\?)|^\/(wp-(admin|login|includes|json)|xmlrpc|cgi-bin)|\/\./i;

export function isNoise(path: string): boolean {
  return path.length > MAX_PATH || NOISE.test(path);
}

/**
 * یک ۴۰۴ را ثبت می‌کند.
 *
 * هرگز خطا پرتاب نمی‌کند و منتظرش نمی‌مانیم: صفحهٔ «پیدا نشد» باید حتی
 * وقتی دیتابیس مشکل دارد نمایش داده شود.
 */
export function recordNotFound(path: string, referrer: string | null): void {
  if (isNoise(path)) return;
  const from = referrer ? referrer.slice(0, MAX_PATH) : null;

  void (async () => {
    const db = await getDb();
    const inserted = await db
      .insert(notFound)
      .values({ path, referrer: from })
      .onConflictDoUpdate({
        target: notFound.path,
        set: {
          hits: sql`${notFound.hits} + 1`,
          lastSeen: sql`(unixepoch())`,
          // ارجاع‌دهندهٔ خالی، ارجاع‌دهندهٔ مفید قبلی را پاک نکند
          referrer: sql`coalesce(${from}, ${notFound.referrer})`,
        },
      })
      .returning({ hits: notFound.hits });

    // فقط وقتی ردیف تازه ساخته شده، سقف را بررسی می‌کنیم
    if (inserted[0]?.hits === 1) await prune();
  })().catch((err) => console.error('[404] ثبت ناموفق بود:', err));
}

/** قدیمی‌ترین ردیف‌های کم‌بازدید را حذف می‌کند تا جدول از سقف بیشتر نشود */
async function prune(): Promise<void> {
  const db = await getDb();
  const keep = db
    .select({ id: notFound.id })
    .from(notFound)
    .orderBy(desc(notFound.lastSeen))
    .limit(MAX_ROWS);
  await db.delete(notFound).where(notInArray(notFound.id, keep));
}

export async function listNotFound(limit = 100): Promise<NotFound[]> {
  const db = await getDb();
  return db.select().from(notFound).orderBy(desc(notFound.hits), desc(notFound.lastSeen)).limit(limit);
}

export async function countNotFound(): Promise<number> {
  const db = await getDb();
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(notFound);
  return row?.n ?? 0;
}

export async function deleteNotFound(path: string): Promise<void> {
  const db = await getDb();
  await db.delete(notFound).where(eq(notFound.path, path));
}

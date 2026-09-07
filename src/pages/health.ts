import type { APIRoute } from 'astro';
import { sql } from 'drizzle-orm';
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { getDb } from '../server/db/client';
import { mediaDir } from '../server/media/store';

export const prerender = false;

/**
 * بررسی سلامت اپ برای میزبان.
 *
 * قبلاً healthCheck لیارا صفحهٔ اصلی را صدا می‌زد؛ آن صفحه استاتیک بود و
 * حتی وقتی دیتابیس از کار می‌افتاد سالم پاسخ می‌داد. این مسیر دو چیزی را
 * بررسی می‌کند که واقعاً می‌توانند خراب شوند: دیتابیس و محل ذخیرهٔ تصاویر.
 *
 * نکتهٔ مهم دربارهٔ بررسی دیسک: صرفِ *وجود* پوشه معیار خوبی نیست. دیسک
 * پایدار روی `/data` سوار می‌شود ولی زیرپوشهٔ تصاویر تا اولین آپلود ساخته
 * نشده است — پس بررسی وجودِ ساده، اپِ کاملاً سالم را ناسالم اعلام می‌کرد و
 * میزبان آن را منتشر نمی‌کرد. چیزی که واقعاً اهمیت دارد **قابل نوشتن بودن**
 * است، پس همان را امتحان می‌کنیم: پوشه را می‌سازیم و یک فایل کوچک در آن
 * می‌نویسیم و پاک می‌کنیم.
 */
export const GET: APIRoute = async () => {
  const checks: Record<string, string> = {};
  let healthy = true;

  try {
    const db = await getDb();
    await db.get(sql`select 1`);
    checks.database = 'ok';
  } catch (err) {
    healthy = false;
    checks.database = err instanceof Error ? err.message.slice(0, 200) : 'اتصال برقرار نشد';
  }

  const dir = mediaDir();
  try {
    mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, '.health');
    writeFileSync(probe, '');
    unlinkSync(probe);
    checks.media = 'ok';
  } catch (err) {
    /* نوشتن ممکن نیست، یعنی دیسک پایدار وصل نشده یا اجازهٔ نوشتن ندارد. هر
       تصویری که آپلود شود با انتشار بعدی از بین می‌رود — این خرابی است نه
       هشدار، چون بی‌سروصدا داده از دست می‌رود. */
    healthy = false;
    checks.media = `${dir} قابل نوشتن نیست: ${err instanceof Error ? err.message.slice(0, 120) : ''}`;
  }

  return new Response(
    JSON.stringify({
      status: healthy ? 'ok' : 'degraded',
      checks,
      uptime: Math.round(process.uptime()),
      time: new Date().toISOString(),
    }),
    {
      status: healthy ? 200 : 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    },
  );
};

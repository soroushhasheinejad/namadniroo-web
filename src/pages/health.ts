import type { APIRoute } from 'astro';
import { sql } from 'drizzle-orm';
import { existsSync } from 'node:fs';
import { getDb } from '../server/db/client';
import { mediaDir } from '../server/media/store';

export const prerender = false;

/**
 * بررسی سلامت اپ برای میزبان.
 *
 * قبلاً healthCheck لیارا صفحهٔ اصلی را صدا می‌زد؛ آن صفحه استاتیک بود و
 * حتی وقتی دیتابیس از کار می‌افتاد سالم پاسخ می‌داد. این مسیر دو چیزی را
 * بررسی می‌کند که واقعاً می‌توانند خراب شوند: اتصال دیتابیس و دسترسی به
 * محل ذخیرهٔ تصاویر.
 */
export const GET: APIRoute = async () => {
  const checks: Record<string, string> = {};
  let healthy = true;

  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    checks.database = 'ok';
  } catch (err) {
    healthy = false;
    checks.database = err instanceof Error ? err.message.slice(0, 200) : 'اتصال برقرار نشد';
  }

  /* اگر پوشهٔ رسانه در دسترس نباشد یعنی دیسک پایدار وصل نشده و هر تصویری
     که آپلود شود با انتشار بعدی از بین می‌رود — این خرابی است نه هشدار،
     چون بی‌سروصدا داده از دست می‌رود. */
  const dir = mediaDir();
  if (existsSync(dir)) {
    checks.media = 'ok';
  } else {
    healthy = false;
    checks.media = `مسیر ${dir} در دسترس نیست`;
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

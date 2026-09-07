import type { APIRoute } from 'astro';
import { existsSync } from 'node:fs';

export const prerender = false;

/**
 * بررسی سلامت اپ برای میزبان.
 *
 * قبلاً healthCheck لیارا صفحهٔ اصلی را صدا می‌زد؛ آن صفحه استاتیک است و
 * حتی وقتی ذخیره‌سازی خراب باشد سالم پاسخ می‌دهد. این مسیر چیزی را بررسی
 * می‌کند که واقعاً می‌تواند خراب شود: دسترسی به محل ذخیرهٔ لیدها.
 *
 * وقتی دیتابیس اضافه شد، پینگ دیتابیس هم به همین‌جا افزوده می‌شود.
 */
export const GET: APIRoute = async () => {
  const leadsDir = process.env.LEADS_DIR;

  /* اگر LEADS_DIR تعریف شده ولی وجود ندارد، یعنی دیسک پایدار وصل نشده و
     هر لیدی که ثبت شود با انتشار بعدی از بین می‌رود — این خرابی است، نه
     هشدار، چون بی‌سروصدا داده از دست می‌رود. */
  const storageOk = !leadsDir || existsSync(leadsDir);

  const body = {
    status: storageOk ? 'ok' : 'degraded',
    storage: storageOk ? 'ok' : `مسیر ${leadsDir} در دسترس نیست`,
    uptime: Math.round(process.uptime()),
    time: new Date().toISOString(),
  };

  return new Response(JSON.stringify(body), {
    status: storageOk ? 200 : 503,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
};

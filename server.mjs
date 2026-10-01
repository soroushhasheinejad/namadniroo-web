/**
 * نقطهٔ شروع سرور در تولید.
 *
 * همان سرور مستقل Astro است، فقط پاسخ‌ها فشرده (brotli/gzip) فرستاده
 * می‌شوند. سرور خود Astro هیچ فشرده‌سازی‌ای ندارد و لبهٔ لیارا هم این کار
 * را نمی‌کند، پس HTML مقاله و فایل CSS — که هر دو جلوی نمایش صفحه را
 * می‌گیرند — خام می‌رفتند: حدود ۱۱۰ کیلوبایت به‌جای ۲۵. روی اینترنت موبایل
 * همین فرق، اولین نمایش صفحه را محسوس عقب می‌انداخت.
 *
 * فشرده‌سازی جلوی هر دو مسیر می‌نشیند: فایل‌های ثابت (`/_astro`، فونت‌ها)
 * و صفحه‌هایی که روی سرور ساخته می‌شوند.
 */
import http from 'node:http';
import { constants } from 'node:zlib';
import compression from 'compression';

// بدون این، وارد کردن entry.mjs خودش سروری روی همان پورت بالا می‌آورد
process.env.ASTRO_NODE_AUTOSTART = 'disabled';
const { handler } = await import('./dist/server/entry.mjs');

const compress = compression({
  // سطح ۴ brotli برای پاسخ‌های پویا: نزدیک به gzip سریع است و کوچک‌تر
  brotli: { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } },
});

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

http
  .createServer((req, res) => compress(req, res, () => handler(req, res)))
  .listen(port, host, () => console.log(`listening on http://${host}:${port}`));

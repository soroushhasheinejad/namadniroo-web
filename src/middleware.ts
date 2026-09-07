import { defineMiddleware } from 'astro:middleware';
import { readSessionCookie, resolveSession } from './server/auth/session';
import { lookupRedirect } from './server/repos/redirects';
import { ensureMigrated } from './server/db/migrate';
import { startOutboxWorker } from './server/services/outbox';

/**
 * کارهایی که پیش از رسیدن درخواست به صفحه انجام می‌شود.
 *
 * سه وظیفه دارد: آماده‌سازی یک‌بارهٔ اپ، اعمال ریدایرکت‌های تعریف‌شده در
 * پنل، و شناسایی کاربر واردشده برای صفحات پنل.
 */

/* راه‌اندازی فقط یک بار در طول عمر پروسه انجام می‌شود. اینجا صدا زده
   می‌شود نه در فایل ورودی سرور، چون آداپتورهای مختلف نقطهٔ شروع متفاوتی
   دارند ولی همه از middleware عبور می‌کنند. */
let booted: Promise<void> | null = null;
function boot(): Promise<void> {
  booted ??= ensureMigrated().then(() => {
    startOutboxWorker();
  });
  return booted;
}

/** مسیرهایی که اصلاً به دیتابیس کار ندارند */
const SKIP = /^\/(_astro|assets|fonts|downloads|favicon)/;

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  if (SKIP.test(pathname)) return next();

  try {
    await boot();
  } catch (err) {
    /* اگر دیتابیس در دسترس نباشد، صفحات استاتیک باید همچنان سرو شوند —
       سایت معرفی شرکت نباید به‌خاطر خرابی دیتابیس کاملاً از دسترس خارج
       شود. فقط بخش‌هایی که واقعاً داده می‌خواهند خطا می‌دهند. */
    console.error('[boot] آماده‌سازی ناموفق بود:', err);
  }

  /* ریدایرکت‌های مدیریت‌شده از پنل. پیش از هر کار دیگری بررسی می‌شوند تا
     نشانی قدیمی حتی اگر صفحه‌ای هم‌نام داشته باشد، منتقل شود. */
  const redirect = await lookupRedirect(pathname).catch(() => null);
  if (redirect) {
    return context.redirect(redirect.toPath, redirect.statusCode as 301 | 302);
  }

  /* شناسایی کاربر فقط برای مسیرهای پنل. صفحات عمومی نه به آن نیاز دارند
     نه باید هزینهٔ کوئری‌اش را بدهند. */
  if (pathname.startsWith('/admin')) {
    context.locals.user = await resolveSession(readSessionCookie(context)).catch(() => null);
  }

  return next();
});

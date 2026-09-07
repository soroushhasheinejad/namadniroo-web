import { defineMiddleware } from 'astro:middleware';
import { readSessionCookie, resolveSession } from './server/auth/session';
import { lookupRedirect } from './server/repos/redirects';
import { startOutboxWorker } from './server/services/outbox';

/**
 * کارهایی که پیش از رسیدن درخواست به صفحه انجام می‌شود: اعمال ریدایرکت‌های
 * تعریف‌شده در پنل، و شناسایی کاربر واردشده برای صفحات پنل.
 *
 * اینجا هیچ اتصالی به دیتابیس باز نمی‌شود مگر واقعاً لازم باشد. ساختار
 * دیتابیس هم هنگام اولین اتصال به‌روز می‌شود، نه اینجا — چون این تابع در
 * زمان بیلد هم برای صفحات ثابت اجرا می‌گردد و آن‌ها نباید به دیتابیس نیاز
 * داشته باشند.
 */

/** مسیرهایی که اصلاً به دیتابیس کار ندارند */
const SKIP = /^\/(_astro|assets|fonts|downloads|favicon|media)/;

/** worker فقط روی سرور واقعی روشن می‌شود، نه در زمان بیلد */
let workerStarted = false;

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  if (SKIP.test(pathname)) return next();

  /* صفحات از پیش ساخته‌شده در زمان بیلد از اینجا رد می‌شوند. آن‌ها فایل
     ثابت‌اند و نه ریدایرکت پویا برایشان معنا دارد نه کاربر واردشده — پس
     نباید بیلد را وادار به اتصال به دیتابیس کنند. */
  if (context.isPrerendered) return next();

  if (!workerStarted && !import.meta.env.DEV) {
    workerStarted = true;
    startOutboxWorker();
  }

  /* ریدایرکت‌های مدیریت‌شده از پنل. پیش از هر کار دیگری بررسی می‌شوند تا
     نشانی قدیمی حتی اگر صفحه‌ای هم‌نام داشته باشد، منتقل شود.
     خطای دیتابیس نباید سایت را از کار بیندازد: بدترین حالت این است که یک
     ریدایرکت اعمال نشود و کاربر صفحهٔ ۴۰۴ ببیند. */
  const redirect = await lookupRedirect(pathname).catch(() => null);
  if (redirect) {
    return context.redirect(redirect.toPath, redirect.statusCode as 301 | 302);
  }

  /* شناسایی کاربر فقط برای مسیرهای پنل. صفحات عمومی نه به آن نیاز دارند
     نه باید هزینهٔ کوئری‌اش را بدهند. */
  if (pathname.startsWith('/admin')) {
    const user = await resolveSession(readSessionCookie(context)).catch(() => null);
    context.locals.user = user;

    /* محافظت از دسترسی اینجا انجام می‌شود و نه در قالب صفحات پنل: قالب یک
       کامپوننت است و `return` داخل آن جلوی رندر صفحه را نمی‌گیرد، پس صفحه
       با وجود ریدایرکت هم ساخته می‌شد. اینجا درخواست پیش از رسیدن به صفحه
       متوقف می‌شود، و افزودن صفحهٔ تازه به پنل نمی‌تواند به‌اشتباه
       محافظت‌نشده بماند. */
    const isPublic = pathname === '/admin/login' || pathname === '/admin/logout';
    if (!user && !isPublic) {
      return context.redirect(`/admin/login?next=${encodeURIComponent(pathname)}`);
    }
  }

  return next();
});

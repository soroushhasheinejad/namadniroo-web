import { defineMiddleware } from 'astro:middleware';
import type { APIContext } from 'astro';
import { readSessionCookie, resolveSession } from './server/auth/session';
import { lookupRedirect } from './server/repos/redirects';
import { legacyPrefixRedirects } from './data/legacyRedirects';
import { startOutboxWorker } from './server/services/outbox';
import { startAnalyticsWorker } from './server/services/rollup';
import { identify } from './server/analytics/identity';
import { attributionFrom, deviceFrom, isBot } from './server/analytics/channel';
import { trackVisit } from './server/analytics/track';

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
    startAnalyticsWorker();
  }

  /* ریدایرکت‌های مدیریت‌شده از پنل. پیش از هر کار دیگری بررسی می‌شوند تا
     نشانی قدیمی حتی اگر صفحه‌ای هم‌نام داشته باشد، منتقل شود.
     خطای دیتابیس نباید سایت را از کار بیندازد: بدترین حالت این است که یک
     ریدایرکت اعمال نشود و کاربر صفحهٔ ۴۰۴ ببیند. */
  const redirect = await lookupRedirect(pathname).catch(() => null);
  if (redirect) {
    return context.redirect(redirect.toPath, redirect.statusCode as 301 | 302);
  }

  /* پیوندهای تاریخ‌دار وردپرس (`/۱۴۰۴/۰۶/۰۱/عنوان`). تک‌تکشان را نمی‌شود
     در جدول ریدایرکت نوشت — ده‌ها نوشته بودند و فهرستشان جایی نمانده. هر
     کدام که معادل دقیقی دارد در `legacyRedirects` آمده و بالاتر گرفته
     می‌شود؛ بقیه به جای صفحهٔ «پیدا نشد» به مجله می‌روند. */
  if (/^\/\d{4}\/\d{2}\/\d{2}\//.test(pathname)) {
    return context.redirect('/magazine', 301);
  }

  const prefix = legacyPrefixRedirects.find(([from]) => pathname.toLowerCase().startsWith(from));
  if (prefix) return context.redirect(prefix[1], 301);

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

  /* ثبت بازدید — بعد از ریدایرکت‌ها و پیش از رسیدن به صفحه.
     ترتیبش مهم است: نشانی‌ای که ۳۰۱ می‌خورد نباید به‌عنوان بازدید ثبت
     شود، وگرنه هر لینک قدیمی وردپرس دو بازدید می‌ساخت. */
  trackPageview(context);

  return next();
});

/**
 * بازدیدها سمت سرور ثبت می‌شوند و نه با اسکریپت مرورگر.
 *
 * سه مزیت دارد: افزونه‌های مسدودکننده نمی‌توانند خاموشش کنند، هیچ
 * جاوااسکریپتی به صفحه اضافه نمی‌شود، و آماری که می‌بینیم همان چیزی است
 * که سرور واقعاً سرو کرده.
 */
function trackPageview(context: APIContext): void {
  const { url, request, cookies } = context;

  /* فقط صفحه‌های واقعی: مسیرهای API، پنل و هر چیزی جز GET بازدید نیستند.
     (پنل عمداً ردیابی نمی‌شود — آمار سایت نباید با رفت‌وآمد خودمان در
     پنل مخلوط شود.) */
  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/admin') || url.pathname.startsWith('/api')) return;
  if (/^\/(health|ping|robots\.txt|sitemap\.xml|leads)$/.test(url.pathname)) return;

  const ua = request.headers.get('user-agent');
  if (isBot(ua)) return;

  const { visitorId, sessionId, newSession } = identify(cookies, url);
  trackVisit({
    visitorId,
    sessionId,
    newSession,
    path: url.pathname,
    device: deviceFrom(ua),
    attribution: attributionFrom(url, request.headers.get('referer'), url.hostname),
  });
}

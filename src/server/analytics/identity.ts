import { randomBytes } from 'node:crypto';
import type { AstroCookies } from 'astro';

/**
 * شناسایی بازدیدکننده با کوکی اول‌شخص.
 *
 * دو کوکی گذاشته می‌شود و هیچ‌کدام چیزی دربارهٔ خودِ آدم نمی‌گویند:
 *
 * - `nn_vid` — شناسهٔ تصادفی یک‌ساله. کلیدی است که مسیر کاربر را به هم
 *   وصل می‌کند: بدون آن، کسی که امروز مقاله خوانده و هفتهٔ بعد فرم پر
 *   کرده، دو غریبه‌اند.
 * - `nn_sid` — شناسهٔ نشست، با عمر ۳۰ دقیقه که در هر بازدید تازه می‌شود.
 *   نیم‌ساعت بی‌حرکتی یعنی نشست بعدی، بازدید تازه‌ای است.
 *
 * هر دو `httpOnly` هستند: هیچ اسکریپتی — نه مال ما نه مال دیگری — نباید
 * بتواند بخواندشان. رویدادهای سمت مرورگر هم شناسه را خودشان نمی‌فرستند؛
 * سرور آن را از کوکی همان درخواست برمی‌دارد، پس کسی نمی‌تواند خود را جای
 * بازدیدکنندهٔ دیگری جا بزند.
 */

export const VISITOR_COOKIE = 'nn_vid';
export const SESSION_COOKIE = 'nn_sid';

const YEAR = 365 * 24 * 60 * 60;
const SESSION_MINUTES = 30;

/** شناسهٔ ۲۲ کاراکتری — به‌اندازهٔ کافی تصادفی و کوتاه‌تر از UUID */
const newId = (): string => randomBytes(16).toString('base64url');

/** شناسه‌ای که از کوکی می‌آید باید دقیقاً همان شکلی باشد که خودمان ساخته‌ایم */
const VALID = /^[A-Za-z0-9_-]{16,32}$/;

export interface Identity {
  visitorId: string;
  sessionId: string;
  /** نشست تازه شروع شده — یعنی این بازدید، یک «ورود» است نه ادامهٔ پیمایش */
  newSession: boolean;
  /** اولین باری است که این مرورگر را می‌بینیم */
  newVisitor: boolean;
}

const isSecure = (url: URL): boolean => url.protocol === 'https:';

/**
 * شناسه‌ها را می‌خواند و اگر نبودند می‌سازد و روی پاسخ می‌نشاند.
 *
 * `sameSite: 'lax'` یعنی کوکی هنگام آمدن از لینک بیرونی (اینستاگرام،
 * گوگل) هم فرستاده می‌شود — که دقیقاً همان لحظه‌ای است که به آن نیاز
 * داریم — ولی در درخواست‌های جانبی سایت‌های دیگر نه.
 */
export function identify(cookies: AstroCookies, url: URL): Identity {
  const secure = isSecure(url);
  const existingVid = cookies.get(VISITOR_COOKIE)?.value;
  const existingSid = cookies.get(SESSION_COOKIE)?.value;

  const visitorId = existingVid && VALID.test(existingVid) ? existingVid : newId();
  const newVisitor = visitorId !== existingVid;

  const sessionId = existingSid && VALID.test(existingSid) ? existingSid : newId();
  const newSession = sessionId !== existingSid;

  if (newVisitor) {
    cookies.set(VISITOR_COOKIE, visitorId, {
      path: '/',
      maxAge: YEAR,
      httpOnly: true,
      sameSite: 'lax',
      secure,
    });
  }

  /* کوکی نشست در هر بازدید دوباره نوشته می‌شود تا مهلتش عقب برود؛ نشست
     وقتی تمام می‌شود که کاربر نیم‌ساعت هیچ صفحه‌ای باز نکند. */
  cookies.set(SESSION_COOKIE, sessionId, {
    path: '/',
    maxAge: SESSION_MINUTES * 60,
    httpOnly: true,
    sameSite: 'lax',
    secure,
  });

  return { visitorId, sessionId, newSession, newVisitor };
}

/**
 * فقط خواندن — برای مسیرهای API.
 *
 * اینجا شناسه ساخته نمی‌شود: درخواستی که کوکی ندارد یا از بیرون مرورگر
 * آمده یا اولین بازدیدش هنوز ثبت نشده. در هر دو حالت، ساختن شناسهٔ تازه
 * فقط یک بازدیدکنندهٔ بی‌مسیر به آمار اضافه می‌کرد.
 */
export function readIdentity(cookies: AstroCookies): { visitorId: string; sessionId: string } | null {
  const vid = cookies.get(VISITOR_COOKIE)?.value;
  const sid = cookies.get(SESSION_COOKIE)?.value;
  if (!vid || !VALID.test(vid)) return null;
  return { visitorId: vid, sessionId: sid && VALID.test(sid) ? sid : vid };
}

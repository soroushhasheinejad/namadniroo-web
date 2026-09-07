/**
 * محدودکنندهٔ نرخ درخواست — پنجرهٔ لغزان ساده، درون حافظهٔ همین پروسه.
 *
 * چرا درون حافظه: اپ روی یک نمونه اجرا می‌شود، پس یک شمارندهٔ مشترک لازم
 * نیست. اگر روزی چندنمونه‌ای شد، همین رابط را می‌شود روی Redis پیاده کرد
 * بدون این‌که مسیرهای فراخوان تغییر کنند.
 *
 * هدف جلوگیری از پرشدن دیسک/دیتابیس با ارسال خودکار فرم است، نه دفاع در
 * برابر حملهٔ گسترده — آن کار لایهٔ بالاتر (میزبان) است.
 */

interface Hit {
  /** زمان درخواست‌های داخل پنجره */
  times: number[];
}

const buckets = new Map<string, Hit>();

/** هر از چندگاهی کلیدهای مرده پاک می‌شوند تا حافظه بی‌نهایت رشد نکند. */
let lastSweep = Date.now();
function sweep(windowMs: number) {
  const now = Date.now();
  if (now - lastSweep < windowMs) return;
  lastSweep = now;
  for (const [key, hit] of buckets) {
    if (hit.times.every((t) => now - t > windowMs)) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** چند ثانیه دیگر دوباره اجازه دارد — برای هدر Retry-After */
  retryAfter: number;
}

/**
 * بررسی می‌کند کلید داده‌شده از سقف عبور کرده یا نه، و درخواست را می‌شمارد.
 *
 * @param key      شناسهٔ درخواست‌کننده (معمولاً IP)
 * @param limit    حداکثر تعداد مجاز در پنجره
 * @param windowMs طول پنجره به میلی‌ثانیه
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  sweep(windowMs);

  const now = Date.now();
  const hit = buckets.get(key) ?? { times: [] };
  hit.times = hit.times.filter((t) => now - t < windowMs);

  if (hit.times.length >= limit) {
    buckets.set(key, hit);
    const oldest = hit.times[0];
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - oldest)) / 1000) };
  }

  hit.times.push(now);
  buckets.set(key, hit);
  return { ok: true, retryAfter: 0 };
}

/**
 * آدرس واقعی درخواست‌کننده.
 *
 * اپ پشت پراکسی میزبان اجرا می‌شود، پس آدرس سوکت همیشه خود پراکسی است و
 * باید از هدرها خوانده شود. اولین مقدار در `x-forwarded-for` نزدیک‌ترین
 * چیز به آدرس کاربر است.
 */
export function clientIp(request: Request, fallback?: string): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]!.trim();
  return request.headers.get('x-real-ip') ?? fallback ?? 'unknown';
}

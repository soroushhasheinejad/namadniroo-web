import { getDb } from '../db/client';
import { media, type Media } from '../db/schema';
import { TAGS, cached } from '../cache';
import type { ImageRef } from '../repos/content';

/**
 * پیدا کردن تصویر از روی ارجاعی که در تنظیمات ذخیره شده.
 *
 * ارجاع‌ها در طول زمان سه شکل گرفته‌اند و هر سه باید کار کنند:
 *
 *   • کلید رسانه (`1a2b708483744df1`) — شکلی که پنل از این به بعد ذخیره
 *     می‌کند. یکتاست، چون از محتوای خود فایل ساخته می‌شود.
 *   • نام فایل اصلی (`activity-1.jpg`) — شکلی که اسلایدها تا امروز
 *     داشتند. خوانا است ولی یکتا نیست؛ دو فایل متفاوت می‌توانند یک نام
 *     داشته باشند.
 *   • مسیر ثابت (`/assets/brands/fronius.png`) — لوگوی برندها که هیچ‌وقت
 *     وارد کتابخانه نشده‌اند و از پوشهٔ public سرو می‌شوند.
 *
 * اگر فقط شکل اول شناخته می‌شد، اولین ذخیرهٔ هر بخش همهٔ تصاویر قدیمی را
 * بی‌صدا پاک می‌کرد.
 */

export function mediaIndex(): Promise<Map<string, Media>> {
  return cached('media:index', [TAGS.media], async () => {
    const db = await getDb();
    const rows = await db.select().from(media);
    const index = new Map<string, Media>();
    // نام فایل اول، کلید بعد: اگر نامی با کلیدی یکی شد، کلید برنده است
    for (const m of rows) if (m.originalName) index.set(m.originalName, m);
    for (const m of rows) index.set(m.key, m);
    return index;
  });
}

/** ارجاع → تصویر کامل برای قالب‌ها، یا null اگر پیدا نشد */
export function refFrom(
  index: Map<string, Media>,
  value: string | null | undefined,
  fallbackAlt: string,
): ImageRef | null {
  if (!value) return null;
  const m = index.get(value);
  if (!m) return null;
  return {
    key: m.key,
    url: m.url,
    alt: m.alt || fallbackAlt,
    width: m.width,
    height: m.height,
  };
}

/**
 * ارجاع → فقط نشانی، برای جاهایی که srcset لازم ندارند (مثل لوگوی برند).
 * مسیر ثابتِ قدیمی دست‌نخورده برگردانده می‌شود.
 */
export function urlFrom(index: Map<string, Media>, value: string | null | undefined): string | null {
  if (!value) return null;
  const m = index.get(value);
  if (m) return m.url;
  return value.startsWith('/') ? value : null;
}

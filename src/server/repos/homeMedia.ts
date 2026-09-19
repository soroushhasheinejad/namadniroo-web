import { mediaIndex, refFrom } from '../media/resolve';
import type { ImageRef } from './content';

/**
 * تصاویر هیرو و «درهای» صفحهٔ اصلی.
 *
 * ارجاع هر تصویر از «متن صفحات ← صفحهٔ اصلی» می‌آید و از کتابخانهٔ رسانه
 * خوانده می‌شود — ویراستار از پنل عوضش می‌کند. اگر تصویری پیدا نشود بخش
 * بی‌عکس ولی سالم نمایش داده می‌شود، نه خطا.
 *
 * هیرو عکس بی‌متن می‌خواهد: تیتر HTML واقعی است و پوسترهای قدیمی متن
 * چاپ‌شده روی خود داشتند.
 */
export async function homeImages(content: {
  hero: { image: string };
  doors: { items: { image: string; title: string }[] };
}): Promise<{ hero: ImageRef | null; doors: (ImageRef | null)[] }> {
  const index = await mediaIndex().catch(() => new Map());
  return {
    hero: refFrom(index, content.hero.image, 'نیروگاه خورشیدی اجراشده، نمای هوایی'),
    // به ترتیب ردیف‌ها، نه بر اساس نوع مخاطب — دو در می‌توانند یک نوع داشته باشند
    doors: content.doors.items.map((d) => refFrom(index, d.image, d.title)),
  };
}

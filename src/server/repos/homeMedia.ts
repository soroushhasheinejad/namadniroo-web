import { mediaIndex, refFrom } from '../media/resolve';
import type { ImageRef } from './content';
import { audiences } from '../../data/siteContent';

/**
 * تصاویر هیرو و «سه در» صفحهٔ اصلی.
 *
 * مثل بقیهٔ تصاویر سایت از کتابخانهٔ رسانه و با نام فایل خوانده می‌شوند،
 * پس با آپلود فایلی با همین نام در پنل عوض می‌شوند. اگر تصویری پیدا نشود
 * بخش بی‌عکس ولی سالم نمایش داده می‌شود، نه خطا.
 *
 * هیرو عکس بی‌متن می‌خواهد: تیتر حالا HTML واقعی است و پوسترهای قبلی
 * متن چاپ‌شده روی خود داشتند.
 */
export const HERO_IMAGE = 'area-3.jpg';

export async function homeImages(): Promise<{
  hero: ImageRef | null;
  doors: Record<string, ImageRef | null>;
}> {
  const index = await mediaIndex();
  const doors: Record<string, ImageRef | null> = {};
  for (const a of audiences) doors[a.who] = refFrom(index, a.image, a.title);
  return {
    hero: refFrom(index, HERO_IMAGE, 'نیروگاه خورشیدی اجراشده، نمای هوایی'),
    doors,
  };
}

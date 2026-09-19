import { getSetting, type ImageRef } from './content';
import { mediaIndex, refFrom } from '../media/resolve';
import * as fallback from '../../data/siteContent';

/**
 * اسلایدهای صفحهٔ اصلی و تصاویر حوزه‌های فعالیت.
 *
 * تا پیش از این، پوسترها با `import` مستقیم از `src/assets` می‌آمدند و
 * Astro در زمان بیلد بهینه‌شان می‌کرد. حالا که صفحهٔ اصلی روی سرور رندر
 * می‌شود، همان کد تصویر را در *لحظهٔ درخواست* می‌ساخت — کندتر، و مهم‌تر
 * این‌که ویراستار نمی‌توانست پوستر را از پنل عوض کند.
 *
 * پس این تصاویر هم مثل بقیه از کتابخانهٔ رسانه می‌آیند: از پیش به WebP در
 * چند اندازه تبدیل شده‌اند و با کش دائمی سرو می‌شوند.
 *
 * ارجاع با «نام فایل» است نه شناسهٔ عددی، چون ویراستار در پنل نام را
 * می‌بیند و می‌فهمد، و اگر تصویری هنوز آپلود نشده باشد فقط همان اسلاید بی
 * تصویر می‌ماند نه این‌که صفحه خطا بدهد.
 */

export interface HeroSlide {
  label: string;
  icon: string;
  image: ImageRef | null;
}

export interface PromoSlide {
  href: string;
  alt: string;
  image: ImageRef | null;
}

export interface AreaBlock {
  id: string;
  eyebrow: string;
  icon: string;
  title: string;
  desc: string;
  items: string[];
  cta: { href: string; label: string };
  proof: { label: string; value: string; tail: string };
  reverse?: boolean;
  image: ImageRef | null;
}

/** نام فایل پیش‌فرض هر اسلاید، وقتی تنظیمات چیزی نگفته باشد */
export const DEFAULT_HERO_IMAGES = ['activity-1.jpg', 'activity-2.jpg', 'activity-3.jpg'];
export const DEFAULT_PROMO_IMAGES = ['banner-1.jpg', 'banner-2.jpg'];
export const DEFAULT_AREA_IMAGES = ['area-1.jpg', 'area-2.jpg', 'area-3.jpg'];


export async function heroSlides(): Promise<HeroSlide[]> {
  const [config, byName] = await Promise.all([
    getSetting<{ label: string; icon: string; image?: string }[]>(
      'heroSlides',
      fallback.heroSlides as never,
    ),
    mediaIndex(),
  ]);

  return config.map((slide, i) => ({
    label: slide.label,
    icon: slide.icon,
    image: refFrom(byName, slide.image ?? DEFAULT_HERO_IMAGES[i], slide.label),
  }));
}

export async function promoSlides(): Promise<PromoSlide[]> {
  const [config, byName] = await Promise.all([
    getSetting<{ href: string; alt: string; image?: string }[]>(
      'promoSlides',
      fallback.promoSlides as never,
    ),
    mediaIndex(),
  ]);

  return config.map((slide, i) => ({
    href: slide.href,
    alt: slide.alt,
    image: refFrom(byName, slide.image ?? DEFAULT_PROMO_IMAGES[i], slide.alt),
  }));
}

export async function areaBlocks(): Promise<AreaBlock[]> {
  const [config, byName] = await Promise.all([
    getSetting<Omit<AreaBlock, 'image'>[] & { image?: string }[]>(
      'areas',
      fallback.areas as never,
    ),
    mediaIndex(),
  ]);

  return config.map((area, i) => ({
    ...area,
    image: refFrom(byName, (area as { image?: string }).image ?? DEFAULT_AREA_IMAGES[i], area.title),
  }));
}

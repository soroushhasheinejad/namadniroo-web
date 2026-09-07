import { getImage } from 'astro:assets';
import { heroSlides, promoSlides } from '../data/site';

/**
 * تصاویر اسلایدرها، یک بار ساخته و تا پایان بیلد نگه داشته می‌شوند.
 *
 * دلیل وجود این فایل: پوستر اسلاید اول بزرگ‌ترین عنصر صفحهٔ اصلی (LCP) است و
 * باید در <head> با <link rel="preload"> اعلام شود. تگ preload را فقط صفحه
 * می‌تواند به Base بدهد، ولی خودِ تصویر را کامپوننت اسلایدر رندر می‌کند؛
 * پس هر دو باید دقیقاً یک آدرس را ببینند. اگر هر کدام getImage را جدا صدا
 * بزنند، آدرس‌ها یکی می‌مانند ولی این تضمین در کد ثبت نمی‌شود — این ماژول
 * همان تضمین است.
 */

export interface SliderImage {
  /** آدرس نسخهٔ بزرگ — مقدار src */
  src: string;
  /** srcset دو اندازه‌ای تا موبایل نسخهٔ ۱۹۲۰ پیکسلی را دانلود نکند */
  srcset: string;
  width: number;
  height: number;
}

/** دو اندازه از یک تصویر می‌سازد و آن‌ها را در قالب srcset برمی‌گرداند. */
async function twoSizes(
  img: ImageMetadata,
  large: number,
  small: number,
  quality: number,
): Promise<SliderImage> {
  const [lg, sm] = await Promise.all([
    getImage({ src: img, format: 'webp', width: large, quality }),
    getImage({ src: img, format: 'webp', width: small, quality: quality - 2 }),
  ]);

  return {
    src: lg.src,
    srcset: `${sm.src} ${small}w, ${lg.src} ${large}w`,
    width: large,
    // نسبت تصویر اصلی حفظ می‌شود تا مرورگر پیش از دانلود، جای درست را کنار
    // بگذارد و چیدمان صفحه بعد از لود نپرد (CLS)
    height: Math.round((large * img.height) / img.width),
  };
}

let heroCache: Promise<SliderImage[]> | null = null;
let promoCache: Promise<SliderImage[]> | null = null;

export function heroImages(): Promise<SliderImage[]> {
  heroCache ??= Promise.all(heroSlides.map((s) => twoSizes(s.img, 1920, 900, 80)));
  return heroCache;
}

export function promoImages(): Promise<SliderImage[]> {
  promoCache ??= Promise.all(promoSlides.map((s) => twoSizes(s.img, 1600, 800, 80)));
  return promoCache;
}

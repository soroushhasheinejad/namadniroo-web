import { BRANDS, brandKey } from './shopTaxonomy';
import { fa } from '../utils';

/**
 * عنوان، توضیح و داده‌ی ساختاریافته‌ی پیش‌فرض صفحه‌ی محصول.
 *
 * چرا این شکل: در Search Console (آذر ۱۴۰۵) مردم مدل را با توان و نوع
 * جست‌وجو می‌کنند، نه با نام کاتالوگ: «اینورتر آنگرید ۱۰ کیلووات kaco»،
 * «اینورتر خورشیدی ۱۰۰ کیلووات آنگرید deye سه فاز مدل sun-100k-g03». صفحه‌ها
 * در رتبه‌ی ۳ تا ۸ بودند و کلیک نمی‌گرفتند، چون عنوان قبلی فقط نام کاتالوگ
 * و برند تکراری بود («… | KACO — فروشگاه نماد نیرو»). حالا توان و نوع
 * اتصال در عنوان می‌آید و نام فارسی برند (دای، دیه، فرونیوس…) در توضیح.
 *
 * عنوان و توضیحی که در پنل نوشته شود همیشه بر این‌ها مقدم است.
 */

export interface SeoProduct {
  name: string;
  brand: string;
  kind: 'inverter' | 'panel' | 'storage' | 'accessory' | 'tool';
  subkind: string | null;
  powerMin: number | null;
  powerMax: number | null;
  official: boolean;
  inStock: boolean | null;
  price: number | null;
  image?: { url: string } | null;
}

/** نام فارسی برند، همان‌طور که در جست‌وجوها نوشته می‌شود */
export const BRAND_FA: Record<string, string> = {
  'ae-solar': 'ای‌ای سولار',
  fronius: 'فرونیوس',
  sungrow: 'سانگرو',
  deye: 'دای یا دیه',
  goodwe: 'گودوی',
  sineng: 'سینانگ',
  sunways: 'سانویز',
  trina: 'ترینا',
  kaco: 'کاکو',
  huawei: 'هوآوی',
};

const UNIT: Record<SeoProduct['kind'], string> = {
  inverter: 'کیلووات',
  panel: 'وات',
  storage: 'کیلووات‌ساعت',
  accessory: '',
  tool: '',
};

/** نام برند برای نمایش: «Deye»، «AE Solar»؛ اگر ناشناخته بود همان مقدار دیتابیس */
export function brandDisplay(raw: string): string {
  return BRANDS[brandKey(raw)] ?? raw.replace(/&nbsp;/g, ' ').trim();
}

/** خط‌تیره‌ی نشکن نام کاتالوگ را برای موتور جست‌وجو به خط‌تیره‌ی معمولی برمی‌گرداند */
const plainName = (name: string) => name.replace(/‑/g, '-').replace(/&nbsp;/g, ' ').trim();

/** «۱۰ کیلووات» یا «۳ تا ۸٫۲ کیلووات»؛ رشته‌ی خالی اگر توان معلوم نیست */
export function powerText(p: SeoProduct): string {
  const unit = UNIT[p.kind];
  if (!unit) return '';
  const min = p.powerMin ?? p.powerMax;
  const max = p.powerMax ?? p.powerMin;
  if (min == null || max == null) return '';
  return min === max ? `${fa(max)} ${unit}` : `${fa(min)} تا ${fa(max)} ${unit}`;
}

/** نوع اتصال به زبان جست‌وجوکننده */
function typeText(p: SeoProduct): string {
  if (p.kind === 'inverter') return p.subkind === 'hybrid' ? 'هیبرید' : p.subkind === 'string' ? 'آنگرید' : '';
  if (p.kind === 'panel') return p.subkind === 'bifacial' ? 'دوطرفه' : '';
  if (p.kind === 'storage') return p.subkind === 'all-in-one' ? 'اینورتر هیبرید و باتری یکپارچه' : 'باتری لیتیومی';
  return '';
}

export function productTitle(p: SeoProduct): string {
  const name = plainName(p.name);
  const brand = brandDisplay(p.brand);
  const withBrand = name.toLowerCase().includes(brand.toLowerCase().split(' ')[0]!) ? name : `${name} ${brand}`;
  /* برای ذخیره‌ساز، ظرفیت مهم‌تر از نوع است («باتری ۱۲ کیلووات ساعت deye») */
  const qualifier = [powerText(p), p.kind === 'storage' ? '' : typeText(p)].filter(Boolean).join(' ');
  return qualifier ? `${withBrand}، ${qualifier} | نماد نیرو` : `${withBrand} | نماد نیرو`;
}

export function productDescription(p: SeoProduct): string {
  const name = plainName(p.name);
  const key = brandKey(p.brand);
  const brand = brandDisplay(p.brand);
  const brandFa = BRAND_FA[key];
  const facts = [powerText(p), typeText(p)].filter(Boolean).join('، ');
  return [
    `${name}${brandFa ? ` از ${brand} (${brandFa})` : ''}${facts ? `؛ ${facts}` : ''}.`,
    p.official ? 'از نمایندگی رسمی با ضمانت رسمی.' : '',
    p.inStock ? 'موجود در انبار نماد نیرو.' : '',
    'مشخصات از دیتاشیت سازنده، مشاوره‌ی انتخاب و استعلام قیمت روز.',
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * داده‌ی ساختاریافته‌ی Product فقط وقتی قیمت داریم.
 *
 * گوگل Product بدون `offers`، `review` یا `aggregateRating` را نامعتبر
 * می‌شمارد (خطای Search Console: «Either "offers", "review", or
 * "aggregateRating" should be specified» روی ۱۰ صفحه). فروشگاه فعلاً قیمت
 * آنلاین ندارد، و قیمت صفر یا ساختگی بدتر از نبودنش است؛ پس تا وقتی قیمت در
 * پنل ثبت نشده، Product نمی‌آید و breadcrumb کار خودش را می‌کند. با ثبت
 * قیمت (به ریال، برای IRR) Product با Offer خودکار برمی‌گردد.
 */
export function productSchema(p: SeoProduct, url: string, description: string): Record<string, unknown> | null {
  if (!p.price) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: plainName(p.name),
    description,
    brand: { '@type': 'Brand', name: brandDisplay(p.brand) },
    ...(p.image ? { image: new URL(p.image.url, 'https://namadniroo.ir').href } : {}),
    offers: {
      '@type': 'Offer',
      url,
      price: p.price,
      priceCurrency: 'IRR',
      availability: p.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: { '@id': 'https://namadniroo.ir/#organization' },
    },
  };
}

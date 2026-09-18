import { getAllSettings } from './content';
import * as defaults from '../../data/siteContent';

/**
 * متن‌های سراسری سایت، همان‌طور که صفحات باید ببینند.
 *
 * تا پیش از این، صفحهٔ «تنظیمات» پنل در دیتابیس می‌نوشت ولی هدر، فوتر،
 * آمار و بقیه مستقیم از `siteContent.ts` می‌خواندند — یعنی ویراستار متنی را
 * عوض می‌کرد، «ذخیره شد» می‌دید، و روی سایت هیچ اتفاقی نمی‌افتاد. همهٔ
 * مصرف‌کننده‌ها حالا از همین تابع می‌خوانند.
 *
 * مقادیر پیش‌فرض همان فایل `siteContent.ts` است و مقدار دیتابیس رویش
 * می‌نشیند:
 *
 *   • شیء‌ها **فیلد به فیلد** ادغام می‌شوند. اگر فیلد تازه‌ای به پیش‌فرض
 *     اضافه شود (مثلاً ایمیل) و رکورد قدیمی دیتابیس آن را نداشته باشد،
 *     فیلد از پیش‌فرض پر می‌شود و قالبی که به آن نیاز دارد نمی‌شکند.
 *   • فهرست‌ها **کامل جایگزین** می‌شوند. ادغام آرایه معنا ندارد: اگر
 *     ویراستار یک ردیف منو را حذف کرده، باید حذف بماند.
 *   • مقدار با شکل نادرست نادیده گرفته می‌شود و پیش‌فرض می‌نشیند — صفحهٔ
 *     عمومی هرگز به‌خاطر یک رکورد خراب از کار نمی‌افتد.
 *
 * خواندن از کش درون‌حافظه‌ای است و با هر ذخیره در پنل باطل می‌شود، پس
 * هزینه‌اش در هر درخواست ناچیز است و تغییر بلافاصله دیده می‌شود.
 */

export type SiteInfo = typeof defaults.site & {
  email?: string;
  address?: string;
};
export type NavItem = (typeof defaults.nav)[number];
export type Stat = (typeof defaults.stats)[number];
export type TimelineItem = (typeof defaults.timeline)[number];
export type Capability = (typeof defaults.capabilities)[number];
export type Brand = (typeof defaults.brands)[number];

export interface SiteSettings {
  site: SiteInfo;
  portfolio: typeof defaults.portfolio;
  nav: NavItem[];
  stats: Stat[];
  timeline: TimelineItem[];
  capabilities: Capability[];
  brands: Brand[];
  clients: string[];
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** شیء دیتابیس را فیلد به فیلد روی پیش‌فرض می‌نشاند */
function mergeObject<T extends object>(fallback: T, stored: unknown): T {
  if (!isObject(stored)) return fallback;
  const out = { ...fallback } as Record<string, unknown>;
  for (const [key, value] of Object.entries(stored)) {
    // رشتهٔ خالی یعنی «پاک کرده‌ام»، ولی null و undefined یعنی «دست نزده‌ام»
    if (value !== null && value !== undefined) out[key] = value;
  }
  return out as T;
}

/** فهرست دیتابیس را کامل جایگزین می‌کند، مگر شکلش آرایه نباشد */
function pickList<T>(fallback: readonly T[], stored: unknown): T[] {
  return Array.isArray(stored) ? (stored as T[]) : [...fallback];
}

/** ادغام خالص، جدا از دیتابیس — تا بشود مستقل تستش کرد */
export function resolveSiteSettings(stored: Record<string, unknown>): SiteSettings {
  return {
    site: mergeObject<SiteInfo>(defaults.site, stored.site),
    portfolio: mergeObject(defaults.portfolio, stored.portfolio),
    nav: pickList(defaults.nav, stored.nav),
    stats: pickList(defaults.stats, stored.stats),
    timeline: pickList(defaults.timeline, stored.timeline),
    capabilities: pickList(defaults.capabilities, stored.capabilities),
    brands: pickList(defaults.brands, stored.brands),
    clients: pickList(defaults.clients, stored.clients),
  };
}

export async function getSiteSettings(): Promise<SiteSettings> {
  /* اگر دیتابیس در دسترس نباشد، سایت با متن پیش‌فرض بالا می‌آید و نه با
     صفحهٔ خطا. برای سایت معرفی شرکت، متن کمی قدیمی خیلی بهتر از هیچ است. */
  const stored = await getAllSettings().catch((err) => {
    console.error('[settings] خواندن تنظیمات ناموفق بود؛ پیش‌فرض‌ها استفاده می‌شوند:', err);
    return {} as Record<string, unknown>;
  });
  return resolveSiteSettings(stored);
}

import type { AstroGlobal } from 'astro';
import { parseForm } from './fields';
import { SECTIONS, type Section } from './settingsSections';
import { getAllSettings, setSetting } from '../server/repos/content';
import { resolveSiteSettings } from '../server/repos/siteSettings';
import { resolveSeoSettings } from '../server/repos/seoSettings';
import { DEFAULT_AREA_IMAGES, DEFAULT_PROMO_IMAGES } from '../server/repos/slides';
import * as defaults from '../data/siteContent';

/**
 * منطق مشترک صفحه‌های تنظیمات پنل — «متن‌های سایت» و «تنظیمات سئو».
 *
 * هر دو صفحه همین را صدا می‌زنند و فقط گروه بخش‌هایشان فرق دارد. مسیر
 * جداگانه دارند تا منوی پنل بداند کدام فعال است.
 */

type Group = NonNullable<Section['group']>;
type Role = 'admin' | 'editor' | 'sales';

export interface SettingsView {
  sections: Section[];
  current: Section;
  formValue: unknown;
  error: string | null;
  saved: boolean;
}

/** بخش‌هایی از یک گروه که این نقش اجازهٔ دیدنشان را دارد */
export function visibleSections(group: Group, role: Role): Section[] {
  return SECTIONS.filter(
    (s) => (s.group ?? 'site') === group && (!s.roles || s.roles.includes(role as 'admin' | 'editor')),
  );
}

/**
 * درخواست را پردازش می‌کند. اگر ذخیره موفق بود نشانی بازگشت را می‌دهد تا
 * صفحه با یک GET تازه بارگذاری شود؛ وگرنه آنچه برای نمایش لازم است.
 */
export async function runSettingsPage(
  Astro: AstroGlobal,
  group: Group,
  basePath: string,
): Promise<{ redirect: string } | SettingsView> {
  const user = Astro.locals.user!;
  const sections = visibleSections(group, user.role);
  let current = sections.find((s) => s.key === Astro.url.searchParams.get('s')) ?? sections[0]!;

  let error: string | null = null;
  let rejected: unknown = undefined;

  if (Astro.request.method === 'POST') {
    const form = await Astro.request.formData();
    // بخشی که این کاربر نمی‌بیند، ذخیره هم نمی‌شود — حتی با فرم دست‌ساز
    const section = sections.find((s) => s.key === String(form.get('section') ?? ''));

    if (!section) {
      error = 'این بخش وجود ندارد یا اجازهٔ ویرایشش را ندارید.';
    } else {
      current = section;
      const parsed = parseForm(section.root, form);
      const value = section.fromForm ? section.fromForm(parsed) : parsed;

      const problem = validate(section.key, value);
      if (problem) {
        error = problem;
        /* اگر فرم با مقدار ذخیره‌شده دوباره ساخته می‌شد، هر چیزی که ویراستار
           تایپ کرده بود از بین می‌رفت — ده تغییر به‌خاطر یک خطا. */
        rejected = value;
      } else {
        await setSetting(section.key, value, user.id);
        return { redirect: `${basePath}?s=${section.key}&saved=1` };
      }
    }
  }

  const stored = await getAllSettings();
  const raw = rejected !== undefined ? rejected : currentValue(current.key, stored);

  return {
    sections,
    current,
    formValue: current.toForm ? current.toForm(raw) : raw,
    error,
    saved: Astro.url.searchParams.get('saved') === '1' && !error,
  };
}

/* ============================================================
   مقدار فعلی هر بخش
   ============================================================ */

/** تصویر پیش‌فرض را در ردیف‌هایی که هنوز تصویری انتخاب نکرده‌اند می‌نشاند،
    تا انتخابگر همان تصویری را نشان دهد که الان روی سایت است. */
function withImages<T extends Record<string, unknown>>(rows: T[], fallbacks: string[]): T[] {
  return rows.map((r, i) => ({ ...r, image: (r.image as string) || fallbacks[i] || '' }));
}

function currentValue(key: string, stored: Record<string, unknown>): unknown {
  switch (key) {
    case 'site':
    case 'portfolio':
    case 'nav':
    case 'stats':
    case 'timeline':
    case 'capabilities':
    case 'brands':
    case 'clients':
      return resolveSiteSettings(stored)[key];
    case 'promoSlides':
      return withImages((stored.promoSlides as never) ?? [...defaults.promoSlides], DEFAULT_PROMO_IMAGES);
    case 'areas':
      return withImages((stored.areas as never) ?? defaults.areas, DEFAULT_AREA_IMAGES);
    case 'seoDefaults':
      return resolveSeoSettings(stored).defaults;
    case 'business':
      return resolveSeoSettings(stored).business;
    case 'webmaster':
      return resolveSeoSettings(stored).webmaster;
    case 'robots':
      return typeof stored.robots === 'string' ? stored.robots : 'User-agent: *\nAllow: /';
  }
  return stored[key];
}

/* ============================================================
   بررسی پیش از ذخیره
   ============================================================ */

const isUrl = (v: string) => /^https?:\/\/[^\s]+\.[^\s]+$/.test(v);

/** فقط چیزهایی رد می‌شوند که سایت یا دادهٔ گوگل را واقعاً خراب می‌کنند */
export function validate(key: string, value: unknown): string | null {
  if (key === 'nav') {
    const bad = (value as { label: string; href: string }[]).find(
      (n) => !n.label || !/^(\/|https?:\/\/|#)/.test(n.href),
    );
    if (bad) {
      return `پیوند «${bad.label || 'بی‌نام'}» ناقص است. هر پیوند منو عنوان لازم دارد و نشانی‌اش باید با / یا http شروع شود.`;
    }
  }

  if (key === 'site') {
    const site = value as { name: string; phoneHref: string };
    if (!site.name) return 'نام شرکت نمی‌تواند خالی باشد — در عنوان همهٔ صفحات استفاده می‌شود.';
    if (site.phoneHref && !/^tel:\+?\d+$/.test(site.phoneHref)) {
      return 'پیوند تماس باید به شکل tel:03432521416 باشد — بدون فاصله و خط تیره.';
    }
  }

  if (key === 'business') {
    const b = value as {
      telephone: string;
      foundingYear: string;
      sameAs: string[];
      geo: { lat: string; lng: string };
    };
    if (b.telephone && !/^\+\d{8,15}$/.test(b.telephone)) {
      return 'تلفن باید به شکل بین‌المللی باشد، مثل +983432521416 — با + و بدون صفر ابتدایی یا فاصله.';
    }
    if (b.foundingYear && !/^\d{4}$/.test(b.foundingYear)) {
      return 'سال تأسیس باید یک سال میلادی چهاررقمی باشد، مثل 2008.';
    }
    const badUrl = b.sameAs.find((u) => !isUrl(u));
    if (badUrl) return `«${badUrl}» نشانی کامل نیست. هر صفحهٔ شبکهٔ اجتماعی باید با https:// شروع شود.`;
    const hasLat = b.geo.lat !== '';
    const hasLng = b.geo.lng !== '';
    if (hasLat !== hasLng) return 'مختصات را کامل بنویسید — هم عرض و هم طول جغرافیایی، یا هیچ‌کدام.';
    if (hasLat && (!Number.isFinite(Number(b.geo.lat)) || !Number.isFinite(Number(b.geo.lng)))) {
      return 'مختصات باید عدد باشد، مثل 30.2839 — با ارقام انگلیسی و نقطه.';
    }
  }

  if (key === 'webmaster') {
    const w = value as { ga4: string; gtm: string };
    if (w.ga4 && !/^G-[A-Z0-9]+$/.test(w.ga4)) return 'شناسهٔ Google Analytics باید به شکل G-XXXXXXXXXX باشد.';
    if (w.gtm && !/^GTM-[A-Z0-9]+$/.test(w.gtm)) return 'شناسهٔ Tag Manager باید به شکل GTM-XXXXXXX باشد.';
  }

  return null;
}

import { getAllSettings } from './content';
import { deepMerge } from '../content/merge';
import {
  type Business,
  type SeoDefaults,
  type Webmaster,
  businessDefaults,
  seoDefaults,
  webmasterDefaults,
} from '../../data/seoDefaults';

/**
 * تنظیمات سئوی سراسری، ادغام‌شده روی پیش‌فرض‌ها.
 *
 * مثل `getSiteSettings`: خواندن از کش، و در صورت خرابی دیتابیس بازگشت به
 * پیش‌فرض — سرصفحهٔ همهٔ صفحات به این وابسته است و نباید سایت را پایین بیاورد.
 */

export interface SeoSettings {
  defaults: SeoDefaults;
  business: Business;
  webmaster: Webmaster;
}

export function resolveSeoSettings(stored: Record<string, unknown>): SeoSettings {
  return {
    defaults: deepMerge(seoDefaults, stored.seoDefaults),
    business: deepMerge(businessDefaults, stored.business),
    webmaster: deepMerge(webmasterDefaults, stored.webmaster),
  };
}

export async function getSeoSettings(): Promise<SeoSettings> {
  const stored = await getAllSettings().catch((err) => {
    console.error('[seo] خواندن تنظیمات سئو ناموفق بود؛ پیش‌فرض‌ها استفاده می‌شوند:', err);
    return {} as Record<string, unknown>;
  });
  return resolveSeoSettings(stored);
}

import { normalizePhone } from '../../lib/phone';

/**
 * اعتبارسنجی فرم درخواست مشاوره.
 *
 * بدون کتابخانه نوشته شده چون قواعد کم و ثابت‌اند و تنها چیزی که واقعاً
 * لازم داریم پیام خطای فارسی است — که در هر حال باید دستی نوشته شود.
 */

export const MAX_FIELD = 200;

export interface QuoteInput {
  name: string;
  phone: string;
  phoneNormalized: string;
  capacity: string;
  area: string;
  source: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export type ValidationResult =
  | { ok: true; value: QuoteInput }
  | { ok: false; message: string; status: 400 | 422 };

/** حذف شکست خط (تا هدر ایمیل تزریق نشود) و کوتاه‌کردن به سقف مجاز */
export function clean(value: unknown): string {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, MAX_FIELD);
}

export function validateQuote(body: Record<string, unknown>): ValidationResult {
  const name = clean(body.name);
  const phone = clean(body.phone);

  if (!name || !phone) {
    return { ok: false, message: 'نام و شمارهٔ تماس الزامی است', status: 422 };
  }

  if (name.length < 2) {
    return { ok: false, message: 'نام واردشده کوتاه است', status: 422 };
  }

  const phoneNormalized = normalizePhone(phone);
  if (!phoneNormalized) {
    return { ok: false, message: 'شمارهٔ تماس معتبر نیست', status: 422 };
  }

  return {
    ok: true,
    value: {
      name,
      phone,
      phoneNormalized,
      capacity: clean(body.capacity),
      area: clean(body.area),
      source: clean(body.source),
      utmSource: clean(body.utm_source) || undefined,
      utmMedium: clean(body.utm_medium) || undefined,
      utmCampaign: clean(body.utm_campaign) || undefined,
    },
  };
}

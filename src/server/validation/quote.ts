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
  /** راه تماس دلخواه کاربر، به فارسی — یا رشتهٔ خالی */
  contactVia: string;
  source: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  /** خلاصهٔ برآورد ماشین‌حساب، اگر لید از آن صفحه آمده باشد */
  estimate?: string;
  /** شناسهٔ کاربر گوگل آنالیتیکس، اگر مرورگر کوکی‌اش را داشته باشد */
  gaClientId?: string;
  /**
   * کاربر از برآورد چه می‌خواست: `review` یعنی بررسی با کارشناس، `pdf`
   * فقط برگهٔ برآورد. فرم‌های دیگر این را نمی‌فرستند.
   */
  intent?: 'review' | 'pdf';
  /** پاسخ‌های کوتاه فرم بررسی (زمین یا سقف، زمان شروع)، به فارسی */
  qualifiers?: string;
}

/* فقط همین سه مقدار پذیرفته می‌شود. متن آزاد از بیرون در این ستون
   می‌توانست هر چیزی باشد، و تیم فروش بر اساسش تصمیم می‌گیرد. */
export const CONTACT_VIA: Record<string, string> = {
  call: 'تماس تلفنی',
  bale: 'پیام در بله',
  whatsapp: 'واتساپ',
};

/* پرسش‌های کوتاه فرم بررسی برآورد. مثل CONTACT_VIA فقط کلید پذیرفته
   می‌شود و برچسب از همین‌جا می‌آید، چون کارشناس بر اساسش اولویت می‌دهد. */
export const SITE_STATUS: Record<string, string> = {
  land: 'زمین دارد',
  roof: 'سقف سوله یا ساختمان دارد',
  none: 'هنوز زمین یا سقف ندارد',
};

export const TIMELINE: Record<string, string> = {
  now: 'می‌خواهد همین حالا شروع کند',
  soon: 'شروع در ۳ تا ۶ ماه آینده',
  research: 'فعلاً در حال بررسی است',
};

const INTENTS = new Set(['review', 'pdf']);

export type ValidationResult =
  | { ok: true; value: QuoteInput }
  | { ok: false; message: string; status: 400 | 422 };

/** حذف شکست خط (تا هدر ایمیل تزریق نشود) و کوتاه‌کردن به سقف مجاز */
export function clean(value: unknown, limit: number = MAX_FIELD): string {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, limit);
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
      contactVia: CONTACT_VIA[clean(body.contact_via)] ?? '',
      source: clean(body.source),
      utmSource: clean(body.utm_source) || undefined,
      utmMedium: clean(body.utm_medium) || undefined,
      utmCampaign: clean(body.utm_campaign) || undefined,
      /* سقف بلندتر از بقیهٔ فیلدها چون یک جملهٔ کامل است، ولی همچنان
         محدود — این متن از سمت کاربر می‌آید. */
      estimate: clean(body.estimate, 400) || undefined,
      /* شکل استاندارد `1234567890.1234567890` است؛ هر چیز دیگری دور
         ریخته می‌شود تا ستون با دادهٔ بی‌معنی پر نشود. */
      gaClientId: /^\d{6,12}\.\d{8,12}$/.test(clean(body.ga_client_id, 40))
        ? clean(body.ga_client_id, 40)
        : undefined,
      intent: INTENTS.has(clean(body.intent)) ? (clean(body.intent) as 'review' | 'pdf') : undefined,
      qualifiers:
        [SITE_STATUS[clean(body.site)], TIMELINE[clean(body.timeline)]].filter(Boolean).join(' · ') ||
        undefined,
    },
  };
}

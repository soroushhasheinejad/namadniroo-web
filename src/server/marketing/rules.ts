/**
 * قواعدی که جلوی پیام را می‌گیرند.
 *
 * این فایل مهم‌ترین بخش اتوماسیون است، چون تنها چیزی است که میان یک
 * اشتباه و پیامک‌باران مشتریان واقعی ایستاده. هر قاعده یک دلیل روشن
 * برمی‌گرداند که در پنل کنار همان پیام نوشته می‌شود؛ «نرفت» بدون دلیل،
 * بدترین چیزی است که تیم فروش می‌تواند ببیند.
 */
import type { Contact } from '../db/schema';

export type SkipReason =
  | 'opted_out'
  | 'no_consent'
  | 'weekly_cap'
  | 'quiet_hours'
  | 'too_soon'
  | 'no_phone';

export const SKIP_LABELS: Record<SkipReason, string> = {
  opted_out: 'لغو عضویت کرده',
  no_consent: 'رضایت پیامکی ندارد',
  weekly_cap: 'سقف هفتگی پر است',
  quiet_hours: 'ساعت سکوت',
  too_soon: 'فاصله از پیام قبلی کم است',
  no_phone: 'شماره ندارد',
};

export interface SendPolicy {
  /** بیشترین پیام تبلیغاتی در هفت روز */
  weeklyCap: number;
  /** کمترین فاصله از پیام قبلی، به ساعت */
  minGapHours: number;
  /** بازهٔ مجاز ارسال به وقت تهران */
  quietFrom: number;
  quietTo: number;
}

export const DEFAULT_POLICY: SendPolicy = {
  weeklyCap: 2,
  minGapHours: 24,
  /* پیام تبلیغاتی ساعت ۱۱ شب، مشتری را می‌پراند نه جذب می‌کند. */
  quietFrom: 9,
  quietTo: 21,
};

/** ساعت تهران، مستقل از ساعت سرور */
export function tehranHour(at: Date): number {
  const s = at.toLocaleString('en-US', { timeZone: 'Asia/Tehran', hour: '2-digit', hour12: false });
  return Number(s);
}

export interface CheckInput {
  contact: Pick<
    Contact,
    'phoneNormalized' | 'marketingConsent' | 'optedOutAt' | 'messages7d' | 'lastMessagedAt'
  >;
  at: Date;
  policy?: SendPolicy;
  /**
   * پیام تراکنشی پاسخ به کار خود کاربر است (پیگیری درخواستی که خودش ثبت
   * کرده)، پس رضایت تبلیغاتی و سقف هفتگی شاملش نمی‌شود — ولی ساعت سکوت
   * همچنان رعایت می‌شود.
   */
  transactional?: boolean;
}

/** `null` یعنی مجاز است؛ وگرنه دلیل نرفتن */
export function checkSend(input: CheckInput): SkipReason | null {
  const { contact, at, transactional } = input;
  const policy = input.policy ?? DEFAULT_POLICY;

  if (!contact.phoneNormalized) return 'no_phone';
  if (contact.optedOutAt) return 'opted_out';

  const hour = tehranHour(at);
  if (hour < policy.quietFrom || hour >= policy.quietTo) return 'quiet_hours';

  if (transactional) return null;

  if (!contact.marketingConsent) return 'no_consent';
  if (contact.messages7d >= policy.weeklyCap) return 'weekly_cap';

  if (contact.lastMessagedAt) {
    const gapHours = (at.getTime() - contact.lastMessagedAt.getTime()) / 3_600_000;
    if (gapHours < policy.minGapHours) return 'too_soon';
  }

  return null;
}

/**
 * نزدیک‌ترین زمان مجاز بعدی.
 *
 * وقتی پیامی به ساعت سکوت می‌خورد، انداختنش بهتر از فرستادنش است ولی
 * بهتر از هر دو، فرستادن در اولین ساعت مجاز صبح است.
 */
export function nextAllowedTime(at: Date, policy: SendPolicy = DEFAULT_POLICY): Date {
  const hour = tehranHour(at);
  if (hour >= policy.quietFrom && hour < policy.quietTo) return at;

  const next = new Date(at);
  const hoursAhead = hour < policy.quietFrom ? policy.quietFrom - hour : 24 - hour + policy.quietFrom;
  next.setTime(next.getTime() + hoursAhead * 3_600_000);
  next.setMinutes(0, 0, 0);
  return next;
}

/* ============================================================
   متغیرهای متن پیام
   ============================================================ */

/**
 * `{{first_name}}` و امثالش را جایگزین می‌کند.
 *
 * متغیر ناشناخته با رشتهٔ خالی پر می‌شود، نه اینکه خودِ `{{…}}` در پیام
 * مشتری بماند — چیزی که هر پنل پیامکی حداقل یک بار سرش آبروریزی کرده.
 */
export function fillTemplate(body: string, vars: Record<string, string | null | undefined>): string {
  return body
    .replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) => vars[key.toLowerCase()] ?? '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

/** نام کوچک از نام کامل — برای `{{first_name}}` */
export function firstName(full: string | null | undefined): string {
  if (!full) return '';
  return full.trim().split(/\s+/)[0] ?? '';
}

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_POLICY,
  checkSend,
  fillTemplate,
  firstName,
  nextAllowedTime,
  tehranHour,
} from './rules';
import { localPhone, smsSize } from './sms';

/** ساختن لحظه‌ای با ساعت مشخص به وقت تهران */
const atTehranHour = (hour: number): Date => {
  const d = new Date('2026-10-03T00:00:00Z');
  for (let i = 0; i < 48; i++) {
    if (tehranHour(d) === hour) return d;
    d.setTime(d.getTime() + 3_600_000);
  }
  throw new Error('ساعت پیدا نشد');
};

const noon = atTehranHour(12);

const contact = (over: Partial<Parameters<typeof checkSend>[0]['contact']> = {}) => ({
  phoneNormalized: '+989121112233',
  marketingConsent: true,
  optedOutAt: null,
  messages7d: 0,
  lastMessagedAt: null,
  ...over,
});

describe('قواعد ارسال', () => {
  it('در شرایط عادی اجازه می‌دهد', () => {
    expect(checkSend({ contact: contact(), at: noon })).toBeNull();
  });

  it('لغو عضویت، مطلق است — حتی برای پیام تراکنشی', () => {
    const at = noon;
    const c = contact({ optedOutAt: new Date('2026-01-01') });
    expect(checkSend({ contact: c, at })).toBe('opted_out');
    expect(checkSend({ contact: c, at, transactional: true })).toBe('opted_out');
  });

  it('بدون رضایت، پیام تبلیغاتی نمی‌رود ولی تراکنشی می‌رود', () => {
    const c = contact({ marketingConsent: false });
    expect(checkSend({ contact: c, at: noon })).toBe('no_consent');
    expect(checkSend({ contact: c, at: noon, transactional: true })).toBeNull();
  });

  it('سقف هفتگی را رعایت می‌کند', () => {
    const c = contact({ messages7d: DEFAULT_POLICY.weeklyCap });
    expect(checkSend({ contact: c, at: noon })).toBe('weekly_cap');
    // تراکنشی از سقف تبلیغاتی مستثناست
    expect(checkSend({ contact: c, at: noon, transactional: true })).toBeNull();
  });

  it('فاصلهٔ کم از پیام قبلی را می‌گیرد', () => {
    const c = contact({ lastMessagedAt: new Date(noon.getTime() - 2 * 3_600_000) });
    expect(checkSend({ contact: c, at: noon })).toBe('too_soon');
  });

  it('ساعت سکوت حتی برای تراکنشی رعایت می‌شود', () => {
    const night = atTehranHour(23);
    expect(checkSend({ contact: contact(), at: night })).toBe('quiet_hours');
    expect(checkSend({ contact: contact(), at: night, transactional: true })).toBe('quiet_hours');
  });

  it('بامداد هم ساعت سکوت است', () => {
    expect(checkSend({ contact: contact(), at: atTehranHour(5) })).toBe('quiet_hours');
  });
});

describe('زمان مجاز بعدی', () => {
  it('در ساعت مجاز، همان لحظه را می‌دهد', () => {
    expect(nextAllowedTime(noon).getTime()).toBe(noon.getTime());
  });

  it('بامداد را به صبح همان روز می‌برد', () => {
    const next = nextAllowedTime(atTehranHour(5));
    expect(tehranHour(next)).toBe(DEFAULT_POLICY.quietFrom);
  });

  it('شب را به صبح روز بعد می‌برد', () => {
    const night = atTehranHour(23);
    const next = nextAllowedTime(night);
    expect(tehranHour(next)).toBe(DEFAULT_POLICY.quietFrom);
    expect(next.getTime()).toBeGreaterThan(night.getTime());
  });
});

describe('متن پیام', () => {
  it('متغیرها را پر می‌کند', () => {
    expect(fillTemplate('{{first_name}} عزیز، سلام', { first_name: 'نگار' })).toBe('نگار عزیز، سلام');
  });

  it('متغیر ناشناخته را خالی می‌گذارد، نه اینکه در پیام مشتری بماند', () => {
    expect(fillTemplate('سلام {{unknown}}!', {})).toBe('سلام !');
  });

  it('نام کوچک را از نام کامل در می‌آورد', () => {
    expect(firstName('نگار حسینی')).toBe('نگار');
    expect(firstName(null)).toBe('');
  });
});

describe('اندازه و شمارهٔ پیامک', () => {
  it('پیام کوتاه فارسی یک بخش است', () => {
    expect(smsSize('سلام').parts).toBe(1);
  });

  it('از ۷۰ نویسه که رد شود، دو بخش می‌شود', () => {
    expect(smsSize('ا'.repeat(71)).parts).toBe(2);
    expect(smsSize('ا'.repeat(70)).parts).toBe(1);
  });

  it('پیام خالی هزینه ندارد', () => {
    expect(smsSize('')).toEqual({ chars: 0, parts: 0 });
  });

  it('شمارهٔ بین‌المللی را به شکل داخلی در می‌آورد', () => {
    expect(localPhone('+989121112233')).toBe('09121112233');
    expect(localPhone('+983432521416')).toBe('03432521416');
  });
});

import { describe, expect, it } from 'vitest';
import { MAX_FIELD, clean, validateQuote } from './quote';

describe('clean', () => {
  it('شکست خط را حذف می‌کند تا هدر ایمیل تزریق نشود', () => {
    expect(clean('علی\r\nBcc: attacker@evil.test')).toBe('علی Bcc: attacker@evil.test');
  });

  it('فیلد بلند را کوتاه می‌کند', () => {
    expect(clean('x'.repeat(500))).toHaveLength(MAX_FIELD);
  });

  it('مقدار غایب را به رشتهٔ خالی تبدیل می‌کند', () => {
    expect(clean(undefined)).toBe('');
    expect(clean(null)).toBe('');
  });
});

describe('validateQuote', () => {
  const valid = { name: 'سروش هاشمی‌نژاد', phone: '۰۹۱۳۱۲۳۴۵۶۷' };

  it('ورودی درست را می‌پذیرد و شماره را نرمال می‌کند', () => {
    const result = validateQuote(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.name).toBe('سروش هاشمی‌نژاد');
    // شکل واردشده دست‌نخورده می‌ماند
    expect(result.value.phone).toBe('۰۹۱۳۱۲۳۴۵۶۷');
    expect(result.value.phoneNormalized).toBe('+989131234567');
  });

  it('راه تماس را فقط از میان گزینه‌های مجاز می‌پذیرد', () => {
    const ok = validateQuote({ ...valid, contact_via: 'bale' });
    expect(ok.ok && ok.value.contactVia).toBe('پیام در بله');

    // مقدار ناشناخته به‌جای ذخیرهٔ متن آزاد، خالی می‌شود
    const odd = validateQuote({ ...valid, contact_via: 'fax<script>' });
    expect(odd.ok && odd.value.contactVia).toBe('');
  });

  it('نبود نام یا شماره را رد می‌کند', () => {
    expect(validateQuote({ phone: '09131234567' })).toMatchObject({ ok: false, status: 422 });
    expect(validateQuote({ name: 'علی' })).toMatchObject({ ok: false, status: 422 });
    expect(validateQuote({})).toMatchObject({ ok: false, status: 422 });
  });

  it('نام یک‌حرفی را رد می‌کند', () => {
    expect(validateQuote({ ...valid, name: 'ع' })).toMatchObject({ ok: false });
  });

  it('شمارهٔ نامعتبر را رد می‌کند', () => {
    const result = validateQuote({ ...valid, phone: '۱۲۳' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('معتبر');
  });

  it('فیلدهای اختیاری خالی را undefined می‌گذارد نه رشتهٔ خالی', () => {
    const result = validateQuote(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.utmSource).toBeUndefined();
  });

  it('پارامترهای کمپین را برمی‌دارد', () => {
    const result = validateQuote({ ...valid, utm_source: 'instagram', utm_campaign: 'bahar' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.utmSource).toBe('instagram');
    expect(result.value.utmCampaign).toBe('bahar');
  });
});

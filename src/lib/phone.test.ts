import { describe, expect, it } from 'vitest';
import { displayPhone, normalizePhone, toLatinDigits } from './phone';

describe('toLatinDigits', () => {
  it('ارقام فارسی را تبدیل می‌کند', () => {
    expect(toLatinDigits('۰۹۱۳۱۲۳۴۵۶۷')).toBe('09131234567');
  });

  it('ارقام عربی را هم تبدیل می‌کند', () => {
    expect(toLatinDigits('٠٩١٢')).toBe('0912');
  });

  it('به متن غیرعددی دست نمی‌زند', () => {
    expect(toLatinDigits('تماس ۰۹۱۲')).toBe('تماس 0912');
  });
});

describe('normalizePhone', () => {
  it('شکل‌های گوناگون یک موبایل را به یک خروجی می‌رساند', () => {
    const expected = '+989131234567';
    for (const input of [
      '09131234567',
      '۰۹۱۳۱۲۳۴۵۶۷',
      '+989131234567',
      '00989131234567',
      '989131234567',
      '9131234567',
      '0913-123-4567',
      '0913 123 4567',
      '(0913) 1234567',
    ]) {
      expect(normalizePhone(input), input).toBe(expected);
    }
  });

  it('شمارهٔ ثابت با کد شهر را می‌پذیرد', () => {
    expect(normalizePhone('۰۳۴۳۲۵۲۱۴۱۶')).toBe('+983432521416');
    expect(normalizePhone('02112345678')).toBe('+982112345678');
  });

  it('شمارهٔ نامعتبر را رد می‌کند', () => {
    for (const input of ['', '123', '0913123456', '09131234567890', 'سلام', '+1234567890']) {
      expect(normalizePhone(input), input).toBeNull();
    }
  });
});

describe('displayPhone', () => {
  it('شکل یکتا را دوباره خوانا می‌کند', () => {
    expect(displayPhone('+989131234567')).toBe('۰۹۱۳۱۲۳۴۵۶۷');
  });
});

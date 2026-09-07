import { describe, expect, it } from 'vitest';
import { hashPassword, suggestPassword, verifyPassword } from './password';

describe('hashPassword', () => {
  it('رمز خام را در خروجی نمی‌گذارد', async () => {
    const hash = await hashPassword('رمز-محرمانه');
    expect(hash).not.toContain('رمز-محرمانه');
    expect(hash.startsWith('scrypt$')).toBe(true);
  });

  it('برای یک رمز، دو بار هش متفاوت می‌سازد', async () => {
    const [a, b] = await Promise.all([hashPassword('یکسان'), hashPassword('یکسان')]);
    expect(a).not.toBe(b);
  });
});

describe('verifyPassword', () => {
  it('رمز درست را می‌پذیرد', async () => {
    const hash = await hashPassword('Hunter2!');
    expect(await verifyPassword('Hunter2!', hash)).toBe(true);
  });

  it('رمز نادرست را رد می‌کند', async () => {
    const hash = await hashPassword('Hunter2!');
    expect(await verifyPassword('hunter2!', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('هش خراب را بدون پرتاب خطا رد می‌کند', async () => {
    for (const bad of ['', 'نامعتبر', 'bcrypt$aa$bb', 'scrypt$only-one-part']) {
      expect(await verifyPassword('هرچه', bad), bad).toBe(false);
    }
  });

  it('رمزهای طولانی و یونیکد را درست بررسی می‌کند', async () => {
    const password = 'رمز عبور فارسی با فاصله و ۱۲۳';
    const hash = await hashPassword(password);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword(password + ' ', hash)).toBe(false);
  });
});

describe('suggestPassword', () => {
  it('رمز تصادفی با طول کافی می‌سازد', () => {
    const a = suggestPassword();
    expect(a.length).toBeGreaterThanOrEqual(16);
    expect(a).not.toBe(suggestPassword());
  });
});

import { describe, expect, it } from 'vitest';
import { clientIp, rateLimit } from './rateLimit';

describe('rateLimit', () => {
  it('تا سقف اجازه می‌دهد و بعد رد می‌کند', () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 3, 60_000).ok, `درخواست ${i + 1}`).toBe(true);
    }
    expect(rateLimit(key, 3, 60_000).ok).toBe(false);
  });

  it('کلیدهای متفاوت روی هم اثر ندارند', () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    rateLimit(a, 1, 60_000);
    expect(rateLimit(a, 1, 60_000).ok).toBe(false);
    expect(rateLimit(b, 1, 60_000).ok).toBe(true);
  });

  it('زمان انتظار را برمی‌گرداند', () => {
    const key = `retry-${Math.random()}`;
    rateLimit(key, 1, 60_000);
    const blocked = rateLimit(key, 1, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(blocked.retryAfter).toBeLessThanOrEqual(60);
  });

  it('بعد از گذشت پنجره دوباره اجازه می‌دهد', async () => {
    const key = `window-${Math.random()}`;
    expect(rateLimit(key, 1, 30).ok).toBe(true);
    expect(rateLimit(key, 1, 30).ok).toBe(false);
    await new Promise((r) => setTimeout(r, 45));
    expect(rateLimit(key, 1, 30).ok).toBe(true);
  });
});

describe('clientIp', () => {
  const make = (headers: Record<string, string>) => new Request('https://x.test', { headers });

  it('اولین آدرس x-forwarded-for را می‌گیرد', () => {
    expect(clientIp(make({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }))).toBe('1.2.3.4');
  });

  it('در نبود آن سراغ x-real-ip می‌رود', () => {
    expect(clientIp(make({ 'x-real-ip': '9.9.9.9' }))).toBe('9.9.9.9');
  });

  it('در نبود هدر از آدرس سوکت استفاده می‌کند', () => {
    expect(clientIp(make({}), '127.0.0.1')).toBe('127.0.0.1');
  });
});

import { describe, expect, it } from 'vitest';
import { attributionFrom, deviceFrom, isBot, sourceLabel } from './channel';

const SITE = 'namadniroo.ir';
const at = (path = '/', query = '') => new URL(`https://${SITE}${path}${query}`);

describe('تشخیص کانال', () => {
  it('بدون ارجاع‌دهنده و بدون utm، مستقیم است', () => {
    expect(attributionFrom(at(), null, SITE).channel).toBe('direct');
  });

  it('ورود از گوگل، جست‌وجوی ارگانیک است', () => {
    expect(attributionFrom(at(), 'https://www.google.com/search?q=solar', SITE).channel).toBe('organic');
  });

  it('ورود از اینستاگرام، اجتماعی است', () => {
    expect(attributionFrom(at(), 'https://l.instagram.com/', SITE).channel).toBe('social');
  });

  it('utm صریح بر ارجاع‌دهنده مقدم است', () => {
    const a = attributionFrom(at('/', '?utm_medium=cpc&utm_source=google'), 'https://www.google.com/', SITE);
    expect(a.channel).toBe('paid');
    expect(a.utmMedium).toBe('cpc');
  });

  it('gclid بدون utm هم یعنی تبلیغ پولی', () => {
    expect(attributionFrom(at('/', '?gclid=abc123'), null, SITE).channel).toBe('paid');
  });

  it('fbclid بدون utm یعنی اجتماعی، نه پولی', () => {
    // متا این پارامتر را روی هر لینکی می‌گذارد، چه تبلیغ باشد چه پست عادی
    expect(attributionFrom(at('/', '?fbclid=xyz'), null, SITE).channel).toBe('social');
  });

  it('پیمایش داخل سایت، ورود تازه حساب نمی‌شود', () => {
    expect(attributionFrom(at('/shop'), `https://${SITE}/`, SITE).channel).toBe('internal');
    expect(attributionFrom(at('/shop'), `https://www.${SITE}/magazine`, SITE).channel).toBe('internal');
  });

  it('سایت ناشناس دیگر، ارجاع است', () => {
    expect(attributionFrom(at(), 'https://example.com/blog', SITE).channel).toBe('referral');
  });

  it('ارجاع‌دهندهٔ بدشکل، سایت را از کار نمی‌اندازد', () => {
    expect(attributionFrom(at(), 'نه-یک-نشانی', SITE).channel).toBe('direct');
  });

  it('مقدارهای طولانی کوتاه می‌شوند', () => {
    const long = 'x'.repeat(500);
    const a = attributionFrom(at('/', `?utm_source=${long}`), null, SITE);
    expect(a.utmSource!.length).toBeLessThanOrEqual(120);
  });
});

describe('نام مبدأ', () => {
  it('دامنهٔ ارجاع‌دهنده را بدون www نشان می‌دهد', () => {
    expect(sourceLabel({ utmSource: null, referrer: 'https://www.aparat.com/v/x', channel: 'social' })).toBe('aparat.com');
  });

  it('utm بر ارجاع‌دهنده مقدم است', () => {
    expect(sourceLabel({ utmSource: 'instagram-bio', referrer: 'https://t.co/x', channel: 'social' })).toBe('instagram-bio');
  });
});

describe('دستگاه', () => {
  it('آیفون موبایل است', () => {
    expect(deviceFrom('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15')).toBe('mobile');
  });

  it('اندروید بدون Mobile، تبلت است', () => {
    expect(deviceFrom('Mozilla/5.0 (Linux; Android 13; SM-X200) AppleWebKit/537.36')).toBe('tablet');
  });

  it('پیش‌فرض دسکتاپ است', () => {
    expect(deviceFrom('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe('desktop');
  });
});

describe('تشخیص ربات', () => {
  it('خزندهٔ گوگل ربات است', () => {
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true);
  });

  it('ابزارهای پایش و درخواست‌های برنامه‌ای ربات‌اند', () => {
    expect(isBot('curl/8.4.0')).toBe(true);
    expect(isBot('python-requests/2.31')).toBe(true);
    expect(isBot('Lighthouse')).toBe(true);
  });

  it('نبودِ User-Agent هم ربات حساب می‌شود', () => {
    expect(isBot(null)).toBe(true);
    expect(isBot('')).toBe(true);
  });

  it('مرورگر واقعی ربات نیست', () => {
    expect(
      isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'),
    ).toBe(false);
  });
});

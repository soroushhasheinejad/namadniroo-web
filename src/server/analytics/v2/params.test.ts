import { describe, expect, it } from 'vitest';
import { parseFilters, withDays, withFilter, withoutFilter, MAX_FILTERS } from './params';

const q = (search: string) => new URLSearchParams(search);
const at = (href: string) => new URL(href, 'https://namadniroo.ir');

describe('خواندن فیلتر از نشانی', () => {
  it('شکل ساده را می‌خواند', () => {
    expect(parseFilters(q('f=utmSource:is:instagram'))).toEqual([
      { dimension: 'utmSource', op: 'is', value: 'instagram' },
    ]);
  });

  it('مقدار خالی یعنی «ثبت‌نشده»، نه رشتهٔ خالی', () => {
    /* فرقشان در گزارش دیده می‌شود: بازدید بدون utm_campaign با بازدیدی که
       utm_campaign خالی فرستاده یکی نیست. */
    expect(parseFilters(q('f=utmCampaign:is:'))[0]!.value).toBeNull();
  });

  it('مقدار حاوی دونقطه سالم می‌ماند', () => {
    const f = parseFilters(q(`f=referrer:contains:${encodeURIComponent('https://t.me/x')}`));
    expect(f[0]!.value).toBe('https://t.me/x');
  });

  it('بُعد ناشناخته را دور می‌ریزد', () => {
    /* تنها سدّ تزریق: نام ستون هرگز از ورودی ساخته نمی‌شود. */
    expect(parseFilters(q('f=path;drop table events--:is:x'))).toEqual([]);
    expect(parseFilters(q('f=__proto__:is:x'))).toEqual([]);
  });

  it('شرط ناشناخته را دور می‌ریزد', () => {
    expect(parseFilters(q('f=path:regex:x'))).toEqual([]);
  });

  it('ورودی بدشکل را نادیده می‌گیرد', () => {
    expect(parseFilters(q('f=path&f=path:is'))).toEqual([]);
  });

  it('بیش از سقف فیلتر نمی‌پذیرد', () => {
    const many = Array.from({ length: MAX_FILTERS + 5 }, () => 'f=channel:is:paid').join('&');
    expect(parseFilters(q(many))).toHaveLength(MAX_FILTERS);
  });
});

describe('ساختن نشانی', () => {
  it('فیلتر اضافه می‌کند و بقیه را نگه می‌دارد', () => {
    const href = withFilter(at('/admin/analytics2?days=7&f=channel:is:paid'), {
      dimension: 'device',
      value: 'mobile',
      op: 'is',
    });
    expect(href).toContain('days=7');
    expect(href).toContain('channel%3Ais%3Apaid');
    expect(href).toContain('device%3Ais%3Amobile');
  });

  it('فیلتر تکراری را دوبار اضافه نمی‌کند', () => {
    const url = at('/admin/analytics2?f=channel:is:paid');
    const href = withFilter(url, { dimension: 'channel', value: 'paid', op: 'is' });
    expect(href.match(/f=/g)).toHaveLength(1);
  });

  it('فیلتر درست را حذف می‌کند', () => {
    const href = withoutFilter(at('/admin/analytics2?f=channel:is:paid&f=device:is:mobile'), 0);
    expect(href).not.toContain('channel');
    expect(href).toContain('device');
  });

  it('بازه را عوض می‌کند بی‌آنکه فیلترها بپرند', () => {
    const href = withDays(at('/admin/analytics2?days=7&f=channel:is:paid'), 90);
    expect(href).toContain('days=90');
    expect(href).toContain('channel');
  });
});

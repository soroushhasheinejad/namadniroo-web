import { describe, expect, it } from 'vitest';
import { resolveSiteSettings } from './siteSettings';
import * as defaults from '../../data/siteContent';

describe('resolveSiteSettings', () => {
  it('بدون هیچ رکوردی دقیقاً پیش‌فرض‌ها را می‌دهد', () => {
    /* قید اصلی: تا کسی در پنل چیزی عوض نکرده، سایت باید عیناً همان باشد
       که بود. */
    const s = resolveSiteSettings({});
    expect(s.site).toEqual(defaults.site);
    expect(s.nav).toEqual(defaults.nav);
    expect(s.stats).toEqual(defaults.stats);
    expect(s.brands).toEqual(defaults.brands);
    expect(s.clients).toEqual(defaults.clients);
  });

  it('فیلد ذخیره‌شده جای پیش‌فرض را می‌گیرد', () => {
    const s = resolveSiteSettings({ site: { phone: '۰۲۱ ۱۱۱۱۱۱۱۱' } });
    expect(s.site.phone).toBe('۰۲۱ ۱۱۱۱۱۱۱۱');
  });

  it('فیلدی که رکورد قدیمی ندارد از پیش‌فرض پر می‌شود', () => {
    /* رکوردی که پیش از افزودن فیلد تازه ذخیره شده، نباید قالب را بشکند. */
    const s = resolveSiteSettings({ site: { phone: 'x' } });
    expect(s.site.name).toBe(defaults.site.name);
    expect(s.site.city).toBe(defaults.site.city);
  });

  it('رشتهٔ خالی را نگه می‌دارد ولی null را نه', () => {
    const s = resolveSiteSettings({ site: { city: '', since: null } });
    expect(s.site.city).toBe('');
    expect(s.site.since).toBe(defaults.site.since);
  });

  it('فهرست را کامل جایگزین می‌کند نه ادغام', () => {
    /* اگر ویراستار ردیفی را حذف کرده، باید حذف بماند. */
    const nav = [{ href: '/shop', label: 'فروشگاه' }];
    expect(resolveSiteSettings({ nav }).nav).toEqual(nav);
  });

  it('فهرست خالی را می‌پذیرد', () => {
    expect(resolveSiteSettings({ clients: [] }).clients).toEqual([]);
  });

  it('مقدار با شکل نادرست را نادیده می‌گیرد', () => {
    const s = resolveSiteSettings({
      site: 'خراب',
      nav: { not: 'an array' },
      stats: null,
    });
    expect(s.site).toEqual(defaults.site);
    expect(s.nav).toEqual(defaults.nav);
    expect(s.stats).toEqual(defaults.stats);
  });

  it('پیش‌فرض را دست‌کاری نمی‌کند', () => {
    const before = JSON.stringify(defaults.site);
    const s = resolveSiteSettings({ site: { phone: 'x' } });
    s.site.name = 'تغییر';
    expect(JSON.stringify(defaults.site)).toBe(before);
  });
});

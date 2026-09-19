import { describe, expect, it } from 'vitest';
import { validate, visibleSections } from './settingsPage';
import { businessDefaults } from '../data/seoDefaults';

describe('visibleSections', () => {
  it('ابزار وبمستر فقط برای مدیر است', () => {
    /* فیلد «کد دلخواه در سرصفحه» بدون بررسی در همهٔ صفحات اجرا می‌شود؛
       ویراستار نباید به آن دسترسی داشته باشد. */
    expect(visibleSections('seo', 'admin').map((s) => s.key)).toContain('webmaster');
    expect(visibleSections('seo', 'editor').map((s) => s.key)).not.toContain('webmaster');
  });

  it('گروه‌ها جدا هستند', () => {
    const site = visibleSections('site', 'admin').map((s) => s.key);
    const seo = visibleSections('seo', 'admin').map((s) => s.key);
    expect(site).toContain('nav');
    expect(site).not.toContain('business');
    expect(seo).toContain('robots');
    expect(seo).not.toContain('nav');
  });
});

describe('validate', () => {
  const b = (patch: Partial<typeof businessDefaults>) => ({ ...businessDefaults, ...patch });

  it('پیش‌فرض‌های کسب‌وکار معتبرند', () => {
    expect(validate('business', businessDefaults)).toBeNull();
  });

  it('تلفن غیربین‌المللی را رد می‌کند', () => {
    expect(validate('business', b({ telephone: '03432521416' }))).toMatch(/بین‌المللی/);
    expect(validate('business', b({ telephone: '+98 34 3252' }))).toMatch(/بین‌المللی/);
  });

  it('نشانی ناقص شبکهٔ اجتماعی را رد می‌کند', () => {
    expect(validate('business', b({ sameAs: ['instagram.com/x'] }))).toMatch(/https/);
    expect(validate('business', b({ sameAs: ['https://instagram.com/x'] }))).toBeNull();
  });

  it('مختصات نیمه‌کاره یا غیرعددی را رد می‌کند', () => {
    expect(validate('business', b({ geo: { lat: '30.2', lng: '' } }))).toMatch(/کامل/);
    expect(validate('business', b({ geo: { lat: '۳۰', lng: '۵۷' } }))).toMatch(/عدد/);
    expect(validate('business', b({ geo: { lat: '30.2', lng: '57.1' } }))).toBeNull();
  });

  it('شناسهٔ نادرست Analytics و Tag Manager را رد می‌کند', () => {
    /* این شناسه‌ها مستقیم در کد اسکریپت نوشته می‌شوند؛ الگوی سخت‌گیرانه
       همان چیزی است که درجشان را امن می‌کند. */
    expect(validate('webmaster', { ga4: "G-1');alert(1)//", gtm: '' })).toMatch(/G-/);
    expect(validate('webmaster', { ga4: '', gtm: 'GTM-x y' })).toMatch(/GTM-/);
    expect(validate('webmaster', { ga4: 'G-ABC123', gtm: 'GTM-XYZ9' })).toBeNull();
  });
});

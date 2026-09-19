import { describe, expect, it } from 'vitest';
import { localBusinessSchema, organizationSchema } from './structuredData';
import { businessDefaults } from '../../data/seoDefaults';

describe('organizationSchema', () => {
  it('با پیش‌فرض‌ها همان دادهٔ هاردکد قبلی را می‌سازد', () => {
    /* تنها افزوده: استان در نشانی، که قبلاً فقط در بلوک LocalBusiness بود. */
    expect(organizationSchema(businessDefaults, 'نماد نیرو')).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': 'https://namadniroo.ir/#organization',
      name: 'نماد نیرو',
      alternateName: 'کرمان نماد نیرو',
      url: 'https://namadniroo.ir',
      logo: 'https://namadniroo.ir/assets/logo.png',
      foundingDate: '2008',
      telephone: '+983432521416',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'کرمان',
        addressRegion: 'کرمان',
        addressCountry: 'IR',
      },
      areaServed: 'IR',
      knowsAbout: businessDefaults.knowsAbout,
    });
  });

  it('فیلد خالی را حذف می‌کند نه این‌که رشتهٔ خالی بفرستد', () => {
    const s = organizationSchema({ ...businessDefaults, email: '', alternateName: '' }, 'x');
    expect(s).not.toHaveProperty('email');
    expect(s).not.toHaveProperty('alternateName');
  });

  it('شبکه‌های اجتماعی را به sameAs می‌برد', () => {
    const s = organizationSchema({ ...businessDefaults, sameAs: ['https://instagram.com/namadniroo'] }, 'x');
    expect(s.sameAs).toEqual(['https://instagram.com/namadniroo']);
  });
});

describe('localBusinessSchema', () => {
  it('با پیش‌فرض‌ها همان فیلدهای قبلی را دارد', () => {
    expect(localBusinessSchema(businessDefaults)).toMatchObject({
      '@type': 'LocalBusiness',
      '@id': 'https://namadniroo.ir/#localbusiness',
      name: 'شرکت کرمان نماد نیرو',
      telephone: '+983432521416',
      priceRange: '$$',
      address: { addressLocality: 'کرمان', addressRegion: 'کرمان', addressCountry: 'IR' },
    });
  });

  it('مختصات را عددی می‌فرستد', () => {
    const s = localBusinessSchema({ ...businessDefaults, geo: { lat: '30.2839', lng: '57.0834' } });
    expect(s.geo).toEqual({ '@type': 'GeoCoordinates', latitude: 30.2839, longitude: 57.0834 });
  });

  it('مختصات ناقص یا نامعتبر را نمی‌فرستد', () => {
    expect(localBusinessSchema({ ...businessDefaults, geo: { lat: '30.2', lng: '' } })).not.toHaveProperty('geo');
    expect(localBusinessSchema({ ...businessDefaults, geo: { lat: 'x', lng: 'y' } })).not.toHaveProperty('geo');
  });

  it('ساعات کاری را منتقل می‌کند', () => {
    const s = localBusinessSchema({ ...businessDefaults, openingHours: ['Sa-We 08:00-17:00'] });
    expect(s.openingHours).toEqual(['Sa-We 08:00-17:00']);
  });

  it('به سازمان پیوند می‌خورد', () => {
    expect(localBusinessSchema(businessDefaults).parentOrganization).toEqual({
      '@id': 'https://namadniroo.ir/#organization',
    });
  });
});

/**
 * مقادیر پیش‌فرض بخش‌های سئوی پنل.
 *
 * همان مقادیری است که تا امروز در `Base.astro` و صفحهٔ اصلی هاردکد بود، پس
 * تا کسی در پنل چیزی عوض نکرده، دادهٔ ساختاریافتهٔ سایت همان می‌ماند.
 */

export const seoDefaults = {
  description:
    'نماد نیرو — طراحی، اجرا و بهره‌برداری نیروگاه‌های خورشیدی، تأمین تجهیزات و سرمایه‌گذاری در انرژی‌های تجدیدپذیر.',
  /** ارجاع به تصویر کتابخانه؛ خالی یعنی تصویر ثابت og-default */
  image: '',
};

export const businessDefaults = {
  legalName: 'شرکت کرمان نماد نیرو',
  alternateName: 'کرمان نماد نیرو',
  telephone: '+983432521416',
  email: '',
  foundingYear: '2008',
  priceRange: '$$',
  address: {
    street: '',
    locality: 'کرمان',
    region: 'کرمان',
    postalCode: '',
    country: 'IR',
  },
  geo: { lat: '', lng: '' },
  openingHours: [] as string[],
  sameAs: [] as string[],
  knowsAbout: [
    'نیروگاه خورشیدی',
    'انرژی تجدیدپذیر',
    'پنل خورشیدی',
    'اینورتر خورشیدی',
    'طراحی مهندسی نیروگاه',
  ],
};

export const webmasterDefaults = {
  /* کد تأیید مالکیت در Google Search Console (روش «تگ HTML»).
     اینجا پیش‌فرض است تا با هر انتشار همراه کد برود و گم نشود؛ اگر روزی در
     پنل مقدار دیگری ذخیره شود، همان اولویت دارد. */
  google: 'd42MH3b7_CHMI9mHSJM4---Y3kM4yw5FBd_-fP5bEKA',
  bing: '',
  yandex: '',
  ga4: '',
  gtm: '',
  customHead: '',
};

export type SeoDefaults = typeof seoDefaults;
export type Business = typeof businessDefaults;
export type Webmaster = typeof webmasterDefaults;

import type { Business } from '../../data/seoDefaults';

/**
 * دادهٔ ساختاریافتهٔ کسب‌وکار (JSON-LD)، ساخته از تنظیمات پنل.
 *
 * تا امروز این‌ها در `Base.astro` و صفحهٔ اصلی هاردکد بود و مثلاً عوض شدن
 * تلفن یعنی تغییر کد. حالا از «سئو ← اطلاعات کسب‌وکار» ساخته می‌شوند.
 *
 * فیلد خالی حذف می‌شود نه با رشتهٔ خالی فرستاده: گوگل مقدار خالی را خطا
 * حساب می‌کند، ولی نبود فیلد اختیاری را نه.
 *
 * نکته: مقادیر JSON-LD با ارقام لاتین‌اند، برخلاف متن سایت که فارسی است.
 */

const SITE = 'https://namadniroo.ir';

type Json = Record<string, unknown>;

/** فقط کلیدهایی که مقدار دارند */
function compact(obj: Json): Json {
  const out: Json = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === '' || v === undefined || v === null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

function postalAddress(a: Business['address']): Json | undefined {
  const address = compact({
    streetAddress: a.street,
    addressLocality: a.locality,
    addressRegion: a.region,
    postalCode: a.postalCode,
    addressCountry: a.country,
  });
  return Object.keys(address).length ? { '@type': 'PostalAddress', ...address } : undefined;
}

function geo(g: Business['geo']): Json | undefined {
  const lat = Number.parseFloat(g.lat);
  const lng = Number.parseFloat(g.lng);
  // مختصات ناقص یا نامعتبر بدتر از نبودنش است — گوگل محل را اشتباه نشان می‌دهد
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return { '@type': 'GeoCoordinates', latitude: lat, longitude: lng };
}

export function organizationSchema(b: Business, siteName: string): Json {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE}/#organization`,
    name: siteName,
    alternateName: b.alternateName,
    url: SITE,
    logo: `${SITE}/assets/logo.png`,
    foundingDate: b.foundingYear,
    telephone: b.telephone,
    email: b.email,
    address: postalAddress(b.address),
    areaServed: 'IR',
    knowsAbout: b.knowsAbout,
    sameAs: b.sameAs,
  });
}

export function localBusinessSchema(b: Business): Json {
  return compact({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${SITE}/#localbusiness`,
    name: b.legalName,
    url: SITE,
    image: `${SITE}/assets/logo.png`,
    telephone: b.telephone,
    email: b.email,
    priceRange: b.priceRange,
    address: postalAddress(b.address),
    geo: geo(b.geo),
    openingHours: b.openingHours,
    /* کسب‌وکار محلی و سازمان یک موجودیت‌اند؛ این پیوند به گوگل می‌گوید دو
       بلوک را یکی حساب کند. */
    parentOrganization: { '@id': `${SITE}/#organization` },
  });
}

const SITE = 'https://namadniroo.ir';

/** تبدیل ارقام لاتین به فارسی */
export const fa = (v: string | number): string =>
  String(v).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

/** تبدیل ارقام فارسی به لاتین — برای محاسبات و داده‌های ساختاریافته */
export const toLatinDigits = (v: string): string =>
  v.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));

/**
 * تبدیل تاریخ شمسی به میلادی و خروجی به شکل ISO (YYYY-MM-DD).
 * لازم است چون داده‌های ساختاریافتهٔ schema.org فقط تاریخ میلادی می‌پذیرند،
 * در حالی که تاریخ مقالات در سایت شمسی و با ارقام فارسی ذخیره شده است.
 *
 * ورودی: '۱۴۰۴/۰۵/۱۲' یا '1404/05/12' — خروجی: '2025-08-03'
 * اگر ورودی قابل تفسیر نبود، undefined برمی‌گردد (تا داده‌ی غلط منتشر نشود).
 */
export function jalaliToISO(input: string): string | undefined {
  const parts = toLatinDigits(input).split(/[\/\-]/).map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return undefined;

  let [jy, jm, jd] = parts;
  if (jy < 1000 || jm < 1 || jm > 12 || jd < 1 || jd > 31) return undefined;

  jy += 1595;
  let days =
    -355668 +
    365 * jy +
    Math.floor(jy / 33) * 8 +
    Math.floor(((jy % 33) + 3) / 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);

  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }

  let gd = days + 1;
  const isLeap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const monthLengths = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  let gm = 0;
  while (gm < 12 && gd > monthLengths[gm]) {
    gd -= monthLengths[gm];
    gm++;
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  return `${gy}-${pad(gm + 1)}-${pad(gd)}`;
}

/**
 * ساخت BreadcrumbList برای داده‌های ساختاریافته.
 * ترتیب ورودی از کلی به جزئی است؛ «خانه» خودکار اول اضافه می‌شود.
 */
export function breadcrumbSchema(trail: { name: string; href?: string }[]) {
  const items = [{ name: 'خانه', href: '/' }, ...trail];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      ...(item.href ? { item: new URL(item.href, SITE).href } : {}),
    })),
  };
}

/** ساخت FAQPage از فهرست پرسش‌وپاسخ */
export function faqSchema(items: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}

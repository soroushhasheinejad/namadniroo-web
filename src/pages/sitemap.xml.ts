import type { APIRoute } from 'astro';
import { listArticles, listProducts } from '../server/repos/content';

export const prerender = false;

const SITE = 'https://namadniroo.ir';

/**
 * نقشهٔ سایت، ساخته‌شده از دیتابیس.
 *
 * قبلاً افزونهٔ Astro آن را در زمان بیلد می‌ساخت. حالا که محتوا از پنل عوض
 * می‌شود، آن نقشه از همان لحظهٔ اولین ویرایش کهنه می‌شد: مقالهٔ تازه تا
 * انتشار بعدی به گوگل معرفی نمی‌شد و مقالهٔ حذف‌شده همچنان در فهرست می‌ماند.
 *
 * `lastmod` هم دیگر تاریخ بیلد نیست بلکه زمان واقعی آخرین ویرایش هر صفحه
 * است — چیزی که گوگل برای تصمیم به خزش دوباره به آن نگاه می‌کند.
 */

interface Entry {
  path: string;
  lastmod?: Date;
  changefreq: string;
  priority: string;
}

/** صفحات ثابت سایت */
const STATIC_PAGES: Entry[] = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/activity', changefreq: 'monthly', priority: '0.8' },
  { path: '/projects', changefreq: 'weekly', priority: '0.8' },
  { path: '/shop', changefreq: 'weekly', priority: '0.9' },
  { path: '/ae-solar', changefreq: 'monthly', priority: '0.7' },
  { path: '/investment', changefreq: 'monthly', priority: '0.7' },
  { path: '/magazine', changefreq: 'weekly', priority: '0.8' },
  { path: '/about', changefreq: 'monthly', priority: '0.6' },
  { path: '/contact', changefreq: 'yearly', priority: '0.6' },
];

const escapeXml = (value: string): string =>
  value.replace(/[<>&'"]/g, (c) => `&${{ '<': 'lt', '>': 'gt', '&': 'amp', "'": 'apos', '"': 'quot' }[c]};`);

function urlEntry({ path, lastmod, changefreq, priority }: Entry): string {
  return [
    '  <url>',
    `    <loc>${escapeXml(SITE + path)}</loc>`,
    lastmod ? `    <lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : '',
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n');
}

export const GET: APIRoute = async () => {
  const [products, articles] = await Promise.all([listProducts(), listArticles()]);

  const entries: Entry[] = [
    ...STATIC_PAGES,

    /* صفحاتی که ویراستار `noindex` زده در نقشه نمی‌آیند — فرستادن نشانی‌ای
       که خودمان از گوگل پنهانش کرده‌ایم سیگنال متناقض است. */
    ...products
      .filter((p) => !p.noindex)
      .map((p) => ({
        path: `/shop/${p.slug}`,
        lastmod: p.updatedAt,
        changefreq: 'monthly',
        priority: '0.7',
      })),

    ...articles
      .filter((a) => !a.noindex)
      .map((a) => ({
        path: `/magazine/${a.slug}`,
        lastmod: a.updatedAt,
        changefreq: 'monthly',
        priority: '0.6',
      })),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(urlEntry),
    '</urlset>',
  ].join('\n');

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // یک ساعت کافی است: نقشه سنگین نیست و تازگی‌اش مهم‌تر از کش است
      'Cache-Control': 'public, max-age=3600',
    },
  });
};

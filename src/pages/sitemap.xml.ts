import type { APIRoute } from 'astro';
import { listArticles, listProducts } from '../server/repos/content';
import { getPageContent } from '../server/repos/pageContent';
import { PAGES } from '../data/pages';

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
  /** تصویر اصلی صفحه، برای دیده‌شدن در جست‌وجوی تصاویر گوگل */
  image?: string;
}

/**
 * بسامد و اولویت هر صفحهٔ ثابت.
 *
 * خودِ فهرست صفحات از `src/data/pages.ts` می‌آید، نه از اینجا: پیش‌تر این
 * فهرست جدا نگه داشته می‌شد و صفحهٔ «برآورد سرمایه‌گذاری» که بعداً اضافه
 * شد، هرگز واردش نشد. صفحه‌ای که اینجا نباشد با مقادیر معمولی می‌آید.
 */
const HINTS: Record<string, Pick<Entry, 'changefreq' | 'priority'>> = {
  '/': { changefreq: 'weekly', priority: '1.0' },
  '/shop': { changefreq: 'weekly', priority: '0.9' },
  '/activity': { changefreq: 'monthly', priority: '0.8' },
  '/projects': { changefreq: 'weekly', priority: '0.8' },
  '/magazine': { changefreq: 'weekly', priority: '0.8' },
  '/solar-calculator': { changefreq: 'monthly', priority: '0.8' },
  '/ae-solar': { changefreq: 'monthly', priority: '0.7' },
  '/investment': { changefreq: 'monthly', priority: '0.7' },
  '/about': { changefreq: 'monthly', priority: '0.6' },
  '/contact': { changefreq: 'yearly', priority: '0.6' },
};

/** صفحات ثابتی که باید در نقشه بیایند — بدون ۴۰۴ و بدون آن‌هایی که از گوگل پنهان شده‌اند */
async function staticPages(): Promise<Entry[]> {
  const pages = PAGES.filter((p) => p.path !== '/404');
  const contents = await Promise.all(pages.map((p) => getPageContent(p)));
  return pages
    .filter((_, i) => !(contents[i] as { seo?: { noindex?: boolean } }).seo?.noindex)
    .map((p) => ({ path: p.path, ...(HINTS[p.path] ?? { changefreq: 'monthly', priority: '0.6' }) }));
}

const escapeXml = (value: string): string =>
  value.replace(/[<>&'"]/g, (c) => `&${{ '<': 'lt', '>': 'gt', '&': 'amp', "'": 'apos', '"': 'quot' }[c]};`);

function urlEntry({ path, lastmod, changefreq, priority, image }: Entry): string {
  return [
    '  <url>',
    `    <loc>${escapeXml(SITE + path)}</loc>`,
    lastmod ? `    <lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : '',
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    image ? `    <image:image><image:loc>${escapeXml(new URL(image, SITE).href)}</image:loc></image:image>` : '',
    '  </url>',
  ]
    .filter(Boolean)
    .join('\n');
}

export const GET: APIRoute = async () => {
  const [products, articles, pages] = await Promise.all([listProducts(), listArticles(), staticPages()]);

  const entries: Entry[] = [
    ...pages,

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
        image: a.cover?.url,
      })),
  ];

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
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

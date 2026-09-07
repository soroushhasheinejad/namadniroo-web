import { asc } from 'drizzle-orm';
import { getDb } from '../db/client';
import { articles, media, products, projects } from '../db/schema';
import { fa } from '../../utils';

/**
 * بررسی سلامت سئوی محتوا.
 *
 * هدف این نیست که همه‌چیز را بررسی کند، بلکه این است که چند خطای پرتکرار و
 * پرهزینه را پیش از آن‌که گوگل ببیندشان نشان دهد: عنوان تکراری، توضیح متای
 * غایب، عنوان بیش از حد بلند، و تصویر بدون متن جایگزین.
 *
 * هر یافته توضیح می‌دهد چرا مهم است — فهرست خطا بدون دلیل، در عمل نادیده
 * گرفته می‌شود.
 */

export type Severity = 'error' | 'warning';

export interface Finding {
  severity: Severity;
  /** عنوان مشکل */
  title: string;
  /** چرا اهمیت دارد */
  why: string;
  items: { label: string; href: string }[];
}

/* گوگل بر اساس پهنای پیکسلی می‌بُرد نه تعداد نویسه؛ این اعداد تقریبی و
   محافظه‌کارانه‌اند. */
const TITLE_MAX = 60;
const DESC_MIN = 70;
const DESC_MAX = 155;

export async function auditSeo(): Promise<Finding[]> {
  const db = await getDb();

  const [productRows, projectRows, articleRows, mediaRows] = await Promise.all([
    db.select().from(products).orderBy(asc(products.id)),
    db.select().from(projects).orderBy(asc(projects.id)),
    db.select().from(articles).orderBy(asc(articles.id)),
    db.select().from(media).orderBy(asc(media.id)),
  ]);

  /** هر چیزی که صفحهٔ عمومی دارد */
  const pages = [
    ...productRows
      .filter((p) => p.published)
      .map((p) => ({
        label: p.name,
        href: `/admin/products/${p.id}`,
        title: p.seoTitle || `${p.name} | فروشگاه نماد نیرو`,
        description: p.seoDescription,
        noindex: p.noindex,
      })),
    ...articleRows
      .filter((a) => a.published)
      .map((a) => ({
        label: a.title,
        href: `/admin/articles/${a.id}`,
        title: a.seoTitle || `${a.title} | مجلهٔ نماد نیرو`,
        description: a.seoDescription,
        noindex: a.noindex,
      })),
  ];

  const findings: Finding[] = [];

  /* --- عنوان تکراری --- */
  const byTitle = new Map<string, typeof pages>();
  for (const page of pages) {
    const key = page.title.trim().toLowerCase();
    byTitle.set(key, [...(byTitle.get(key) ?? []), page]);
  }
  const duplicates = [...byTitle.values()].filter((group) => group.length > 1).flat();
  if (duplicates.length > 0) {
    findings.push({
      severity: 'error',
      title: 'عنوان تکراری',
      why: 'وقتی چند صفحه عنوان یکسان دارند، گوگل نمی‌داند کدام را برای جست‌وجو نشان دهد و هر دو ضعیف‌تر دیده می‌شوند.',
      items: duplicates.map((p) => ({ label: p.label, href: p.href })),
    });
  }

  /* --- توضیح متای غایب --- */
  const noDescription = pages.filter((p) => !p.description?.trim());
  if (noDescription.length > 0) {
    findings.push({
      severity: 'warning',
      title: 'توضیح متا ندارد',
      why: 'بدون توضیح، گوگل خودش تکه‌ای از متن صفحه را برمی‌دارد که معمولاً ترغیب‌کننده نیست و نرخ کلیک را پایین می‌آورد.',
      items: noDescription.map((p) => ({ label: p.label, href: p.href })),
    });
  }

  /* --- طول نامناسب --- */
  const longTitles = pages.filter((p) => p.title.length > TITLE_MAX);
  if (longTitles.length > 0) {
    findings.push({
      severity: 'warning',
      title: `عنوان بلندتر از ${fa(TITLE_MAX)} نویسه`,
      why: 'عنوان بلند در نتایج جست‌وجو با «…» بریده می‌شود و بخش مهمش دیده نمی‌شود.',
      items: longTitles.map((p) => ({ label: `${p.label} (${fa(p.title.length)})`, href: p.href })),
    });
  }

  const shortDescriptions = pages.filter(
    (p) => p.description && p.description.trim().length < DESC_MIN,
  );
  if (shortDescriptions.length > 0) {
    findings.push({
      severity: 'warning',
      title: `توضیح کوتاه‌تر از ${fa(DESC_MIN)} نویسه`,
      why: 'توضیح خیلی کوتاه فضای موجود در نتیجهٔ جست‌وجو را هدر می‌دهد.',
      items: shortDescriptions.map((p) => ({ label: p.label, href: p.href })),
    });
  }

  const longDescriptions = pages.filter(
    (p) => p.description && p.description.trim().length > DESC_MAX,
  );
  if (longDescriptions.length > 0) {
    findings.push({
      severity: 'warning',
      title: `توضیح بلندتر از ${fa(DESC_MAX)} نویسه`,
      why: 'انتهای توضیح بریده می‌شود؛ نکتهٔ اصلی را اول بیاورید.',
      items: longDescriptions.map((p) => ({ label: p.label, href: p.href })),
    });
  }

  /* --- تصویر بدون متن جایگزین --- */
  const noAlt = mediaRows.filter((m) => !m.alt?.trim());
  if (noAlt.length > 0) {
    findings.push({
      severity: 'error',
      title: 'تصویر بدون متن جایگزین',
      why: 'کاربر نابینا محتوای تصویر را نمی‌فهمد، و گوگل هم نمی‌داند تصویر از چیست — پس در جست‌وجوی تصاویر نمی‌آید.',
      items: noAlt.map((m) => ({ label: m.key, href: '/admin/media' })),
    });
  }

  /* --- محتوای بی‌تصویر --- */
  const productsNoImage = productRows.filter((p) => p.published && !p.imageMediaId);
  if (productsNoImage.length > 0) {
    findings.push({
      severity: 'warning',
      title: 'محصول بدون تصویر',
      why: 'صفحهٔ محصول بدون عکس هم برای کاربر ضعیف است و هم امکان دیده‌شدن در نتایج تصویری را از دست می‌دهد.',
      items: productsNoImage.map((p) => ({ label: p.name, href: `/admin/products/${p.id}` })),
    });
  }

  /* --- مقالهٔ بی‌متن --- */
  const emptyArticles = articleRows.filter((a) => a.published && a.body.trim().length < 200);
  if (emptyArticles.length > 0) {
    findings.push({
      severity: 'error',
      title: 'مقالهٔ منتشرشده با متن بسیار کوتاه',
      why: 'صفحهٔ کم‌محتوا در بهترین حالت رتبه نمی‌گیرد و در بدترین حالت کیفیت کل دامنه را پایین می‌آورد.',
      items: emptyArticles.map((a) => ({ label: a.title, href: `/admin/articles/${a.id}` })),
    });
  }

  /* --- noindex روی محتوای منتشرشده --- */
  const hidden = pages.filter((p) => p.noindex);
  if (hidden.length > 0) {
    findings.push({
      severity: 'warning',
      title: 'صفحهٔ منتشرشده ولی پنهان از گوگل',
      why: 'این صفحات در سایت دیده می‌شوند ولی عمداً از نتایج جست‌وجو کنار گذاشته شده‌اند. اگر عمدی نبوده، تیک noindex را بردارید.',
      items: hidden.map((p) => ({ label: p.label, href: p.href })),
    });
  }

  // خطاها بالاتر از هشدارها
  return findings.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
}

export interface SeoSummary {
  publishedPages: number;
  errors: number;
  warnings: number;
}

export function summarize(findings: Finding[], publishedPages: number): SeoSummary {
  return {
    publishedPages,
    errors: findings.filter((f) => f.severity === 'error').length,
    warnings: findings.filter((f) => f.severity === 'warning').length,
  };
}

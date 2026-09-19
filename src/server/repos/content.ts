import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { articles, media, products, projects, settings } from '../db/schema';
import { TAGS, cached, invalidate } from '../cache';

/**
 * خواندن محتوا برای صفحات عمومی سایت.
 *
 * هر تابع نتیجه‌اش را کش می‌کند، پس صدا زدنش در چند جای یک صفحه هزینهٔ
 * اضافه ندارد و صفحه‌ای که چند بخش دارد می‌تواند همه را با Promise.all
 * موازی بخواند بی‌آن‌که آبشار کوئری بسازد.
 *
 * توابع نوشتن اینجا نیستند؛ آن‌ها در سرویس‌های پنل‌اند و بعد از هر نوشتن
 * `invalidate` را صدا می‌زنند.
 */

/** تصویر به شکلی که قالب‌ها لازم دارند */
export interface ImageRef {
  /** کلید فایل — برای ساختن srcset لازم است */
  key: string;
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
}

export interface ProductView {
  id: number;
  slug: string;
  name: string;
  brand: string;
  spec: string;
  specUnit: string;
  cat: 'home' | 'industrial';
  kind: 'inverter' | 'panel' | 'storage' | 'accessory';
  body: string | null;
  featured: boolean;
  image: ImageRef | null;
  seoTitle: string | null;
  seoDescription: string | null;
  noindex: boolean;
  /** canonical دستی از پنل؛ null یعنی خودکار */
  canonicalOverride: string | null;
  updatedAt: Date;
}

/* ============================================================
   محصولات
   ============================================================ */

export function listProducts(): Promise<ProductView[]> {
  return cached(`products:all`, [TAGS.products, TAGS.media], async () => {
    const db = await getDb();
    const rows = await db
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        brand: products.brand,
        spec: products.spec,
        specUnit: products.specUnit,
        cat: products.cat,
        kind: products.kind,
        body: products.body,
        featured: products.featured,
        seoTitle: products.seoTitle,
        seoDescription: products.seoDescription,
        noindex: products.noindex,
        canonicalOverride: products.canonicalOverride,
        updatedAt: products.updatedAt,
        imageKey: media.key,
        imageUrl: media.url,
        imageAlt: media.alt,
        imageWidth: media.width,
        imageHeight: media.height,
      })
      .from(products)
      .leftJoin(media, eq(products.imageMediaId, media.id))
      .where(eq(products.published, true))
      .orderBy(asc(products.sortOrder), asc(products.id));

    return rows.map(toProductView);
  });
}

export async function getProduct(slug: string): Promise<ProductView | null> {
  const all = await listProducts();
  return all.find((p) => p.slug === slug) ?? null;
}

export async function listFeaturedProducts(limit: number): Promise<ProductView[]> {
  const all = await listProducts();
  return all.filter((p) => p.featured).slice(0, limit);
}

function toProductView(row: Record<string, any>): ProductView {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    spec: row.spec,
    specUnit: row.specUnit,
    cat: row.cat,
    kind: row.kind,
    body: row.body,
    featured: row.featured,
    image: toImageRef(row, row.name),
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    noindex: row.noindex,
    canonicalOverride: row.canonicalOverride ?? null,
    updatedAt: row.updatedAt,
  };
}

/* ============================================================
   پروژه‌ها
   ============================================================ */

export interface ProjectView {
  id: number;
  slug: string;
  name: string;
  capacity: string;
  unit: string;
  tag: string;
  cat: 'supply' | 'build' | 'invest';
  note: string | null;
  featured: boolean;
  image: ImageRef | null;
  updatedAt: Date;
}

export function listProjects(): Promise<ProjectView[]> {
  return cached(`projects:all`, [TAGS.projects, TAGS.media], async () => {
    const db = await getDb();
    const rows = await db
      .select({
        id: projects.id,
        slug: projects.slug,
        name: projects.name,
        capacity: projects.capacity,
        unit: projects.unit,
        tag: projects.tag,
        cat: projects.cat,
        note: projects.note,
        featured: projects.featured,
        updatedAt: projects.updatedAt,
        imageKey: media.key,
        imageUrl: media.url,
        imageAlt: media.alt,
        imageWidth: media.width,
        imageHeight: media.height,
      })
      .from(projects)
      .leftJoin(media, eq(projects.imageMediaId, media.id))
      .where(eq(projects.published, true))
      .orderBy(asc(projects.sortOrder), asc(projects.id));

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      capacity: row.capacity,
      unit: row.unit,
      tag: row.tag,
      cat: row.cat,
      note: row.note,
      featured: row.featured,
      image: toImageRef(row, row.name),
      updatedAt: row.updatedAt,
    }));
  });
}

export async function listFeaturedProjects(limit: number): Promise<ProjectView[]> {
  const all = await listProjects();
  return all.filter((p) => p.featured).slice(0, limit);
}

/* ============================================================
   مقالات
   ============================================================ */

export interface ArticleView {
  id: number;
  slug: string;
  title: string;
  category: 'edu' | 'market' | 'news';
  body: string;
  dateFa: string;
  publishedAt: Date | null;
  readTime: number;
  cover: ImageRef | null;
  seoTitle: string | null;
  seoDescription: string | null;
  noindex: boolean;
  /** canonical دستی از پنل؛ null یعنی خودکار */
  canonicalOverride: string | null;
  updatedAt: Date;
}

export function listArticles(): Promise<ArticleView[]> {
  return cached(`articles:all`, [TAGS.articles, TAGS.media], async () => {
    const db = await getDb();
    const rows = await db
      .select({
        id: articles.id,
        slug: articles.slug,
        title: articles.title,
        category: articles.category,
        body: articles.body,
        dateFa: articles.dateFa,
        publishedAt: articles.publishedAt,
        readTime: articles.readTime,
        seoTitle: articles.seoTitle,
        seoDescription: articles.seoDescription,
        noindex: articles.noindex,
        canonicalOverride: articles.canonicalOverride,
        updatedAt: articles.updatedAt,
        imageKey: media.key,
        imageUrl: media.url,
        imageAlt: media.alt,
        imageWidth: media.width,
        imageHeight: media.height,
      })
      .from(articles)
      .leftJoin(media, eq(articles.coverMediaId, media.id))
      .where(eq(articles.published, true))
      .orderBy(desc(articles.publishedAt), desc(articles.id));

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      title: row.title,
      category: row.category,
      body: row.body,
      dateFa: row.dateFa,
      publishedAt: row.publishedAt,
      readTime: row.readTime,
      cover: toImageRef(row, row.title),
      seoTitle: row.seoTitle,
      seoDescription: row.seoDescription,
      noindex: row.noindex,
      canonicalOverride: row.canonicalOverride ?? null,
      updatedAt: row.updatedAt,
    }));
  });
}

export async function getArticle(slug: string): Promise<ArticleView | null> {
  const all = await listArticles();
  return all.find((a) => a.slug === slug) ?? null;
}

/* ============================================================
   تنظیمات سایت
   ============================================================ */

/**
 * یک کلید از تنظیمات را می‌خواند.
 *
 * `fallback` وقتی به کار می‌آید که کلید هنوز در دیتابیس نیست — مثلاً درست
 * بعد از افزودن یک بخش تازه به سایت و پیش از اولین ذخیره در پنل. یعنی
 * صفحه هیچ‌وقت به‌خاطر یک کلید غایب خالی نمی‌شود.
 */
export function getSetting<T>(key: string, fallback: T): Promise<T> {
  return cached(`settings:${key}`, [TAGS.settings], async () => {
    const db = await getDb();
    const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
    return (row?.value as T) ?? fallback;
  });
}

/** همهٔ تنظیمات، برای پنل */
export function getAllSettings(): Promise<Record<string, unknown>> {
  return cached(`settings:all`, [TAGS.settings], async () => {
    const db = await getDb();
    const rows = await db.select().from(settings);
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  });
}

export async function setSetting(key: string, value: unknown, userId?: number): Promise<void> {
  const db = await getDb();
  await db
    .insert(settings)
    .values({ key, value: value as never, updatedBy: userId ?? null })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: value as never, updatedAt: new Date(), updatedBy: userId ?? null },
    });
  invalidate(TAGS.settings);
}

/* ============================================================
   کمکی‌ها
   ============================================================ */

function toImageRef(row: Record<string, any>, fallbackAlt: string): ImageRef | null {
  if (!row.imageUrl) return null;
  return {
    key: row.imageKey,
    url: row.imageUrl,
    // اگر ویراستار alt ننوشته، نام رکورد بهتر از رشتهٔ خالی است
    alt: row.imageAlt || fallbackAlt,
    width: row.imageWidth,
    height: row.imageHeight,
  };
}

/**
 * تازه‌ترین زمان تغییر محتوا — برای `lastmod` در نقشهٔ سایت.
 * یک کوئری سبک، تا برای ساختن sitemap کل جدول‌ها خوانده نشود.
 */
export function contentLastModified(): Promise<Date> {
  return cached(
    'content:lastmod',
    [TAGS.products, TAGS.projects, TAGS.articles, TAGS.settings],
    async () => {
      const db = await getDb();
      /* در SQLite تابع `max` با چند آرگومان بزرگ‌ترین را برمی‌گرداند (معادل
         `greatest` در Postgres). تاریخ‌ها عدد ثانیه‌اند، پس مقایسه و
         `coalesce` روی همان عدد انجام می‌شود. */
      const [row] = await db.all<{ at: number | null }>(sql`select max(
        coalesce((select max(updated_at) from products), 0),
        coalesce((select max(updated_at) from projects), 0),
        coalesce((select max(updated_at) from articles), 0)
      ) as at`);

      return row?.at ? new Date(row.at * 1000) : new Date();
    },
  );
}

export { and, eq };

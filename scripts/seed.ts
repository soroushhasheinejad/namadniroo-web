/**
 * انتقال محتوای فایل‌محور فعلی به دیتابیس.
 *
 * یک بار اجرا می‌شود، ولی چند بار اجرا کردنش هم بی‌خطر است: هر رکورد با
 * `slug` تطبیق داده می‌شود و اگر از قبل باشد به‌روزرسانی می‌گردد، نه دوباره
 * ساخته. یعنی اگر اجرا نیمه‌کاره بماند، فقط دوباره اجرایش کنید.
 *
 * نکتهٔ مهم: این اسکریپت هرگز چیزی را در دیتابیس حذف نمی‌کند. اگر محتوایی
 * در پنل ویرایش شده باشد، اجرای دوبارهٔ seed آن را به نسخهٔ فایل برمی‌گرداند
 * — پس بعد از راه‌افتادن پنل دیگر اجرا نشود.
 *
 *   npm run db:seed
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { getDb } from '../src/server/db/client';
import { ensureMigrated } from '../src/server/db/migrate';
import { articles, leads, media, products, projects, settings } from '../src/server/db/schema';
import { jalaliToISO } from '../src/utils';
import { normalizePhone } from '../src/lib/phone';

const root = path.resolve(import.meta.dirname, '..');

/* ============================================================
   رسانه
   ============================================================ */

/**
 * تصاویر فعلی داخل `src/assets/` هستند و Astro در زمان بیلد بهینه‌شان
 * می‌کند. رکورد media برایشان می‌سازیم تا محتوا بتواند به آن‌ها ارجاع دهد؛
 * `key` همان مسیر نسبی است، و بعد از راه‌اندازی فضای ذخیره‌سازی، آپلودهای
 * تازه با کلید واقعی ثبت می‌شوند.
 */
async function seedMedia(): Promise<Map<string, number>> {
  const db = await getDb();
  const byKey = new Map<string, number>();

  const dirs = ['src/assets', 'src/assets/products'];
  for (const dir of dirs) {
    const full = path.join(root, dir);
    if (!existsSync(full)) continue;

    for (const file of await readdir(full)) {
      if (!/\.(jpe?g|png|webp)$/i.test(file)) continue;
      const key = `${dir}/${file}`;
      const [row] = await db
        .insert(media)
        .values({
          key,
          url: `/${key}`,
          mime: file.endsWith('.png') ? 'image/png' : file.endsWith('.webp') ? 'image/webp' : 'image/jpeg',
          alt: null,
          bytes: 0,
        })
        .onConflictDoUpdate({ target: media.key, set: { url: `/${key}` } })
        .returning({ id: media.id });
      if (row) byKey.set(file, row.id);
    }
  }

  console.log(`رسانه: ${byKey.size} فایل ثبت شد`);
  return byKey;
}

/** `../assets/products/x.jpg` → شناسهٔ رکورد رسانه */
function mediaIdFor(imagePath: string | undefined, byKey: Map<string, number>): number | null {
  if (!imagePath) return null;
  return byKey.get(path.basename(imagePath)) ?? null;
}

/* ============================================================
   محصولات و پروژه‌ها
   ============================================================ */

async function seedProducts(byKey: Map<string, number>): Promise<void> {
  const db = await getDb();
  const rows = JSON.parse(await readFile(path.join(root, 'src/data/products.json'), 'utf8'));

  for (const p of rows) {
    const values = {
      slug: p.id,
      name: p.name,
      brand: p.brand,
      spec: p.spec,
      specUnit: p.specUnit,
      cat: p.cat,
      kind: p.kind,
      imageMediaId: mediaIdFor(p.image, byKey),
      featured: p.featured ?? false,
      sortOrder: p.order ?? 999,
      price: p.price ?? null,
      sku: p.sku ?? null,
      inStock: p.inStock ?? null,
      updatedAt: new Date(),
    };

    await db
      .insert(products)
      .values(values)
      .onConflictDoUpdate({ target: products.slug, set: values });
  }

  console.log(`محصولات: ${rows.length} رکورد`);
}

async function seedProjects(byKey: Map<string, number>): Promise<void> {
  const db = await getDb();
  const rows = JSON.parse(await readFile(path.join(root, 'src/data/projects.json'), 'utf8'));

  for (const p of rows) {
    const values = {
      slug: p.id,
      name: p.name,
      capacity: p.capacity,
      unit: p.unit,
      tag: p.tag,
      cat: p.cat,
      note: p.note ?? null,
      imageMediaId: mediaIdFor(p.image, byKey),
      featured: p.featured ?? false,
      sortOrder: p.order ?? 999,
      updatedAt: new Date(),
    };

    await db
      .insert(projects)
      .values(values)
      .onConflictDoUpdate({ target: projects.slug, set: values });
  }

  console.log(`پروژه‌ها: ${rows.length} رکورد`);
}

/* ============================================================
   مقالات
   ============================================================ */

/** جداکردن frontmatter از بدنه، بدون کتابخانه — قالب فایل‌ها ساده و ثابت است */
function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };

  const data: Record<string, string> = {};
  for (const line of match[1]!.split('\n')) {
    const sep = line.indexOf(':');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    const value = line.slice(sep + 1).trim().replace(/^["']|["']$/g, '');
    data[key] = value;
  }

  return { data, body: match[2] ?? '' };
}

async function seedArticles(): Promise<void> {
  const db = await getDb();
  const dir = path.join(root, 'src/content/articles');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.md'));

  for (const file of files) {
    const { data, body } = parseFrontmatter(await readFile(path.join(dir, file), 'utf8'));
    const iso = jalaliToISO(data.date ?? '');

    const values = {
      slug: file.replace(/\.md$/, ''),
      title: data.title ?? file,
      category: (data.category ?? 'edu') as 'edu' | 'market' | 'news',
      body: body.trim(),
      dateFa: data.date ?? '',
      publishedAt: iso ? new Date(iso) : null,
      readTime: Number(data.readTime ?? 5),
      published: data.draft !== 'true',
      updatedAt: new Date(),
    };

    await db
      .insert(articles)
      .values(values)
      .onConflictDoUpdate({ target: articles.slug, set: values });
  }

  console.log(`مقالات: ${files.length} رکورد`);
}

/* ============================================================
   متن‌های ثابت سایت
   ============================================================ */

async function seedSettings(): Promise<void> {
  const db = await getDb();

  /* از `siteContent` خوانده می‌شود نه `site`: آن یکی تصویر import می‌کند و
     فقط داخل باندلر Astro قابل بارگذاری است. تصاویر هم اینجا لازم نیستند —
     در پنل به رکورد رسانه وصل می‌شوند. */
  const content = await import('../src/data/siteContent');

  const entries: [string, unknown][] = [
    ['site', content.site],
    ['nav', content.nav],
    ['stats', content.stats],
    ['brands', content.brands],
    ['clients', content.clients],
    ['portfolio', content.portfolio],
    ['areas', content.areas],
    ['timeline', content.timeline],
    ['capabilities', content.capabilities],
    ['heroSlides', content.heroSlides],
    ['promoSlides', content.promoSlides],
  ];

  for (const [key, value] of entries) {
    await db
      .insert(settings)
      .values({ key, value: value as never })
      .onConflictDoUpdate({ target: settings.key, set: { value: value as never, updatedAt: new Date() } });
  }

  console.log(`تنظیمات: ${entries.length} کلید`);
}

/* ============================================================
   لیدهای موجود
   ============================================================ */

/**
 * لیدهای ثبت‌شده در فایل قدیمی را وارد می‌کند.
 *
 * مسیر فایل از `LEADS_DIR` خوانده می‌شود — همان متغیری که سرور فعلی
 * استفاده می‌کند. اگر فایلی نباشد، از این مرحله رد می‌شود.
 */
async function importOldLeads(): Promise<void> {
  const dir = process.env.LEADS_DIR;
  if (!dir) return;

  const file = path.join(dir, 'leads.jsonl');
  if (!existsSync(file)) {
    console.log('لیدهای قدیمی: فایلی پیدا نشد');
    return;
  }

  const db = await getDb();
  const raw = await readFile(file, 'utf8');
  let imported = 0;
  let skipped = 0;

  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;

    let old: Record<string, any>;
    try {
      old = JSON.parse(line);
    } catch {
      skipped++;
      continue;
    }

    const createdAt = old.createdAt ? new Date(old.createdAt) : new Date();

    /* تشخیص تکراری بر اساس شماره و زمان دقیق ثبت — تا اجرای دوبارهٔ
       اسکریپت همان لیدها را دوباره وارد نکند. */
    const normalized = old.phoneNormalized ?? normalizePhone(String(old.phone ?? '')) ?? null;
    const existing = await db
      .select({ id: leads.id })
      .from(leads)
      .where(eq(leads.createdAt, createdAt))
      .limit(1);
    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await db.insert(leads).values({
      name: String(old.name ?? '—'),
      phone: String(old.phone ?? ''),
      phoneNormalized: normalized,
      capacity: old.capacity || null,
      area: old.area || null,
      source: old.source || null,
      createdAt,
      updatedAt: createdAt,
    });
    imported++;
  }

  console.log(`لیدهای قدیمی: ${imported} وارد شد، ${skipped} رد شد`);
}

/* ============================================================
   اجرا
   ============================================================ */

async function main(): Promise<void> {
  await ensureMigrated();
  console.log('ساختار دیتابیس به‌روز است');

  const byKey = await seedMedia();
  await seedProducts(byKey);
  await seedProjects(byKey);
  await seedArticles();
  await seedSettings();
  await importOldLeads();

  console.log('\nانتقال داده کامل شد.');
  process.exit(0);
}

main().catch((err) => {
  console.error('انتقال داده ناموفق بود:', err);
  process.exit(1);
});

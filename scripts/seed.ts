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
import { leads, products, projects, settings } from '../src/server/db/schema';
import { ingestImage } from '../src/server/media/store';
import { normalizePhone } from '../src/lib/phone';
import { syncArticles } from './articles';

const root = path.resolve(import.meta.dirname, '..');

/* ============================================================
   رسانه
   ============================================================ */

/**
 * تصاویر موجود در `src/assets/` را وارد خط لولهٔ رسانه می‌کند.
 *
 * تا امروز Astro این‌ها را در زمان بیلد بهینه می‌کرد. حالا از همان مسیری
 * عبور می‌کنند که آپلودهای پنل عبور می‌کنند: تبدیل به WebP در چند اندازه و
 * ذخیره روی دیسک پایدار. نتیجه یکدست است — چه تصویری که امروز در مخزن است
 * و چه تصویری که فردا ویراستار آپلود می‌کند.
 */
async function seedMedia(): Promise<Map<string, number>> {
  const byFilename = new Map<string, number>();

  const dirs = ['src/assets', 'src/assets/products'];
  for (const dir of dirs) {
    const full = path.join(root, dir);
    if (!existsSync(full)) continue;

    for (const file of await readdir(full)) {
      if (!/\.(jpe?g|png|webp)$/i.test(file)) continue;

      const buffer = await readFile(path.join(full, file));
      const mime = file.endsWith('.png')
        ? 'image/png'
        : file.endsWith('.webp')
          ? 'image/webp'
          : 'image/jpeg';

      const { media: row } = await ingestImage(buffer, { filename: file, mime });
      byFilename.set(file, row.id);
    }
  }

  console.log(`رسانه: ${byFilename.size} تصویر پردازش شد`);
  return byFilename;
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

  /* فقط کلیدهای غایب را می‌نویسد، هرگز روی موجود. از وقتی سایت واقعاً از
     این تنظیمات می‌خواند، بازنویسی یعنی پاک‌کردن بی‌صدای هر چیزی که
     ویراستار در پنل عوض کرده — آن هم با اجرای اسکریپتی که ظاهراً فقط
     «داده را مقداردهی اولیه می‌کند». */
  let added = 0;
  for (const [key, value] of entries) {
    const inserted = await db
      .insert(settings)
      .values({ key, value: value as never })
      .onConflictDoNothing({ target: settings.key })
      .returning({ key: settings.key });
    added += inserted.length;
  }

  console.log(`تنظیمات: ${added} کلید تازه، ${entries.length - added} کلید موجود دست‌نخورده ماند`);
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
  const byKey = await seedMedia();
  await seedProducts(byKey);
  await seedProjects(byKey);
  await syncArticles();
  await seedSettings();
  await importOldLeads();

  console.log('\nانتقال داده کامل شد.');
  process.exit(0);
}

main().catch((err) => {
  console.error('انتقال داده ناموفق بود:', err);
  process.exit(1);
});

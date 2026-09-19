/**
 * انتقال مقالات از `src/content/articles/*.md` به دیتابیس.
 *
 * هم `seed` از این استفاده می‌کند و هم `db:articles`. فرقش با seed این است
 * که فقط به جدول مقالات دست می‌زند؛ محصولات، پروژه‌ها و متن‌های سایت که
 * ممکن است در پنل ویرایش شده باشند دست‌نخورده می‌مانند. پس روی سرورِ در
 * حال کار هم اجرایش بی‌خطر است — به شرط این‌که بدانید مقاله‌ای که در
 * پوشه هست، نسخهٔ پنلش را بازنویسی می‌کند.
 *
 *   npm run db:articles                       # افزودن و به‌روزرسانی
 *   npm run db:articles -- --unpublish-others # و از انتشار خارج کردن بقیه
 *
 * `--unpublish-others` مقاله‌هایی را که در پوشه نیستند حذف نمی‌کند، فقط
 * منتشرنشده می‌کند؛ از پنل می‌شود دوباره منتشرشان کرد.
 *
 * دو قرارداد دیگر:
 * - تصویر `covers/<slug>.jpg` اگر باشد، تصویر شاخص مقاله می‌شود (پیش‌نمایش
 *   لینک در تلگرام و واتساپ، و تصویر Article در داده‌های ساختاریافته).
 * - `aliases` در frontmatter یعنی نشانی قبلی مقاله: ریدایرکت ۳۰۱ از آن به
 *   نشانی تازه ساخته می‌شود و ردیف قدیمی با همان نشانی پاک می‌شود.
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { and, eq, inArray, notInArray } from 'drizzle-orm';
import { getDb } from '../src/server/db/client';
import { articles, redirects } from '../src/server/db/schema';
import { ingestImage } from '../src/server/media/store';
import { jalaliToISO } from '../src/utils';

const root = path.resolve(import.meta.dirname, '..');

/** جداکردن frontmatter از بدنه، بدون کتابخانه — قالب فایل‌ها ساده و ثابت است */
export function parseFrontmatter(raw: string): { data: Record<string, string>; body: string } {
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

export async function syncArticles(options: { unpublishOthers?: boolean } = {}): Promise<void> {
  const db = await getDb();
  const dir = path.join(root, 'src/content/articles');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.md'));
  const slugs: string[] = [];
  let covers = 0;

  for (const file of files) {
    const { data, body } = parseFrontmatter(await readFile(path.join(dir, file), 'utf8'));
    const iso = jalaliToISO(data.date ?? '');
    const slug = file.replace(/\.md$/, '');
    slugs.push(slug);

    let coverMediaId: number | undefined;
    const coverFile = path.join(dir, 'covers', `${slug}.jpg`);
    if (existsSync(coverFile)) {
      const { media: row } = await ingestImage(await readFile(coverFile), {
        filename: `${slug}.jpg`,
        mime: 'image/jpeg',
        alt: data.title,
      });
      coverMediaId = row.id;
      covers++;
    }

    const values = {
      slug,
      title: data.title ?? file,
      category: (data.category ?? 'edu') as 'edu' | 'market' | 'news',
      body: body.trim(),
      dateFa: data.date ?? '',
      publishedAt: iso ? new Date(iso) : null,
      readTime: Number(data.readTime ?? 5),
      seoTitle: data.seoTitle || null,
      seoDescription: data.description || null,
      published: data.draft !== 'true',
      updatedAt: new Date(),
      ...(coverMediaId ? { coverMediaId } : {}),
    };

    const aliases = (data.aliases ?? '').split(',').map((a) => a.trim()).filter(Boolean);
    if (aliases.length > 0) {
      // ردیف قدیمی باید پیش از درج برود، وگرنه دو ردیف یک مقاله می‌مانند
      await db.delete(articles).where(inArray(articles.slug, aliases));
      for (const alias of aliases) {
        await db
          .insert(redirects)
          .values({ fromPath: `/magazine/${alias}`, toPath: `/magazine/${slug}`, statusCode: 301, auto: true })
          .onConflictDoUpdate({ target: redirects.fromPath, set: { toPath: `/magazine/${slug}`, statusCode: 301 } });
      }
    }
    // اگر روزی همین نشانی قبلاً به جای دیگری ریدایرکت شده بود، صفحهٔ زنده را پنهان می‌کرد
    await db.delete(redirects).where(eq(redirects.fromPath, `/magazine/${slug}`));

    await db
      .insert(articles)
      .values(values)
      .onConflictDoUpdate({ target: articles.slug, set: values });
  }

  console.log(`مقالات: ${files.length} رکورد، ${covers} تصویر شاخص`);

  if (options.unpublishOthers && slugs.length > 0) {
    const hidden = await db
      .update(articles)
      .set({ published: false, updatedAt: new Date() })
      .where(and(notInArray(articles.slug, slugs), eq(articles.published, true)))
      .returning({ slug: articles.slug });

    console.log(
      hidden.length
        ? `از انتشار خارج شد: ${hidden.map((a) => a.slug).join('، ')}`
        : 'مقالهٔ منتشرشدهٔ دیگری نبود',
    );
  }
}

/* اجرای مستقیم؛ وقتی seed این فایل را import می‌کند اجرا نمی‌شود */
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  syncArticles({ unpublishOthers: process.argv.includes('--unpublish-others') })
    .then(() => {
      /* سرور در حال کار کش خودش را دارد و تغییر را حداکثر تا ۱۰ دقیقه بعد
         نشان می‌دهد؛ ری‌استارت اپ آن را فوری می‌کند. */
      console.log('\nانجام شد. سایت در حال اجرا تا ۱۰ دقیقهٔ دیگر نسخهٔ تازه را نشان می‌دهد.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('انتقال مقالات ناموفق بود:', err);
      process.exit(1);
    });
}

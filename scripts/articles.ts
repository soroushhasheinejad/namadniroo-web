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
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { and, eq, notInArray } from 'drizzle-orm';
import { getDb } from '../src/server/db/client';
import { articles } from '../src/server/db/schema';
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

  for (const file of files) {
    const { data, body } = parseFrontmatter(await readFile(path.join(dir, file), 'utf8'));
    const iso = jalaliToISO(data.date ?? '');
    const slug = file.replace(/\.md$/, '');
    slugs.push(slug);

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
    };

    await db
      .insert(articles)
      .values(values)
      .onConflictDoUpdate({ target: articles.slug, set: values });
  }

  console.log(`مقالات: ${files.length} رکورد`);

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

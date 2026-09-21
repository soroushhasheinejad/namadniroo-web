/**
 * ثبت گروهی ریدایرکت نشانی‌های سایت قدیمی، و گزارش ۴۰۴های ثبت‌شده.
 *
 *   npm run db:redirects          # ثبت فهرست + گزارش
 *   npm run db:redirects -- --report   # فقط گزارش، بدون تغییر
 *
 * ریدایرکت‌هایی که در پنل دستی ساخته شده‌اند دست‌نخورده می‌مانند: این
 * اسکریپت فقط ردیف‌های خودکار (`auto`) را می‌نویسد و اگر نشانی‌ای از قبل
 * ثبت شده باشد، از آن رد می‌شود. پس اجرای دوباره‌اش بی‌خطر است.
 *
 * گزارش ۴۰۴ برای همین است که فهرست بالا کامل نیست؛ هر نشانی پربازدیدی که
 * در گزارش دیده شود، یا باید به `legacyRedirects` اضافه شود یا از پنل
 * ریدایرکت بگیرد.
 */
import { desc, eq } from 'drizzle-orm';
import { pathToFileURL } from 'node:url';
import { getDb } from '../src/server/db/client';
import { notFound, redirects } from '../src/server/db/schema';
import { legacyRedirects } from '../src/data/legacyRedirects';

/** همان قاعده‌ای که هنگام جست‌وجوی ریدایرکت اعمال می‌شود */
function normalizePath(path: string): string {
  return path.replace(/\/+$/, '').toLowerCase() || '/';
}

/**
 * شکل‌های مختلفی که یک نشانی ممکن است با آن‌ها درخواست شود.
 *
 * نشانی فارسی در مرورگر خوانا دیده می‌شود ولی درصدی فرستاده می‌شود، و
 * سرور همان درصدی را می‌بیند. هر دو ثبت می‌شوند تا هر کدام که آمد بگیرد.
 */
function variants(path: string): string[] {
  const out = new Set<string>([path]);
  try {
    out.add(encodeURI(path));
    out.add(decodeURI(path));
  } catch {
    // نشانی نامعتبر برای decode — همان شکل خام کافی است
  }
  return [...out].map(normalizePath);
}

async function applyRedirects(): Promise<void> {
  const db = await getDb();
  let added = 0;
  let skipped = 0;

  for (const [from, to] of Object.entries(legacyRedirects)) {
    for (const variant of variants(from)) {
      if (normalizePath(to) === variant) continue; // ریدایرکت به خود، حلقه می‌سازد

      const [existing] = await db
        .select({ id: redirects.id })
        .from(redirects)
        .where(eq(redirects.fromPath, variant))
        .limit(1);

      if (existing) {
        skipped++;
        continue;
      }

      await db.insert(redirects).values({ fromPath: variant, toPath: to, statusCode: 301, auto: true });
      added++;
    }
  }

  console.log(`ریدایرکت: ${added} ردیف تازه، ${skipped} ردیف از قبل موجود`);
}

async function report(): Promise<void> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(notFound)
    .orderBy(desc(notFound.hits), desc(notFound.lastSeen))
    .limit(40);

  if (rows.length === 0) {
    console.log('\n۴۰۴ ثبت‌شده‌ای نیست.');
    return;
  }

  console.log('\nپربازدیدترین نشانی‌هایی که به ۴۰۴ خوردند:');
  for (const r of rows) {
    let path = r.path;
    try {
      path = decodeURIComponent(r.path);
    } catch {
      // نشانی نیمه‌کدشده — همان شکل خام نمایش داده می‌شود
    }
    console.log(`  ${String(r.hits).padStart(4)}  ${path}${r.referrer ? `  ← ${r.referrer}` : ''}`);
  }
}

async function main(): Promise<void> {
  if (!process.argv.includes('--report')) await applyRedirects();
  await report();
  console.log('\nسایت در حال اجرا تا ۱۰ دقیقهٔ دیگر ریدایرکت‌های تازه را می‌شناسد.');
  process.exit(0);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error('ثبت ریدایرکت‌ها ناموفق بود:', err);
    process.exit(1);
  });
}

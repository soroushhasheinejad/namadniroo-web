import { cached } from '../cache';

/**
 * تبدیل مارک‌داون به HTML در زمان اجرا.
 *
 * تا دیروز Astro این کار را در زمان بیلد انجام می‌داد. حالا که متن مقاله در
 * دیتابیس است و ویراستار از پنل عوضش می‌کند، همان تبدیل باید هنگام نمایش
 * انجام شود.
 *
 * از خودِ پردازشگر Astro استفاده می‌شود نه یک کتابخانهٔ دیگر، تا خروجی
 * دقیقاً همان چیزی باشد که تا امروز بوده و ظاهر مقالات موجود تغییر نکند.
 */

type Processor = { render: (input: string) => Promise<{ code: string }> };

let processor: Promise<Processor> | null = null;

function getProcessor(): Promise<Processor> {
  processor ??= import('@astrojs/markdown-remark').then((m) =>
    m.createMarkdownProcessor({
      gfm: true,
      smartypants: true,
    }),
  ) as Promise<Processor>;
  return processor;
}

/**
 * HTML یک متن مارک‌داون.
 *
 * نتیجه بر اساس خود متن کش می‌شود: تبدیل مارک‌داون گران‌ترین کار رندر یک
 * صفحهٔ مقاله است و متن تا وقتی ویراستار عوضش نکند ثابت می‌ماند. کلید کش
 * طول و ابتدای متن است، پس هر ویرایشی کلید تازه می‌سازد.
 */
export async function renderMarkdown(source: string): Promise<string> {
  if (!source.trim()) return '';

  const key = `md:${source.length}:${source.slice(0, 64)}`;
  return cached(key, ['articles'], async () => {
    const { render } = await getProcessor();
    const { code } = await render(source);
    return code;
  });
}

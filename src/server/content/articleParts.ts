/**
 * تکه‌هایی که از خودِ متن مقاله بیرون کشیده می‌شوند.
 *
 * از صفحهٔ مقاله جدا شده تا بشود تست‌شان کرد: هر دو تابع با الگوی متنی
 * کار می‌کنند و الگو چیزی است که به‌راحتی و بی‌سروصدا خراب می‌شود.
 */

const stripTags = (value: string): string =>
  value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

export interface FaqItem {
  q: string;
  a: string;
}

/**
 * پرسش‌های پرتکرار از HTML رندرشدهٔ مقاله.
 *
 * قرارداد: یک تیتر h2 با عنوان «پرسش‌های پرتکرار» و زیرش هر پرسش یک h3
 * با یک پاراگراف پاسخ. نویسنده فقط همان بخش را می‌نویسد و داده‌های
 * ساختاریافتهٔ FAQPage خودکار ساخته می‌شود.
 *
 * فقط h3های *بعد از* آن تیتر خوانده می‌شوند تا h3های میانهٔ متن به‌اشتباه
 * پرسش حساب نشوند.
 */
export function extractFaq(html: string): FaqItem[] {
  const start = html.search(/<h2[^>]*>\s*پرسش‌های پرتکرار\s*<\/h2>/);
  if (start === -1) return [];

  return [...html.slice(start).matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)]
    .map((m) => ({ q: stripTags(m[1]!), a: stripTags(m[2]!) }))
    .filter((item) => item.q !== '' && item.a !== '');
}

/**
 * نشانی مقاله‌هایی که متن به آن‌ها لینک داده است.
 *
 * مبنای «مطالب مرتبط» است: مقاله‌ای که در متن به آن ارجاع داده‌ایم از
 * مقاله‌ای که فقط هم‌دسته است، واقعاً مرتبط‌تر است.
 */
export function linkedArticleSlugs(markdown: string): Set<string> {
  return new Set(
    [...markdown.matchAll(/\]\(\/magazine\/([^)#\s]+)\)/g)].map((m) => m[1]!),
  );
}

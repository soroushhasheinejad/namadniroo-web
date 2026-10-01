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

/**
 * متن پیش از اولین تیتر h2 — یعنی جواب کوتاهی که مقاله با آن شروع می‌شود —
 * جدا از بقیهٔ متن.
 *
 * صفحهٔ مقاله این بخش را پیش از فهرست مطالب می‌گذارد. روی موبایل، فهرست
 * سیزده‌تایی کل صفحهٔ اول را پر می‌کرد و کسی که از گوگل آمده بود جواب را
 * نمی‌دید تا اسکرول کند؛ و برگشتن به نتایج جست‌وجو بدترین سیگنالی است که
 * یک صفحه می‌تواند بدهد.
 */
export function splitLead(html: string): { lead: string; rest: string } {
  const at = html.search(/<h2[\s>]/);
  if (at <= 0) return { lead: '', rest: html };
  return { lead: html.slice(0, at).trim(), rest: html.slice(at) };
}

/**
 * عنوان ستون را روی هر خانهٔ جدول می‌گذارد (`data-label`) و جدول‌های سه‌ستونه
 * و بیشتر را با کلاس `table-cards` علامت می‌زند.
 *
 * روی موبایل، CSS هر ردیف این جدول‌ها را به یک کارت تبدیل می‌کند که عنوان
 * ستون کنار هر عدد نوشته شده. جدول هفت‌ستونهٔ سود در عرض گوشی فقط دو سه
 * ستون اول را نشان می‌داد و ستونی که خواننده دنبالش بود — سود خالص — پشت
 * اسکرول افقی پنهان می‌ماند.
 */
export function labelTableCells(html: string): string {
  return html.replace(/<table>([\s\S]*?)<\/table>/g, (table, inner: string) => {
    const head = inner.match(/<thead>([\s\S]*?)<\/thead>/)?.[1] ?? '';
    const labels = [...head.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/g)].map((m) =>
      stripTags(m[1]!).replace(/"/g, '&quot;'),
    );
    if (labels.length < 3) return table;

    const body = inner.replace(/<tr>([\s\S]*?)<\/tr>/g, (row, cells: string) => {
      let i = 0;
      const labelled = cells.replace(/<td(\s[^>]*)?>/g, (_td, attrs = '') => {
        const label = labels[i++];
        return label ? `<td${attrs} data-label="${label}">` : `<td${attrs}>`;
      });
      return `<tr>${labelled}</tr>`;
    });
    return `<table class="table-cards">${body}</table>`;
  });
}

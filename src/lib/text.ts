/**
 * کمکی‌های نمایش متن‌هایی که ویراستار در پنل می‌نویسد.
 */

/**
 * جایگزینی نشانه‌ها در متن.
 *
 * بعضی متن‌ها عددی دارند که از جای دیگری می‌آید — مثل «{mw} مگاوات» در
 * تیتر صفحهٔ اصلی که باید با نوار آمار یکی بماند. اگر ویراستار عدد را
 * دستی بنویسد، با به‌روز شدن آمار، تیتر و آمار دو عدد متفاوت می‌گویند.
 * نشانهٔ ناشناخته دست‌نخورده می‌ماند تا خطای تایپی دیده شود نه پنهان.
 */
export function fillTokens(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

export interface TextPart {
  text: string;
  latin: boolean;
}

/**
 * متن را به تکه‌های فارسی و لاتین می‌شکند.
 *
 * نام‌های لاتین (AE Solar، Fronius) در سایت با قلم لاتین نوشته می‌شوند
 * (`span.lat`). ویراستار متن ساده می‌نویسد؛ این تابع تکه‌های لاتین را پیدا
 * می‌کند تا قالب آن‌ها را جدا بپیچد. خروجی تکه متن است نه HTML، پس متنی که
 * ویراستار نوشته هرگز به‌عنوان کد تفسیر نمی‌شود.
 */
export function latinParts(text: string): TextPart[] {
  const parts: TextPart[] = [];
  // یک واژهٔ لاتین، یا چند واژه با فاصله/نقطه/خط بینشان (مثل «AE Solar»)
  const re = /[A-Za-z][A-Za-z0-9]*(?:[ .&'-]+[A-Za-z0-9]+)*/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) parts.push({ text: text.slice(last, m.index), latin: false });
    parts.push({ text: m[0], latin: true });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), latin: false });
  return parts;
}

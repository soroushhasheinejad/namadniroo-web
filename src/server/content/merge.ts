/**
 * نشاندن مقدار ذخیره‌شده روی مقدار پیش‌فرض، در هر عمقی.
 *
 * قواعد همان قواعد تنظیمات سراسری است (`siteSettings.ts`)، فقط تو‌در‌تو:
 *
 *   • شیء فیلد به فیلد ادغام می‌شود — فیلدی که بعدها به پیش‌فرض اضافه
 *     شود، در رکوردهای قدیمی هم از پیش‌فرض پر می‌شود.
 *   • آرایه کامل جایگزین می‌شود — اگر ویراستار ردیفی را حذف کرده، باید
 *     حذف بماند.
 *   • null و undefined یعنی «دست نزده» و پیش‌فرض می‌ماند؛ رشتهٔ خالی یعنی
 *     «عمداً پاک کرده» و خالی می‌ماند.
 *   • مقداری که نوعش با پیش‌فرض نمی‌خواند (مثلاً رشته جای شیء) نادیده
 *     گرفته می‌شود، تا یک رکورد خراب صفحهٔ عمومی را از کار نیندازد.
 */

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function deepMerge<T>(fallback: T, stored: unknown): T {
  if (stored === null || stored === undefined) return fallback;

  if (Array.isArray(fallback)) {
    return (Array.isArray(stored) ? stored : fallback) as T;
  }

  if (isPlainObject(fallback)) {
    if (!isPlainObject(stored)) return fallback;
    const out: Record<string, unknown> = { ...fallback };
    for (const [key, value] of Object.entries(stored)) {
      out[key] = key in fallback ? deepMerge(fallback[key], value) : value;
    }
    return out as T;
  }

  // مقدار ساده: فقط اگر هم‌نوع باشد جایگزین می‌شود
  return (typeof stored === typeof fallback ? stored : fallback) as T;
}

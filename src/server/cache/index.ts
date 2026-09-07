/**
 * کش درون‌حافظه‌ای با برچسب.
 *
 * مسئله: تا دیروز همهٔ صفحات در زمان بیلد ساخته می‌شدند و تحویل‌شان تقریباً
 * صفر هزینه داشت. حالا که محتوا از پنل عوض می‌شود، صفحه باید تازه باشد —
 * ولی اگر هر بازدید چند کوئری به دیتابیس بزند، آن سرعت از دست می‌رود.
 *
 * راه‌حل: نتیجهٔ هر کوئری با یک یا چند برچسب کش می‌شود («products»،
 * «settings» و…). خواندن از حافظه است، پس تقریباً مثل حالت استاتیک. هر
 * نوشتن در پنل برچسب مربوطه را باطل می‌کند، پس تغییر بلافاصله دیده می‌شود.
 *
 * برخلاف کش زمان‌محور، اینجا هیچ‌وقت پنجره‌ای وجود ندارد که محتوای قدیمی
 * نمایش داده شود. TTL فقط یک تور ایمنی است برای وقتی که جایی فراموش شود
 * برچسبی باطل شود.
 */

interface Entry {
  value: unknown;
  tags: string[];
  expiresAt: number;
}

const store = new Map<string, Entry>();

/** تور ایمنی — در عمل باطل‌سازی با برچسب زودتر عمل می‌کند. */
const DEFAULT_TTL_MS = 10 * 60 * 1000;

/**
 * درخواست‌های هم‌زمانِ یک کلید.
 *
 * اگر ده بازدیدکننده هم‌زمان صفحه‌ای را باز کنند که کشش تازه باطل شده،
 * بدون این نگاشت هر ده نفر یک کوئری یکسان به دیتابیس می‌زنند. با آن، اولی
 * کوئری می‌زند و بقیه منتظر همان نتیجه می‌مانند.
 */
const inFlight = new Map<string, Promise<unknown>>();

/**
 * مقدار را از کش می‌دهد، یا اگر نبود می‌سازد و نگه می‌دارد.
 *
 * @param key   شناسهٔ یکتای این کوئری، همراه پارامترهایش
 * @param tags  برچسب‌هایی که با باطل‌شدنشان این مقدار هم دور ریخته می‌شود
 * @param load  خودِ کوئری، فقط وقتی صدا زده می‌شود که کش نداشته باشیم
 */
export async function cached<T>(
  key: string,
  tags: string[],
  load: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = load()
    .then((value) => {
      store.set(key, { value, tags, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => inFlight.delete(key));

  inFlight.set(key, promise);
  return promise;
}

/** همهٔ مقادیر دارای این برچسب‌ها را دور می‌ریزد. */
export function invalidate(...tags: string[]): void {
  if (tags.length === 0) return;
  for (const [key, entry] of store) {
    if (entry.tags.some((t) => tags.includes(t))) store.delete(key);
  }
}

/** پاک‌کردن کامل — برای تست‌ها و مواقع اضطراری. */
export function clearCache(): void {
  store.clear();
  inFlight.clear();
}

export function cacheStats(): { entries: number; inFlight: number } {
  return { entries: store.size, inFlight: inFlight.size };
}

/** برچسب‌های شناخته‌شده، تا در کد رشتهٔ آزاد نوشته نشود. */
export const TAGS = {
  products: 'products',
  projects: 'projects',
  articles: 'articles',
  settings: 'settings',
  media: 'media',
  redirects: 'redirects',
} as const;

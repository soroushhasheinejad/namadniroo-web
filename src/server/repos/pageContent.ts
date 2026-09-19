import { getAllSettings, setSetting } from './content';
import { deepMerge } from '../content/merge';
import { type PageDef, storageKey } from '../../data/pages';
import { getDb } from '../db/client';
import { settings } from '../db/schema';
import { eq } from 'drizzle-orm';
import { TAGS, invalidate } from '../cache';

/**
 * متن یک صفحه، آن‌طور که قالب باید ببیند: متن ذخیره‌شده در پنل روی متن
 * پیش‌فرض همان صفحه.
 *
 * نوع خروجی از پیش‌فرض‌های خود صفحه گرفته می‌شود، پس قالبی که فیلد
 * نادرستی بخواهد در زمان ساخت خطا می‌دهد نه روی سایت.
 */
export async function getPageContent<T extends Record<string, unknown>>(page: PageDef<T>): Promise<T> {
  const stored = await getAllSettings().catch((err) => {
    /* صفحهٔ عمومی به‌خاطر خرابی دیتابیس نباید بالا نیاید؛ متن پیش‌فرض
       خیلی بهتر از صفحهٔ خطاست. */
    console.error(`[pages] خواندن متن «${page.key}» ناموفق بود؛ پیش‌فرض استفاده می‌شود:`, err);
    return {} as Record<string, unknown>;
  });
  return deepMerge(page.defaults, stored[storageKey(page.key)]);
}

export async function savePageContent(page: PageDef, value: unknown, userId: number): Promise<void> {
  await setSetting(storageKey(page.key), value, userId);
}

/** متن ذخیره‌شده را پاک می‌کند تا صفحه به متن اصلی برگردد */
export async function resetPageContent(page: PageDef): Promise<void> {
  const db = await getDb();
  await db.delete(settings).where(eq(settings.key, storageKey(page.key)));
  invalidate(TAGS.settings);
}

/** آیا متن این صفحه در پنل تغییر کرده است؟ */
export async function isCustomized(page: PageDef): Promise<boolean> {
  const stored = await getAllSettings();
  return storageKey(page.key) in stored;
}

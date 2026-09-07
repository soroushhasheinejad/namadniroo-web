import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { articles, auditLog, products, projects } from '../db/schema';
import { TAGS, invalidate } from '../cache';
import { clearRedirectFrom, createRedirect } from '../repos/redirects';

/**
 * نوشتن محتوا از پنل.
 *
 * سه کار در هر ذخیره انجام می‌شود که اگر یکی‌شان جا بیفتد بعداً دردسر
 * می‌سازد، پس همه اینجا جمع شده‌اند:
 *
 * ۱. باطل‌کردن کش، تا تغییر بلافاصله در سایت دیده شود.
 * ۲. ساخت ریدایرکت ۳۰۱ اگر نشانی (slug) عوض شده باشد.
 * ۳. ثبت در گزارش تغییرات.
 */

type Entity = 'products' | 'projects' | 'articles';

const tables = { products, projects, articles } as const;

const tags: Record<Entity, string> = {
  products: TAGS.products,
  projects: TAGS.projects,
  articles: TAGS.articles,
};

/** نشانی عمومی هر موجودیت — مبنای ساخت ریدایرکت هنگام تغییر slug */
const publicPath: Record<Entity, (slug: string) => string | null> = {
  products: (slug) => `/shop/${slug}`,
  articles: (slug) => `/magazine/${slug}`,
  // پروژه‌ها صفحهٔ اختصاصی ندارند، پس ریدایرکتی هم لازم نیست
  projects: () => null,
};

/**
 * نشانی را به شکل مجاز درمی‌آورد.
 *
 * حروف فارسی نگه داشته می‌شوند: نشانی فارسی هم برای گوگل قابل ایندکس است و
 * هم برای کاربر ایرانی خواناتر. فقط فاصله و نویسه‌هایی که در URL معنای
 * دیگری دارند حذف یا جایگزین می‌شوند.
 */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

export interface SaveOptions {
  userId: number;
  entity: Entity;
  /** نبودنش یعنی رکورد تازه */
  id?: number;
  values: Record<string, unknown>;
}

export async function saveContent({ userId, entity, id, values }: SaveOptions): Promise<number> {
  const db = await getDb();
  const table = tables[entity];

  const payload = { ...values, updatedAt: new Date() };

  if (!id) {
    const [row] = await db.insert(table).values(payload as never).returning({ id: table.id });
    await record(userId, entity, row!.id, 'create', values);
    invalidate(tags[entity]);
    return row!.id;
  }

  const [before] = await db.select().from(table).where(eq(table.id, id)).limit(1);
  await db.update(table).set(payload as never).where(eq(table.id, id));

  /* تغییر نشانی بدون ریدایرکت یعنی شکستن هر لینکی که به صفحهٔ قبلی داده
     شده و از دست دادن رتبهٔ گوگل. پس همین‌جا و خودکار ساخته می‌شود. */
  const oldSlug = (before as Record<string, unknown> | undefined)?.slug as string | undefined;
  const newSlug = values.slug as string | undefined;
  if (oldSlug && newSlug && oldSlug !== newSlug) {
    const from = publicPath[entity](oldSlug);
    const to = publicPath[entity](newSlug);
    if (from && to) {
      /* نشانی تازه ممکن است خودش قبلاً مبدأ یک ریدایرکت بوده باشد — مثلاً
         وقتی ویراستار نشانی را عوض کرده و حالا برش می‌گرداند. اگر آن ردیف
         بماند، صفحهٔ زنده به جای دیگری منتقل می‌شود و حلقه می‌سازد. */
      await clearRedirectFrom(to);
      await createRedirect(from, to, { auto: true });
    }
  }

  await record(userId, entity, id, 'update', diff(before as Record<string, unknown>, values));
  invalidate(tags[entity]);
  return id;
}

export async function deleteContent(userId: number, entity: Entity, id: number): Promise<void> {
  const db = await getDb();
  await db.delete(tables[entity]).where(eq(tables[entity].id, id));
  await record(userId, entity, id, 'delete', null);
  invalidate(tags[entity]);
}

/** فقط فیلدهایی که واقعاً عوض شده‌اند، به شکل { نام: [قبل, بعد] } */
function diff(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown>,
): Record<string, [unknown, unknown]> {
  const changes: Record<string, [unknown, unknown]> = {};
  if (!before) return changes;

  for (const [key, value] of Object.entries(after)) {
    const old = before[key];
    if (old instanceof Date || value instanceof Date) continue;
    if (JSON.stringify(old) !== JSON.stringify(value)) changes[key] = [old, value];
  }
  return changes;
}

async function record(
  userId: number,
  entity: string,
  entityId: number,
  action: 'create' | 'update' | 'delete',
  changes: unknown,
): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(auditLog).values({
      userId,
      entity,
      entityId: String(entityId),
      action,
      diff: changes as never,
    });
  } catch (err) {
    // گزارش تغییرات نباید مانع ذخیرهٔ محتوا شود
    console.error('[audit] ثبت ناموفق:', err);
  }
}

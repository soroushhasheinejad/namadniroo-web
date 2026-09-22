import { desc, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { leadActivity, users, type ActivityKind, type LeadActivity } from '../db/schema';

/**
 * خط زمانی پروندهٔ فروش.
 *
 * هر تماس، یادداشت و تغییر وضعیت یک سطر است. `notes` روی خود لید همچنان
 * وجود دارد و نقشش عوض شده: «خلاصهٔ فعلی پرونده» — چیزی که کارشناس در
 * نگاه اول باید بداند. جزئیات و ترتیب کارها اینجاست.
 */

export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  note: 'یادداشت',
  call: 'تماس تلفنی',
  meeting: 'جلسه / بازدید',
  message: 'پیام (واتساپ، بله، پیامک)',
  status: 'تغییر وضعیت',
  system: 'سیستم',
};

export interface NewActivity {
  leadId: number;
  kind?: ActivityKind;
  body?: string | null;
  userId?: number | null;
  statusFrom?: string | null;
  statusTo?: string | null;
}

/** حداکثر طول یادداشت — بلندتر از این، یعنی جایش سند است نه خط زمانی */
const MAX_BODY = 2000;

export async function logActivity(input: NewActivity): Promise<void> {
  const db = await getDb();
  await db.insert(leadActivity).values({
    leadId: input.leadId,
    kind: input.kind ?? 'note',
    body: input.body ? input.body.slice(0, MAX_BODY) : null,
    userId: input.userId ?? null,
    statusFrom: input.statusFrom ?? null,
    statusTo: input.statusTo ?? null,
  });
}

export type ActivityRow = LeadActivity & { userName: string | null };

/** خط زمانی یک پرونده — جدیدترین اول، چون کارشناس آخرین اتفاق را می‌خواهد */
export async function leadTimeline(leadId: number, limit = 100): Promise<ActivityRow[]> {
  const db = await getDb();
  return db
    .select({
      id: leadActivity.id,
      leadId: leadActivity.leadId,
      userId: leadActivity.userId,
      kind: leadActivity.kind,
      body: leadActivity.body,
      statusFrom: leadActivity.statusFrom,
      statusTo: leadActivity.statusTo,
      createdAt: leadActivity.createdAt,
      userName: users.name,
    })
    .from(leadActivity)
    .leftJoin(users, eq(leadActivity.userId, users.id))
    .where(eq(leadActivity.leadId, leadId))
    .orderBy(desc(leadActivity.createdAt), desc(leadActivity.id))
    .limit(limit);
}

/**
 * تعداد پیگیری‌های ثبت‌شده در بازهٔ اخیر، به تفکیک کارشناس.
 *
 * برای گزارش مدیریت: «چند تماس گرفته شد» عددی است که همیشه پرسیده می‌شود و
 * تا امروز جایی ثبت نمی‌شد.
 */
export async function activityCounts(since: Date) {
  const db = await getDb();
  return db
    .select({
      userName: sql<string>`coalesce(${users.name}, 'سیستم')`,
      kind: leadActivity.kind,
      value: sql<number>`count(*)`,
    })
    .from(leadActivity)
    .leftJoin(users, eq(leadActivity.userId, users.id))
    .where(sql`${leadActivity.createdAt} >= ${since}`)
    .groupBy(sql`coalesce(${users.name}, 'سیستم')`, leadActivity.kind);
}

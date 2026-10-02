/**
 * موتور پرس‌وجوی آنالیتیکس ۲.
 *
 * نسخهٔ ۱ چند گزارش ثابت دارد: هر سؤال تازه یعنی یک تابع تازه. اینجا
 * برعکس است — یک موتور که بُعد و سنجه و فیلتر را به‌صورت داده می‌گیرد، تا
 * گزارش‌ها و بخش «اکسپلور» هر دو از همین یکی ساخته شوند.
 *
 * روی جدول خام `events` کار می‌کند و نه خلاصهٔ روزانه، چون سؤال‌هایی مثل
 * «کمپین اینستاگرام روی صفحهٔ ماشین‌حساب، فقط موبایل» در خلاصهٔ روزانه
 * اصلاً وجود ندارد. در عوض بازهٔ زمانی همیشه محدود است و ستون‌های
 * پرتکرار ایندکس دارند.
 *
 * نکتهٔ امنیتی: نام ستون‌ها هرگز از ورودی کاربر ساخته نمی‌شود. هر بُعد و
 * سنجه کلیدی از همین فهرست است و مقدارها همیشه پارامتر می‌شوند — وگرنه
 * یک صفحهٔ گزارش، تزریق SQL می‌شد.
 */
import { and, gte, lte, sql, type SQL } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { events } from '../../db/schema';

/* ============================================================
   بُعدها و سنجه‌ها
   ============================================================ */

/** هر بُعد = یک ستون قابل گروه‌بندی، با نامی که در پنل دیده می‌شود */
export const DIMENSIONS = {
  channel: { label: 'کانال', col: events.channel },
  utmSource: { label: 'منبع (utm_source)', col: events.utmSource },
  utmMedium: { label: 'مدیوم (utm_medium)', col: events.utmMedium },
  utmCampaign: { label: 'کمپین (utm_campaign)', col: events.utmCampaign },
  utmTerm: { label: 'کلمهٔ کلیدی (utm_term)', col: events.utmTerm },
  utmContent: { label: 'خلاقه (utm_content)', col: events.utmContent },
  referrer: { label: 'ارجاع‌دهنده', col: events.referrer },
  path: { label: 'صفحه', col: events.path },
  device: { label: 'دستگاه', col: events.device },
  type: { label: 'نوع رویداد', col: events.type },
} as const;

export type DimensionKey = keyof typeof DIMENSIONS;

export const METRICS = {
  events: { label: 'رویداد', sql: sql<number>`count(*)` },
  sessions: { label: 'نشست', sql: sql<number>`count(distinct ${events.sessionId})` },
  visitors: { label: 'بازدیدکننده', sql: sql<number>`count(distinct ${events.visitorId})` },
  pageviews: {
    label: 'بازدید صفحه',
    sql: sql<number>`sum(case when ${events.type} = 'pageview' then 1 else 0 end)`,
  },
  leads: {
    label: 'لید',
    sql: sql<number>`sum(case when ${events.type} = 'lead_submit' then 1 else 0 end)`,
  },
  calcResults: {
    label: 'برآورد ماشین‌حساب',
    sql: sql<number>`sum(case when ${events.type} = 'calc_result' then 1 else 0 end)`,
  },
} as const;

export type MetricKey = keyof typeof METRICS;

/* `hasOwn` و نه `in`: عملگر `in` زنجیرهٔ پروتوتایپ را هم می‌بیند، پس
   `__proto__` از آن رد می‌شد و بعد `DIMENSIONS['__proto__'].col` چیزی
   می‌داد که ستون نیست. */
export const isDimension = (v: string): v is DimensionKey => Object.hasOwn(DIMENSIONS, v);
export const isMetric = (v: string): v is MetricKey => Object.hasOwn(METRICS, v);

/* ============================================================
   فیلتر
   ============================================================ */

/**
 * فیلترها روی همان بُعدها بسته می‌شوند. `null` یعنی «مقدار ندارد» که با
 * رشتهٔ خالی یکی نیست: بازدید بدون utm_source با بازدیدی که utm_source
 * خالی فرستاده فرق دارد و در گزارش هم جدا دیده می‌شوند.
 */
export interface Filter {
  dimension: DimensionKey;
  /** `null` = مقدار ثبت‌نشده */
  value: string | null;
  /** پیش‌فرض برابری؛ `contains` برای صفحه و ارجاع‌دهنده مفید است */
  op?: 'is' | 'contains' | 'not';
}

export interface Range {
  from: Date;
  to: Date;
}

export interface QuerySpec {
  range: Range;
  /** یک یا دو بُعد؛ دومی جدول را دوسطحی می‌کند (مثل اکسپلور GA4) */
  dimensions: DimensionKey[];
  metrics: MetricKey[];
  filters?: Filter[];
  /** بر اساس کدام سنجه مرتب شود — پیش‌فرض اولین سنجه */
  orderBy?: MetricKey;
  limit?: number;
}

export interface Row {
  keys: (string | null)[];
  values: Record<MetricKey, number>;
}

function filterSql(f: Filter): SQL {
  const col = DIMENSIONS[f.dimension].col;
  if (f.value === null) return f.op === 'not' ? sql`${col} is not null` : sql`${col} is null`;
  if (f.op === 'contains') return sql`${col} like ${'%' + f.value + '%'}`;
  if (f.op === 'not') return sql`(${col} is null or ${col} <> ${f.value})`;
  return sql`${col} = ${f.value}`;
}

/** شرط مشترک همهٔ پرس‌وجوها: بازهٔ زمانی به‌علاوهٔ فیلترهای کاربر */
export function whereOf(spec: Pick<QuerySpec, 'range' | 'filters'>): SQL {
  const parts: SQL[] = [
    gte(events.createdAt, spec.range.from),
    lte(events.createdAt, spec.range.to),
    ...(spec.filters ?? []).map(filterSql),
  ];
  return and(...parts)!;
}

/**
 * جدول گروه‌بندی‌شده.
 *
 * خروجی عمداً عمومی است (کلیدها + مقدارها) نه یک شکل برای هر گزارش، تا
 * همان یک کامپوننت جدول بتواند هر ترکیبی را نشان دهد.
 */
export async function runQuery(spec: QuerySpec): Promise<Row[]> {
  const db = await getDb();
  const dims = spec.dimensions.length ? spec.dimensions : (['channel'] as DimensionKey[]);
  const metrics = spec.metrics.length ? spec.metrics : (['sessions'] as MetricKey[]);

  const select: Record<string, unknown> = {};
  dims.forEach((d, i) => (select[`k${i}`] = DIMENSIONS[d].col));
  for (const m of metrics) select[m] = METRICS[m].sql;

  const order = spec.orderBy && metrics.includes(spec.orderBy) ? spec.orderBy : metrics[0]!;

  const rows = await db
    .select(select as never)
    .from(events)
    .where(whereOf(spec))
    .groupBy(...dims.map((d) => DIMENSIONS[d].col))
    .orderBy(sql`${METRICS[order].sql} desc`)
    .limit(Math.min(spec.limit ?? 100, 500));

  return (rows as Record<string, string | number | null>[]).map((r) => ({
    keys: dims.map((_, i) => (r[`k${i}`] as string | null) ?? null),
    values: Object.fromEntries(metrics.map((m) => [m, Number(r[m] ?? 0)])) as Record<
      MetricKey,
      number
    >,
  }));
}

/** مجموع کل، بدون گروه‌بندی — برای کارت‌های بالای صفحه */
export async function runTotals(
  spec: Pick<QuerySpec, 'range' | 'filters'> & { metrics: MetricKey[] },
): Promise<Record<MetricKey, number>> {
  const db = await getDb();
  const metrics = spec.metrics.length ? spec.metrics : (['sessions'] as MetricKey[]);
  const select = Object.fromEntries(metrics.map((m) => [m, METRICS[m].sql]));

  const [row] = await db.select(select as never).from(events).where(whereOf(spec));
  return Object.fromEntries(
    metrics.map((m) => [m, Number((row as Record<string, unknown>)?.[m] ?? 0)]),
  ) as Record<MetricKey, number>;
}

/** مقدارهای موجود یک بُعد، برای پرکردن فهرست کشویی فیلترها */
export async function dimensionValues(
  dimension: DimensionKey,
  range: Range,
  limit = 50,
): Promise<{ value: string | null; count: number }[]> {
  const db = await getDb();
  const col = DIMENSIONS[dimension].col;
  const rows = await db
    .select({ value: col, count: sql<number>`count(*)` })
    .from(events)
    .where(whereOf({ range }))
    .groupBy(col)
    .orderBy(sql`count(*) desc`)
    .limit(limit);
  return rows.map((r) => ({ value: (r.value as string | null) ?? null, count: Number(r.count) }));
}

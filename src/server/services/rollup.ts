import { and, desc, lt, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { dailyStats, events } from '../db/schema';
import { byChannel, deviceSplit, eventCounts, overview, salesKpis, topPages } from '../analytics/reports';
import { runAlerts } from './alerts';

/**
 * جمع‌بندی روزانهٔ آمار.
 *
 * دو مشکل را با هم حل می‌کند. اول سرعت: داشبورد نباید هر بار روی جدول خام
 * رویدادها کوئری بزند، چون آن جدول تنها چیزی است که مدام بزرگ می‌شود.
 * دوم و مهم‌تر، تاریخچه: رویدادهای خام بعد از چند ماه پاک می‌شوند و اگر
 * خلاصه‌ای نمانده باشد، مقایسهٔ امسال با پارسال برای همیشه از دست می‌رود.
 *
 * جمع‌بندی فقط برای روزهای تمام‌شده انجام می‌شود؛ روز جاری همیشه زنده از
 * خود رویدادها خوانده می‌شود، وگرنه عددی که تا ظهر جمع بسته شده تا شب
 * غلط می‌ماند.
 */

/** رویداد خام بعد از این مدت پاک می‌شود — خلاصه‌اش برای همیشه می‌ماند */
const RETENTION_DAYS = 120;

/** روزی که در یک بار اجرا حداکثر جمع‌بندی می‌شود (تا بعد از توقف طولانی، یک‌باره سنگین نشود) */
const MAX_DAYS_PER_RUN = 40;

/* مرز روز به وقت ایران، نه UTC — همان قاعده‌ای که گزارش‌ها با آن روزها را
   جدا می‌کنند. اگر این دو یکی نباشند، عدد جمع‌بندی‌شده با عدد زندهٔ همان
   روز فرق می‌کند و هیچ‌کس نمی‌فهمد چرا. */
const TZ = '+03:30';
const isoDay = (d: Date): string =>
  new Date(d.getTime() + 3.5 * 3_600_000).toISOString().slice(0, 10);
const dayStart = (day: string) => new Date(`${day}T00:00:00${TZ}`);
const dayRange = (day: string) => ({
  from: dayStart(day),
  to: new Date(dayStart(day).getTime() + 86_400_000),
});

interface StatRow {
  day: string;
  metric: string;
  key: string;
  value: number;
}

/** یک روز را جمع می‌بندد و می‌نویسد. اجرای دوباره بی‌ضرر است — مقدار قبلی بازنویسی می‌شود. */
export async function rollupDay(day: string): Promise<number> {
  const db = await getDb();
  const range = dayRange(day);

  const [total, channels, devices, pages, eventsByType, sales] = await Promise.all([
    overview(range),
    byChannel(range),
    deviceSplit(range),
    topPages(range, 25),
    eventCounts(range),
    salesKpis(range),
  ]);

  const rows: StatRow[] = [
    { day, metric: 'visits', key: '_', value: total.visitors },
    { day, metric: 'pageviews', key: '_', value: total.pageviews },
    { day, metric: 'sessions', key: '_', value: total.sessions },
    { day, metric: 'leads', key: '_', value: total.leads },
    { day, metric: 'won', key: '_', value: sales.won },
    { day, metric: 'deal_value', key: '_', value: sales.dealValue },
    { day, metric: 'capacity_kw', key: '_', value: sales.capacityKw },
    ...channels.map((c) => ({ day, metric: 'channel', key: c.channel, value: c.visitors })),
    ...channels.map((c) => ({ day, metric: 'channel_leads', key: c.channel, value: c.leads })),
    ...devices.map((d) => ({ day, metric: 'device', key: d.device, value: d.value })),
    ...pages.map((p) => ({ day, metric: 'path', key: p.path ?? '—', value: p.views })),
    ...eventsByType.map((e) => ({ day, metric: 'event', key: e.type, value: e.visitors })),
  ].filter((r) => r.value > 0);

  if (rows.length === 0) {
    /* روزی که هیچ اتفاقی در آن نیفتاده هم باید علامت بخورد، وگرنه هر شب
       دوباره تلاش می‌کنیم روزی را جمع ببندیم که خالی است. */
    rows.push({ day, metric: 'visits', key: '_', value: 0 });
  }

  for (const row of rows) {
    await db
      .insert(dailyStats)
      .values(row)
      .onConflictDoUpdate({
        target: [dailyStats.day, dailyStats.metric, dailyStats.key],
        set: { value: row.value },
      });
  }

  return rows.length;
}

/** آخرین روزی که جمع‌بندی شده */
async function lastRolledDay(): Promise<string | null> {
  const db = await getDb();
  const [row] = await db
    .select({ day: dailyStats.day })
    .from(dailyStats)
    .orderBy(desc(dailyStats.day))
    .limit(1);
  return row?.day ?? null;
}

/**
 * روزهای جمع‌بندی‌نشده را جمع می‌بندد.
 *
 * اگر تا به حال هیچ جمع‌بندی‌ای نشده، از قدیمی‌ترین رویداد موجود شروع
 * می‌کند — یعنی با اولین اجرا، کل تاریخچهٔ موجود خلاصه می‌شود.
 */
export async function rollupPending(): Promise<number> {
  const db = await getDb();
  const last = await lastRolledDay();

  let start: Date;
  if (last) {
    start = dayStart(last);
    start.setUTCDate(start.getUTCDate() + 1);
  } else {
    const [first] = await db
      .select({ at: events.createdAt })
      .from(events)
      .orderBy(events.createdAt)
      .limit(1);
    if (!first) return 0;
    start = dayStart(isoDay(first.at));
  }

  /* روز جاری جمع‌بندی نمی‌شود: هنوز تمام نشده و عددش تا شب عوض می‌شود. */
  const today = dayStart(isoDay(new Date())).toISOString();
  let done = 0;

  while (start.toISOString() < today && done < MAX_DAYS_PER_RUN) {
    await rollupDay(isoDay(start));
    start.setUTCDate(start.getUTCDate() + 1);
    done++;
  }

  return done;
}

/**
 * رویدادهای قدیمی را پاک می‌کند.
 *
 * فقط بعد از جمع‌بندی صدا زده می‌شود؛ ترتیبش حیاتی است، وگرنه روزی پاک
 * می‌شود که هنوز خلاصه نشده و داده‌اش برای همیشه می‌رود.
 */
export async function pruneEvents(days = RETENTION_DAYS): Promise<void> {
  const db = await getDb();
  const cutoff = new Date(Date.now() - days * 86_400_000);
  await db.delete(events).where(lt(events.createdAt, cutoff));
}

/* ============================================================
   خواندن از خلاصه — برای بازه‌هایی که رویداد خامشان پاک شده
   ============================================================ */

export interface RolledSummary {
  /** جمع بازدیدکنندهٔ روزانه — «بازدیدکننده‌روز»، نه آدم یکتا */
  visitorDays: number;
  pageviews: number;
  channels: { channel: string; visitorDays: number; leads: number }[];
}

/**
 * آمار یک بازه از جدول جمع‌بندی.
 *
 * چرا لازم است: داشبورد و گزارش مستقیم روی رویدادهای خام کوئری می‌زنند و
 * آن‌ها بعد از ۱۲۰ روز پاک می‌شوند. بدون این تابع، گزارش «آبان پارسال»
 * ترافیک صفر نشان می‌داد — که بدتر از نبودِ گزارش است، چون شبیه یک عدد
 * واقعی به نظر می‌رسد.
 *
 * یک تفاوت را باید صریح گفت و هر جا نمایش داده می‌شود برچسب خورد: اینجا
 * جمعِ شمارش‌های روزانه است، پس کسی که در سه روز آمده سه بار شمرده
 * می‌شود. شمارش آدم یکتا در یک بازهٔ بلند را فقط از روی رویداد خام
 * می‌شود گرفت و آن رویداد دیگر وجود ندارد.
 */
export async function summaryFromRollup(from: string, to: string): Promise<RolledSummary> {
  const db = await getDb();

  const rows = await db
    .select({ metric: dailyStats.metric, key: dailyStats.key, value: sql<number>`sum(${dailyStats.value})` })
    .from(dailyStats)
    .where(and(sql`${dailyStats.day} >= ${from}`, sql`${dailyStats.day} < ${to}`))
    .groupBy(dailyStats.metric, dailyStats.key);

  const channels = new Map<string, { channel: string; visitorDays: number; leads: number }>();
  const channelRow = (key: string) =>
    channels.get(key) ?? channels.set(key, { channel: key, visitorDays: 0, leads: 0 }).get(key)!;

  let visitorDays = 0;
  let pageviews = 0;

  for (const row of rows) {
    if (row.metric === 'visits' && row.key === '_') visitorDays = row.value;
    else if (row.metric === 'pageviews' && row.key === '_') pageviews = row.value;
    else if (row.metric === 'channel') channelRow(row.key).visitorDays = row.value;
    else if (row.metric === 'channel_leads') channelRow(row.key).leads = row.value;
  }

  return {
    visitorDays,
    pageviews,
    channels: [...channels.values()].sort((a, b) => b.leads - a.leads || b.visitorDays - a.visitorDays),
  };
}

/** آیا رویدادهای خام این بازه هنوز هستند؟ */
export function withinRetention(from: Date): boolean {
  return from.getTime() > Date.now() - RETENTION_DAYS * 86_400_000;
}

/** همان شکل تاریخی که جدول جمع‌بندی با آن کار می‌کند */
export const rollupDayKey = isoDay;

/* ============================================================
   worker
   ============================================================ */

let timer: ReturnType<typeof setInterval> | null = null;

/**
 * کارهای پس‌زمینهٔ آمار: جمع‌بندی، پاک‌سازی، هشدار پیگیری.
 *
 * هر شش ساعت اجرا می‌شود و نه دقیقاً نیمه‌شب: هیچ‌کدام از این کارها به
 * ساعت دقیق حساس نیستند و یک `setInterval` ساده، یک زمان‌بند جداگانه کم
 * می‌کند. تکرار هم بی‌ضرر است چون جمع‌بندی هر روز، مقدار قبلی را بازنویسی
 * می‌کند نه اینکه رویش اضافه کند.
 */
export function startAnalyticsWorker(intervalMs = 6 * 60 * 60_000): void {
  if (timer) return;

  const tick = async () => {
    try {
      const days = await rollupPending();
      if (days > 0) {
        console.log(`[analytics] ${days} روز جمع‌بندی شد`);
        await pruneEvents();
      }
      await runAlerts();
    } catch (err) {
      console.error('[analytics] دور پس‌زمینه ناموفق:', err);
    }
  };

  timer = setInterval(() => void tick(), intervalMs);
  timer.unref?.();

  /* اولین اجرا کمی بعد از بالا آمدن اپ، نه همان لحظه: وقتی نسخهٔ تازه
     منتشر می‌شود، چند ثانیهٔ اول باید صرف پاسخ به بازدیدکننده شود نه
     جمع‌بندی آمار. */
  setTimeout(() => void tick(), 60_000).unref?.();
}

export function stopAnalyticsWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

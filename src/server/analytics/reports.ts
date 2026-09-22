import { and, eq, gte, isNotNull, lt, ne, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { events, leads, visitors } from '../db/schema';
import { FUNNEL } from './events';

/**
 * کوئری‌های گزارش.
 *
 * یک قاعده در همهٔ این فایل: هر جا «چند نفر» معنا دارد، آدم‌ها شمرده
 * می‌شوند نه رویدادها (`count(distinct visitor_id)`). تفاوتش کوچک به نظر
 * می‌رسد ولی نیست: کسی که ده بار ورودی ماشین‌حساب را عوض می‌کند، یک نفر
 * است؛ اگر رویداد بشماریم، قیف پر از آدم‌های خیالی می‌شود و نرخ تبدیل
 * بی‌معنا.
 *
 * بازهٔ زمانی همیشه صریح پاس داده می‌شود و هیچ تابعی پیش‌فرض «تا امروز»
 * ندارد، تا دو عدد در یک گزارش تصادفاً از دو بازهٔ متفاوت نیایند.
 */

/**
 * مرز روز، به وقت ایران.
 *
 * زمان‌ها در دیتابیس UTC هستند. بدون این تنظیم، بازدیدهای بین نیمه‌شب تا
 * ۳:۳۰ بامداد به روز قبل می‌افتادند — یعنی هر شب بخشی از ترافیک در
 * گزارش روز اشتباهی می‌نشست.
 */
const LOCAL_DAY = (column: unknown) =>
  sql<string>`date(${column}, 'unixepoch', '+3 hours', '+30 minutes')`;

export interface Range {
  from: Date;
  to: Date;
}

const inRange = (r: Range) => and(gte(events.createdAt, r.from), lt(events.createdAt, r.to));
const people = sql<number>`count(distinct ${events.visitorId})`;

/* ============================================================
   نمای کلی
   ============================================================ */

export interface Overview {
  visitors: number;
  pageviews: number;
  sessions: number;
  leads: number;
  /** درصد بازدیدکنندگانی که به درخواست تبدیل شدند */
  conversion: number;
}

export async function overview(r: Range): Promise<Overview> {
  const db = await getDb();

  const [[traffic], [leadCount]] = await Promise.all([
    db
      .select({
        visitors: people,
        pageviews: sql<number>`count(*)`,
        sessions: sql<number>`count(distinct ${events.sessionId})`,
      })
      .from(events)
      .where(and(inRange(r), eq(events.type, 'pageview'))),
    db
      .select({ value: sql<number>`count(*)` })
      .from(leads)
      .where(and(gte(leads.createdAt, r.from), lt(leads.createdAt, r.to))),
  ]);

  const v = traffic?.visitors ?? 0;
  const l = leadCount?.value ?? 0;

  return {
    visitors: v,
    pageviews: traffic?.pageviews ?? 0,
    sessions: traffic?.sessions ?? 0,
    leads: l,
    conversion: v > 0 ? (l / v) * 100 : 0,
  };
}

/* ============================================================
   قیف
   ============================================================ */

export interface FunnelStep {
  key: string;
  label: string;
  people: number;
  /**
   * درصد نسبت به مرحلهٔ قبل — جایی که نشتی دیده می‌شود.
   *
   * `null` یعنی مرحلهٔ قبل هیچ‌کس نداشته و نسبت تعریف‌نشده است. با صفر
   * یکی نیست و نباید یکی نشان داده شود: «۰٪ عبور کردند» حرفی دربارهٔ
   * ریزش می‌زند که واقعیت ندارد.
   */
  fromPrevious: number | null;
  /** درصد نسبت به کل بازدیدکنندگان */
  ofTotal: number;
}

/**
 * قیف تبدیل.
 *
 * «درصد نسبت به مرحلهٔ قبل» عمداً کنار «درصد از کل» می‌آید: دومی می‌گوید
 * در مجموع چقدر تبدیل داریم، اولی می‌گوید نشتی دقیقاً کجاست — و تصمیم
 * محصولی از دومی در نمی‌آید.
 */
export async function funnel(r: Range): Promise<FunnelStep[]> {
  const db = await getDb();

  const rows = await db
    .select({ type: events.type, value: people })
    .from(events)
    .where(inRange(r))
    .groupBy(events.type);

  const counts = new Map(rows.map((row) => [row.type, row.value]));
  const visits = counts.get('pageview') ?? 0;

  let previous = visits;
  return FUNNEL.map((step) => {
    const value = step.key === 'visits' ? visits : (counts.get(step.key) ?? 0);
    const out: FunnelStep = {
      key: step.key,
      label: step.label,
      people: value,
      fromPrevious: previous > 0 ? (value / previous) * 100 : null,
      ofTotal: visits > 0 ? (value / visits) * 100 : 0,
    };
    previous = value;
    return out;
  });
}

/* ============================================================
   کانال‌ها — جایی که بودجهٔ بازاریابی تصمیم گرفته می‌شود
   ============================================================ */

export interface ChannelRow {
  channel: string;
  visitors: number;
  leads: number;
  won: number;
  value: number;
  capacityKw: number;
  /** درصد بازدیدکنندهٔ این کانال که به درخواست رسید */
  conversion: number;
}

/**
 * عملکرد هر کانال، از بازدید تا قرارداد.
 *
 * ترافیک از رویدادها می‌آید و لید از جدول لیدها؛ اتصالشان «کانال» است.
 * برای لید، *اولین* برخورد مبنا است نه آخرین: کسی که از اینستاگرام ما را
 * شناخت و یک هفته بعد با جست‌وجوی نام شرکت برگشت، مشتری‌ای است که
 * اینستاگرام آورده — نه گوگل. آخرین برخورد جداگانه روی خود پرونده هست.
 *
 * نکته‌ای که موقع خواندن باید بدانید: اگر بازدیدکننده‌ای در یک بازه هم از
 * گوگل و هم از اینستاگرام آمده باشد، در هر دو سطر شمرده می‌شود؛ پس جمع
 * ستون بازدیدکننده می‌تواند از کل بیشتر باشد.
 */
export async function byChannel(r: Range): Promise<ChannelRow[]> {
  const db = await getDb();

  const [traffic, conversions] = await Promise.all([
    db
      .select({ channel: sql<string>`coalesce(${events.channel}, 'direct')`, value: people })
      .from(events)
      .where(and(inRange(r), eq(events.type, 'pageview'), ne(events.channel, 'internal')))
      .groupBy(sql`coalesce(${events.channel}, 'direct')`),
    db
      .select({
        channel: sql<string>`coalesce(${leads.firstChannel}, ${leads.channel}, 'direct')`,
        value: sql<number>`count(*)`,
        won: sql<number>`sum(case when ${leads.status} = 'won' then 1 else 0 end)`,
        amount: sql<number>`coalesce(sum(case when ${leads.status} = 'won' then ${leads.dealValue} else 0 end), 0)`,
        kw: sql<number>`coalesce(sum(case when ${leads.status} = 'won' then ${leads.capacityKw} else 0 end), 0)`,
      })
      .from(leads)
      .where(and(gte(leads.createdAt, r.from), lt(leads.createdAt, r.to)))
      .groupBy(sql`coalesce(${leads.firstChannel}, ${leads.channel}, 'direct')`),
  ]);

  const map = new Map<string, ChannelRow>();
  const row = (channel: string): ChannelRow =>
    map.get(channel) ??
    map.set(channel, {
      channel,
      visitors: 0,
      leads: 0,
      won: 0,
      value: 0,
      capacityKw: 0,
      conversion: 0,
    }).get(channel)!;

  for (const t of traffic) row(t.channel).visitors = t.value;
  for (const c of conversions) {
    const target = row(c.channel);
    target.leads = c.value;
    target.won = c.won ?? 0;
    target.value = c.amount ?? 0;
    target.capacityKw = c.kw ?? 0;
  }

  return [...map.values()]
    .map((c) => ({ ...c, conversion: c.visitors > 0 ? (c.leads / c.visitors) * 100 : 0 }))
    .sort((a, b) => b.leads - a.leads || b.visitors - a.visitors);
}

/* ============================================================
   صفحه‌ها، رویدادها، دستگاه‌ها
   ============================================================ */

export async function topPages(r: Range, limit = 15) {
  const db = await getDb();
  return db
    .select({ path: events.path, views: sql<number>`count(*)`, visitors: people })
    .from(events)
    .where(and(inRange(r), eq(events.type, 'pageview'), isNotNull(events.path)))
    .groupBy(events.path)
    .orderBy(sql`count(*) desc`)
    .limit(limit);
}

/**
 * صفحه‌های ورود — اولین صفحه‌ای که بازدیدکننده دیده.
 *
 * با «پربازدیدترین صفحه» یکی نیست و تفاوتشان برای سئو مهم است: صفحه‌ای که
 * مردم از گوگل رویش فرود می‌آیند، صفحه‌ای است که باید برایش محتوا نوشت.
 */
export async function landingPages(r: Range, limit = 10) {
  const db = await getDb();
  return db
    .select({ path: visitors.firstLanding, value: sql<number>`count(*)` })
    .from(visitors)
    .where(
      and(gte(visitors.firstSeen, r.from), lt(visitors.firstSeen, r.to), isNotNull(visitors.firstLanding)),
    )
    .groupBy(visitors.firstLanding)
    .orderBy(sql`count(*) desc`)
    .limit(limit);
}

export async function eventCounts(r: Range) {
  const db = await getDb();
  return db
    .select({ type: events.type, total: sql<number>`count(*)`, visitors: people })
    .from(events)
    .where(and(inRange(r), ne(events.type, 'pageview')))
    .groupBy(events.type)
    .orderBy(sql`count(distinct ${events.visitorId}) desc`);
}

export async function deviceSplit(r: Range) {
  const db = await getDb();
  return db
    .select({ device: sql<string>`coalesce(${events.device}, 'desktop')`, value: people })
    .from(events)
    .where(and(inRange(r), eq(events.type, 'pageview')))
    .groupBy(sql`coalesce(${events.device}, 'desktop')`);
}

/** روند روزانهٔ بازدیدکننده و لید — برای نمودار */
export async function dailyTrend(r: Range) {
  const db = await getDb();

  const [traffic, conversions] = await Promise.all([
    db
      .select({ day: LOCAL_DAY(events.createdAt), value: people })
      .from(events)
      .where(and(inRange(r), eq(events.type, 'pageview')))
      .groupBy(LOCAL_DAY(events.createdAt)),
    db
      .select({ day: LOCAL_DAY(leads.createdAt), value: sql<number>`count(*)` })
      .from(leads)
      .where(and(gte(leads.createdAt, r.from), lt(leads.createdAt, r.to)))
      .groupBy(LOCAL_DAY(leads.createdAt)),
  ]);

  const leadsByDay = new Map(conversions.map((c) => [c.day, c.value]));
  return traffic
    .map((t) => ({ day: t.day, visitors: t.value, leads: leadsByDay.get(t.day) ?? 0 }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

/* ============================================================
   محتوایی که واقعاً مشتری می‌آورد
   ============================================================ */

/**
 * مقاله‌هایی که بازدیدکنندگانِ تبدیل‌شده خوانده بودند.
 *
 * این عدد چیزی را نشان می‌دهد که هیچ ابزار آماده‌ای نمی‌دهد: ارزش محتوا
 * در مسیر فروش، نه تعداد بازدیدش. مقاله‌ای با هزار بازدید که هیچ‌کدام لید
 * نشدند، از مقاله‌ای با صد بازدید که پنج تایشان مشتری شدند کم‌ارزش‌تر
 * است.
 *
 * ادعای علیت ندارد — می‌گوید «این‌ها را خوانده بودند»، نه «به خاطر این‌ها
 * تماس گرفتند». برای تصمیم دربارهٔ موضوع مقالهٔ بعدی، همین کافی است.
 */
export async function assistingContent(r: Range, limit = 12) {
  const db = await getDb();
  return db
    .select({
      path: events.path,
      leads: sql<number>`count(distinct ${visitors.leadId})`,
    })
    .from(events)
    .innerJoin(visitors, eq(visitors.id, events.visitorId))
    .where(
      and(
        eq(events.type, 'pageview'),
        isNotNull(visitors.leadId),
        sql`${events.path} like '/magazine/%'`,
        gte(events.createdAt, r.from),
        lt(events.createdAt, r.to),
      ),
    )
    .groupBy(events.path)
    .orderBy(sql`count(distinct ${visitors.leadId}) desc`)
    .limit(limit);
}

/* ============================================================
   سنجه‌های فروش
   ============================================================ */

export interface SalesKpis {
  leads: number;
  contacted: number;
  won: number;
  lost: number;
  open: number;
  /** میانگین فاصلهٔ ثبت درخواست تا اولین تماس، به ساعت */
  responseHours: number | null;
  /** میانگین طول چرخهٔ فروش پرونده‌های بسته‌شده، به روز */
  cycleDays: number | null;
  /** تعداد لیدهایی که هنوز هیچ تماسی با آن‌ها گرفته نشده */
  untouched: number;
  dealValue: number;
  capacityKw: number;
  /** درصد لیدهایی که به قرارداد رسیدند (از میان پرونده‌های بسته‌شده) */
  winRate: number;
}

export async function salesKpis(r: Range): Promise<SalesKpis> {
  const db = await getDb();
  const within = and(gte(leads.createdAt, r.from), lt(leads.createdAt, r.to));

  const [row] = await db
    .select({
      total: sql<number>`count(*)`,
      contacted: sql<number>`sum(case when ${leads.status} = 'contacted' then 1 else 0 end)`,
      won: sql<number>`sum(case when ${leads.status} = 'won' then 1 else 0 end)`,
      lost: sql<number>`sum(case when ${leads.status} = 'lost' then 1 else 0 end)`,
      untouched: sql<number>`sum(case when ${leads.firstContactAt} is null then 1 else 0 end)`,
      /* میانگین فقط روی پرونده‌هایی که واقعاً تماس گرفته شده‌اند؛ گنجاندن
         بقیه با صفر، عدد را به‌شکل خوش‌بینانه‌ای خراب می‌کرد. */
      responseSeconds: sql<number | null>`avg(case when ${leads.firstContactAt} is not null
        then ${leads.firstContactAt} - ${leads.createdAt} end)`,
      cycleSeconds: sql<number | null>`avg(case when ${leads.closedAt} is not null
        then ${leads.closedAt} - ${leads.createdAt} end)`,
      amount: sql<number>`coalesce(sum(case when ${leads.status} = 'won' then ${leads.dealValue} else 0 end), 0)`,
      kw: sql<number>`coalesce(sum(case when ${leads.status} = 'won' then ${leads.capacityKw} else 0 end), 0)`,
    })
    .from(leads)
    .where(within);

  const total = row?.total ?? 0;
  const won = row?.won ?? 0;
  const lost = row?.lost ?? 0;
  const closed = won + lost;

  return {
    leads: total,
    contacted: row?.contacted ?? 0,
    won,
    lost,
    open: total - closed,
    responseHours: row?.responseSeconds ? row.responseSeconds / 3600 : null,
    cycleDays: row?.cycleSeconds ? row.cycleSeconds / 86400 : null,
    untouched: row?.untouched ?? 0,
    dealValue: row?.amount ?? 0,
    capacityKw: row?.kw ?? 0,
    winRate: closed > 0 ? (won / closed) * 100 : 0,
  };
}

/** دلایل ازدست‌رفتن — پاسخ به «چرا می‌بازیم» */
export async function lostReasons(r: Range) {
  const db = await getDb();
  return db
    .select({ reason: sql<string>`coalesce(${leads.lostReason}, 'ثبت نشده')`, value: sql<number>`count(*)` })
    .from(leads)
    .where(and(eq(leads.status, 'lost'), gte(leads.createdAt, r.from), lt(leads.createdAt, r.to)))
    .groupBy(sql`coalesce(${leads.lostReason}, 'ثبت نشده')`)
    .orderBy(sql`count(*) desc`);
}

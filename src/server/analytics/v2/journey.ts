/**
 * نشست‌ها و مسیر هر شخص.
 *
 * نشست جدول جدا ندارد: `events.session_id` هنگام ثبت ساخته می‌شود و هر
 * چیزی که دربارهٔ نشست می‌خواهیم — صفحهٔ ورود، کانال، طول، تعداد بازدید —
 * از همان رویدادها در می‌آید. ساختن جدول موازی یعنی دو جای حقیقت و یک
 * مسیر تازه برای ناهماهنگی؛ اگر روزی حجم داده زیاد شد، همین کوئری‌ها
 * به جدول خلاصه منتقل می‌شوند بی‌آنکه رابط عوض شود.
 */
import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { events, leads, visitors } from '../../db/schema';
import type { Filter, Range } from './query';
import { whereOf } from './query';

export interface SessionRow {
  sessionId: string;
  visitorId: string;
  startedAt: Date;
  endedAt: Date;
  /** ثانیه؛ نشست تک‌بازدیدی صفر است و این واقعیت است نه خطا */
  durationSec: number;
  pageviews: number;
  eventCount: number;
  landing: string | null;
  exit: string | null;
  channel: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  device: string | null;
  /** آیا در همین نشست فرم پر شد */
  converted: boolean;
}

/** نشست‌های یک بازه، با همان فیلترهای گزارش‌ها */
export async function listSessions(
  range: Range,
  filters: Filter[] = [],
  limit = 100,
): Promise<SessionRow[]> {
  const db = await getDb();

  /* `min(created_at)` ردیف ورود را تعیین می‌کند و بقیهٔ ستون‌های همان ردیف
     با همین تابع بیرون می‌آیند — در SQLite این الگو تضمین‌شده است. */
  const rows = await db
    .select({
      sessionId: events.sessionId,
      visitorId: sql<string>`min(${events.visitorId})`,
      startedAt: sql<number>`min(${events.createdAt})`,
      endedAt: sql<number>`max(${events.createdAt})`,
      eventCount: sql<number>`count(*)`,
      pageviews: sql<number>`sum(case when ${events.type} = 'pageview' then 1 else 0 end)`,
      converted: sql<number>`max(case when ${events.type} = 'lead_submit' then 1 else 0 end)`,
      landing: sql<string | null>`min(${events.path})`,
      exit: sql<string | null>`max(${events.path})`,
      channel: sql<string | null>`min(${events.channel})`,
      utmSource: sql<string | null>`min(${events.utmSource})`,
      utmMedium: sql<string | null>`min(${events.utmMedium})`,
      utmCampaign: sql<string | null>`min(${events.utmCampaign})`,
      device: sql<string | null>`min(${events.device})`,
    })
    .from(events)
    .where(whereOf({ range, filters }))
    .groupBy(events.sessionId)
    .orderBy(desc(sql`min(${events.createdAt})`))
    .limit(Math.min(limit, 500));

  return rows.map((r) => ({
    sessionId: r.sessionId,
    visitorId: r.visitorId,
    startedAt: new Date(Number(r.startedAt) * 1000),
    endedAt: new Date(Number(r.endedAt) * 1000),
    durationSec: Number(r.endedAt) - Number(r.startedAt),
    pageviews: Number(r.pageviews ?? 0),
    eventCount: Number(r.eventCount),
    landing: r.landing,
    exit: r.exit,
    channel: r.channel,
    utmSource: r.utmSource,
    utmMedium: r.utmMedium,
    utmCampaign: r.utmCampaign,
    device: r.device,
    converted: Number(r.converted) === 1,
  }));
}

export interface JourneyEvent {
  at: Date;
  type: string;
  path: string | null;
  sessionId: string;
  props: unknown;
}

export interface Journey {
  visitor: {
    id: string;
    firstSeen: Date;
    lastSeen: Date;
    pageviews: number;
    sessions: number;
    device: string | null;
    firstChannel: string | null;
    firstUtmSource: string | null;
    firstUtmMedium: string | null;
    firstUtmCampaign: string | null;
    firstUtmTerm: string | null;
    firstUtmContent: string | null;
    firstReferrer: string | null;
    firstLanding: string | null;
    lastChannel: string | null;
  };
  /** پروندهٔ فروش، اگر این بازدیدکننده روزی فرم پر کرده باشد */
  lead: {
    id: number;
    name: string;
    phone: string;
    status: string;
    dealValue: number | null;
    createdAt: Date;
  } | null;
  sessions: SessionRow[];
  timeline: JourneyEvent[];
}

/**
 * همهٔ آنچه از یک نفر می‌دانیم، از اولین بازدید تا آخرین رویداد.
 *
 * سقف رویداد دارد چون یک ربات یا یک کاربر خیلی فعال می‌تواند هزاران
 * ردیف داشته باشد و صفحه را از کار بیندازد.
 */
export async function journeyOf(visitorId: string, maxEvents = 300): Promise<Journey | null> {
  const db = await getDb();

  const [visitor] = await db.select().from(visitors).where(eq(visitors.id, visitorId)).limit(1);
  if (!visitor) return null;

  const [rawEvents, leadRow] = await Promise.all([
    db
      .select({
        at: events.createdAt,
        type: events.type,
        path: events.path,
        sessionId: events.sessionId,
        props: events.props,
      })
      .from(events)
      .where(eq(events.visitorId, visitorId))
      .orderBy(asc(events.createdAt))
      .limit(maxEvents),
    visitor.leadId
      ? db
          .select({
            id: leads.id,
            name: leads.name,
            phone: leads.phone,
            status: leads.status,
            dealValue: leads.dealValue,
            createdAt: leads.createdAt,
          })
          .from(leads)
          .where(eq(leads.id, visitor.leadId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  /* نشست‌های همین یک نفر؛ بازهٔ زمانی از خود پروندهٔ بازدیدکننده می‌آید
     تا مسیر کامل دیده شود، نه فقط بازه‌ای که در صفحه انتخاب شده. */
  const sessions = await listSessions(
    { from: visitor.firstSeen, to: new Date(visitor.lastSeen.getTime() + 1000) },
    [],
    200,
  ).then((all) => all.filter((s) => s.visitorId === visitorId));

  return {
    visitor: {
      id: visitor.id,
      firstSeen: visitor.firstSeen,
      lastSeen: visitor.lastSeen,
      pageviews: visitor.pageviews,
      sessions: visitor.sessions,
      device: visitor.device,
      firstChannel: visitor.firstChannel,
      firstUtmSource: visitor.firstUtmSource,
      firstUtmMedium: visitor.firstUtmMedium,
      firstUtmCampaign: visitor.firstUtmCampaign,
      firstUtmTerm: visitor.firstUtmTerm,
      firstUtmContent: visitor.firstUtmContent,
      firstReferrer: visitor.firstReferrer,
      firstLanding: visitor.firstLanding,
      lastChannel: visitor.lastChannel,
    },
    lead: leadRow[0] ?? null,
    sessions,
    timeline: rawEvents.map((e) => ({ ...e, at: e.at })),
  };
}

/** بازدیدکننده‌های یک بازه، مرتب بر اساس آخرین فعالیت — ورودی صفحهٔ جرنی */
export async function listVisitors(
  range: Range,
  opts: { onlyLeads?: boolean; limit?: number } = {},
): Promise<
  {
    id: string;
    lastSeen: Date;
    pageviews: number;
    sessions: number;
    firstChannel: string | null;
    firstUtmSource: string | null;
    firstUtmCampaign: string | null;
    device: string | null;
    leadId: number | null;
    leadName: string | null;
    leadStatus: string | null;
  }[]
> {
  const db = await getDb();
  const where = and(
    gte(visitors.lastSeen, range.from),
    lte(visitors.lastSeen, range.to),
    ...(opts.onlyLeads ? [sql`${visitors.leadId} is not null`] : []),
  )!;

  const rows = await db
    .select({
      id: visitors.id,
      lastSeen: visitors.lastSeen,
      pageviews: visitors.pageviews,
      sessions: visitors.sessions,
      firstChannel: visitors.firstChannel,
      firstUtmSource: visitors.firstUtmSource,
      firstUtmCampaign: visitors.firstUtmCampaign,
      device: visitors.device,
      leadId: visitors.leadId,
      leadName: leads.name,
      leadStatus: leads.status,
    })
    .from(visitors)
    .leftJoin(leads, eq(leads.id, visitors.leadId))
    .where(where)
    .orderBy(desc(visitors.lastSeen))
    .limit(Math.min(opts.limit ?? 100, 500));

  return rows;
}

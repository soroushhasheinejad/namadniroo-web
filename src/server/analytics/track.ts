import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { events, visitors } from '../db/schema';
import type { Attribution, Device } from './channel';

/**
 * نوشتن رویداد در دیتابیس.
 *
 * دو قاعده در همهٔ این فایل رعایت می‌شود:
 *
 * ۱. هیچ‌وقت منتظر نمی‌مانیم. ثبت آمار نباید حتی یک میلی‌ثانیه به زمان
 *    پاسخ صفحه اضافه کند، و خطای دیتابیس هرگز نباید باعث شود بازدیدکننده
 *    صفحه را نبیند. پس فراخوانی‌ها `void` هستند و خطا فقط لاگ می‌شود.
 *
 * ۲. هیچ اطلاعات شخصی ثبت نمی‌شود. نه آی‌پی، نه شماره تلفن، نه نام.
 *    شناسهٔ بازدیدکننده عدد تصادفی است و تا وقتی خودِ کاربر فرم را پر
 *    نکند به هیچ هویتی وصل نیست.
 */

/** نشانی بلندتر از این یا اسکن ربات است یا پارامتر بی‌معنی */
const MAX_PATH = 200;

export interface TrackInput {
  visitorId: string;
  sessionId: string;
  type: string;
  path?: string | null;
  device?: Device | null;
  attribution?: Attribution | null;
  props?: Record<string, unknown> | null;
}

/** بدنهٔ ثبت — جدا نگه داشته شده تا در تست بدون `void` قابل انتظار کشیدن باشد */
export async function writeEvent(input: TrackInput): Promise<void> {
  const db = await getDb();
  const a = input.attribution;
  await db.insert(events).values({
    visitorId: input.visitorId,
    sessionId: input.sessionId,
    type: input.type,
    path: input.path ? input.path.slice(0, MAX_PATH) : null,
    referrer: a?.referrer ?? null,
    channel: a?.channel ?? null,
    utmSource: a?.utmSource ?? null,
    utmMedium: a?.utmMedium ?? null,
    utmCampaign: a?.utmCampaign ?? null,
    device: input.device ?? null,
    props: (input.props ?? null) as never,
  });
}

/** ثبت رویداد بدون معطل کردن درخواست */
export function trackEvent(input: TrackInput): void {
  void writeEvent(input).catch((err) => console.error('[analytics] ثبت رویداد ناموفق:', err));
}

export interface VisitInput {
  visitorId: string;
  sessionId: string;
  newSession: boolean;
  path: string;
  device: Device;
  attribution: Attribution;
}

/**
 * یک بازدید صفحه: هم ردیف رویداد، هم به‌روزرسانی پروندهٔ بازدیدکننده.
 *
 * «اولین برخورد» فقط هنگام ساخت ردیف نوشته می‌شود و بعد از آن دست‌نخورده
 * می‌ماند — این تمام ارزش جدول بازدیدکننده است. اگر با هر بازدید به‌روز
 * می‌شد، دیگر نمی‌شد گفت این آدم اولین بار از کجا ما را شناخت و همه‌چیز
 * به آخرین کلیک تقلیل پیدا می‌کرد.
 *
 * کانال داخلی («internal») در اولین برخورد ثبت نمی‌شود: اگر کوکی کاربر
 * پاک شده باشد و وسط سایت دوباره شناخته شود، مبدأش «خودمان» نیست، نامعلوم
 * است.
 */
export function trackVisit(input: VisitInput): void {
  const { visitorId, sessionId, path, device, attribution: a, newSession } = input;
  const knownOrigin = a.channel !== 'internal';

  void (async () => {
    const db = await getDb();

    await db
      .insert(visitors)
      .values({
        id: visitorId,
        device,
        pageviews: 1,
        sessions: 1,
        lastChannel: a.channel,
        firstChannel: knownOrigin ? a.channel : null,
        firstUtmSource: a.utmSource,
        firstUtmMedium: a.utmMedium,
        firstUtmCampaign: a.utmCampaign,
        firstReferrer: a.referrer,
        firstLanding: path.slice(0, MAX_PATH),
      })
      .onConflictDoUpdate({
        target: visitors.id,
        set: {
          lastSeen: sql`(unixepoch())`,
          pageviews: sql`${visitors.pageviews} + 1`,
          sessions: newSession ? sql`${visitors.sessions} + 1` : sql`${visitors.sessions}`,
          device,
          /* کانال آخر فقط وقتی عوض می‌شود که واقعاً از بیرون برگشته باشد؛
             پیمایش داخلی نباید مبدأ نشست را پاک کند. */
          lastChannel: knownOrigin ? a.channel : sql`${visitors.lastChannel}`,
          /* پر کردن جاهای خالی برای ردیف‌هایی که مبدأشان در اولین بازدید
             معلوم نبود — ولی هرگز بازنویسی مقدار موجود. */
          firstChannel: knownOrigin ? sql`coalesce(${visitors.firstChannel}, ${a.channel})` : sql`${visitors.firstChannel}`,
        },
      });

    await writeEvent({
      visitorId,
      sessionId,
      type: 'pageview',
      path,
      device,
      attribution: a,
    });
  })().catch((err) => console.error('[analytics] ثبت بازدید ناموفق:', err));
}

/**
 * پروندهٔ بازدیدکننده را به لید وصل می‌کند.
 *
 * بر خلاف بقیهٔ توابع این فایل منتظرش می‌مانیم: بدون این اتصال، صفحهٔ
 * پروندهٔ فروش نمی‌تواند مسیر کاربر را نشان دهد — و آن، خودِ چیزی است که
 * ساخته‌ایم.
 */
export async function linkVisitorToLead(visitorId: string, leadId: number): Promise<void> {
  const db = await getDb();
  await db.update(visitors).set({ leadId }).where(eq(visitors.id, visitorId));
}

/** پروندهٔ بازدیدکننده، برای خواندن اولین برخورد هنگام ثبت لید */
export async function getVisitor(visitorId: string) {
  const db = await getDb();
  const [row] = await db.select().from(visitors).where(eq(visitors.id, visitorId)).limit(1);
  return row ?? null;
}

/**
 * آخرین مبدأ شناخته‌شدهٔ یک بازدیدکننده.
 *
 * از خود رویدادها خوانده می‌شود و نه از آنچه مرورگر هنگام ارسال فرم
 * می‌فرستد: کاربری که با لینک کمپین وارد شده و بعد سه صفحه جلوتر فرم را
 * پر می‌کند، در لحظهٔ ارسال دیگر هیچ utm روی نشانی‌اش ندارد. اینجا همان
 * ورود اولیه‌اش پیدا می‌شود.
 *
 * بازدیدهای داخلی کنار گذاشته می‌شوند چون مبدأ نیستند، ادامهٔ مسیرند.
 */
export async function lastTouch(visitorId: string) {
  const db = await getDb();
  const [row] = await db
    .select({
      channel: events.channel,
      utmSource: events.utmSource,
      utmMedium: events.utmMedium,
      utmCampaign: events.utmCampaign,
    })
    .from(events)
    .where(and(eq(events.visitorId, visitorId), ne(events.channel, 'internal')))
    .orderBy(desc(events.createdAt))
    .limit(1);
  return row ?? null;
}

/** خط زمانی یک بازدیدکننده — قدیمی‌ترین اول، برای نمایش در پروندهٔ فروش */
export async function visitorJourney(visitorId: string, limit = 200) {
  const db = await getDb();
  return db
    .select()
    .from(events)
    .where(eq(events.visitorId, visitorId))
    .orderBy(events.createdAt)
    .limit(limit);
}

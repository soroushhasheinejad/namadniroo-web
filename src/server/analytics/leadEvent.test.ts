import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/* دیتابیس موقت؛ پیش از اولین اتصال تنظیم می‌شود */
process.env.DATABASE_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'nn-lead-')), 'test.db');

const { getDb } = await import('../db/client');
const { events, leads } = await import('../db/schema');
const { currentSessionId } = await import('./track');
const { submitQuote } = await import('../services/quote');

const visitorId = 'vis-1';

beforeEach(async () => {
  const db = await getDb();
  await db.delete(events);
  await db.delete(leads);
});

/** بازدیدی که با کمپین وارد شده، چند دقیقه پیش */
async function arriveFromCampaign(sessionId: string, minutesAgo: number) {
  const db = await getDb();
  await db.insert(events).values({
    visitorId,
    sessionId,
    type: 'pageview',
    path: '/solar-calculator',
    channel: 'paid',
    utmSource: 'google',
    utmMedium: 'cpc',
    utmCampaign: 'kerman',
    createdAt: new Date(Date.now() - minutesAgo * 60_000),
  });
}

const leadInput = {
  name: 'نگار',
  phone: '09121112233',
  phoneNormalized: '+989121112233',
  capacity: '',
  area: '',
  contactVia: '',
  source: '/solar-calculator',
};

/** کمی صبر، چون ثبت رویداد عمداً منتظر نمی‌ماند */
const settle = () => new Promise((r) => setTimeout(r, 120));

describe('رویداد ثبت لید', () => {
  it('مبدأ را با خودش می‌برد، نه اینکه زیر «ثبت‌نشده» بیفتد', async () => {
    /* باگی که در تولید پیدا شد: هر ۳۵۲ لید بدون کانال ثبت شده بودند و
       هیچ گزارشی نمی‌توانست بگوید کدام کمپین مشتری ساخته است. */
    await arriveFromCampaign('sess-1', 5);
    await submitQuote(leadInput, { visitorId, sessionId: 'sess-1' });
    await settle();

    const db = await getDb();
    const [row] = await db.select().from(events).where(eq(events.type, 'lead_submit'));
    expect(row).toBeDefined();
    expect(row!.channel).toBe('paid');
    expect(row!.utmSource).toBe('google');
    expect(row!.utmCampaign).toBe('kerman');
  });

  it('در نشست واقعی بازدیدکننده می‌نشیند، نه نشستی تازه', async () => {
    /* نیمهٔ دوم همان باگ: کوکی نشست بعد از نیم‌ساعت منقضی می‌شود و
       شناسهٔ نشست به شناسهٔ بازدیدکننده برمی‌گشت، پس رویداد لید در
       نشستی تک‌ردیفی می‌افتاد که به هیچ بازدیدی وصل نبود. */
    await arriveFromCampaign('sess-2', 10);
    // کوکی نشست از بین رفته و مرورگر شناسهٔ بازدیدکننده را می‌فرستد
    await submitQuote(leadInput, { visitorId, sessionId: visitorId });
    await settle();

    const db = await getDb();
    const [row] = await db.select().from(events).where(eq(events.type, 'lead_submit'));
    expect(row!.sessionId).toBe('sess-2');
  });

  it('اگر مدت‌ها قبل بازدید کرده باشد، نشست تازه را به‌زور به قدیمی نمی‌چسباند', async () => {
    await arriveFromCampaign('sess-old', 120);
    await submitQuote(leadInput, { visitorId, sessionId: 'sess-new' });
    await settle();

    const db = await getDb();
    const [row] = await db.select().from(events).where(eq(events.type, 'lead_submit'));
    expect(row!.sessionId).toBe('sess-new');
    // ولی مبدأ همچنان از همان ورود قدیمی می‌آید
    expect(row!.channel).toBe('paid');
  });

  it('بدون سابقهٔ بازدید هم ثبت لید را زمین نمی‌زند', async () => {
    await submitQuote(leadInput, { visitorId: 'ناشناس', sessionId: 's' });
    await settle();

    const db = await getDb();
    const rows = await db.select().from(leads);
    expect(rows).toHaveLength(1);
  });
});

describe('currentSessionId', () => {
  it('آخرین نشست درون پنجره را می‌دهد', async () => {
    await arriveFromCampaign('sess-a', 40);
    await arriveFromCampaign('sess-b', 3);
    expect(await currentSessionId(visitorId)).toBe('sess-b');
  });

  it('بیرون از پنجره، چیزی نمی‌دهد', async () => {
    await arriveFromCampaign('sess-a', 120);
    expect(await currentSessionId(visitorId)).toBeNull();
  });
});

import { beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

/* دیتابیس موقت — تست به دادهٔ واقعی دست نمی‌زند. باید پیش از اولین اتصال
   تنظیم شود، چون مسیر هنگام اتصال خوانده می‌شود. */
process.env.DATABASE_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'nn-v2-')), 'test.db');

const { getDb } = await import('../../db/client');
const { events, visitors } = await import('../../db/schema');
const { runQuery, runTotals, dimensionValues, isDimension, isMetric } = await import('./query');
const { listSessions, journeyOf } = await import('./journey');

const range = { from: new Date(Date.now() - 7 * 864e5), to: new Date(Date.now() + 864e5) };
const base = Date.now() - 2 * 864e5;

beforeAll(async () => {
  const db = await getDb();
  await db.insert(visitors).values({
    id: 'v1',
    device: 'mobile',
    pageviews: 3,
    sessions: 2,
    firstChannel: 'paid',
    firstUtmSource: 'google',
    firstUtmMedium: 'cpc',
    firstUtmCampaign: 'kerman',
    firstUtmTerm: 'پنل خورشیدی',
    firstUtmContent: 'ad-a',
    firstLanding: '/solar-calculator',
    firstSeen: new Date(base),
    lastSeen: new Date(base + 36e5),
  });

  const rows = [
    { s: 's1', type: 'pageview', path: '/solar-calculator', t: 0 },
    { s: 's1', type: 'pageview', path: '/shop', t: 120 },
    { s: 's1', type: 'lead_submit', path: '/contact', t: 300 },
    { s: 's2', type: 'pageview', path: '/', t: 3600 },
  ];
  for (const r of rows) {
    await db.insert(events).values({
      visitorId: 'v1',
      sessionId: r.s,
      type: r.type,
      path: r.path,
      channel: 'paid',
      utmSource: 'google',
      utmMedium: 'cpc',
      utmCampaign: 'kerman',
      utmTerm: 'پنل خورشیدی',
      utmContent: 'ad-a',
      device: 'mobile',
      createdAt: new Date(base + r.t * 1000),
    });
  }

  // یک بازدیدکنندهٔ دوم بدون utm، برای آزمودن «ثبت‌نشده»
  await db.insert(events).values({
    visitorId: 'v2',
    sessionId: 's3',
    type: 'pageview',
    path: '/',
    channel: 'organic',
    device: 'desktop',
    createdAt: new Date(base + 7200e3),
  });
});

describe('نگهبان نام ستون', () => {
  it('فقط بُعد و سنجهٔ شناخته‌شده پذیرفته می‌شود', () => {
    expect(isDimension('utmTerm')).toBe(true);
    expect(isDimension('drop table')).toBe(false);
    expect(isMetric('sessions')).toBe(true);
    expect(isMetric('; delete from events')).toBe(false);
  });
});

describe('runTotals', () => {
  it('نشست و بازدیدکننده را یکتا می‌شمارد', async () => {
    const t = await runTotals({ range, metrics: ['sessions', 'visitors', 'pageviews', 'leads'] });
    expect(t.sessions).toBe(3);
    expect(t.visitors).toBe(2);
    expect(t.pageviews).toBe(4);
    expect(t.leads).toBe(1);
  });

  it('فیلتر، مجموع را محدود می‌کند', async () => {
    const t = await runTotals({
      range,
      filters: [{ dimension: 'channel', value: 'organic', op: 'is' }],
      metrics: ['sessions', 'leads'],
    });
    expect(t.sessions).toBe(1);
    expect(t.leads).toBe(0);
  });
});

describe('runQuery', () => {
  it('بر اساس یک بُعد گروه می‌کند', async () => {
    const rows = await runQuery({ range, dimensions: ['channel'], metrics: ['sessions'] });
    expect(rows.map((r) => r.keys[0]).sort()).toEqual(['organic', 'paid']);
  });

  it('دو بُعدی کار می‌کند', async () => {
    const rows = await runQuery({ range, dimensions: ['channel', 'device'], metrics: ['events'] });
    expect(rows.find((r) => r.keys[0] === 'paid')!.keys[1]).toBe('mobile');
  });

  it('مقدار ثبت‌نشده را null نشان می‌دهد، نه رشتهٔ خالی', async () => {
    const rows = await runQuery({ range, dimensions: ['utmCampaign'], metrics: ['events'] });
    expect(rows.some((r) => r.keys[0] === null)).toBe(true);
  });

  it('فیلتر «ثبت‌نشده» فقط ردیف‌های بی‌مقدار را می‌آورد', async () => {
    const rows = await runQuery({
      range,
      dimensions: ['channel'],
      metrics: ['events'],
      filters: [{ dimension: 'utmSource', value: null, op: 'is' }],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.keys[0]).toBe('organic');
  });

  it('شرط contains روی مسیر کار می‌کند', async () => {
    const rows = await runQuery({
      range,
      dimensions: ['path'],
      metrics: ['pageviews'],
      filters: [{ dimension: 'path', value: 'calc', op: 'contains' }],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.keys[0]).toBe('/solar-calculator');
  });

  it('شرط not، ردیف‌های بی‌مقدار را هم نگه می‌دارد', async () => {
    /* اگر `not` را ساده بنویسیم، SQL ردیف‌های null را بی‌صدا می‌اندازد و
       جمع ستون با مجموع کل نمی‌خواند. */
    const rows = await runQuery({
      range,
      dimensions: ['channel'],
      metrics: ['events'],
      filters: [{ dimension: 'utmSource', value: 'google', op: 'not' }],
    });
    expect(rows.map((r) => r.keys[0])).toEqual(['organic']);
  });

  it('utm_term و utm_content هم بُعد هستند', async () => {
    const term = await runQuery({ range, dimensions: ['utmTerm'], metrics: ['sessions'] });
    expect(term.some((r) => r.keys[0] === 'پنل خورشیدی')).toBe(true);
    const content = await runQuery({ range, dimensions: ['utmContent'], metrics: ['sessions'] });
    expect(content.some((r) => r.keys[0] === 'ad-a')).toBe(true);
  });
});

describe('dimensionValues', () => {
  it('مقدارهای موجود را با تعدادشان می‌دهد', async () => {
    const values = await dimensionValues('device', range);
    expect(values.find((v) => v.value === 'mobile')!.count).toBe(4);
  });
});

describe('نشست و مسیر', () => {
  it('نشست را از رویدادها می‌سازد', async () => {
    const sessions = await listSessions(range);
    const s1 = sessions.find((s) => s.sessionId === 's1')!;
    expect(s1.pageviews).toBe(2);
    expect(s1.eventCount).toBe(3);
    expect(s1.durationSec).toBe(300);
    expect(s1.landing).toBe('/contact'); // کمترین مسیر الفبایی در همین نشست
    expect(s1.converted).toBe(true);
  });

  it('مسیر یک نفر، نشست‌ها و خط زمانی را با هم می‌دهد', async () => {
    const j = await journeyOf('v1');
    expect(j).not.toBeNull();
    expect(j!.visitor.firstUtmTerm).toBe('پنل خورشیدی');
    expect(j!.timeline).toHaveLength(4);
    expect(j!.sessions.map((s) => s.sessionId).sort()).toEqual(['s1', 's2']);
    expect(j!.lead).toBeNull();
  });

  it('برای شناسهٔ ناشناخته null می‌دهد', async () => {
    expect(await journeyOf('نیست')).toBeNull();
  });
});

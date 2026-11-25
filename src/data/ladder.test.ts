import { describe, expect, it } from 'vitest';
import { ladderDefaults, ladderState, ladderView, parseCount, parseEndsAt, parsePercent, type LadderItemStored } from './ladder';

const item = (over: Partial<LadderItemStored> = {}): LadderItemStored => ({
  slug: 'kaco-blueplanet-10-0-nx3-m2',
  sold: '0',
  t1Units: '4',
  t1Off: '20',
  t2Units: '6',
  t2Off: '12',
  t3Units: '10',
  t3Off: '6',
  ...over,
});

describe('خواندن عدد از فرم', () => {
  it('رقم فارسی و جداکننده را می‌پذیرد', () => {
    expect(parseCount('۱۲')).toBe(12);
    expect(parseCount('1,200')).toBe(1200);
  });
  it('متن نامعتبر عدد نمی‌شود', () => {
    expect(parseCount('')).toBeNull();
    expect(parseCount('حدود ۵')).toBeNull();
    expect(parseCount('-3')).toBeNull();
  });
  it('درصد با یا بدون علامت، فقط ۱ تا ۹۹', () => {
    expect(parsePercent('۲۰٪')).toBe(20);
    expect(parsePercent('20%')).toBe(20);
    expect(parsePercent('20')).toBe(20);
    expect(parsePercent('0')).toBeNull();
    expect(parsePercent('120')).toBeNull();
  });
});

describe('پایان کمپین به وقت تهران', () => {
  it('ساعت را با +۰۳:۳۰ می‌خواند', () => {
    expect(parseEndsAt('2026-12-02 23:59')?.toISOString()).toBe('2026-12-02T20:29:00.000Z');
  });
  it('بدون ساعت، آخر همان روز است', () => {
    expect(parseEndsAt('۲۰۲۶-۱۲-۰۲')?.toISOString()).toBe('2026-12-02T20:29:00.000Z');
  });
  it('قالب نامعتبر', () => expect(parseEndsAt('۱۱ آذر')).toBeNull());
});

describe('پله‌ها', () => {
  it('اول کار، پلهٔ ۱ جاری است', () => {
    const s = ladderState(item())!;
    expect(s.current?.off).toBe(20);
    expect(s.remainingInCurrent).toBe(4);
    expect(s.next?.off).toBe(12);
    expect(s.total).toBe(20);
  });

  it('با پر شدن پلهٔ ۱، پلهٔ ۲ باز می‌شود', () => {
    const s = ladderState(item({ sold: '5' }))!;
    expect(s.tiers.map((t) => t.status)).toEqual(['full', 'current', 'next']);
    expect(s.remainingInCurrent).toBe(5);
  });

  it('فروش بیش از کل پله‌ها همه را پر نشان می‌دهد، نه عدد منفی', () => {
    const s = ladderState(item({ sold: '99' }))!;
    expect(s.current).toBeNull();
    expect(s.sold).toBe(20);
    expect(s.tiers.every((t) => t.status === 'full')).toBe(true);
  });

  it('پلهٔ ناقص کنار گذاشته می‌شود', () => {
    expect(ladderState(item({ t3Off: '' }))!.tiers).toHaveLength(2);
  });

  it('مدل بدون هیچ پلهٔ کامل نشان داده نمی‌شود', () => {
    expect(ladderState(item({ t1Units: '', t2Units: '', t3Units: '' }))).toBeNull();
  });
});

describe('دیده شدن بلوک کمپین', () => {
  const on = { ...ladderDefaults, active: true, endsAt: '2026-12-02 23:59', items: [item()] };
  const before = new Date('2026-11-30T10:00:00Z');

  it('خاموش دیده نمی‌شود', () => expect(ladderView({ ...on, active: false }, before)).toBeNull());
  it('بعد از مهلت دیده نمی‌شود', () => expect(ladderView(on, new Date('2026-12-03T00:00:00Z'))).toBeNull());
  it('بدون مدل دیده نمی‌شود', () => expect(ladderView({ ...on, items: [] }, before)).toBeNull());
  it('روشن و در مهلت دیده می‌شود', () => expect(ladderView(on, before)?.items).toHaveLength(1));
});

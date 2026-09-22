import { describe, expect, it } from 'vitest';
import { responseHours, stampPatch } from './crm';

const now = new Date('2026-09-20T10:00:00Z');
const base = { status: 'new' as const, firstContactAt: null, closedAt: null };

describe('مهرهای زمانی پروندهٔ فروش', () => {
  it('اولین خروج از «جدید»، زمان اولین تماس را ثبت می‌کند', () => {
    expect(stampPatch(base, { status: 'contacted' }, now).firstContactAt).toEqual(now);
  });

  it('زمان اولین تماسِ ثبت‌شده دوباره نوشته نمی‌شود', () => {
    const earlier = new Date('2026-09-18T08:00:00Z');
    const patch = stampPatch({ ...base, status: 'contacted', firstContactAt: earlier }, { status: 'won' }, now);
    expect(patch.firstContactAt).toBeUndefined();
  });

  it('رسیدن به «برنده» پرونده را می‌بندد', () => {
    expect(stampPatch(base, { status: 'won' }, now).closedAt).toEqual(now);
  });

  it('بازگشایی پرونده، زمان بسته‌شدن را پاک می‌کند', () => {
    const closed = { status: 'lost' as const, firstContactAt: now, closedAt: now };
    expect(stampPatch(closed, { status: 'contacted' }, now).closedAt).toBeNull();
  });

  it('دلیل باخت روی پرونده‌ای که باخته نیست نمی‌ماند', () => {
    expect(stampPatch(base, { status: 'won', lostReason: 'قیمت' }, now).lostReason).toBeNull();
    expect(stampPatch(base, { status: 'lost', lostReason: 'قیمت' }, now).lostReason).toBe('قیمت');
  });

  it('پروندهٔ بسته‌شده قرار پیگیری نگه نمی‌دارد', () => {
    const patch = stampPatch(base, { status: 'won', nextFollowUpAt: new Date('2026-10-01') }, now);
    expect(patch.nextFollowUpAt).toBeNull();
  });

  it('پروندهٔ باز قرار پیگیری‌اش را نگه می‌دارد', () => {
    const due = new Date('2026-10-01');
    expect(stampPatch(base, { status: 'contacted', nextFollowUpAt: due }, now).nextFollowUpAt).toEqual(due);
  });
});

describe('سرعت پاسخ', () => {
  it('فاصلهٔ ثبت تا اولین تماس را به ساعت می‌دهد', () => {
    const lead = {
      createdAt: new Date('2026-09-20T08:00:00Z'),
      firstContactAt: new Date('2026-09-20T11:30:00Z'),
    };
    expect(responseHours(lead)).toBeCloseTo(3.5);
  });

  it('پرونده‌ای که تماس نگرفته، صفر نیست — نامعلوم است', () => {
    expect(responseHours({ createdAt: now, firstContactAt: null })).toBeNull();
  });
});

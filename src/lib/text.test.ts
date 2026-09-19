import { describe, expect, it } from 'vitest';
import { fillTokens, latinParts } from './text';

describe('fillTokens', () => {
  it('نشانه‌ها را جایگزین می‌کند', () => {
    expect(fillTokens('تیمی که {mw} مگاوات ساخته، از {since}', { mw: '۷۰', since: '۱۳۸۷' })).toBe(
      'تیمی که ۷۰ مگاوات ساخته، از ۱۳۸۷',
    );
  });

  it('نشانهٔ ناشناخته را دست‌نخورده می‌گذارد', () => {
    expect(fillTokens('عدد {mv}', { mw: '۷۰' })).toBe('عدد {mv}');
  });

  it('متن بی‌نشانه را تغییر نمی‌دهد', () => {
    expect(fillTokens('متن ساده', { mw: '۷۰' })).toBe('متن ساده');
  });
});

describe('latinParts', () => {
  it('نام‌های لاتین را جدا می‌کند و فاصلهٔ درون نام را نگه می‌دارد', () => {
    expect(latinParts('AE Solar و Fronius در ایران')).toEqual([
      { text: 'AE Solar', latin: true },
      { text: ' و ', latin: false },
      { text: 'Fronius', latin: true },
      { text: ' در ایران', latin: false },
    ]);
  });

  it('متن تماماً فارسی یک تکه است', () => {
    expect(latinParts('صنایع بزرگ کشور')).toEqual([{ text: 'صنایع بزرگ کشور', latin: false }]);
  });

  it('کنار هم گذاشتن تکه‌ها همان متن اصلی است', () => {
    for (const t of ['AE Solar و Fronius', 'نماینده Sungrow SG110CX در کرمان', 'O&M و EPC', '']) {
      expect(latinParts(t).map((p) => p.text).join(''), t).toBe(t);
    }
  });

  it('کد نوشته‌شده متن باقی می‌ماند', () => {
    expect(latinParts('<script>').map((p) => p.text).join('')).toBe('<script>');
  });
});

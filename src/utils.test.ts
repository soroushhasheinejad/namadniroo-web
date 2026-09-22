import { describe, expect, it } from 'vitest';
import { fa, jalaliMonthStart, jalaliToISO, jalaliYearMonth, toLatinDigits } from './utils';

describe('fa', () => {
  it('ارقام را فارسی می‌کند', () => {
    expect(fa(70)).toBe('۷۰');
    expect(fa('2026')).toBe('۲۰۲۶');
  });

  it('جداکنندهٔ هزارگان و اعشار را هم فارسی می‌کند', () => {
    /* بدون این، عددی مثل «۱,۸۵۰,۰۰۰» نیمه‌فارسی می‌ماند — در برگهٔ چاپی
       که قرار است جایی ارائه شود، به چشم می‌آید. */
    expect(fa('1,850,000')).toBe('۱٬۸۵۰٬۰۰۰');
    expect(fa('1.5')).toBe('۱٫۵');
  });

  it('به حروف دست نمی‌زند', () => {
    expect(fa('۱ مگاوات')).toBe('۱ مگاوات');
    expect(fa('kWh 100')).toBe('kWh ۱۰۰');
  });
});

describe('toLatinDigits', () => {
  it('ارقام و جداکننده‌ها را برمی‌گرداند', () => {
    expect(toLatinDigits('۱٬۸۵۰٬۰۰۰')).toBe('1,850,000');
    expect(toLatinDigits('۱٫۵')).toBe('1.5');
  });

  it('رفت و برگشت عدد را سالم نگه می‌دارد', () => {
    for (const n of ['1,000', '3.4', '1,850,000.75', '0']) {
      expect(toLatinDigits(fa(n)), n).toBe(n);
    }
  });
});

describe('jalaliToISO', () => {
  it('تاریخ شمسی را به میلادی تبدیل می‌کند', () => {
    expect(jalaliToISO('۱۴۰۴/۰۵/۱۲')).toBe('2025-08-03');
    expect(jalaliToISO('1404/05/12')).toBe('2025-08-03');
  });

  it('ورودی نامعتبر را undefined می‌دهد', () => {
    for (const bad of ['', 'سلام', '1404', '1404/13/01', '99/1/1']) {
      expect(jalaliToISO(bad), bad).toBeUndefined();
    }
  });
});

describe('ماه شمسی', () => {
  it('سال و ماه شمسی را درست می‌دهد', () => {
    // ۱ مهر ۱۴۰۴ برابر ۲۳ سپتامبر ۲۰۲۵
    expect(jalaliYearMonth(new Date('2025-09-23T09:00:00Z'))).toEqual({ year: 1404, month: 7 });
  });

  it('مرز شروع ماه شمسی، نیمه‌شب به وقت ایران است', () => {
    const start = jalaliMonthStart(1404, 7);
    expect(start.toISOString()).toBe('2025-09-22T20:30:00.000Z');
  });

  it('ماه صفر و سیزده به سال قبل و بعد سر می‌خورند', () => {
    expect(jalaliMonthStart(1405, 0).toISOString()).toBe(jalaliMonthStart(1404, 12).toISOString());
    expect(jalaliMonthStart(1404, 13).toISOString()).toBe(jalaliMonthStart(1405, 1).toISOString());
  });
});

import { describe, expect, it } from 'vitest';
import { size, stringsFor, dcWindow, type PanelSpec, type SizingInput } from './sizing';

/* AE Solar Aurora 550 — ردیف ۵۵۰ وات دیتاشیت */
const aurora: PanelSpec = { key: 'aurora-550w', label: 'Aurora 550', w: 550, voc: 51.44, vmp: 42.57, isc: 13.67, tempVoc: -0.275, areaM2: 2.278 * 1.133, bifacial: false, href: '' };
const base: SizingInput = {
  mode: 'power', monthlyKwh: 0, coverage: 100, areaM2: 0, targetKw: 5, system: 'grid', mount: 'roof',
  region: 'high', phase: 'auto', panel: aurora, backupKw: 2, backupHours: 4,
};

describe('ابعاد تجهیزات', () => {
  it('۵ کیلووات خانگی: ۱۰ پنل ۵۵۰ وات، یک رشته، اینورتر ۵ کیلووات تک‌فاز', () => {
    const s = size(base);
    expect(s.panels).toBe(10);
    expect(s.arrayKw).toBeCloseTo(5.5);
    expect(s.phase).toBe('single');
    expect(s.inverter).toMatchObject({ units: 1, unitKw: 5 });
    expect(s.strings).toMatchObject({ count: 1, perString: 10, nMin: 3, nMax: 10 });
  });

  it('ولتاژ مدار باز رشته در سرمای منطقه از سقف اینورتر بالاتر نمی‌رود', () => {
    const s = size({ ...base, targetKw: 100 });
    expect(s.strings.perString * s.strings.vocCold).toBeLessThanOrEqual(s.window.vMax);
    expect(s.strings.perString * s.strings.vmpHot).toBeGreaterThanOrEqual(s.window.mpptMin);
    expect(s.phase).toBe('three');
    expect(s.inverter.unitKw).toBe(100);
    // رشته‌های هم‌اندازه: تعداد پنل مضرب طول رشته است
    expect(s.panels % s.strings.perString).toBe(0);
  });

  it('سرمای بیشتر رشتهٔ کوتاه‌تر می‌خواهد', () => {
    const win = dcWindow('grid', 'three', 50);
    expect(stringsFor(aurora, 200, win, -20).nMax).toBeLessThan(stringsFor(aurora, 200, win, 10).nMax);
  });

  it('حالت سطح: پنل‌ها از سطح بیرون نمی‌زنند (گرد به پایین)', () => {
    const s = size({ ...base, mode: 'area', areaM2: 100 });
    // سقف: ۶ مترمربع بر کیلووات ← ۱۶٫۷ کیلووات ← ۳۰ پنل ۵۵۰ واتی
    expect(s.panels).toBe(30);
    expect(s.footprintM2).toBeLessThanOrEqual(100);
  });

  it('حالت قبض: تولید ماهانه حدوداً همان مصرف را پوشش می‌دهد', () => {
    const s = size({ ...base, mode: 'bill', monthlyKwh: 500 });
    expect(s.coveragePct!).toBeGreaterThanOrEqual(100);
    expect(s.coveragePct!).toBeLessThan(115);
  });

  it('هیبرید: باتری از بار ضروری و ساعت پشتیبانی، و اینورتر دست‌کم به اندازهٔ بار', () => {
    const s = size({ ...base, system: 'hybrid', targetKw: 3, backupKw: 4, backupHours: 4 });
    expect(s.battery!.usableKwh).toBe(16);
    expect(s.battery!.nominalKwh).toBeCloseTo(16 / 0.9 / 0.95);
    expect(s.battery!.modules).toBe(4);
    expect(s.inverter.unitKw).toBeGreaterThanOrEqual(4);
  });

  it('مقیاس مگاوات: چند اینورتر ۱۰۰ کیلوواتی', () => {
    const s = size({ ...base, targetKw: 1000, mount: 'ground' });
    expect(s.inverter.units).toBeGreaterThan(5);
    expect(s.inverter.unitKw).toBe(100);
    expect(s.battery).toBeNull();
  });

  it('تک‌فاز اجباری بالای ۱۰ کیلووات به سه‌فاز می‌رود و دلیلش گفته می‌شود', () => {
    const s = size({ ...base, targetKw: 20, phase: 'single' });
    expect(s.phase).toBe('three');
    expect(s.phaseNote).toBeTruthy();
  });
});

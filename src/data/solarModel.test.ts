import { describe, expect, it } from 'vitest';
import {
  EQUIPMENT_COST,
  SITE_COST,
  TARIFF,
  calculate,
  capacityFor,
  defaultAssumptions,
  scaleOf,
} from './solarModel';

const MILLION = 1_000_000;
const BILLION = 1_000 * MILLION;

describe('scaleOf', () => {
  it('ظرفیت را به پلهٔ درست نسبت می‌دهد', () => {
    expect(scaleOf(50)).toBe('small');
    expect(scaleOf(199)).toBe('small');
    expect(scaleOf(200)).toBe('commercial');
    expect(scaleOf(999)).toBe('commercial');
    expect(scaleOf(1000)).toBe('utility');
    expect(scaleOf(5000)).toBe('utility');
  });
});

describe('capacityFor', () => {
  it('روی پشت‌بام هزینهٔ محوطه را حساب نمی‌کند', () => {
    const roof = capacityFor(1 * BILLION, { mount: 'roof' });
    const ground = capacityFor(1 * BILLION, { mount: 'ground' });

    expect(roof.capexPerKw).toBe(EQUIPMENT_COST[roof.scale].typical);
    expect(ground.capexPerKw).toBeGreaterThan(roof.capexPerKw);
    // با یک سرمایه، روی پشت‌بام ظرفیت بیشتری می‌شود نصب کرد
    expect(roof.capacityKw).toBeGreaterThan(ground.capacityKw);
  });

  it('به پلهٔ سازگار با ظرفیت خروجی می‌رسد', () => {
    /* وابستگی حلقوی است: هزینهٔ هر کیلووات به پله بستگی دارد و پله به
       ظرفیت. خروجی باید با خودش سازگار باشد. */
    for (const investment of [200 * MILLION, 5 * BILLION, 50 * BILLION, 500 * BILLION]) {
      const r = capacityFor(investment, { mount: 'ground' });
      expect(scaleOf(r.capacityKw), `${investment}`).toBe(r.scale);
    }
  });

  it('فرض دستی کاربر جای پیش‌فرض را می‌گیرد', () => {
    const r = capacityFor(1 * BILLION, {
      mount: 'roof',
      equipmentCostPerKw: 20 * MILLION,
    });
    expect(r.capexPerKw).toBe(20 * MILLION);
    expect(r.capacityKw).toBe(50);
  });

  it('ظرفیت با سرمایه خطی بالا می‌رود وقتی پله عوض نشود', () => {
    const a = capacityFor(10 * BILLION, { mount: 'roof', equipmentCostPerKw: 25 * MILLION });
    const b = capacityFor(20 * BILLION, { mount: 'roof', equipmentCostPerKw: 25 * MILLION });
    expect(b.capacityKw).toBeCloseTo(a.capacityKw * 2, 6);
  });
});

describe('calculate', () => {
  const base = defaultAssumptions('ground', 'high');

  it('تولید سال اول از ظرفیت و تابش می‌آید', () => {
    const r = calculate(10 * BILLION, base);
    expect(r.firstYearProductionKwh).toBeCloseTo(r.capacityKw * base.yieldPerKw, 6);
  });

  it('تولید هر سال کمتر از سال قبل است', () => {
    const r = calculate(10 * BILLION, base);
    for (let i = 1; i < r.rows.length; i++) {
      expect(r.rows[i]!.productionKwh).toBeLessThan(r.rows[i - 1]!.productionKwh);
    }
  });

  it('افت راندمان بعد از ۲۰ سال معقول است', () => {
    const r = calculate(10 * BILLION, base);
    const ratio = r.rows.at(-1)!.productionKwh / r.rows[0]!.productionKwh;
    // با افت ۰٫۷٪ سالانه، سال بیستم باید حدود ۸۷٪ سال اول باشد
    expect(ratio).toBeGreaterThan(0.85);
    expect(ratio).toBeLessThan(0.9);
  });

  it('هزینهٔ نگه‌داری از درآمد کم می‌شود', () => {
    const r = calculate(10 * BILLION, base);
    expect(r.firstYearNet).toBeCloseTo(r.firstYearRevenue - 10 * BILLION * base.omRate, 6);
  });

  it('سال بازگشت با جمع جریان نقدی می‌خواند', () => {
    const r = calculate(10 * BILLION, { ...base, tariff: TARIFF.bourse });
    expect(r.paybackYears).not.toBeNull();

    const full = Math.floor(r.paybackYears!);
    // تا سال قبلِ بازگشت هنوز سرمایه برنگشته، و در سال بازگشت برگشته
    expect(r.rows[full - 1]!.cumulative).toBeLessThan(10 * BILLION);
    expect(r.rows[full]!.cumulative).toBeGreaterThanOrEqual(10 * BILLION);
  });

  it('وقتی سرمایه در افق برنگردد null می‌دهد', () => {
    // نرخ بسیار پایین: درآمد هیچ‌وقت به سرمایه نمی‌رسد
    const r = calculate(100 * BILLION, { ...base, tariff: 1 });
    expect(r.paybackYears).toBeNull();
  });

  it('نرخ بورس بازگشت را زودتر می‌کند تا خرید تضمینی', () => {
    const satba = calculate(50 * BILLION, base);
    const bourse = calculate(50 * BILLION, { ...base, tariff: TARIFF.bourse });

    expect(bourse.paybackYears!).toBeLessThan(satba.paybackYears!);
    expect(bourse.totalNet).toBeGreaterThan(satba.totalNet);
  });

  it('در نبود نرخ دستی، نرخ پله‌ای ساتبا انتخاب می‌شود', () => {
    const r = calculate(5 * BILLION, defaultAssumptions('roof', 'good'));
    expect(r.tariff).toBe(TARIFF.satba[r.scale]);
  });

  it('تابش بیشتر یعنی درآمد بیشتر', () => {
    const sunny = calculate(10 * BILLION, defaultAssumptions('ground', 'high'));
    const cloudy = calculate(10 * BILLION, defaultAssumptions('ground', 'low'));
    expect(sunny.firstYearRevenue).toBeGreaterThan(cloudy.firstYearRevenue);
  });

  it('مساحت موردنیاز زمینی بیشتر از پشت‌بامی است', () => {
    const roof = calculate(10 * BILLION, defaultAssumptions('roof', 'good'));
    const ground = calculate(10 * BILLION, defaultAssumptions('ground', 'good'));
    expect(ground.areaM2 / ground.capacityKw).toBeGreaterThan(roof.areaM2 / roof.capacityKw);
  });

  it('جمع تجمعی با جمع خالص سال‌ها برابر است', () => {
    const r = calculate(10 * BILLION, base);
    const sum = r.rows.reduce((s, row) => s + row.net, 0);
    expect(r.totalNet).toBeCloseTo(sum, 4);
  });

  it('خروجی برای یک نیروگاه مگاواتی در محدودهٔ منابع منتشرشده است', () => {
    /* ۷۰ میلیارد تومان، زمینی، کرمان — طبق منابع باید حدود یک مگاوات
       در بیاید و بازگشت سرمایه در بازهٔ چندساله باشد. این تست نگهبان
       است: اگر فرض‌ها روزی طوری عوض شوند که خروجی از واقعیت بازار دور
       بیفتد، همین‌جا معلوم می‌شود. */
    const r = calculate(70 * BILLION, defaultAssumptions('ground', 'high'));

    expect(r.capacityKw).toBeGreaterThan(900);
    expect(r.capacityKw).toBeLessThan(1400);
    expect(r.firstYearProductionKwh).toBeGreaterThan(1_500_000);
    expect(r.firstYearProductionKwh).toBeLessThan(2_600_000);
  });

  it('بازهٔ هزینه، بازهٔ ظرفیت می‌سازد', () => {
    const cheap = calculate(10 * BILLION, {
      ...base,
      equipmentCostPerKw: EQUIPMENT_COST.commercial.min,
      siteCostPerKw: SITE_COST.min,
    });
    const pricey = calculate(10 * BILLION, {
      ...base,
      equipmentCostPerKw: EQUIPMENT_COST.commercial.max,
      siteCostPerKw: SITE_COST.max,
    });

    expect(cheap.capacityKw).toBeGreaterThan(pricey.capacityKw);
    expect(cheap.paybackYears!).toBeLessThan(pricey.paybackYears!);
  });
});

describe('نرخ ساتبا بالای یک مگاوات', () => {
  it('برای مقیاس نیروگاهی نرخ مصوب ندارد', () => {
    /* مصوبهٔ ۱۴۰۵ تا سقف یک مگاوات نرخ دارد. اگر روزی عددی اینجا گذاشته
       شود، باید آگاهانه باشد — نه از روی کپی یک منبع قدیمی. */
    expect(TARIFF.satba.utility).toBeNull();
    expect(TARIFF.satba.small).toBeGreaterThan(0);
    expect(TARIFF.satba.commercial).toBeGreaterThan(0);
  });

  it('در نبود نرخ مصوب، محاسبه به نرخ بورس برمی‌گردد و خطا نمی‌دهد', () => {
    const r = calculate(70 * BILLION, defaultAssumptions('ground', 'high'));
    expect(r.scale).toBe('utility');
    expect(r.tariff).toBe(TARIFF.bourse);
    expect(Number.isFinite(r.totalNet)).toBe(true);
  });
});

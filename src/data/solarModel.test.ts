import { describe, expect, it } from 'vitest';
import {
  CONSTRUCTION_MONTHS,
  EQUIPMENT_COST,
  GRID_COST,
  LAND_COST,
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
    const roof = capacityFor(60 * BILLION, { mount: 'roof' });
    const ground = capacityFor(60 * BILLION, { mount: 'ground' });

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

describe('هزینهٔ ثابت پست و خط انتقال', () => {
  it('با ظرفیت ضرب نمی‌شود — نیروگاه ده‌مگاواتی همان‌قدر می‌دهد که یک‌مگاواتی', () => {
    /* باگی که رفع شد: این هزینه «بر کیلووات» حساب می‌شد، پس نیروگاه
       بزرگ‌تر ده برابر هزینهٔ پست می‌گرفت. پست یک بار ساخته می‌شود. */
    const small = capacityFor(60 * BILLION, { mount: 'ground' });
    const big = capacityFor(600 * BILLION, { mount: 'ground' });
    expect(small.capex.grid).toBe(big.capex.grid);
    expect(big.capex.grid).toBe(GRID_COST.typical);
  });

  it('نیروگاه بزرگ‌تر آن را سرشکن می‌کند، پس هر کیلووات ارزان‌تر تمام می‌شود', () => {
    const small = capacityFor(60 * BILLION, { mount: 'ground' });
    const big = capacityFor(600 * BILLION, { mount: 'ground' });
    expect(big.capexPerKw).toBeLessThan(small.capexPerKw);
  });

  it('روی پشت‌بام اصلاً وجود ندارد', () => {
    const roof = capacityFor(10 * BILLION, { mount: 'roof' });
    expect(roof.capex.grid).toBe(0);
    expect(roof.capex.land).toBe(0);
  });

  it('سرمایهٔ کمتر از هزینهٔ پست، نیروگاه زمینی نمی‌سازد', () => {
    const r = capacityFor(GRID_COST.typical - 1, { mount: 'ground' });
    expect(r.belowGridCost).toBe(true);
    expect(r.capacityKw).toBe(0);
  });

  it('تفکیک سرمایه با کل سرمایه جمع می‌خورد', () => {
    const investment = 120 * BILLION;
    const { capex } = capacityFor(investment, { mount: 'ground' });
    expect(capex.equipment + capex.land + capex.grid).toBeCloseTo(investment, 4);
  });
});

describe('زمان ساخت در بازگشت سرمایه', () => {
  it('بازگشت با احتساب ساخت، به اندازهٔ همان ماه‌ها دیرتر است', () => {
    const r = calculate(60 * BILLION, { ...defaultAssumptions('ground', 'high'), tariff: TARIFF.bourse });
    expect(r.paybackWithBuildYears!).toBeCloseTo(
      r.paybackYears! + CONSTRUCTION_MONTHS[r.scale] / 12,
      6,
    );
    expect(r.paybackWithBuildYears!).toBeGreaterThan(r.paybackYears!);
  });

  it('وقتی سرمایه اصلاً برنگردد، هر دو null‌اند', () => {
    const r = calculate(60 * BILLION, { ...defaultAssumptions('ground', 'high'), tariff: 1 });
    expect(r.paybackYears).toBeNull();
    expect(r.paybackWithBuildYears).toBeNull();
  });

  it('پروژهٔ بزرگ‌تر مدت ساخت بیشتری دارد', () => {
    expect(CONSTRUCTION_MONTHS.utility).toBeGreaterThan(CONSTRUCTION_MONTHS.commercial);
    expect(CONSTRUCTION_MONTHS.commercial).toBeGreaterThan(CONSTRUCTION_MONTHS.small);
  });
});

describe('نرخ بورس انرژی', () => {
  it('میانگین معاملات است، نه سقف تعرفهٔ صنایع', () => {
    /* پیش‌تر نرخ بورس روی سقف تعرفه گذاشته شده بود و درآمد را
       خوش‌بینانه نشان می‌داد. */
    expect(TARIFF.bourse).toBeLessThan(TARIFF.bourseCeiling);
    expect(TARIFF.bourse).toBeGreaterThan(TARIFF.satba.small);
  });
});

describe('calculate', () => {
  const base = defaultAssumptions('ground', 'high');

  it('تولید سال اول از ظرفیت و تابش می‌آید', () => {
    const r = calculate(60 * BILLION, base);
    expect(r.firstYearProductionKwh).toBeCloseTo(r.capacityKw * base.yieldPerKw, 6);
  });

  it('تولید هر سال کمتر از سال قبل است', () => {
    const r = calculate(60 * BILLION, base);
    for (let i = 1; i < r.rows.length; i++) {
      expect(r.rows[i]!.productionKwh).toBeLessThan(r.rows[i - 1]!.productionKwh);
    }
  });

  it('افت راندمان بعد از ۲۰ سال معقول است', () => {
    const r = calculate(60 * BILLION, base);
    const ratio = r.rows.at(-1)!.productionKwh / r.rows[0]!.productionKwh;
    // با افت ۰٫۷٪ سالانه، سال بیستم باید حدود ۸۷٪ سال اول باشد
    expect(ratio).toBeGreaterThan(0.85);
    expect(ratio).toBeLessThan(0.9);
  });

  it('هزینهٔ نگه‌داری از درآمد کم می‌شود', () => {
    const r = calculate(60 * BILLION, base);
    expect(r.firstYearNet).toBeCloseTo(r.firstYearRevenue - 60 * BILLION * base.omRate, 6);
  });

  it('سال بازگشت با جمع جریان نقدی می‌خواند', () => {
    const r = calculate(60 * BILLION, { ...base, tariff: TARIFF.bourse });
    expect(r.paybackYears).not.toBeNull();

    const full = Math.floor(r.paybackYears!);
    // تا سال قبلِ بازگشت هنوز سرمایه برنگشته، و در سال بازگشت برگشته
    expect(r.rows[full - 1]!.cumulative).toBeLessThan(60 * BILLION);
    expect(r.rows[full]!.cumulative).toBeGreaterThanOrEqual(60 * BILLION);
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
    const sunny = calculate(60 * BILLION, defaultAssumptions('ground', 'high'));
    const cloudy = calculate(60 * BILLION, defaultAssumptions('ground', 'low'));
    expect(sunny.firstYearRevenue).toBeGreaterThan(cloudy.firstYearRevenue);
  });

  it('مساحت موردنیاز زمینی بیشتر از پشت‌بامی است', () => {
    const roof = calculate(60 * BILLION, defaultAssumptions('roof', 'good'));
    const ground = calculate(60 * BILLION, defaultAssumptions('ground', 'good'));
    expect(ground.areaM2 / ground.capacityKw).toBeGreaterThan(roof.areaM2 / roof.capacityKw);
  });

  it('جمع تجمعی با جمع خالص سال‌ها برابر است', () => {
    const r = calculate(60 * BILLION, base);
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
    const cheap = calculate(60 * BILLION, {
      ...base,
      tariff: TARIFF.bourse,
      equipmentCostPerKw: EQUIPMENT_COST.commercial.min,
      landCostPerKw: LAND_COST.min,
      gridCost: GRID_COST.min,
    });
    const pricey = calculate(60 * BILLION, {
      ...base,
      tariff: TARIFF.bourse,
      equipmentCostPerKw: EQUIPMENT_COST.commercial.max,
      landCostPerKw: LAND_COST.max,
      gridCost: GRID_COST.max,
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

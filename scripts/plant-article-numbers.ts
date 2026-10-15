/**
 * عددهای مقاله‌های «هزینه احداث نیروگاه خورشیدی X کیلوواتی/مگاواتی ۱۴۰۵».
 *
 * همهٔ عددها از src/data/solarModel.ts می‌آیند، همان مدلی که ماشین‌حساب
 * با آن حساب می‌کند؛ اگر نرخ یا قیمت در آن فایل عوض شد، این اسکریپت را
 * دوباره اجرا کنید و جدول‌های مقاله‌ها را با خروجی‌اش به‌روز کنید.
 *
 *   npx tsx scripts/plant-article-numbers.ts 5 10 50 200 2000 5000 10000
 */
import {
  AREA_PER_KW,
  CONSTRUCTION_MONTHS,
  DEGRADATION,
  OM_RATE,
  TARIFF,
  YEARS,
  YIELD_BY_REGION,
  calculate,
  costRangeFor,
  scaleOf,
  type Mount,
} from '../src/data/solarModel';

const caps = process.argv.slice(2).map(Number).filter((n) => n > 0);
const out: Record<string, unknown> = {};

for (const kw of caps) {
  const scale = scaleOf(kw);
  const mounts: Mount[] = ['roof', 'ground'];
  const cost = Object.fromEntries(mounts.map((m) => {
    const r = costRangeFor(m);
    return [m, { min: kw * r.min, typical: kw * r.typical, max: kw * r.max, perKw: r, areaM2: kw * AREA_PER_KW[m] }];
  }));
  const routes = { satba: TARIFF.satba[scale], bourse: TARIFF.bourse, self: TARIFF.self };
  const byRegion: Record<string, unknown> = {};
  for (const [key, reg] of Object.entries(YIELD_BY_REGION)) {
    byRegion[key] = Object.fromEntries(mounts.map((m) => {
      const capex = kw * costRangeFor(m).typical;
      const base = { costPerKw: costRangeFor(m).typical, yieldPerKw: reg.kwhPerKw, mount: m, omRate: OM_RATE, degradation: DEGRADATION, years: YEARS };
      return [m, Object.fromEntries(Object.entries(routes).map(([route, tariff]) => {
        if (tariff === null) return [route, null];
        const r = calculate(capex, { ...base, tariff });
        return [route, {
          tariff,
          production: Math.round(r.firstYearProductionKwh),
          revenue: Math.round(r.firstYearRevenue),
          om: Math.round(capex * OM_RATE),
          net: Math.round(r.firstYearNet),
          payback: r.paybackYears && +r.paybackYears.toFixed(1),
          paybackBuild: r.paybackWithBuildYears && +r.paybackWithBuildYears.toFixed(1),
          total20: Math.round(r.totalNet),
        }];
      }))];
    }));
    (byRegion[key] as Record<string, unknown>).label = reg.label;
  }
  out[kw] = { scale, constructionMonths: CONSTRUCTION_MONTHS[scale], cost, routes, byRegion };
}
console.log(JSON.stringify(out, null, 1));

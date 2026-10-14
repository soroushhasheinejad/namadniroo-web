import { describe, expect, it } from 'vitest';
import { calculate } from '../data/solarModel';
import {
  capacityLabel,
  defaultAssumptions,
  estimateDetail,
  fa,
  latin,
  reportUrl,
  routeOutcomes,
  toman,
} from './estimate';

describe('قالب‌بندی برآورد', () => {
  it('عدد را فارسی و برگشت‌پذیر می‌نویسد', () => {
    expect(fa('10,000.5')).toBe('۱۰٬۰۰۰٫۵');
    expect(latin('۱۰٬۰۰۰٫۵')).toBe('10,000.5');
    // کیبورد عربی
    expect(latin('١٢٣')).toBe('123');
  });

  it('مبلغ بزرگ را به میلیارد و میلیون می‌نویسد', () => {
    expect(toman(5_000_000_000)).toBe('۵٫۰ میلیارد');
    expect(toman(70_000_000_000)).toBe('۷۰ میلیارد');
    expect(toman(250_000_000)).toBe('۲۵۰ میلیون');
  });

  it('ظرفیت بالای هزار کیلووات را مگاوات می‌نویسد', () => {
    expect(capacityLabel(667.4)).toBe('۶۶۷ کیلووات');
    expect(capacityLabel(1500)).toBe('۱٫۵۰ مگاوات');
  });
});

describe('خلاصه و برگهٔ برآورد', () => {
  const a = defaultAssumptions('roof', 'high');

  it('خلاصه همان ظرفیتی را می‌گوید که مدل حساب می‌کند', () => {
    const d = estimateDetail(5_000_000_000, a, 'high');
    const kw = calculate(5_000_000_000, a).capacityKw;
    expect(d.kw).toBe(Math.round(kw));
    expect(d.summary).toContain('پشت‌بام');
    expect(d.summary).toContain(`ظرفیت حدود ${capacityLabel(kw)}`);
  });

  it('برگه با همان فرض‌ها ساخته می‌شود و فقط نسخهٔ چاپی print دارد', () => {
    const url = new URL(reportUrl(5_000_000_000, a, 'high'), 'https://x');
    expect(url.pathname).toBe('/solar-calculator/report');
    expect(url.searchParams.get('mount')).toBe('roof');
    expect(Number(url.searchParams.get('cost')) * 1_000_000).toBe(a.costPerKw);
    expect(url.searchParams.get('om')).toBe('1.5');
    expect(url.searchParams.has('print')).toBe(false);
    expect(estimateDetail(5_000_000_000, a, 'high').printUrl).toContain('print=1');
  });

  it('بالای یک مگاوات، ساتبا نرخ مصوب ندارد', () => {
    const big = routeOutcomes(200_000_000_000, defaultAssumptions('ground', 'high'));
    expect(big.find((o) => o.route.key === 'satba')?.result).toBeNull();
    expect(big.find((o) => o.route.key === 'bourse')?.result).not.toBeNull();
  });
});

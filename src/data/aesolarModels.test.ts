import { describe, expect, it } from 'vitest';
import { aeModels } from './aesolarModels';

describe('aeModels', () => {
  /* جدول‌ها دستی از دیتاشیت رونویسی شده‌اند. Vmp × Imp باید همان توان نامی
     باشد؛ یک رقم جابه‌جا این را چند درصد به هم می‌زند. */
  it('هر ردیف جدول برقی با توان نامی خودش می‌خواند', () => {
    for (const m of aeModels) {
      for (const r of m.rows) {
        expect(Math.abs(r.vmp * r.imp - r.pmax) / r.pmax, `${m.slug} ${r.pmax}W`).toBeLessThan(0.005);
      }
    }
  });

  it('بازهٔ توان عنوان با اولین و آخرین ردیف جدول یکی است', () => {
    for (const m of aeModels) {
      expect(m.rows[0]!.pmax).toBe(m.minW);
      expect(m.rows.at(-1)!.pmax).toBe(m.maxW);
    }
  });

  it('نشانی‌ها یکتا هستند', () => {
    expect(new Set(aeModels.map((m) => m.slug)).size).toBe(aeModels.length);
  });
});

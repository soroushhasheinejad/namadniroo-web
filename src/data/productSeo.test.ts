import { describe, expect, it } from 'vitest';
import { productDescription, productSchema, productTitle, type SeoProduct } from './productSeo';

const base: SeoProduct = {
  name: 'اینورتر سه‌فاز KACO blueplanet 10.0 NX3 M2',
  brand: 'KACO',
  kind: 'inverter',
  subkind: 'string',
  powerMin: 10,
  powerMax: 10,
  official: false,
  inStock: true,
  price: null,
};

describe('عنوان صفحهٔ محصول', () => {
  it('توان و نوع اتصال می‌آید و برند تکرار نمی‌شود', () => {
    expect(productTitle(base)).toBe('اینورتر سه‌فاز KACO blueplanet 10.0 NX3 M2، ۱۰ کیلووات آنگرید | نماد نیرو');
  });

  it('برندی که در نام نیست اضافه می‌شود و خط‌تیرهٔ نشکن معمولی می‌شود', () => {
    const t = productTitle({ ...base, name: 'اینورتر رشته‌ای Primo', brand: 'FRONIUS', powerMin: 3, powerMax: 8.2 });
    expect(t).toBe('اینورتر رشته‌ای Primo Fronius، ۳ تا ۸٫۲ کیلووات آنگرید | نماد نیرو');
    expect(productTitle({ ...base, name: 'اینورتر سه‌فاز Deye SUN‑100K‑G03', brand: 'DEYE', powerMin: 100, powerMax: 100 }))
      .toContain('SUN-100K-G03');
  });

  it('ذخیره‌ساز با ظرفیت، ابزار بدون توان', () => {
    expect(productTitle({ ...base, name: 'ذخیره‌ساز یکپارچه AI‑W5.1', brand: 'DEYE', kind: 'storage', subkind: 'all-in-one', powerMin: 5, powerMax: 12 }))
      .toBe('ذخیره‌ساز یکپارچه AI-W5.1 Deye، ۵ تا ۱۲ کیلووات‌ساعت | نماد نیرو');
    expect(productTitle({ ...base, name: 'ابزار پرس کانکتور MC4 PNTECH', brand: 'PNTECH', kind: 'tool', subkind: null, powerMin: null, powerMax: null }))
      .toBe('ابزار پرس کانکتور MC4 PNTECH | نماد نیرو');
  });
});

describe('توضیح صفحهٔ محصول', () => {
  it('نام فارسی برند و موجودی می‌آید؛ نمایندگی فقط وقتی هست', () => {
    const d = productDescription({ ...base, brand: 'DEYE', name: 'اینورتر سه‌فاز Deye SUN‑25K‑G05', powerMin: 25, powerMax: 25 });
    expect(d).toContain('دای یا دیه');
    expect(d).toContain('موجود در انبار');
    expect(d).not.toContain('نمایندگی رسمی');
    expect(productDescription({ ...base, official: true, inStock: false })).toContain('نمایندگی رسمی');
    expect(productDescription({ ...base, inStock: false })).not.toContain('موجود در انبار');
  });
});

describe('داده‌ی ساختاریافتهٔ Product', () => {
  it('بدون قیمت نمی‌آید، تا Search Console خطای offers ندهد', () => {
    expect(productSchema(base, 'https://namadniroo.ir/shop/x', 'd')).toBeNull();
  });

  it('با قیمت، Offer به ریال و وضعیت موجودی', () => {
    const s = productSchema({ ...base, price: 1_000_000_000 }, 'https://namadniroo.ir/shop/x', 'd') as any;
    expect(s.offers.price).toBe(1_000_000_000);
    expect(s.offers.priceCurrency).toBe('IRR');
    expect(s.offers.availability).toBe('https://schema.org/InStock');
  });
});

import { describe, expect, it } from 'vitest';
import { type Field, coerce, formTree, parseForm } from './fields';

const form = (pairs: [string, string][]) => {
  const f = new FormData();
  for (const [k, v] of pairs) f.append(k, v);
  return f;
};

describe('formTree', () => {
  it('ترتیب ردیف‌ها را از ترتیب ظاهرشدن می‌گیرد، نه از نشانه', () => {
    /* ویراستار ردیف‌ها را جابه‌جا کرده: z اول آمده با این‌که بعداً ساخته شده */
    const tree = formTree(
      form([
        ['v.~z.label', 'سوم'],
        ['v.~a.label', 'اول'],
        ['v.~m.label', 'دوم'],
      ]).entries(),
    ) as Record<string, unknown>;
    expect(Object.values(tree).map((r) => (r as { label: string }).label)).toEqual(['سوم', 'اول', 'دوم']);
  });

  it('نشانهٔ عددی‌نما هم ترتیب را حفظ می‌کند', () => {
    /* اگر نشانه بی‌پیشوند و عددی بود، جاوااسکریپت کلیدها را عددی مرتب
       می‌کرد و جابه‌جایی گم می‌شد. پیشوند ~ جلوی این را می‌گیرد. */
    const tree = formTree(form([['v.~9.x', 'a'], ['v.~1.x', 'b']]).entries()) as Record<string, unknown>;
    expect(Object.keys(tree)).toEqual(['~9', '~1']);
  });

  it('فیلدهای خارج از فرم را نادیده می‌گیرد', () => {
    expect(formTree(form([['key', 'site'], ['csrf', 'x']]).entries())).toBeUndefined();
  });
});

describe('parseForm', () => {
  const nav: Field = {
    kind: 'list',
    key: '',
    label: 'منو',
    item: [
      { kind: 'text', key: 'label', label: 'عنوان' },
      { kind: 'text', key: 'href', label: 'نشانی' },
    ],
  };

  it('فهرست را با ترتیب صفحه برمی‌گرداند', () => {
    const value = parseForm(
      nav,
      form([
        ['v.~b.label', 'فروشگاه'],
        ['v.~b.href', '/shop'],
        ['v.~a.label', 'پروژه‌ها'],
        ['v.~a.href', '/projects'],
      ]),
    );
    expect(value).toEqual([
      { label: 'فروشگاه', href: '/shop' },
      { label: 'پروژه‌ها', href: '/projects' },
    ]);
  });

  it('وقتی همهٔ ردیف‌ها حذف شده‌اند، فهرست خالی می‌دهد', () => {
    expect(parseForm(nav, form([['key', 'nav']]))).toEqual([]);
  });

  it('ردیف کاملاً خالی را کنار می‌گذارد', () => {
    const value = parseForm(
      nav,
      form([
        ['v.~a.label', 'مجله'],
        ['v.~a.href', '/magazine'],
        ['v.~b.label', '  '],
        ['v.~b.href', ''],
      ]),
    );
    expect(value).toEqual([{ label: 'مجله', href: '/magazine' }]);
  });

  it('گروه تو‌در‌تو داخل ردیف را می‌سازد', () => {
    const areas: Field = {
      kind: 'list',
      key: '',
      label: 'حوزه‌ها',
      item: [
        { kind: 'text', key: 'title', label: 'عنوان' },
        {
          kind: 'group',
          key: 'cta',
          label: 'دکمه',
          fields: [
            { kind: 'text', key: 'label', label: 'متن' },
            { kind: 'text', key: 'href', label: 'نشانی' },
          ],
        },
        { kind: 'lines', key: 'items', label: 'موارد' },
        { kind: 'checkbox', key: 'reverse', label: 'برعکس' },
      ],
    };
    const value = parseForm(
      areas,
      form([
        ['v.~q.title', 'طراحی'],
        ['v.~q.cta.label', 'مشاوره'],
        ['v.~q.cta.href', '/#quote'],
        ['v.~q.items', 'اول\n\n  دوم  \nسوم'],
      ]),
    );
    expect(value).toEqual([
      {
        title: 'طراحی',
        cta: { label: 'مشاوره', href: '/#quote' },
        items: ['اول', 'دوم', 'سوم'],
        reverse: false,
      },
    ]);
  });

  it('گروه ریشه را فیلد به فیلد می‌خواند', () => {
    const site: Field = {
      kind: 'group',
      key: '',
      label: 'شرکت',
      fields: [
        { kind: 'text', key: 'name', label: 'نام' },
        { kind: 'text', key: 'phone', label: 'تلفن' },
      ],
    };
    expect(parseForm(site, form([['v.name', ' نماد نیرو '], ['v.phone', '۰۳۴']]))).toEqual({
      name: 'نماد نیرو',
      phone: '۰۳۴',
    });
  });

  it('متن چندخطی ریشه را مستقیم می‌خواند', () => {
    const robots: Field = { kind: 'textarea', key: '', label: 'robots' };
    expect(parseForm(robots, form([['v', 'User-agent: *\r\nAllow: /\r\n']]))).toBe('User-agent: *\nAllow: /');
  });
});

describe('coerce', () => {
  it('چک‌باکس غایب را false می‌کند', () => {
    expect(coerce({ kind: 'checkbox', key: 'x', label: 'x' }, undefined)).toBe(false);
    expect(coerce({ kind: 'checkbox', key: 'x', label: 'x' }, '1')).toBe(true);
  });

  it('ورودی غیرمتنی را به متن خالی تبدیل می‌کند نه خطا', () => {
    expect(coerce({ kind: 'text', key: 'x', label: 'x' }, { oops: 1 })).toBe('');
  });
});

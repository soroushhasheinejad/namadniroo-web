import type { Field } from './fields';
import { toLatinDigits } from '../utils';

/**
 * بخش‌های صفحهٔ «متن‌های سایت» در پنل.
 *
 * هر بخش یک کلید در جدول `settings` است و فرمش از همین تعریف ساخته
 * می‌شود. برای افزودن فیلدی تازه به هر بخش، کافی است اینجا یک خط اضافه
 * شود — فرم، ذخیره و خواندن خودکار از آن پیروی می‌کنند.
 */

export interface Section {
  key: string;
  title: string;
  /** کجای پنل نمایش داده شود — پیش‌فرض «متن‌های سایت» */
  group?: 'site' | 'seo';
  /** اگر تعیین شود، فقط این نقش‌ها می‌بینند و ذخیره می‌کنند */
  roles?: ('admin' | 'editor')[];
  /** یک جمله: این بخش کجای سایت دیده می‌شود */
  where: string;
  root: Field;
  /** مقدار ذخیره‌شده → شکلی که فرم نشان می‌دهد */
  toForm?: (stored: unknown) => unknown;
  /** ورودی فرم → شکلی که ذخیره و در سایت استفاده می‌شود */
  fromForm?: (parsed: unknown) => unknown;
}

const ICONS = [
  { value: 'contract', label: 'قرارداد / مهندسی' },
  { value: 'panel', label: 'پنل خورشیدی' },
  { value: 'monitor', label: 'پایش / نمایشگر' },
  { value: 'chart', label: 'نمودار' },
  { value: 'sun', label: 'خورشید' },
  { value: 'shield', label: 'سپر / حفاظت' },
  { value: 'phone', label: 'تلفن' },
  { value: 'pin', label: 'موقعیت' },
  { value: 'clock', label: 'ساعت' },
];

const iconField = (key = 'icon'): Field => ({ kind: 'select', key, label: 'آیکن', options: ICONS });

export const SECTIONS: Section[] = [
  {
    key: 'site',
    title: 'اطلاعات شرکت',
    where: 'سرصفحه، پابرگ، صفحهٔ تماس، فرم مشاوره و برگهٔ برآورد.',
    root: {
      kind: 'group',
      key: '',
      label: '',
      fields: [
        { kind: 'text', key: 'name', label: 'نام شرکت' },
        { kind: 'text', key: 'phone', label: 'تلفن (همان‌طور که نمایش داده می‌شود)', placeholder: '۰۳۴ ۳۲۵۲۱۴۱۶' },
        {
          kind: 'text',
          key: 'phoneHref',
          label: 'پیوند تماس',
          ltr: true,
          placeholder: 'tel:03432521416',
          hint: 'با tel: شروع شود و بدون فاصله — همین شماره با لمس روی موبایل گرفته می‌شود.',
        },
        { kind: 'text', key: 'email', label: 'ایمیل', ltr: true, placeholder: 'info@namadniroo.ir' },
        { kind: 'text', key: 'city', label: 'شهر', placeholder: 'کرمان، ایران' },
        { kind: 'textarea', key: 'address', label: 'نشانی کامل', rows: 2 },
        { kind: 'text', key: 'since', label: 'سال تأسیس', placeholder: '۱۳۸۷' },
      ],
    },
  },

  {
    key: 'nav',
    title: 'منوی اصلی',
    where: 'نوار بالای همهٔ صفحات، و میان‌برهای صفحهٔ ۴۰۴.',
    root: {
      kind: 'list',
      key: '',
      label: '',
      itemTitle: 'label',
      addLabel: 'افزودن پیوند به منو',
      hint: 'ترتیب ردیف‌ها همان ترتیب منو است؛ با پیکان‌ها جابه‌جا کنید.',
      item: [
        { kind: 'text', key: 'label', label: 'عنوان' },
        { kind: 'text', key: 'href', label: 'نشانی', ltr: true, placeholder: '/shop' },
      ],
    },
  },

  {
    key: 'stats',
    title: 'آمار صفحهٔ اصلی',
    where: 'نوار چهار عدد بزرگ زیر اسلایدر صفحهٔ اصلی.',
    root: {
      kind: 'list',
      key: '',
      label: '',
      itemTitle: 'caption',
      addLabel: 'افزودن آمار',
      item: [
        { kind: 'text', key: 'number', label: 'عدد یا متن' },
        { kind: 'text', key: 'unit', label: 'واحد', placeholder: 'MW' },
        { kind: 'text', key: 'caption', label: 'توضیح زیر عدد' },
        {
          kind: 'checkbox',
          key: 'animate',
          label: 'شمارش متحرک از صفر',
          hint: 'برای آمارهایی مثل «۷۰ مگاوات» مناسب است؛ برای سال تأسیس یا عددهایی که نباید «شمرده» شوند خاموش بماند. فقط عدد خالص شمرده می‌شود.',
        },
        { kind: 'checkbox', key: 'plus', label: 'علامت + بعد از عدد' },
      ],
    },
    /* در سایت، آمار یا `value` عددی دارد (که از صفر شمرده می‌شود) یا `text`
       (که همان‌طور نمایش داده می‌شود). این انتخاب با خود ویراستار است، نه
       حدس ما: نسخهٔ اول از روی رقمی بودن حدس می‌زد و در نتیجه سال تأسیس
       «۱۳۸۷» هم از صفر شمرده می‌شد. */
    toForm: (stored) =>
      (Array.isArray(stored) ? stored : []).map((s: Record<string, unknown>) => ({
        number: s.value != null ? String(s.value) : String(s.text ?? ''),
        unit: s.unit ?? '',
        caption: s.caption ?? '',
        animate: s.value != null,
        plus: s.plus === true,
      })),
    fromForm: (parsed) =>
      (parsed as Record<string, string | boolean>[]).map((r) => {
        const raw = String(r.number);
        const latin = toLatinDigits(raw);
        const counts = r.animate === true && /^\d+$/.test(latin);
        return {
          ...(counts ? { value: Number(latin) } : { text: raw }),
          ...(r.unit ? { unit: r.unit } : {}),
          caption: r.caption,
          ...(r.plus ? { plus: true } : {}),
        };
      }),
  },

  /* «اسلایدر صفحهٔ اصلی» عمداً اینجا نیست: صفحهٔ اصلی در حال بازطراحی است و
     دیگر از اسلایدر استفاده نمی‌کند، پس ویرایشش روی سایت اثری نداشت. وقتی
     طراحی تازه نهایی شد، تصاویر همان طراحی اینجا اضافه می‌شوند. */

  {
    key: 'promoSlides',
    title: 'بنرهای صفحهٔ اصلی',
    where: 'بنرهای چرخان میانهٔ صفحهٔ اصلی.',
    root: {
      kind: 'list',
      key: '',
      label: '',
      itemTitle: 'alt',
      addLabel: 'افزودن بنر',
      hint: 'بنر نسبت ۴ به ۱ دارد (مثلاً ۱۶۰۰×۴۰۰).',
      item: [
        {
          kind: 'text',
          key: 'alt',
          label: 'توضیح بنر',
          hint: 'متن روی بنر در خود تصویر است؛ این توضیح برای نابینایان و موتور جست‌وجو خوانده می‌شود.',
        },
        { kind: 'text', key: 'href', label: 'با کلیک به کجا برود', ltr: true, placeholder: '/shop' },
        { kind: 'image', key: 'image', label: 'تصویر بنر' },
      ],
    },
  },

  {
    key: 'areas',
    title: 'حوزه‌های فعالیت',
    where: 'بلوک‌های صفحهٔ «حوزه‌های فعالیت».',
    root: {
      kind: 'list',
      key: '',
      label: '',
      itemTitle: 'title',
      addLabel: 'افزودن حوزه',
      item: [
        { kind: 'text', key: 'eyebrow', label: 'برچسب کوچک بالای عنوان' },
        { kind: 'text', key: 'title', label: 'عنوان' },
        { kind: 'textarea', key: 'desc', label: 'توضیح', rows: 3 },
        { kind: 'lines', key: 'items', label: 'فهرست خدمات' },
        iconField(),
        { kind: 'image', key: 'image', label: 'تصویر' },
        {
          kind: 'group',
          key: 'cta',
          label: 'دکمه',
          fields: [
            { kind: 'text', key: 'label', label: 'متن دکمه' },
            { kind: 'text', key: 'href', label: 'نشانی', ltr: true },
          ],
        },
        {
          kind: 'group',
          key: 'proof',
          label: 'سطر سابقه زیر دکمه',
          hint: 'مثلاً: «تأمین: بیش از ۷۰ مگاوات تجهیزات»',
          fields: [
            { kind: 'text', key: 'label', label: 'پیش از عدد', placeholder: 'تأمین: بیش از' },
            { kind: 'text', key: 'value', label: 'عدد پررنگ', placeholder: '۷۰ مگاوات' },
            { kind: 'text', key: 'tail', label: 'پس از عدد', placeholder: 'تجهیزات' },
          ],
        },
        { kind: 'checkbox', key: 'reverse', label: 'تصویر در سمت دیگر' },
        {
          kind: 'text',
          key: 'id',
          label: 'شناسهٔ پیوند',
          ltr: true,
          hint: 'نشانی مستقیم این بلوک: /activity#شناسه. پس از انتشار عوضش نکنید — پیوندهای موجود می‌شکنند.',
        },
      ],
    },
  },

  {
    key: 'timeline',
    title: 'مسیر رشد شرکت',
    where: 'خط زمانی صفحهٔ «درباره ما».',
    root: {
      kind: 'list',
      key: '',
      label: '',
      itemTitle: 'title',
      addLabel: 'افزودن رویداد',
      item: [
        { kind: 'text', key: 'year', label: 'سال', placeholder: '۱۴۰۲' },
        { kind: 'text', key: 'title', label: 'عنوان' },
        { kind: 'lines', key: 'items', label: 'جزئیات' },
      ],
    },
  },

  {
    key: 'capabilities',
    title: 'توانمندی‌ها',
    where: 'کارت‌های توانمندی در صفحهٔ «درباره ما».',
    root: {
      kind: 'list',
      key: '',
      label: '',
      itemTitle: 'title',
      addLabel: 'افزودن توانمندی',
      item: [iconField(), { kind: 'text', key: 'title', label: 'عنوان' }, { kind: 'textarea', key: 'desc', label: 'توضیح', rows: 2 }],
    },
  },

  {
    key: 'brands',
    title: 'برندها',
    where: 'نوار لوگوی برندها در صفحهٔ اصلی و «درباره ما».',
    root: {
      kind: 'list',
      key: '',
      label: '',
      itemTitle: 'name',
      addLabel: 'افزودن برند',
      hint: 'برندی که لوگو ندارد با نامش نمایش داده می‌شود.',
      item: [
        { kind: 'text', key: 'name', label: 'نام برند', ltr: true },
        { kind: 'image', key: 'logo', label: 'لوگو' },
      ],
    },
  },

  {
    key: 'clients',
    title: 'کارفرمایان',
    where: 'فهرست کارفرمایان در صفحهٔ «درباره ما».',
    root: { kind: 'lines', key: '', label: 'نام کارفرمایان', hint: 'هر کارفرما در یک خط.' },
  },

  {
    key: 'portfolio',
    title: 'پرتفولیو',
    where: 'دکمهٔ دانلود پرتفولیو در پابرگ و صفحهٔ «درباره ما».',
    root: {
      kind: 'group',
      key: '',
      label: '',
      fields: [
        { kind: 'text', key: 'file', label: 'نشانی فایل PDF', ltr: true, placeholder: '/downloads/portfolio.pdf' },
        {
          kind: 'text',
          key: 'size',
          label: 'حجم فایل',
          placeholder: '۸ مگابایت',
          hint: 'کنار دکمه نمایش داده می‌شود تا کاربر موبایل پیش از دانلود بداند.',
        },
      ],
    },
  },

  /* ============================================================
     سئو
     ============================================================ */

  {
    key: 'seoDefaults',
    group: 'seo',
    title: 'پیش‌فرض‌های سئو',
    where: 'هر صفحه‌ای که توضیح یا تصویر اشتراک خودش را ندارد، از این‌ها استفاده می‌کند.',
    root: {
      kind: 'group',
      key: '',
      label: '',
      fields: [
        {
          kind: 'textarea',
          key: 'description',
          label: 'توضیح پیش‌فرض',
          rows: 3,
          hint: 'حدود ۱۲۰ تا ۱۵۵ نویسه. بهتر است هر صفحه توضیح خودش را داشته باشد؛ این فقط جای خالی را پر می‌کند.',
        },
        {
          kind: 'image',
          key: 'image',
          label: 'تصویر اشتراک پیش‌فرض',
          hint: 'تصویری که هنگام فرستادن پیوند در تلگرام، واتساپ و لینکدین دیده می‌شود. اندازهٔ مناسب ۱۲۰۰×۶۳۰.',
        },
      ],
    },
  },

  {
    key: 'business',
    group: 'seo',
    title: 'اطلاعات کسب‌وکار',
    where: 'دادهٔ ساختاریافته‌ای که گوگل از آن کارت کسب‌وکار، نشانی و تلفن شرکت را در نتایج می‌سازد.',
    root: {
      kind: 'group',
      key: '',
      label: '',
      fields: [
        { kind: 'text', key: 'legalName', label: 'نام کامل شرکت', placeholder: 'شرکت کرمان نماد نیرو' },
        { kind: 'text', key: 'alternateName', label: 'نام دیگر', hint: 'نامی که مردم ممکن است با آن جست‌وجو کنند.' },
        {
          kind: 'text',
          key: 'telephone',
          label: 'تلفن به شکل بین‌المللی',
          ltr: true,
          placeholder: '+983432521416',
          hint: 'با +98 و بدون صفر ابتدایی، فاصله یا خط تیره.',
        },
        { kind: 'text', key: 'email', label: 'ایمیل', ltr: true },
        { kind: 'text', key: 'foundingYear', label: 'سال تأسیس به میلادی', ltr: true, placeholder: '2008' },
        { kind: 'text', key: 'priceRange', label: 'بازهٔ قیمت', ltr: true, placeholder: '$$', hint: 'نمادی از ارزان ($) تا گران ($$$$).' },
        {
          kind: 'group',
          key: 'address',
          label: 'نشانی',
          fields: [
            { kind: 'text', key: 'street', label: 'خیابان و پلاک' },
            { kind: 'text', key: 'locality', label: 'شهر' },
            { kind: 'text', key: 'region', label: 'استان' },
            { kind: 'text', key: 'postalCode', label: 'کد پستی', ltr: true },
            { kind: 'text', key: 'country', label: 'کد کشور', ltr: true, placeholder: 'IR' },
          ],
        },
        {
          kind: 'group',
          key: 'geo',
          label: 'مختصات روی نقشه',
          hint: 'از گوگل‌مپ یا نشان: روی محل راست‌کلیک کنید و دو عدد را بردارید. برای نمایش روی نقشه در نتایج محلی لازم است.',
          fields: [
            { kind: 'text', key: 'lat', label: 'عرض جغرافیایی', ltr: true, placeholder: '30.2839' },
            { kind: 'text', key: 'lng', label: 'طول جغرافیایی', ltr: true, placeholder: '57.0834' },
          ],
        },
        {
          kind: 'lines',
          key: 'openingHours',
          label: 'ساعات کاری',
          hint: 'هر بازه در یک خط، به شکل انگلیسی: Sa-We 08:00-17:00 (Sa شنبه، Su یکشنبه، Mo دوشنبه، Tu سه‌شنبه، We چهارشنبه، Th پنجشنبه، Fr جمعه).',
        },
        {
          kind: 'lines',
          key: 'sameAs',
          label: 'صفحه‌های شرکت در شبکه‌های اجتماعی',
          hint: 'نشانی کامل هر صفحه در یک خط (اینستاگرام، لینکدین، تلگرام، آپارات). به گوگل می‌گوید این صفحه‌ها مال همین شرکت‌اند.',
        },
        { kind: 'lines', key: 'knowsAbout', label: 'حوزه‌های تخصص', hint: 'هر حوزه در یک خط.' },
      ],
    },
  },

  {
    key: 'webmaster',
    group: 'seo',
    title: 'ابزار وبمستر و آمار',
    where: 'کدهای تأیید مالکیت در کنسول جست‌وجو و ابزار آمار بازدید. در سرصفحهٔ همهٔ صفحات قرار می‌گیرند.',
    roles: ['admin'],
    root: {
      kind: 'group',
      key: '',
      label: '',
      fields: [
        {
          kind: 'text',
          key: 'google',
          label: 'کد تأیید Google Search Console',
          ltr: true,
          hint: 'فقط مقدار content از تگ meta، نه کل تگ. در کنسول: افزودن ملک ← روش تأیید «تگ HTML».',
        },
        { kind: 'text', key: 'bing', label: 'کد تأیید Bing Webmaster', ltr: true },
        { kind: 'text', key: 'yandex', label: 'کد تأیید Yandex Webmaster', ltr: true },
        { kind: 'text', key: 'ga4', label: 'شناسهٔ Google Analytics', ltr: true, placeholder: 'G-XXXXXXXXXX' },
        { kind: 'text', key: 'gtm', label: 'شناسهٔ Google Tag Manager', ltr: true, placeholder: 'GTM-XXXXXXX' },
        {
          kind: 'textarea',
          key: 'customHead',
          label: 'کد دلخواه در سرصفحه',
          ltr: true,
          rows: 6,
          hint: 'برای هر ابزار دیگری (مثلاً آمار داخلی). این کد بدون هیچ بررسی در همهٔ صفحات اجرا می‌شود — فقط کدی بگذارید که منبعش را می‌شناسید.',
        },
      ],
    },
  },

  {
    key: 'robots',
    group: 'seo',
    title: 'robots.txt',
    where: 'قواعد خزش موتورهای جست‌وجو. مسدودسازی پنل و نشانی نقشهٔ سایت همیشه خودکار اضافه می‌شود.',
    root: { kind: 'textarea', key: '', label: 'قواعد', ltr: true, rows: 10 },
  },
];

export const sectionByKey = (key: string) => SECTIONS.find((s) => s.key === key);

import type { Field } from '../admin/fields';
import { audiences, homeFaq, processSteps } from './siteContent';
import * as aeData from './aesolar';

/**
 * متن صفحات، قابل ویرایش از پنل.
 *
 * هر صفحه اینجا دو چیز اعلام می‌کند: فیلدهایی که ویراستار می‌بیند، و متن
 * پیش‌فرض هر کدام. پیش‌فرض همان متنی است که تا امروز در قالب صفحه نوشته
 * شده بود، پس تا وقتی کسی در پنل چیزی عوض نکرده، صفحه عیناً همان است.
 *
 * برای قابل‌ویرایش کردن متنی تازه: یک فیلد در `fields` و پیش‌فرضش در
 * `defaults` اضافه شود، و قالب صفحه آن را از `getPageContent` بخواند.
 *
 * همهٔ صفحات سایت اینجا هستند — سئو و متن بدنه. آنچه عمداً بیرون مانده
 * (فرض‌های ماشین‌حساب، لایه‌های تصویر ماژول، برچسب فرم‌ها) در کنار همان
 * صفحه توضیح داده شده.
 */

export interface PageDef<T extends Record<string, unknown> = Record<string, unknown>> {
  key: string;
  /** نام صفحه در پنل */
  label: string;
  /** نشانی صفحه روی سایت */
  path: string;
  fields: Field[];
  defaults: T;
}

/* ---------- قطعه‌های تکرارشونده ---------- */

const seoGroup: Field = {
  kind: 'group',
  key: 'seo',
  label: 'نتایج جست‌وجو',
  hint: 'آنچه گوگل در فهرست نتایج و پیام‌رسان‌ها در پیش‌نمایش پیوند نشان می‌دهند.',
  fields: [
    {
      kind: 'text',
      key: 'title',
      label: 'عنوان صفحه',
      hint: 'حدود ۵۰ تا ۶۰ نویسه؛ بیشتر از این در گوگل بریده می‌شود.',
    },
    {
      kind: 'textarea',
      key: 'description',
      label: 'توضیح',
      rows: 3,
      hint: 'حدود ۱۲۰ تا ۱۵۵ نویسه. یک جملهٔ روشن که بگوید در این صفحه چه پیدا می‌شود. خالی بماند، توضیح پیش‌فرض «تنظیمات سئو» استفاده می‌شود.',
    },
    {
      kind: 'image',
      key: 'image',
      label: 'تصویر اشتراک',
      hint: 'تصویری که هنگام فرستادن پیوند این صفحه در تلگرام و واتساپ دیده می‌شود (۱۲۰۰×۶۳۰). خالی بماند، تصویر پیش‌فرض استفاده می‌شود.',
    },
    {
      kind: 'checkbox',
      key: 'noindex',
      label: 'این صفحه در نتایج گوگل نیاید',
      hint: 'صفحه از نقشهٔ سایت هم حذف می‌شود. فقط برای صفحه‌ای که عمداً نمی‌خواهید پیدا شود.',
    },
  ],
};

/** سئوی یک صفحه با متن و تصویر پیش‌فرض */
const seo = (title: string, description: string) => ({ title, description, image: '', noindex: false });

/**
 * صفحهٔ فهرستی با الگوی تکراری: سرصفحه، عنوان «مقاله‌های مرتبط» و دعوت
 * پایین صفحه. خود فهرست (حوزه‌ها، محصولات، مقالات) از جای دیگری می‌آید.
 */
const listingPage = (
  key: string,
  label: string,
  path: string,
  defaults: {
    seo: ReturnType<typeof seo>;
    hero: { title: string; lead: string };
    related?: string;
    cta: { title: string; text: string; label: string; href: string };
  },
) =>
  ({
    key,
    label,
    path,
    fields: [
      seoGroup,
      heroGroup,
      ...(defaults.related !== undefined
        ? [{ kind: 'text', key: 'related', label: 'عنوان «مقاله‌های مرتبط»' } as Field]
        : []),
      ctaGroup,
    ],
    defaults,
  }) satisfies PageDef;


const heroGroup: Field = {
  kind: 'group',
  key: 'hero',
  label: 'سرصفحه',
  fields: [
    { kind: 'text', key: 'title', label: 'عنوان بزرگ' },
    { kind: 'textarea', key: 'lead', label: 'متن زیر عنوان', rows: 2 },
  ],
};

const headGroup = (key: string, label: string): Field => ({
  kind: 'group',
  key,
  label,
  fields: [
    { kind: 'text', key: 'eyebrow', label: 'برچسب کوچک بالای عنوان' },
    { kind: 'text', key: 'title', label: 'عنوان' },
  ],
});

const ctaGroup: Field = {
  kind: 'group',
  key: 'cta',
  label: 'دعوت پایین صفحه',
  fields: [
    { kind: 'text', key: 'title', label: 'عنوان' },
    { kind: 'text', key: 'text', label: 'متن' },
    { kind: 'text', key: 'label', label: 'متن دکمه' },
    { kind: 'text', key: 'href', label: 'نشانی دکمه', ltr: true },
  ],
};

/* ============================================================
   درباره ما
   ============================================================ */

export const aboutPage = {
  key: 'about',
  label: 'درباره ما',
  path: '/about',
  fields: [
    seoGroup,
    heroGroup,
    {
      kind: 'group',
      key: 'intro',
      label: 'معرفی',
      fields: [
        { kind: 'textarea', key: 'lead', label: 'جملهٔ درشت', rows: 2 },
        {
          kind: 'lines',
          key: 'body',
          label: 'پاراگراف‌ها',
          hint: 'هر پاراگراف در یک خط. برای پاراگراف تازه Enter بزنید.',
        },
      ],
    },
    headGroup('capabilities', 'سرتیتر توانمندی‌ها'),
    headGroup('brands', 'سرتیتر برندها'),
    headGroup('clients', 'سرتیتر کارفرمایان'),
    ctaGroup,
  ],
  defaults: {
    seo: seo(
      'درباره ما | نماد نیرو',
      'نماد نیرو؛ فعال از سال ۱۳۸۷ در کرمان در حوزهٔ نیروگاه‌های خورشیدی و حرارتی — طراحی مهندسی، تأمین تجهیزات و سرمایه‌گذاری.',
    ),
    hero: {
      title: 'از دل کویر، انرژیِ صنعت',
      lead: 'نماد نیرو از سال ۱۳۸۷ در کرمان، از یک شرکت مهندسی برق تا شریکی جامع در انرژی خورشیدی رشد کرده است.',
    },
    intro: {
      lead: 'ما نیروگاه می‌سازیم، تجهیزش می‌کنیم و در آن سرمایه‌گذاری می‌کنیم — همه زیر یک سقف.',
      body: [
        'نماد نیرو کار خود را در سال ۱۳۸۷ در حوزهٔ تولید و توزیع برق صنعتی آغاز کرد و به‌مرور به یکی از فعال‌ترین شرکت‌های انرژی خورشیدی در کرمان و مرکز ایران تبدیل شد.',
        'امروز در سه حوزهٔ طراحی مهندسی و احداث نیروگاه، بازرگانی و تأمین تجهیزات، و سرمایه‌گذاری در پروژه‌های تجدیدپذیر فعالیت می‌کنیم؛ از یک کیلووات روی پشت‌بام تا نیروگاه‌های مگاواتی در دشت.',
      ],
    },
    capabilities: { eyebrow: 'توانمندی‌ها', title: 'از طراحی تا بهره‌برداری و پایش' },
    brands: { eyebrow: 'برندهای همکار', title: 'تجهیزات از سازندگان معتبر جهانی' },
    clients: { eyebrow: 'کارفرمایان ما', title: 'اعتماد صنایع بزرگ کشور' },
    cta: {
      title: 'بیایید پروژهٔ بعدی را با هم بسازیم',
      text: 'از مشاورهٔ اولیه تا بهره‌برداری، کنار شما هستیم.',
      label: 'درخواست مشاوره',
      href: '/#quote',
    },
  },
} satisfies PageDef;

/* ============================================================
   تماس با ما
   ============================================================ */

export const contactPage = {
  key: 'contact',
  label: 'تماس با ما',
  path: '/contact',
  fields: [
    seoGroup,
    heroGroup,
    {
      kind: 'group',
      key: 'info',
      label: 'کارت‌های تماس',
      hint: 'شماره تلفن و شهر از «متن‌های سایت ← اطلاعات شرکت» می‌آیند؛ اینجا فقط عنوان کارت‌ها و ساعات کاری است.',
      fields: [
        { kind: 'text', key: 'phoneTitle', label: 'عنوان کارت تلفن' },
        { kind: 'text', key: 'placeTitle', label: 'عنوان کارت محل' },
        { kind: 'text', key: 'hoursTitle', label: 'عنوان کارت ساعات کاری' },
        { kind: 'text', key: 'hours', label: 'ساعات پاسخ‌گویی' },
      ],
    },
  ],
  defaults: {
    seo: seo(
      'تماس با ما | نماد نیرو',
      'راه‌های تماس با نماد نیرو در کرمان — تلفن، فرم درخواست مشاوره و آدرس دفتر مرکزی.',
    ),
    hero: {
      title: 'گفت‌وگو را شروع کنید',
      lead: 'چه یک نیروگاه خانگی مدنظرتان باشد چه یک پروژهٔ صنعتی، کارشناسان ما آماده‌ی پاسخ‌گویی‌اند.',
    },
    info: {
      phoneTitle: 'تماس تلفنی',
      placeTitle: 'محل شرکت',
      hoursTitle: 'ساعات پاسخ‌گویی',
      hours: 'شنبه تا چهارشنبه، ۸ تا ۱۷',
    },
  },
} satisfies PageDef;

/* ============================================================
   پروژه‌ها
   ============================================================ */

export const projectsPage = {
  key: 'projects',
  label: 'پروژه‌ها',
  path: '/projects',
  fields: [
    seoGroup,
    heroGroup,
    {
      kind: 'list',
      key: 'stats',
      label: 'عددهای سرصفحه',
      itemTitle: 'caption',
      addLabel: 'افزودن عدد',
      item: [
        { kind: 'text', key: 'value', label: 'عدد' },
        { kind: 'text', key: 'unit', label: 'واحد', ltr: true },
        { kind: 'text', key: 'caption', label: 'توضیح' },
      ],
    },
    ctaGroup,
  ],
  defaults: {
    seo: seo(
      'پروژه‌ها | نماد نیرو',
      'نمونه‌ای از پروژه‌های اجراشده و تجهیزشدهٔ نماد نیرو؛ از نیروگاه ۱۰۰ مگاواتی فولاد خوزستان تا هزاران نیروگاه پشت‌بامی خانگی.',
    ),
    hero: {
      title: 'از کویر تا خط تولید',
      lead: 'نمونه‌ای از نیروگاه‌های خورشیدی و پروژه‌هایی که در سراسر کشور اجرا، تأمین یا سرمایه‌گذاری کرده‌ایم.',
    },
    stats: [
      { value: '۷۰', unit: 'MW+', caption: 'مجموع تأمین و اجرا' },
      { value: '۱۰۰', unit: 'MW', caption: 'بزرگ‌ترین پروژه' },
      { value: '۱۰۰۰', unit: '+', caption: 'نیروگاه پشت‌بامی' },
    ],
    cta: {
      title: 'پروژهٔ بعدی می‌تواند مال شما باشد',
      text: 'ظرفیت موردنظرتان را بگویید؛ برآورد اولیه را برایتان می‌فرستیم.',
      label: 'درخواست مشاوره',
      href: '/#quote',
    },
  },
} satisfies PageDef;

/* ============================================================
   ۴۰۴
   ============================================================ */

export const notFoundPage = {
  key: 'notFound',
  label: 'صفحهٔ «پیدا نشد» (۴۰۴)',
  path: '/404',
  fields: [
    {
      kind: 'group',
      key: 'body',
      label: 'متن صفحه',
      hint: 'این صفحه همیشه از نتایج گوگل کنار گذاشته می‌شود، پس بخش سئو ندارد.',
      fields: [
        { kind: 'text', key: 'title', label: 'عنوان' },
        { kind: 'textarea', key: 'lead', label: 'توضیح', rows: 2 },
        { kind: 'text', key: 'homeLabel', label: 'دکمهٔ بازگشت به صفحهٔ اصلی' },
        { kind: 'text', key: 'contactLabel', label: 'دکمهٔ تماس' },
      ],
    },
  ],
  defaults: {
    body: {
      title: 'این صفحه پیدا نشد',
      lead: 'ممکن است آدرس تغییر کرده باشد یا صفحه حذف شده باشد. از میان‌برهای زیر ادامه دهید:',
      homeLabel: 'بازگشت به صفحهٔ اصلی',
      contactLabel: 'تماس با ما',
    },
  },
} satisfies PageDef;

/* ============================================================
   صفحهٔ اصلی
   ============================================================ */

const WHO_OPTIONS = [
  { value: 'investor', label: 'سرمایه‌گذار' },
  { value: 'industry', label: 'صنعت — فرم مشاوره را باز می‌کند' },
  { value: 'buyer', label: 'خریدار تجهیزات' },
  { value: 'home', label: 'خانگی' },
];

const headFields = (withMore: boolean): Field[] => [
  { kind: 'text', key: 'eyebrow', label: 'برچسب کوچک' },
  { kind: 'text', key: 'title', label: 'عنوان' },
  ...(withMore ? [{ kind: 'text', key: 'moreLabel', label: 'متن پیوند «همه»' } as Field] : []),
];

export const homePage = {
  key: 'home',
  label: 'صفحهٔ اصلی',
  path: '/',
  fields: [
    seoGroup,
    {
      kind: 'group',
      key: 'hero',
      label: 'سرصفحه',
      hint: 'در متن‌ها «{mw}» با عدد مگاوات نوار آمار و «{since}» با سال تأسیس جایگزین می‌شود، تا اگر آن‌ها عوض شدند، این‌جا هم خودکار عوض شود.',
      fields: [
        { kind: 'text', key: 'kicker', label: 'سطر کوچک بالای تیتر' },
        { kind: 'textarea', key: 'title', label: 'تیتر اصلی', rows: 2 },
        { kind: 'textarea', key: 'sub', label: 'متن زیر تیتر', rows: 2 },
        { kind: 'text', key: 'primaryLabel', label: 'متن دکمهٔ اصلی' },
        { kind: 'text', key: 'primaryHref', label: 'نشانی دکمهٔ اصلی', ltr: true },
        { kind: 'text', key: 'hint', label: 'سطر زیر دکمه‌ها' },
        { kind: 'text', key: 'proofLabel', label: 'عنوان سطر اعتبار' },
        { kind: 'text', key: 'proofText', label: 'متن سطر اعتبار', hint: 'نام‌های لاتین خودکار با قلم لاتین نمایش داده می‌شوند.' },
        { kind: 'text', key: 'clientsLabel', label: 'عنوان سطر کارفرمایان', hint: 'سه نام اول از «متن‌های سایت ← کارفرمایان» می‌آید.' },
        { kind: 'image', key: 'image', label: 'تصویر سرصفحه', hint: 'بزرگ‌ترین تصویر صفحه؛ پیش از بقیه بارگذاری می‌شود. عکس بی‌متن، چون تیتر روی خود صفحه نوشته می‌شود.' },
      ],
    },
    {
      kind: 'group',
      key: 'doors',
      label: '«از کجا شروع کنیم؟»',
      fields: [
        { kind: 'text', key: 'title', label: 'عنوان بخش' },
        {
          kind: 'list',
          key: 'items',
          label: 'درها',
          itemTitle: 'title',
          addLabel: 'افزودن در',
          item: [
            { kind: 'text', key: 'title', label: 'عنوان' },
            { kind: 'text', key: 'desc', label: 'توضیح' },
            { kind: 'text', key: 'cta', label: 'متن پیوند' },
            { kind: 'text', key: 'href', label: 'نشانی', ltr: true },
            { kind: 'select', key: 'who', label: 'نوع مخاطب', options: WHO_OPTIONS, hint: 'در فرم مشاوره از پیش انتخاب می‌شود.' },
            { kind: 'image', key: 'image', label: 'تصویر' },
          ],
        },
      ],
    },
    {
      kind: 'group',
      key: 'calcTeaser',
      label: 'پیش‌نمایش ماشین‌حساب',
      fields: [
        { kind: 'text', key: 'title', label: 'عنوان' },
        { kind: 'textarea', key: 'text', label: 'متن', rows: 2 },
        { kind: 'text', key: 'button', label: 'متن دکمه' },
      ],
    },
    {
      kind: 'group',
      key: 'projects',
      label: 'بخش پروژه‌ها',
      fields: [
        ...headFields(true),
        { kind: 'text', key: 'ctaText', label: 'پرسش زیر پروژه‌ها' },
        { kind: 'text', key: 'ctaLabel', label: 'متن دکمه (فرم مشاوره را باز می‌کند)' },
      ],
    },
    {
      kind: 'group',
      key: 'process',
      label: 'مسیر همکاری',
      fields: [
        { kind: 'text', key: 'title', label: 'عنوان' },
        { kind: 'textarea', key: 'lead', label: 'متن زیر عنوان', rows: 2 },
        {
          kind: 'list',
          key: 'steps',
          label: 'گام‌ها',
          itemTitle: 'title',
          addLabel: 'افزودن گام',
          hint: 'ترتیب ردیف‌ها همان شماره‌گذاری گام‌هاست.',
          item: [
            { kind: 'text', key: 'title', label: 'عنوان گام' },
            { kind: 'textarea', key: 'desc', label: 'توضیح', rows: 2 },
            { kind: 'text', key: 'output', label: 'خروجی این گام' },
            { kind: 'text', key: 'time', label: 'زمان', hint: 'فقط جایی که شرکت واقعاً به آن متعهد است. خالی بماند، نمایش داده نمی‌شود.' },
          ],
        },
      ],
    },
    { kind: 'group', key: 'shop', label: 'بخش فروشگاه', fields: headFields(false) },
    {
      kind: 'group',
      key: 'faq',
      label: 'پرسش‌های پیش از شروع',
      hint: 'همین پرسش‌ها به‌صورت دادهٔ ساختاریافته به گوگل هم داده می‌شوند و ممکن است مستقیم در نتایج جست‌وجو نمایش داده شوند.',
      fields: [
        { kind: 'text', key: 'title', label: 'عنوان' },
        { kind: 'text', key: 'lead', label: 'متن کنار شمارهٔ تماس' },
        {
          kind: 'list',
          key: 'items',
          label: 'پرسش‌ها',
          itemTitle: 'q',
          addLabel: 'افزودن پرسش',
          item: [
            { kind: 'text', key: 'q', label: 'پرسش' },
            { kind: 'textarea', key: 'a', label: 'پاسخ', rows: 3 },
          ],
        },
      ],
    },
    { kind: 'group', key: 'magazine', label: 'بخش مجله', fields: headFields(true) },
  ],
  defaults: {
    seo: seo(
      'نماد نیرو | راه‌کارهای جامع انرژی پایدار',
      'نماد نیرو از سال ۱۳۸۷ در کرمان: احداث نیروگاه خورشیدی، تأمین پنل و اینورتر از برندهای معتبر جهانی، و سرمایه‌گذاری در پروژه‌های تجدیدپذیر.',
    ),
    hero: {
      kicker: 'از {since} در کرمان',
      title: 'نیروگاه خورشیدی‌تان را با تیمی بسازید که {mw}\u00a0مگاوات ساخته است',
      sub: 'طراحی، تأمین تجهیزات، اجرا و بهره‌برداری، برای صنایع، سرمایه‌گذاران و پیمانکاران.',
      primaryLabel: 'سود نیروگاه را حساب کنید',
      primaryHref: '/solar-calculator',
      hint: 'برآورد رایگان و فوری، بدون نیاز به ثبت‌نام',
      proofLabel: 'نمایندهٔ رسمی',
      proofText: 'AE Solar و Fronius در ایران',
      clientsLabel: 'کارفرمایان',
      image: 'area-3.jpg',
    },
    doors: {
      title: 'از کجا شروع کنیم؟',
      items: audiences.map((a) => ({ ...a })) as { who: string; title: string; desc: string; cta: string; href: string; image: string }[],
    },
    calcTeaser: {
      title: 'با سرمایهٔ شما چه نیروگاهی ساخته می‌شود؟',
      text: 'ظرفیت قابل احداث، تولید سالانه و درآمد را در سه روش فروش برق ببینید: خرید تضمینی ساتبا، بورس انرژی و خودمصرفی صنعتی.',
      button: 'دیدن برآورد',
    },
    projects: {
      eyebrow: 'نمونه‌کارها',
      title: 'از کویر تا خط تولید',
      moreLabel: 'همهٔ پروژه‌ها',
      ctaText: 'پروژه‌ای در همین اندازه دارید؟',
      ctaLabel: 'دربارهٔ پروژه‌تان بپرسید',
    },
    process: {
      title: 'از اولین تماس تا اولین کیلووات‌ساعت',
      lead: 'هر گام یک خروجی مشخص دارد که پیش از رفتن به گام بعد در اختیار شما است.',
      steps: processSteps.map((st) => ({ ...st })),
    },
    shop: { eyebrow: 'فروشگاه تجهیزات', title: 'اینورترها و پنل‌های خورشیدی' },
    faq: {
      title: 'پرسش‌های پیش از شروع',
      lead: 'جواب سؤالتان اینجا نیست؟',
      items: homeFaq.map((f) => ({ ...f })),
    },
    magazine: { eyebrow: 'مجلهٔ انرژی', title: 'دانش، بازار و اخبار', moreLabel: 'همهٔ مقاله‌ها' },
  },
} satisfies PageDef;

export const activityPage = listingPage('activity', 'حوزه‌های فعالیت', '/activity', {
  seo: seo(
    'حوزه‌های فعالیت | نماد نیرو',
    'سه حوزهٔ فعالیت نماد نیرو: طراحی مهندسی نیروگاه، بازرگانی و تأمین تجهیزات خورشیدی، و اجرا و بهره‌برداری پروژه‌های تجدیدپذیر.',
  ),
  hero: {
    title: 'سه حوزه، یک شریک انرژی',
    lead: 'از طراحی و مهندسی تا تأمین تجهیزات و اجرا و بهره‌برداری نیروگاه؛ نماد نیرو در تمام مسیر همراه شماست.',
  },
  related: 'پیش از شروع پروژه بخوانید',
  cta: {
    title: 'مطمئن نیستید کدام مسیر مناسب شماست؟',
    text: 'کارشناسان ما با یک تماس، بهترین حوزه را برای پروژهٔ شما پیشنهاد می‌دهند.',
    label: 'درخواست مشاوره',
    href: '/#quote',
  },
});

/* ============================================================
   AE Solar
   ============================================================ */

/** تیتر دوخطی صفحهٔ AE Solar: برچسب کوچک، خط اول، خط دوم مورب، متن زیر */
const twoLine = (key: string, label: string, withSub = true): Field => ({
  kind: 'group',
  key,
  label,
  hint: 'در خط اول، واژه‌ای که بین دو ستاره بیاید (مثل *یک شرایط*) قرمز نمایش داده می‌شود.',
  fields: [
    { kind: 'text', key: 'kicker', label: 'برچسب کوچک' },
    { kind: 'text', key: 'line1', label: 'خط اول تیتر' },
    { kind: 'text', key: 'line2', label: 'خط دوم تیتر (مورب)' },
    ...(withSub ? [{ kind: 'textarea', key: 'sub', label: 'متن زیر تیتر', rows: 2 } as Field] : []),
  ],
});

export const aeSolarPage = {
  key: 'aeSolar',
  label: 'AE Solar',
  path: '/ae-solar',
  fields: [
    seoGroup,
    {
      kind: 'group',
      key: 'hero',
      label: 'سرصفحه',
      hint: 'در متن زیر تیتر، «{since}» با سال تأسیس AE Solar جایگزین می‌شود.',
      fields: [
        { kind: 'text', key: 'badge', label: 'نشان بالای تیتر' },
        { kind: 'text', key: 'line1', label: 'خط اول تیتر' },
        { kind: 'text', key: 'line2', label: 'خط دوم (قرمز)' },
        { kind: 'text', key: 'line3', label: 'خط سوم (کم‌رنگ)' },
        { kind: 'textarea', key: 'lead', label: 'متن زیر تیتر', rows: 3 },
        { kind: 'text', key: 'primaryLabel', label: 'متن دکمهٔ اصلی' },
        { kind: 'text', key: 'primaryHref', label: 'نشانی دکمهٔ اصلی', ltr: true },
        { kind: 'text', key: 'secondaryLabel', label: 'متن دکمهٔ «سری‌ها»' },
      ],
    },
    {
      kind: 'list',
      key: 'stats',
      label: 'نوار آمار',
      itemTitle: 'label',
      addLabel: 'افزودن آمار',
      item: [
        { kind: 'text', key: 'value', label: 'عدد' },
        { kind: 'text', key: 'unit', label: 'واحد' },
        { kind: 'checkbox', key: 'plus', label: 'علامت + بعد از عدد' },
        { kind: 'text', key: 'label', label: 'توضیح' },
      ],
    },
    twoLine('anatomyHead', 'تیتر «آنچه داخل ماژول است»'),
    twoLine('seriesHead', 'تیتر سری‌ها'),
    {
      kind: 'list',
      key: 'series',
      label: 'سری‌های ماژول',
      itemTitle: 'name',
      addLabel: 'افزودن سری',
      item: [
        { kind: 'text', key: 'name', label: 'نام سری', ltr: true },
        { kind: 'text', key: 'fa', label: 'نام فارسی' },
        { kind: 'text', key: 'tech', label: 'تکنولوژی', ltr: true },
        { kind: 'text', key: 'tagline', label: 'شعار کوتاه' },
        { kind: 'textarea', key: 'desc', label: 'توضیح', rows: 2 },
        { kind: 'text', key: 'power', label: 'بازهٔ توان (وات)', hint: 'اگر «—» بگذارید، «بنا به سفارش» نمایش داده می‌شود.' },
        { kind: 'checkbox', key: 'stocked', label: 'موجود در ایران' },
      ],
    },
    twoLine('techHead', 'تیتر راهنمای انتخاب'),
    {
      kind: 'list',
      key: 'techGuide',
      label: 'جدول تکنولوژی‌ها',
      itemTitle: 'tech',
      addLabel: 'افزودن ردیف',
      item: [
        { kind: 'text', key: 'tech', label: 'تکنولوژی', ltr: true },
        { kind: 'text', key: 'series', label: 'سری', ltr: true },
        { kind: 'text', key: 'best', label: 'مناسب برای' },
        { kind: 'text', key: 'eff', label: 'بازده ماژول' },
        { kind: 'text', key: 'temp', label: 'ضریب دمایی' },
        { kind: 'textarea', key: 'note', label: 'توضیح', rows: 2 },
      ],
    },
    twoLine('warrantyHead', 'تیتر تضمین‌ها', false),
    {
      kind: 'list',
      key: 'warranty',
      label: 'تضمین‌ها',
      itemTitle: 'label',
      addLabel: 'افزودن تضمین',
      item: [
        { kind: 'text', key: 'value', label: 'عدد' },
        { kind: 'text', key: 'unit', label: 'واحد' },
        { kind: 'text', key: 'label', label: 'عنوان' },
        { kind: 'text', key: 'note', label: 'توضیح' },
      ],
    },
    twoLine('whyHead', 'تیتر «چرا از نماد نیرو»', false),
    {
      kind: 'list',
      key: 'whyUs',
      label: 'دلیل‌ها',
      itemTitle: 'title',
      addLabel: 'افزودن دلیل',
      hint: 'شماره‌گذاری خودکار است.',
      item: [
        { kind: 'text', key: 'title', label: 'عنوان' },
        { kind: 'textarea', key: 'desc', label: 'توضیح', rows: 2 },
      ],
    },
    twoLine('datasheetsHead', 'تیتر دیتاشیت‌ها'),
    {
      kind: 'list',
      key: 'datasheets',
      label: 'دیتاشیت‌ها',
      itemTitle: 'series',
      addLabel: 'افزودن دیتاشیت',
      item: [
        { kind: 'text', key: 'series', label: 'سری', ltr: true },
        { kind: 'text', key: 'tech', label: 'تکنولوژی', ltr: true },
        { kind: 'text', key: 'power', label: 'بازهٔ توان (وات)' },
        { kind: 'text', key: 'file', label: 'نشانی فایل PDF', ltr: true },
        { kind: 'text', key: 'size', label: 'حجم فایل' },
      ],
    },
    twoLine('faqHead', 'تیتر پرسش‌ها', false),
    {
      kind: 'list',
      key: 'faq',
      label: 'پرسش‌ها',
      itemTitle: 'q',
      addLabel: 'افزودن پرسش',
      hint: 'همین پرسش‌ها به‌صورت دادهٔ ساختاریافته به گوگل هم داده می‌شوند.',
      item: [
        { kind: 'text', key: 'q', label: 'پرسش' },
        { kind: 'textarea', key: 'a', label: 'پاسخ', rows: 3 },
      ],
    },
    {
      kind: 'group',
      key: 'pact',
      label: 'نشان شراکت',
      fields: [
        { kind: 'text', key: 'us', label: 'نقش ما' },
        { kind: 'text', key: 'them', label: 'نقش AE Solar' },
      ],
    },
    { kind: 'text', key: 'related', label: 'عنوان «مقاله‌های مرتبط»' },
    ctaGroup,
  ],
  defaults: {
    seo: seo(
      'AE Solar | نمایندگی رسمی در ایران — نماد نیرو',
      'نماد نیرو، نمایندهٔ رسمی AE Solar آلمان در ایران. تأمین ماژول‌های خورشیدی سری Aurora، Meteor، Comet و Eclipse با گارانتی معتبر سازنده.',
    ),
    hero: {
      badge: 'نمایندهٔ رسمی در ایران',
      line1: 'ماژول‌های خورشیدی',
      line2: 'مهندسی آلمان',
      line3: 'حالا از انبار کرمان',
      lead: 'AE Solar از سال {since} در آلمان ماژول تولید می‌کند. ما نمایندهٔ رسمی آن در ایران هستیم — یعنی همان کیفیت، با گارانتی معتبر سازنده و تحویل از موجودی داخلی.',
      primaryLabel: 'استعلام قیمت و موجودی',
      primaryHref: '/#quote',
      secondaryLabel: 'مشاهدهٔ سری‌ها',
    },
    stats: aeData.aeStats.map((st) => ({
      value: st.value,
      unit: 'unit' in st ? st.unit : '',
      plus: 'plus' in st ? st.plus : false,
      label: st.label,
    })),
    anatomyHead: {
      kicker: 'آنچه داخل ماژول است',
      line1: 'کیفیت را نمی‌شود دید.',
      line2: 'مگر اینکه بازش کنی.',
      sub: 'هر ماژول از شش لایه ساخته شده و عمر واقعی آن را همین لایه‌ها تعیین می‌کنند، نه برچسب روی جعبه. روی هر لایه نگه دارید تا جای آن را ببینید.',
    },
    seriesHead: {
      kicker: 'سری‌های ماژول',
      line1: 'هر سری برای *یک شرایط*',
      line2: 'ساخته شده است.',
      sub: 'AE Solar نام هر سری را از یک پدیدهٔ کیهانی یا طبیعی گرفته است. تفاوت‌شان تزئینی نیست — هر کدام تکنولوژی سلول متفاوتی دارد و برای اقلیم و نوع پروژهٔ مشخصی بهینه شده.',
    },
    series: aeData.series.map(({ name, fa, tech, tagline, desc, power, stocked }) => ({ name, fa, tech, tagline, desc, power, stocked })),
    techHead: {
      kicker: 'راهنمای انتخاب',
      line1: 'کدام تکنولوژی',
      line2: 'برای پروژهٔ شما؟',
      sub: 'تفاوت PERC، TOPCon، HJT و بک‌کنتکت در بازده و رفتار دمایی است. برای اقلیم گرم، ضریب دمایی از خودِ بازده مهم‌تر است.',
    },
    techGuide: aeData.techGuide.map((t) => ({ ...t })),
    warrantyHead: { kicker: 'تضمین‌ها', line1: 'ماژول را برای سی سال', line2: 'می‌خرید، نه برای امروز.' },
    warranty: aeData.warranty.map((w) => ({ value: w.value, unit: 'unit' in w ? w.unit : '', label: w.label, note: w.note })),
    whyHead: { kicker: 'خرید از کانال رسمی', line1: 'چرا از نماد نیرو', line2: 'و نه از بازار آزاد؟' },
    whyUs: aeData.whyUs.map((w) => ({ ...w })),
    datasheetsHead: {
      kicker: 'مشخصات فنی',
      line1: 'دیتاشیت رسمی',
      line2: 'مستقیم از سازنده.',
      sub: 'همان فایلی که مهندس طراح شما برای محاسبات لازم دارد — بدون واسطه و بدون ثبت‌نام.',
    },
    datasheets: aeData.datasheets.map((d) => ({ ...d })),
    faqHead: { kicker: 'پیش از تماس', line1: 'سؤالی دارید؟', line2: 'احتمالاً جوابش اینجاست.' },
    faq: aeData.faq.map((f) => ({ ...f })),
    pact: { us: 'نمایندهٔ رسمی در ایران', them: `سازنده · ${aeData.ae.origin}` },
    related: 'دربارهٔ پنل خورشیدی',
    cta: {
      title: 'ظرفیت پروژه‌تان را بگویید',
      text: 'سری مناسب اقلیم و طرح شما را پیشنهاد می‌دهیم و موجودی و قیمت روز را می‌فرستیم.',
      label: 'درخواست استعلام',
      href: '/#quote',
    },
  },
} satisfies PageDef;

export const investmentPage = {
  key: 'investment',
  label: 'سرمایه‌گذاری',
  path: '/investment',
  fields: [
    seoGroup,
    heroGroup,
    {
      kind: 'group',
      key: 'stats',
      label: 'عددهای سرصفحه',
      hint: 'دو عدد اول خودکار از پروژه‌های دستهٔ «سرمایه‌گذاری» حساب می‌شوند؛ اینجا فقط توضیحشان است.',
      fields: [
        { kind: 'text', key: 'mwLabel', label: 'توضیح عدد مگاوات' },
        { kind: 'text', key: 'countLabel', label: 'توضیح تعداد نیروگاه‌ها' },
        { kind: 'text', key: 'thirdValue', label: 'عدد سوم' },
        { kind: 'text', key: 'thirdUnit', label: 'واحد عدد سوم' },
        { kind: 'text', key: 'thirdCaption', label: 'توضیح عدد سوم' },
      ],
    },
    {
      kind: 'group',
      key: 'intro',
      label: 'معرفی',
      fields: [
        { kind: 'textarea', key: 'lead', label: 'جملهٔ درشت', rows: 2 },
        { kind: 'lines', key: 'body', label: 'پاراگراف‌ها', hint: 'هر پاراگراف در یک خط.' },
        { kind: 'text', key: 'visual', label: 'متن کادر کناری' },
      ],
    },
    headGroup('projects', 'سرتیتر نیروگاه‌های سرمایه‌گذاری'),
    {
      kind: 'group',
      key: 'why',
      label: 'چرا با ما',
      fields: [
        { kind: 'text', key: 'eyebrow', label: 'برچسب کوچک' },
        { kind: 'text', key: 'title', label: 'عنوان' },
        {
          kind: 'list',
          key: 'items',
          label: 'کارت‌ها',
          itemTitle: 'title',
          addLabel: 'افزودن کارت',
          item: [
            { kind: 'text', key: 'title', label: 'عنوان' },
            { kind: 'textarea', key: 'desc', label: 'توضیح', rows: 2 },
          ],
        },
      ],
    },
    { kind: 'text', key: 'related', label: 'عنوان «مقاله‌های مرتبط»' },
    ctaGroup,
  ],
  defaults: {
    seo: seo(
      'سرمایه‌گذاری | نماد نیرو',
      'نماد نیرو در نیروگاه‌هایی که می‌سازد، خودش هم سرمایه‌گذار است — مشارکت در انرژی خورشیدی با سابقهٔ اجرایی اثبات‌شده.',
    ),
    hero: {
      title: 'ما فقط نمی‌سازیم؛ خودمان هم سرمایه‌گذاریم',
      lead: 'پیش از آن‌که از شما بخواهیم در نیروگاه خورشیدی سرمایه‌گذاری کنید، خودمان چند ده مگاوات از سرمایهٔ خودمان را در همین مسیر گذاشته‌ایم.',
    },
    stats: {
      mwLabel: 'سرمایه‌گذاری مستقیم نماد نیرو',
      countLabel: 'نیروگاه با مشارکت مستقیم',
      thirdValue: '۲',
      thirdUnit: 'دهه',
      thirdCaption: 'سابقهٔ اجرا و بهره‌برداری نیروگاه',
    },
    intro: {
      lead: 'وقتی پیشنهاد سرمایه‌گذاری می‌دهیم، پشت آن سرمایهٔ خودمان ایستاده است.',
      body: [
        'بسیاری از شرکت‌های EPC فقط نیروگاه می‌سازند و پروژه را به کارفرما تحویل می‌دهند. نماد نیرو مسیر دیگری را هم رفته: در کنار طراحی مهندسی و تأمین تجهیزات، در تعدادی از نیروگاه‌هایی که خودمان طراحی و اجرا کرده‌ایم، سرمایه‌گذار هم بوده‌ایم.',
        'این یعنی همان ریسک، بازده و چالش‌های بهره‌برداری که برای یک سرمایه‌گذار مطرح می‌شود، برای ما هم واقعی بوده — و تجربه‌اش را مستقیم داریم، نه فقط از زاویهٔ مجری پروژه.',
      ],
      visual: 'مشارکت، تأمین مالی و اجرا زیر یک سقف',
    },
    projects: { eyebrow: 'نمونهٔ سرمایه‌گذاری‌های ما', title: 'نیروگاه‌هایی که در آن‌ها سهیم‌ایم' },
    why: {
      eyebrow: 'چرا با ما سرمایه‌گذاری کنید',
      title: 'از امکان‌سنجی تا فروش تضمینی برق',
      items: [
        { title: 'سابقهٔ اجرایی واقعی', desc: 'پیش از پیشنهاد به شما، همین مسیر را با سرمایهٔ خودمان رفته‌ایم — از مجوز تا بهره‌برداری.' },
        { title: 'مدیریت کامل پروژه', desc: 'طراحی، تأمین تجهیزات، احداث و بهره‌برداری همه زیر یک مجموعه انجام می‌شود.' },
        { title: 'شفافیت در بازده', desc: 'برآورد بازده و جدول زمانی بازگشت سرمایه پیش از ورود شما مشخص و مکتوب می‌شود.' },
      ],
    },
    related: 'اقتصاد نیروگاه خورشیدی',
    cta: {
      title: 'می‌خواهید در پروژهٔ بعدی سهیم شوید؟',
      text: 'فرصت‌های سرمایه‌گذاری فعلی و شرایط مشارکت را با کارشناسان ما در میان بگذارید.',
      label: 'بررسی فرصت سرمایه‌گذاری',
      href: '/#quote',
    },
  },
} satisfies PageDef;

export const shopPage = listingPage('shop', 'فروشگاه', '/shop', {
  seo: seo(
    'فروشگاه | نماد نیرو',
    'فروشگاه تجهیزات خورشیدی نماد نیرو؛ اینورتر، پنل و ذخیره‌ساز از برندهای معتبر جهانی، در دو دستهٔ محصولات خانگی و صنعتی.',
  ),
  hero: {
    title: 'تجهیزاتی که پروژه را می‌سازند',
    lead: 'اینورتر، پنل و ذخیره‌ساز از برندهای معتبر جهانی؛ برای خانه‌ها و صنایع، همراه با گارانتی و پشتیبانی فنی.',
  },
  related: 'راهنمای انتخاب تجهیزات',
  cta: {
    title: 'تجهیز موردنظرتان را پیدا نکردید؟',
    text: 'لیست کامل برندها و مدل‌ها را داریم؛ نیازتان را بگویید تا بهترین گزینه را پیشنهاد دهیم.',
    label: 'درخواست مشاوره',
    href: '/#quote',
  },
});

export const magazinePage = listingPage('magazine', 'مجله', '/magazine', {
  seo: seo(
    'مجله انرژی خورشیدی؛ آموزش نیروگاه خورشیدی | نماد نیرو',
    'مقاله‌های کاربردی دربارهٔ نیروگاه خورشیدی: اجزا و اینورتر، آنگرید و آفگرید، نگهداری و O&M، شاخص PR، قرارداد EPC و درآمد و سود نیروگاه خورشیدی.',
  ),
  hero: {
    title: 'مجلهٔ انرژی',
    lead: 'راهنمای ساده و کاربردی دربارهٔ نیروگاه خورشیدی، تجهیزات، نگه‌داری و اقتصاد انرژی — برای صاحبان صنایع و علاقه‌مندان.',
  },
  cta: {
    title: 'سؤالی دربارهٔ پروژه‌تان دارید؟',
    text: 'کارشناسان ما فراتر از مقاله، مستقیم راهنمایی‌تان می‌کنند.',
    label: 'درخواست مشاوره',
    href: '/#quote',
  },
});

/* ============================================================
   برآورد سرمایه‌گذاری
   ============================================================

   فقط متن توضیحی اینجاست. برچسب‌های فرم مال خود ابزارند، و «فرض‌های مدل»
   عمداً اینجا نیست: عددهایش همان ثابت‌های محاسبه است و از خود مدل ساخته
   می‌شود، تا متن صفحه هرگز چیزی جز محاسبهٔ واقعی نگوید. */

export const calculatorPage = {
  key: 'calculator',
  label: 'برآورد سرمایه‌گذاری',
  path: '/solar-calculator',
  fields: [
    seoGroup,
    heroGroup,
    {
      kind: 'group',
      key: 'disclaimer',
      label: 'هشدار «تقریبی است»',
      fields: [
        { kind: 'text', key: 'lead', label: 'جملهٔ پررنگ' },
        { kind: 'textarea', key: 'text', label: 'ادامه', rows: 3 },
      ],
    },
    { kind: 'textarea', key: 'resultsFoot', label: 'یادداشت زیر جدول آورده', rows: 2 },
    {
      kind: 'group',
      key: 'pdf',
      label: 'کادر دریافت PDF',
      fields: [
        { kind: 'text', key: 'title', label: 'عنوان' },
        { kind: 'textarea', key: 'text', label: 'متن', rows: 2 },
        { kind: 'text', key: 'button', label: 'متن دکمه' },
        { kind: 'textarea', key: 'note', label: 'یادداشت زیر دکمه', rows: 2 },
      ],
    },
    headGroup('routesHead', 'سرتیتر سه روش فروش برق'),
    {
      kind: 'group',
      key: 'transparency',
      label: 'بخش «این عددها از کجا آمده‌اند»',
      fields: [
        { kind: 'text', key: 'eyebrow', label: 'برچسب کوچک' },
        { kind: 'text', key: 'title', label: 'عنوان' },
        { kind: 'text', key: 'whyTitle', label: 'عنوان ستون توضیح' },
        { kind: 'lines', key: 'whyBody', label: 'پاراگراف‌های توضیح', hint: 'هر پاراگراف در یک خط.' },
      ],
    },
    {
      kind: 'group',
      key: 'cta',
      label: 'دعوت پایین صفحه',
      hint: 'نشانی دکمه خودکار ساخته می‌شود تا ظرفیت برآوردشده همراه فرم برود.',
      fields: [
        { kind: 'text', key: 'title', label: 'عنوان' },
        { kind: 'textarea', key: 'text', label: 'متن', rows: 3 },
        { kind: 'text', key: 'label', label: 'متن دکمه' },
      ],
    },
    {
      kind: 'list',
      key: 'faq',
      label: 'پرسش‌ها',
      itemTitle: 'q',
      addLabel: 'افزودن پرسش',
      hint: 'این پرسش‌ها روی صفحه دیده نمی‌شوند ولی به‌صورت دادهٔ ساختاریافته به گوگل داده می‌شوند و ممکن است در نتایج جست‌وجو نمایش داده شوند.',
      item: [
        { kind: 'text', key: 'q', label: 'پرسش' },
        { kind: 'textarea', key: 'a', label: 'پاسخ', rows: 3 },
      ],
    },
  ],
  defaults: {
    seo: seo(
      'برآورد سرمایه‌گذاری نیروگاه خورشیدی | نماد نیرو',
      'با سرمایهٔ موردنظرتان چه نیروگاه خورشیدی می‌توان ساخت، چقدر برق تولید می‌کند و در چه مدتی برمی‌گردد — برآورد تقریبی بر پایهٔ نرخ‌های ۱۴۰۵ و سه روش فروش برق.',
    ),
    hero: {
      title: 'با این سرمایه، چه نیروگاهی؟',
      lead: 'سرمایهٔ موردنظرتان را وارد کنید تا ببینید تقریباً چه ظرفیتی می‌شود ساخت، چقدر برق تولید می‌کند، و با هر روش فروش برق چه آورده‌ای دارد.',
    },
    disclaimer: {
      lead: 'این محاسبه تقریبی است.',
      text: 'خروجی این صفحه یک برآورد اولیه برای شناخت ابعاد کار است، نه طرح توجیهی. قیمت تجهیزات با نرخ ارز و نرخ فروش برق با مصوبه‌های وزارت نیرو تغییر می‌کند، و هزینهٔ زمین و فاصله تا شبکه در هر پروژه فرق دارد. برای تصمیم سرمایه‌گذاری، امکان‌سنجی اختصاصی لازم است.',
    },
    resultsFoot: 'همهٔ عددها تقریبی‌اند و به قیمت امروز حساب شده‌اند؛ تورم و تعدیل نرخ در آن‌ها لحاظ نشده.',
    pdf: {
      title: 'این برآورد را به‌صورت PDF بگیرید',
      text: 'یک برگهٔ کامل با همهٔ فرض‌ها، سه روش فروش برق و جمع ۲۰ ساله — مناسب برای ارائه به شریک یا هیئت‌مدیره.',
      button: 'دریافت PDF برآورد',
      note: 'شماره‌تان را می‌گیریم تا در صورت نیاز، کارشناس ما برآورد دقیق‌تری برایتان تهیه کند.',
    },
    routesHead: { eyebrow: 'سه راه برای فروش برق', title: 'هر کدام برای چه کسی مناسب است' },
    transparency: {
      eyebrow: 'شفافیت محاسبه',
      title: 'این عددها از کجا آمده‌اند',
      whyTitle: 'چرا بازه می‌دهیم و نه یک عدد',
      whyBody: [
        'منابع منتشرشده دربارهٔ هزینهٔ احداث با هم اختلاف زیادی دارند. بخشی از این اختلاف واقعی است: بعضی برآوردها فقط تجهیزات و نصب را حساب می‌کنند و بعضی زمین، پست و خط انتقال را هم اضافه می‌کنند — که در نیروگاه زمینی می‌تواند نزدیک نیمی از کل سرمایه باشد. بخش دیگرش هم به نرخ ارز و تاریخ انتشار برمی‌گردد.',
        'به همین دلیل خروجی این صفحه بازه است، و می‌توانید فرض‌ها را با استعلام خودتان جایگزین کنید.',
      ],
    },
    cta: {
      title: 'برآورد دقیق پروژهٔ خودتان را بگیرید',
      text: 'این صفحه ابعاد کار را نشان می‌دهد. برای عدد قابل اتکا، کارشناسان ما با بررسی زمین، فاصله تا شبکه و قیمت روز تجهیزات، امکان‌سنجی اختصاصی تهیه می‌کنند.',
      label: 'درخواست امکان‌سنجی',
    },
    faq: [
  {
    q: 'با یک میلیارد تومان چه نیروگاهی می‌توان ساخت؟',
    a: 'به‌طور تقریبی حدود ۲۱ تا ۳۳ کیلووات روی پشت‌بام، یا ۱۰ تا ۲۲ کیلووات به‌صورت زمینی — چون نیروگاه زمینی هزینهٔ زمین، پست و خط انتقال هم دارد. عدد دقیق به قیمت روز تجهیزات و موقعیت زمین بستگی دارد.',
  },
  {
    q: 'بازگشت سرمایهٔ نیروگاه خورشیدی چند سال است؟',
    a: 'بسته به نرخ فروش برق و هزینهٔ احداث، معمولاً بین ۴ تا ۹ سال برآورد می‌شود. فروش در بورس انرژی بازگشت را کوتاه‌تر می‌کند و خرید تضمینی ساتبا بلندتر، در عوض درآمد تضمینی‌تری دارد.',
  },
  {
    q: 'برق نیروگاه را به چه کسی می‌توان فروخت؟',
    a: 'سه مسیر رایج است: خرید تضمینی ۲۰ سالهٔ ساتبا، فروش به صنایع از طریق تابلوی سبز بورس انرژی، و خودمصرفی صنعتی برای صنایع مشمول ماده ۱۶ که باید بخشی از برقشان را تجدیدپذیر تأمین کنند.',
  },
  {
    q: 'هر مگاوات نیروگاه چقدر زمین می‌خواهد؟',
    a: 'حدود ۱ تا ۱٫۵ هکتار برای نصب زمینی. روی پشت‌بام حدود ۶ مترمربع به ازای هر کیلووات لازم است.',
  },
],
  },
} satisfies PageDef;

export const PAGES: PageDef[] = [
  homePage,
  aboutPage,
  activityPage,
  projectsPage,
  shopPage,
  aeSolarPage,
  investmentPage,
  calculatorPage,
  magazinePage,
  contactPage,
  notFoundPage,
];

export const pageByKey = (key: string) => PAGES.find((p) => p.key === key);

/** کلید ذخیره در جدول تنظیمات — پیشوند تا با کلیدهای سراسری قاطی نشود */
export const storageKey = (pageKey: string) => `page:${pageKey}`;

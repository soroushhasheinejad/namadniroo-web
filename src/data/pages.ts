import type { Field } from '../admin/fields';

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
 * همهٔ صفحات سئوی قابل ویرایش دارند. متن بدنه فعلاً برای درباره، تماس،
 * پروژه‌ها و ۴۰۴ قابل ویرایش است؛ بقیه به‌تدریج اضافه می‌شوند.
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

/** صفحه‌ای که فعلاً فقط سئویش از پنل قابل ویرایش است */
const seoOnly = (key: string, label: string, path: string, title: string, description: string) =>
  ({ key, label, path, fields: [seoGroup], defaults: { seo: seo(title, description) } }) satisfies PageDef;

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
   صفحاتی که فعلاً فقط سئویشان از پنل قابل ویرایش است
   ============================================================

   متن بدنهٔ این صفحات هنوز در قالب است — تازه بازطراحی شده‌اند و
   فیلدهایشان جدا اضافه می‌شود. عنوان و توضیحشان برای گوگل اما از همین
   حالا از پنل قابل تغییر است. */

export const homePage = seoOnly(
  'home',
  'صفحهٔ اصلی',
  '/',
  'نماد نیرو | راه‌کارهای جامع انرژی پایدار',
  'نماد نیرو از سال ۱۳۸۷ در کرمان: احداث نیروگاه خورشیدی، تأمین پنل و اینورتر از برندهای معتبر جهانی، و سرمایه‌گذاری در پروژه‌های تجدیدپذیر.',
);

export const activityPage = seoOnly(
  'activity',
  'حوزه‌های فعالیت',
  '/activity',
  'حوزه‌های فعالیت | نماد نیرو',
  'سه حوزهٔ فعالیت نماد نیرو: طراحی مهندسی نیروگاه، بازرگانی و تأمین تجهیزات خورشیدی، و اجرا و بهره‌برداری پروژه‌های تجدیدپذیر.',
);

export const aeSolarPage = seoOnly(
  'aeSolar',
  'AE Solar',
  '/ae-solar',
  'AE Solar | نمایندگی رسمی در ایران — نماد نیرو',
  'نماد نیرو، نمایندهٔ رسمی AE Solar آلمان در ایران. تأمین ماژول‌های خورشیدی سری Aurora، Meteor، Comet و Eclipse با گارانتی معتبر سازنده.',
);

export const investmentPage = seoOnly(
  'investment',
  'سرمایه‌گذاری',
  '/investment',
  'سرمایه‌گذاری | نماد نیرو',
  'نماد نیرو در نیروگاه‌هایی که می‌سازد، خودش هم سرمایه‌گذار است — مشارکت در انرژی خورشیدی با سابقهٔ اجرایی اثبات‌شده.',
);

export const shopPage = seoOnly(
  'shop',
  'فروشگاه',
  '/shop',
  'فروشگاه | نماد نیرو',
  'فروشگاه تجهیزات خورشیدی نماد نیرو؛ اینورتر، پنل و ذخیره‌ساز از برندهای معتبر جهانی، در دو دستهٔ محصولات خانگی و صنعتی.',
);

export const magazinePage = seoOnly(
  'magazine',
  'مجله',
  '/magazine',
  'مجله انرژی خورشیدی؛ آموزش نیروگاه خورشیدی | نماد نیرو',
  'مقاله‌های کاربردی دربارهٔ نیروگاه خورشیدی: اجزا و اینورتر، آنگرید و آفگرید، نگهداری و O&M، شاخص PR، قرارداد EPC و درآمد و سود نیروگاه خورشیدی.',
);

export const calculatorPage = seoOnly(
  'calculator',
  'برآورد سرمایه‌گذاری',
  '/solar-calculator',
  'برآورد سرمایه‌گذاری نیروگاه خورشیدی | نماد نیرو',
  'با سرمایهٔ موردنظرتان چه نیروگاه خورشیدی می‌توان ساخت، چقدر برق تولید می‌کند و در چه مدتی برمی‌گردد — برآورد تقریبی بر پایهٔ نرخ‌های ۱۴۰۵ و سه روش فروش برق.',
);

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

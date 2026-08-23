import activity1 from '../assets/activity-1.jpg';
import activity2 from '../assets/activity-2.jpg';
import activity3 from '../assets/activity-3.jpg';
import banner1 from '../assets/banner-1.jpg';
import banner2 from '../assets/banner-2.jpg';
import area1 from '../assets/area-1.jpg';
import area2 from '../assets/area-2.jpg';
import area3 from '../assets/area-3.jpg';

export const site = {
  name: 'نماد نیرو',
  phone: '۰۳۴ ۳۲۵۲۱۴۱۶',
  phoneHref: 'tel:03432521416',
  city: 'کرمان، ایران',
  since: '۱۳۸۷',
};

export const nav = [
  { href: '/activity.html', label: 'حوزه‌های فعالیت' },
  { href: '/projects.html', label: 'پروژه‌ها' },
  { href: '/shop.html', label: 'فروشگاه' },
  { href: '/ae-solar.html', label: 'AE Solar' },
  { href: '/investment.html', label: 'سرمایه‌گذاری' },
  { href: '/magazine.html', label: 'مجله' },
  { href: '/about.html', label: 'درباره ما' },
  { href: '/contact.html', label: 'تماس با ما' },
];

/* اسلایدر صفحهٔ اصلی — پوسترها متن روی خودشان دارند */
export const heroSlides = [
  { img: activity1, label: 'مهندسی نیروگاه', icon: 'contract' },
  { img: activity2, label: 'تأمین تجهیزات', icon: 'panel' },
  { img: activity3, label: 'اجرا و بهره‌برداری', icon: 'monitor' },
] as const;

export const promoSlides = [
  { img: banner1, href: '/#quote', alt: 'ارائه‌دهندهٔ راه‌کارهای جامع انرژی پایدار' },
  { img: banner2, href: '/shop.html', alt: 'فروشگاه محصولات نماد نیرو' },
];

export const stats = [
  { value: 70, unit: 'MW', caption: 'نیروگاه خورشیدی اجراشده' },
  { value: 120, plus: true, caption: 'پروژهٔ صنعتی تحویل‌شده' },
  { text: '۲', unit: 'دهه', caption: 'سابقهٔ اجرا و بهره‌برداری' },
  { text: '۱۳۸۷', caption: 'سال تأسیس · کرمان، ایران' },
];

export const areas = [
  {
    id: 'engineering', eyebrow: 'طراحی مهندسی', icon: 'contract', image: area1,
    title: 'امکان‌سنجی، طراحی و مهندسی نیروگاه',
    desc: 'پیش از آن‌که یک پیچ بسته شود، پروژه روی کاغذ ساخته می‌شود: بررسی توجیه فنی و اقتصادی، طراحی سامانه و تهیهٔ مدارک مهندسی برای نیروگاه‌های خورشیدی و حرارتی.',
    items: ['امکان‌سنجی فنی و اقتصادی پروژه', 'طراحی سامانه و مهندسی تفصیلی (EPC)', 'مطالعات اتصال به شبکه', 'طراحی سازه و چیدمان آرایه', 'تهیهٔ نقشه‌ها و مدارک فنی'],
    cta: { href: '/#quote', label: 'دریافت مشاوره' },
    proof: { label: 'سابقه:', value: '۲ دهه', tail: 'مهندسی و اجرا' },
  },
  {
    id: 'trading', eyebrow: 'بازرگانی و تجهیزات', icon: 'panel', image: area2, reverse: true,
    title: 'تأمین تجهیزات استاندارد خورشیدی',
    desc: 'واردات و توزیع اینورتر و پنل خورشیدی از برندهای معتبر جهانی، از مقیاس خانگی تا مگاواتی، همراه با گارانتی و پشتیبانی فنی.',
    items: ['اینورترهای Fronius، Sungrow، Sunways و Deye', 'پنل‌های خورشیدی مونوکریستال نیم‌سلولی', 'سازه، کابل و تجهیزات جانبی', 'گارانتی و خدمات پس از فروش', 'مشاورهٔ انتخاب تجهیزات متناسب با پروژه'],
    cta: { href: '/shop.html', label: 'مشاهدهٔ فروشگاه' },
    proof: { label: 'تأمین: بیش از', value: '۷۰ مگاوات', tail: 'تجهیزات' },
  },
  {
    id: 'execution', eyebrow: 'اجرا', icon: 'monitor', image: area3,
    title: 'احداث، راه‌اندازی و بهره‌برداری',
    desc: 'از نصب سازه و آرایه تا سنکرون‌سازی با شبکه و نگه‌داری بلندمدت؛ اجرای نیروگاه‌های خورشیدی و مولدهای مقیاس کوچک با تیم و تجهیزات خودمان.',
    items: ['احداث نیروگاه خورشیدی و مولد مقیاس‌کوچک (DG)', 'نصب، سیم‌کشی و راه‌اندازی', 'تست، سنکرون و تحویل به شبکه', 'بهره‌برداری و نگه‌داری (O&M)', 'سامانه‌های پایش و کنترل SCADA و DCS'],
    cta: { href: '/projects.html', label: 'مشاهدهٔ پروژه‌ها' },
    proof: { label: 'اجراشده: بیش از', value: '۷۰ مگاوات', tail: 'نیروگاه' },
  },
];

/* مسیر رشد شرکت — روی صفحهٔ «درباره ما» نمایش داده می‌شود.
   برای افزودن نقطهٔ جدید کافی است یک عضو به این آرایه اضافه کنید؛
   چیدمان چپ/راست و انیمیشن خودکار است. */
export const timeline = [
  {
    year: '۱۳۸۷',
    title: 'تأسیس شرکت',
    items: ['آغاز فعالیت در حوزهٔ تولید و توزیع برق صنعتی'],
  },
  {
    year: '۱۳۹۱',
    title: 'ورود به نیروگاه‌های بزرگ‌مقیاس',
    items: ['ارائهٔ خدمات فنی و مهندسی به ۱۲ نیروگاه بزرگ‌مقیاس کشور'],
  },
  {
    year: '۱۳۹۲',
    title: 'تشکیل دپارتمان انرژی تجدیدپذیر',
    items: [],
  },
  {
    year: '۱۳۹۳',
    title: 'ورود به خورشیدی پشت‌بامی',
    items: ['مشارکت در اجرای پروژه‌های خورشیدی پشت‌بامی در ایران'],
  },
  {
    year: '۱۳۹۶',
    title: 'نیروگاه‌های مکران و ماهان',
    items: ['اجرای ۲ نیروگاه ۱۰ مگاواتی؛ از نخستین نیروگاه‌های بزرگ خورشیدی ایران'],
  },
  {
    year: '۱۳۹۷ – ۱۳۹۸',
    title: 'گسترش بین‌المللی',
    items: [
      'تأسیس دفتر شرکت در آلمان',
      'اخذ نمایندگی رسمی AE Solar',
      'اخذ پروانهٔ بهره‌برداری نیروگاه‌های بزرگ‌مقیاس از وزارت نیرو',
    ],
  },
  {
    year: '۱۳۹۸',
    title: 'نمایندگی فرونیوس اتریش',
    items: [
      'اخذ نمایندگی رسمی شرکت Fronius',
      'برگزاری دوره‌های آموزش خدمات فنی با مشارکت فرونیوس',
      'صدور گواهی‌نامه برای بیش از ۱۰۰ نفر',
    ],
  },
  {
    year: '۱۳۹۹',
    title: 'نیروگاه کهک قزوین',
    items: ['احداث نیروگاه ۲ مگاواتی برای مپنا؛ نخستین نیروگاه خورشیدی این شرکت'],
  },
  {
    year: '۱۴۰۲',
    title: 'شبکهٔ سراسری نمایندگی',
    items: ['تأسیس دفتر تهران', 'واگذاری نمایندگی در ۱۲ استان بزرگ کشور'],
  },
];

export const capabilities = [
  { icon: 'contract', title: 'طراحی و احداث (EPC)', desc: 'امکان‌سنجی، مهندسی و ساخت نیروگاه‌های خورشیدی و مولد مقیاس‌کوچک.' },
  { icon: 'sun', title: 'بهره‌برداری و نگه‌داری (O&M)', desc: 'سرویس دوره‌ای، رفع خطا و حفظ راندمان نیروگاه در طول عمر پروژه.' },
  { icon: 'monitor', title: 'پایش و کنترل (SCADA/DCS)', desc: 'سامانه‌های پایش لحظه‌ای، کنترل PLC و مانیتورینگ از راه دور.' },
  { icon: 'panel', title: 'تأمین تجهیزات', desc: 'اینورتر و پنل از برندهای معتبر جهانی، با گارانتی و پشتیبانی فنی.' },
  { icon: 'chart', title: 'سرمایه‌گذاری', desc: 'مشارکت و تأمین مالی پروژه‌های خورشیدی با فروش تضمینی برق.' },
  { icon: 'shield', title: 'حفاظت کاتدی', desc: 'طراحی و اجرای سامانه‌های حفاظت کاتدی برای تأسیسات صنعتی.' },
];

/* لوگوی برندها — تا وقتی فایل نباشد، متن نشان داده می‌شود */
export const brands = [
  { name: 'FRONIUS', logo: '/assets/brands/fronius.png' },
  { name: 'SUNGROW', logo: '/assets/brands/sungrow.png' },
  { name: 'SUNWAYS', logo: null },
  { name: 'DEYE', logo: '/assets/brands/deye.png' },
  { name: 'GOODWE', logo: '/assets/brands/goodwe.png' },
  { name: 'SINENG', logo: '/assets/brands/sineng.png' },
  { name: 'AE SOLAR', logo: '/assets/brands/ae-solar.png' },
  { name: 'TRINA', logo: '/assets/brands/trina.png' },
];

export const clients = [
  'فولاد خوزستان', 'تام ایران‌خودرو', 'صنایع شیمیایی اصفهان', 'جندی‌شاپور اصفهان',
  'تولید برق دماوند', 'ابرآهن یزد', 'ایران ملاس', 'گاز اکسیژن کرمان',
  'نیرو پارس یزد', 'سرمایه‌گذاری روزبه', 'خانهٔ کارگر', 'و ده‌ها صنعت دیگر',
];

export const filters = {
  projects: [
    { key: 'all', label: 'همه' },
    { key: 'supply', label: 'تأمین تجهیزات' },
    { key: 'build', label: 'احداث و اجرا' },
    { key: 'invest', label: 'سرمایه‌گذاری' },
  ],
  products: [
    { key: 'all', label: 'همه' },
    { key: 'home', label: 'محصولات خانگی' },
    { key: 'industrial', label: 'محصولات صنعتی' },
  ],
  articles: [
    { key: 'all', label: 'همه' },
    { key: 'edu', label: 'آموزش' },
    { key: 'market', label: 'بازار انرژی' },
    { key: 'news', label: 'خبر شرکت' },
  ],
};

export const categoryLabel: Record<string, string> = {
  edu: 'آموزش', market: 'بازار انرژی', news: 'خبر شرکت',
  home: 'خانگی', industrial: 'صنعتی',
};

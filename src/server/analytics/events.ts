/**
 * فهرست رویدادهایی که ثبت می‌کنیم.
 *
 * عمداً کوتاه است. هر رویدادی که اینجا اضافه شود باید جواب یک سؤال واقعی
 * را بدهد؛ وگرنه فقط جدول را بزرگ می‌کند و گزارش را شلوغ. ترتیب فهرست،
 * ترتیب قیف است: از بازدید ساده تا لید.
 */

export const EVENT_LABELS: Record<string, string> = {
  pageview: 'بازدید صفحه',
  /* --- ماشین‌حساب خورشیدی: قیف اصلی سایت --- */
  calc_start: 'شروع ماشین‌حساب',
  calc_input: 'تغییر ورودی ماشین‌حساب',
  calc_result: 'دیدن نتیجهٔ برآورد',
  calc_report: 'باز کردن برگهٔ برآورد',
  /* --- تماس و فرم --- */
  form_open: 'باز کردن فرم مشاوره',
  form_start: 'شروع پر کردن فرم',
  form_abandon: 'رها کردن فرم نیمه‌کاره',
  lead_submit: 'ثبت درخواست',
  click_phone: 'کلیک روی شمارهٔ تماس',
  click_whatsapp: 'کلیک روی واتساپ',
  /* --- علاقه‌مندی محتوایی --- */
  download: 'دانلود فایل',
  read_complete: 'خواندن کامل مقاله',
  outbound: 'رفتن به لینک بیرونی',
};

/**
 * فقط این‌ها از سمت مرورگر پذیرفته می‌شوند.
 *
 * مسیر `/api/track` عمومی است و هر کسی می‌تواند به آن درخواست بفرستد؛
 * بدون فهرست سفید، یک نفر می‌توانست جدول را با نوع رویداد دلخواه پر کند و
 * گزارش‌ها را بی‌معنی.
 * `pageview` عمداً در این فهرست نیست: بازدید صفحه را سرور خودش ثبت
 * می‌کند، پس پذیرفتنش از مرورگر فقط راهی برای تورم آمار بود.
 */
export const CLIENT_EVENTS = new Set([
  'calc_start',
  'calc_result',
  'calc_report',
  'form_open',
  'form_start',
  'form_abandon',
  'click_phone',
  'click_whatsapp',
  'download',
  'read_complete',
  'outbound',
]);

export const eventLabel = (type: string): string => EVENT_LABELS[type] ?? type;

/**
 * مراحل قیف، به همان ترتیبی که در گزارش دیده می‌شود.
 *
 * `visits` از جدول بازدیدکننده‌ها می‌آید و بقیه از رویدادها؛ همه بر حسب
 * «تعداد آدم» شمرده می‌شوند نه تعداد رویداد، وگرنه کسی که ده بار ورودی
 * ماشین‌حساب را عوض کرده ده نفر حساب می‌شد.
 */
export const FUNNEL: { key: string; label: string }[] = [
  { key: 'visits', label: 'بازدیدکننده' },
  { key: 'calc_start', label: 'شروع ماشین‌حساب' },
  { key: 'calc_result', label: 'دیدن برآورد' },
  { key: 'form_open', label: 'باز کردن فرم' },
  { key: 'lead_submit', label: 'ثبت درخواست' },
];

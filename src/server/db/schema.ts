import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * ساختار دیتابیس — منبع حقیقت.
 *
 * تایپ‌های TypeScript از همین‌جا استخراج می‌شوند، پس اگر ستونی عوض شود،
 * هر جای کد که با آن کار می‌کند در زمان کامپایل خطا می‌دهد نه در زمان اجرا.
 *
 * موتور SQLite است (از طریق libSQL) و فایلش روی دیسک پایدار می‌نشیند.
 * برای این حجم داده — چند هزار رکورد محتوا و لید، با خواندن بسیار بیشتر از
 * نوشتن — از یک دیتابیس شبکه‌ای سریع‌تر هم هست، چون کوئری بدون رفت‌وبرگشت
 * شبکه انجام می‌شود.
 *
 * قرارداد نام‌گذاری: نام ستون‌ها snake_case و نام فیلدها در کد camelCase.
 */

/** تاریخ‌ها به‌صورت عدد (ثانیهٔ یونیکس) ذخیره می‌شوند و به Date تبدیل می‌گردند */
const timestamp = (name: string) => integer(name, { mode: 'timestamp' });
const now = () => sql`(unixepoch())`;
const bool = (name: string) => integer(name, { mode: 'boolean' });

/* ============================================================
   کاربران و ورود
   ============================================================ */

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  /** هش scrypt — رمز خام هرگز ذخیره نمی‌شود */
  passwordHash: text('password_hash').notNull(),
  /** admin: همه‌چیز · editor: محتوا · sales: فقط لیدها */
  role: text('role', { enum: ['admin', 'editor', 'sales'] }).notNull().default('editor'),
  active: bool('active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').notNull().default(now()),
});

export const sessions = sqliteTable(
  'sessions',
  {
    /** شناسهٔ تصادفی که در کوکی می‌نشیند */
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').notNull().default(now()),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

/* ============================================================
   رسانه
   ============================================================ */

export const media = sqliteTable('media', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** کلید فایل در فضای ذخیره‌سازی — از محتوای خود فایل ساخته می‌شود */
  key: text('key').notNull().unique(),
  /** آدرس قابل نمایش */
  url: text('url').notNull(),
  mime: text('mime').notNull(),
  /**
   * نام فایل هنگام آپلود.
   *
   * `key` از محتوای فایل ساخته می‌شود، پس با آن نمی‌شود تصویری را از روی
   * نامش پیدا کرد. این ستون همان کار را می‌کند: تنظیمات سایت (اسلایدر،
   * بنرها، حوزه‌ها) با نام فایل به تصویر ارجاع می‌دهند، نه با شناسه.
   */
  originalName: text('original_name'),
  width: integer('width'),
  height: integer('height'),
  bytes: integer('bytes').notNull().default(0),
  /**
   * متن جایگزین. برای سئو و دسترس‌پذیری هر دو لازم است، پس پنل هنگام آپلود
   * آن را اجباری می‌کند — ولی ستون nullable است تا رکوردهای واردشده از
   * گذشته بدون alt هم قابل ثبت باشند و در گزارش سلامت سئو دیده شوند.
   */
  alt: text('alt'),
  uploadedBy: integer('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').notNull().default(now()),
});

/* ============================================================
   محتوا
   ============================================================ */

/**
 * ستون‌های سئو که روی هر موجودیت محتوایی تکرار می‌شوند.
 *
 * به‌صورت تابع تعریف شده‌اند نه شیء ثابت، چون drizzle برای هر جدول نمونهٔ
 * جداگانه‌ای از ستون لازم دارد.
 */
const seoColumns = () => ({
  /** اگر خالی باشد، از عنوان خود رکورد ساخته می‌شود */
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  ogMediaId: integer('og_media_id'),
  /** فقط در موارد خاص پر می‌شود؛ در حالت عادی canonical خودکار است */
  canonicalOverride: text('canonical_override'),
  noindex: bool('noindex').notNull().default(false),
});

const contentColumns = () => ({
  published: bool('published').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(999),
  featured: bool('featured').notNull().default(false),
  createdAt: timestamp('created_at').notNull().default(now()),
  updatedAt: timestamp('updated_at').notNull().default(now()),
});

export const products = sqliteTable(
  'products',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    brand: text('brand').notNull(),
    /** مقدار مشخصهٔ اصلی، مثل «۳ – ۸٫۲» */
    spec: text('spec').notNull(),
    /** واحد و توضیح مشخصه، مثل «kW · تک‌فاز» */
    specUnit: text('spec_unit').notNull(),
    cat: text('cat', { enum: ['home', 'industrial'] }).notNull(),
    kind: text('kind', { enum: ['inverter', 'panel', 'storage', 'accessory'] }).notNull(),
    imageMediaId: integer('image_media_id'),
    /** توضیح بلند محصول (مارک‌داون) */
    body: text('body'),
    /* --- فاز فروش آنلاین: ساختار آماده است، هنوز استفاده نمی‌شود --- */
    price: integer('price'),
    sku: text('sku'),
    inStock: bool('in_stock'),
    ...contentColumns(),
    ...seoColumns(),
  },
  (t) => [uniqueIndex('products_slug_idx').on(t.slug), index('products_cat_idx').on(t.cat)],
);

export const projects = sqliteTable(
  'projects',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    slug: text('slug').notNull(),
    /** نام کارفرما */
    name: text('name').notNull(),
    capacity: text('capacity').notNull(),
    unit: text('unit').notNull(),
    tag: text('tag').notNull(),
    cat: text('cat', { enum: ['supply', 'build', 'invest'] }).notNull(),
    note: text('note'),
    imageMediaId: integer('image_media_id'),
    ...contentColumns(),
    ...seoColumns(),
  },
  (t) => [uniqueIndex('projects_slug_idx').on(t.slug)],
);

export const articles = sqliteTable(
  'articles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    category: text('category', { enum: ['edu', 'market', 'news'] }).notNull(),
    /** بدنهٔ مارک‌داون */
    body: text('body').notNull().default(''),
    /** تاریخ نمایشی شمسی، همان شکلی که در سایت دیده می‌شود */
    dateFa: text('date_fa').notNull(),
    /** همان تاریخ به میلادی، برای مرتب‌سازی و داده‌های ساختاریافته */
    publishedAt: timestamp('published_at'),
    readTime: integer('read_time').notNull().default(5),
    coverMediaId: integer('cover_media_id'),
    ...contentColumns(),
    ...seoColumns(),
  },
  (t) => [
    uniqueIndex('articles_slug_idx').on(t.slug),
    index('articles_published_idx').on(t.publishedAt),
  ],
);

/**
 * متن‌های ثابت سایت — منو، آمار، برندها، حوزه‌ها، شمارهٔ تماس.
 *
 * به‌جای یک جدول برای هر کدام، یک جدول کلید-مقدار با ستون JSON: این داده‌ها
 * شکل‌های خیلی متفاوتی دارند، به‌ندرت کوئری‌ای روی محتوایشان زده می‌شود و
 * همیشه یک‌جا خوانده می‌شوند. ساختن ده جدول برایشان پیچیدگی بی‌فایده بود.
 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }).notNull(),
  updatedAt: timestamp('updated_at').notNull().default(now()),
  updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
});

/* ============================================================
   لیدها
   ============================================================ */

export const leads = sqliteTable(
  'leads',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    /** همان چیزی که کاربر تایپ کرده */
    phone: text('phone').notNull(),
    /** شکل یکتا (`+989…`) برای تشخیص تکراری و جست‌وجو */
    phoneNormalized: text('phone_normalized'),
    capacity: text('capacity'),
    area: text('area'),
    /** راهی که کاربر برای تماس ترجیح داده (تماس تلفنی، بله، واتساپ) */
    contactVia: text('contact_via'),
    /** صفحه‌ای که فرم از آن ارسال شده */
    source: text('source'),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    /**
     * شناسهٔ بازدیدکننده‌ای که این فرم را فرستاد.
     *
     * همان کوکی اول‌شخصی که میدل‌ور می‌گذارد. کلید اتصال لید به مسیری است
     * که کاربر پیش از فرم طی کرده — بدون آن، «این مشتری از کجا آمد» فقط
     * حدس است.
     */
    visitorId: text('visitor_id'),
    /** کانال دسته‌بندی‌شدهٔ همین ارسال — آخرین برخورد */
    channel: text('channel'),
    /* --- اولین برخورد: از کجا این آدم اولین بار ما را شناخت --- */
    firstChannel: text('first_channel'),
    firstUtmSource: text('first_utm_source'),
    firstUtmMedium: text('first_utm_medium'),
    firstUtmCampaign: text('first_utm_campaign'),
    firstReferrer: text('first_referrer'),
    /** اولین صفحه‌ای که با آن وارد سایت شد */
    landingPage: text('landing_page'),
    status: text('status', { enum: ['new', 'contacted', 'won', 'lost'] })
      .notNull()
      .default('new'),
    assignedTo: integer('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    notes: text('notes'),
    /* --- پیگیری فروش --- */
    /**
     * زمان اولین تماس واقعی تیم فروش.
     *
     * جدا از `updatedAt` نگه داشته می‌شود چون «سرعت پاسخ» مهم‌ترین عددی
     * است که روی نرخ بستن قرارداد اثر می‌گذارد، و `updatedAt` با هر
     * ویرایش کوچکی عوض می‌شود.
     */
    firstContactAt: timestamp('first_contact_at'),
    /** قرار پیگیری بعدی — مبنای هشدار «امروز باید تماس بگیری» */
    nextFollowUpAt: timestamp('next_follow_up_at'),
    /** زمان بسته‌شدن (برنده یا بازنده) — مبنای محاسبهٔ طول چرخهٔ فروش */
    closedAt: timestamp('closed_at'),
    /** مبلغ قرارداد به تومان؛ فقط برای لیدهای برنده معنا دارد */
    dealValue: integer('deal_value'),
    /** ظرفیت قرارداد به کیلووات — واحدی که مدیریت با آن فکر می‌کند */
    capacityKw: integer('capacity_kw'),
    /** چرا از دست رفت: قیمت، زمان‌بندی، رقیب، … */
    lostReason: text('lost_reason'),
    /**
     * خلاصهٔ برآوردی که کاربر در ماشین‌حساب دیده بود.
     *
     * جدا از `notes` نگه داشته می‌شود و نه داخل آن: `notes` را تیم فروش
     * می‌نویسد و این را کاربر. اگر در یک ستون می‌ریختند، معلوم نبود کدام
     * جمله را چه کسی نوشته — و متنی که از بیرون می‌آید می‌توانست شبیه
     * یادداشت همکار به نظر برسد.
     */
    estimate: text('estimate'),
    createdAt: timestamp('created_at').notNull().default(now()),
    updatedAt: timestamp('updated_at').notNull().default(now()),
  },
  (t) => [
    // پنل همیشه بر اساس تاریخ مرتب می‌کند و اغلب بر اساس وضعیت فیلتر
    index('leads_created_idx').on(t.createdAt),
    index('leads_status_idx').on(t.status),
    index('leads_phone_idx').on(t.phoneNormalized),
    // صفحهٔ مسیر کاربر، لید را از روی شناسهٔ بازدیدکننده پیدا می‌کند
    index('leads_visitor_idx').on(t.visitorId),
    // هشدار پیگیری، هر بار قرارهای سررسیدشده را می‌خواند
    index('leads_followup_idx').on(t.nextFollowUpAt),
  ],
);

/* ============================================================
   صف پیام‌ها (Outbox)
   ============================================================ */

/**
 * پیام‌های بیرونی — فعلاً فقط ایمیل — اول اینجا ثبت می‌شوند و بعد یک worker
 * می‌فرستدشان.
 *
 * قبلاً ایمیل داخل خود درخواست فرستاده می‌شد: اگر SMTP از کار می‌افتاد،
 * لید با `emailed:false` می‌ماند و هیچ‌وقت دوباره تلاش نمی‌شد. حالا تلاش
 * مجدد با فاصلهٔ فزاینده انجام می‌شود و پاسخ فرم هم منتظر SMTP نمی‌ماند.
 */
export const outbox = sqliteTable(
  'outbox',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /**
     * `sms` و `webhook` هنوز فرستنده ندارند و ردیفشان در صف می‌ماند.
     * عمداً همین حالا در اسکیما هستند: اتوماسیون‌ها از امروز ردیف ثبت
     * می‌کنند و روزی که پنل پیامکی وصل شد، همان ردیف‌ها فرستاده می‌شوند
     * بدون این‌که چیزی در منطق اتوماسیون عوض شود.
     */
    kind: text('kind', { enum: ['email', 'sms', 'webhook'] }).notNull().default('email'),
    payload: text('payload', { mode: 'json' }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    /** قبل از این زمان تلاش نمی‌شود — مبنای backoff */
    nextAttemptAt: timestamp('next_attempt_at').notNull().default(now()),
    sentAt: timestamp('sent_at'),
    lastError: text('last_error'),
    createdAt: timestamp('created_at').notNull().default(now()),
  },
  (t) => [index('outbox_pending_idx').on(t.sentAt, t.nextAttemptAt)],
);

/* ============================================================
   ریدایرکت و گزارش تغییرات
   ============================================================ */

/**
 * ریدایرکت‌ها از پنل مدیریت می‌شوند، نه از فایل تنظیمات.
 *
 * دلیل اصلی: وقتی ویراستار نشانی (slug) یک مطلب را عوض می‌کند، باید همان
 * لحظه ریدایرکت ۳۰۱ از نشانی قبلی ساخته شود تا رتبهٔ گوگل و لینک‌های بیرونی
 * نشکنند. اگر این کار به کامیت و دیپلوی نیاز داشته باشد، در عمل انجام
 * نمی‌شود.
 */
export const redirects = sqliteTable(
  'redirects',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    fromPath: text('from_path').notNull(),
    toPath: text('to_path').notNull(),
    statusCode: integer('status_code').notNull().default(301),
    /** true یعنی خودکار هنگام تغییر slug ساخته شده، نه دستی */
    auto: bool('auto').notNull().default(false),
    hits: integer('hits').notNull().default(0),
    createdAt: timestamp('created_at').notNull().default(now()),
  },
  (t) => [uniqueIndex('redirects_from_idx').on(t.fromPath)],
);

/**
 * نشانی‌هایی که بازدیدکننده خواست و وجود نداشتند (۴۰۴).
 *
 * بعد از مهاجرت از وردپرس و با هر تغییر نشانی، پیوندهایی در گوگل و
 * سایت‌های دیگر می‌مانند که به صفحهٔ «پیدا نشد» می‌رسند. هر کدام یعنی
 * بازدیدکننده‌ای که از دست رفت و اعتبار پیوندی که هدر شد. این جدول نشان
 * می‌دهد کدام‌ها واقعاً بازدید دارند، تا برایشان ریدایرکت ساخته شود.
 */
export const notFound = sqliteTable(
  'not_found',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    path: text('path').notNull(),
    hits: integer('hits').notNull().default(1),
    /** آخرین صفحه‌ای که بازدیدکننده از آن آمد — معمولاً سرنخ پیوند شکسته */
    referrer: text('referrer'),
    firstSeen: timestamp('first_seen').notNull().default(now()),
    lastSeen: timestamp('last_seen').notNull().default(now()),
  },
  (t) => [uniqueIndex('not_found_path_idx').on(t.path), index('not_found_hits_idx').on(t.hits)],
);

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    /** نام جدول، مثل `products` */
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    action: text('action', { enum: ['create', 'update', 'delete', 'login'] }).notNull(),
    /** فقط فیلدهای تغییرکرده، به شکل { field: [قبل, بعد] } */
    diff: text('diff', { mode: 'json' }),
    createdAt: timestamp('created_at').notNull().default(now()),
  },
  (t) => [index('audit_entity_idx').on(t.entity, t.entityId)],
);

/* ============================================================
   رفتار بازدیدکننده
   ============================================================ */

/**
 * هر بازدیدکننده یک ردیف — ساخته‌شده از کوکی اول‌شخصی که میدل‌ور می‌گذارد.
 *
 * جدول رویدادها همهٔ حرکت‌ها را دارد، پس این جدول از نظر داده تکراری است.
 * دلیل بودنش دو چیز است: اول اینکه «اولین برخورد» باید دقیقاً یک بار و
 * برای همیشه ثبت شود (اگر از رویدادها استخراجش کنیم، با پاک‌شدن
 * رویدادهای قدیمی از بین می‌رود)، دوم اینکه صفحهٔ فروش باید بدون کوئری
 * سنگین روی میلیون‌ها رویداد بداند این آدم چند بار آمده.
 *
 * هیچ اطلاعات شخصی اینجا نیست؛ شناسه عددی تصادفی است و تا وقتی فرم پر
 * نشود به هیچ آدمی وصل نمی‌شود.
 */
export const visitors = sqliteTable(
  'visitors',
  {
    /** شناسهٔ تصادفی کوکی */
    id: text('id').primaryKey(),
    firstSeen: timestamp('first_seen').notNull().default(now()),
    lastSeen: timestamp('last_seen').notNull().default(now()),
    /* --- اولین برخورد؛ بعد از ثبت هرگز به‌روز نمی‌شود --- */
    firstChannel: text('first_channel'),
    firstUtmSource: text('first_utm_source'),
    firstUtmMedium: text('first_utm_medium'),
    firstUtmCampaign: text('first_utm_campaign'),
    firstReferrer: text('first_referrer'),
    firstLanding: text('first_landing'),
    /** آخرین کانالی که با آن برگشت */
    lastChannel: text('last_channel'),
    pageviews: integer('pageviews').notNull().default(0),
    sessions: integer('sessions').notNull().default(0),
    device: text('device', { enum: ['mobile', 'desktop', 'tablet'] }),
    /** تا وقتی فرم پر نشده خالی است؛ بعد از آن، پل بین رفتار و پروندهٔ فروش */
    leadId: integer('lead_id'),
  },
  (t) => [index('visitors_last_seen_idx').on(t.lastSeen), index('visitors_lead_idx').on(t.leadId)],
);

/**
 * رویدادها — ستون فقرات آنالیتیکس.
 *
 * بازدید صفحه سمت سرور در میدل‌ور ثبت می‌شود و نه با اسکریپت مرورگر:
 * افزونه‌های مسدودکنندهٔ تبلیغات نمی‌توانند جلویش را بگیرند، سرعت صفحه را
 * کم نمی‌کند، و به VPN داشتن یا نداشتن کاربر حساس نیست. فقط رویدادهایی
 * که سرور اصلاً نمی‌بیند (کلیک، اسکرول، مرحلهٔ ماشین‌حساب) از مرورگر
 * می‌آیند.
 *
 * ردیف‌های خام بعد از مدتی پاک می‌شوند و خلاصه‌شان در `daily_stats`
 * می‌ماند — وگرنه این جدول تنها چیزی می‌شد که بی‌انتها رشد می‌کند.
 */
export const events = sqliteTable(
  'events',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    createdAt: timestamp('created_at').notNull().default(now()),
    visitorId: text('visitor_id').notNull(),
    /** بازدیدهای پشت‌سرهم با فاصلهٔ کمتر از ۳۰ دقیقه، یک نشست‌اند */
    sessionId: text('session_id').notNull(),
    /** `pageview`، `calc_result`، `lead_submit`، … — فهرست در analytics/events.ts */
    type: text('type').notNull(),
    path: text('path'),
    referrer: text('referrer'),
    /** ارجاع‌دهنده و utm، دسته‌بندی‌شده به یک کانال خوانا */
    channel: text('channel'),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    device: text('device', { enum: ['mobile', 'desktop', 'tablet'] }),
    /** هر چیز مخصوص همان رویداد: ظرفیت محاسبه‌شده، عمق اسکرول، … */
    props: text('props', { mode: 'json' }),
  },
  (t) => [
    index('events_created_idx').on(t.createdAt),
    index('events_visitor_idx').on(t.visitorId, t.createdAt),
    index('events_type_idx').on(t.type, t.createdAt),
  ],
);

/**
 * خلاصهٔ روزانه.
 *
 * داشبورد نباید روی جدول خام رویدادها کوئری بزند: با گذشت زمان کند
 * می‌شود و بدتر از آن، بعد از پاک‌شدن ردیف‌های قدیمی دیگر تاریخچه‌ای
 * نمی‌ماند. یک جاب شبانه روز گذشته را جمع می‌بندد و اینجا می‌نویسد.
 *
 * ساختار عمداً عمومی است (سنجه + کلید + مقدار) نه یک ستون برای هر عدد،
 * چون سنجه‌های تازه مدام اضافه می‌شوند و هر کدام نباید مایگریشن بخواهد.
 */
export const dailyStats = sqliteTable(
  'daily_stats',
  {
    /** تاریخ میلادی به شکل YYYY-MM-DD — مرتب‌سازی متنی‌اش درست است */
    day: text('day').notNull(),
    /** `visits` · `pageviews` · `leads` · `channel` · `path` · `event` · `device` */
    metric: text('metric').notNull(),
    /** بعد سنجه: نام کانال، نشانی صفحه، نوع رویداد — یا `_` برای سنجهٔ تک‌مقداری */
    key: text('key').notNull().default('_'),
    value: integer('value').notNull().default(0),
  },
  (t) => [
    uniqueIndex('daily_stats_idx').on(t.day, t.metric, t.key),
    index('daily_stats_day_idx').on(t.day),
  ],
);

/* ============================================================
   پروندهٔ فروش
   ============================================================ */

/**
 * تاریخچهٔ هر لید — تماس‌ها، یادداشت‌ها، تغییر وضعیت.
 *
 * ستون `notes` روی خود لید یک متن است که با هر ویرایش قبلی را پاک می‌کند.
 * برای پیگیری فروش کافی نیست: باید معلوم باشد چه کسی، کِی، چه کرد و
 * نتیجه چه شد. این جدول همان دفترچهٔ پیگیری است و `notes` به «خلاصهٔ
 * فعلی پرونده» تبدیل می‌شود.
 *
 * تغییر وضعیت هم همین‌جا ثبت می‌شود و نه فقط در `audit_log`: آن یکی برای
 * ممیزی فنی است و تیم فروش نمی‌بیندش، این یکی بخشی از خط زمانی پرونده
 * است که کارشناس هر بار باز می‌کند.
 */
export const leadActivity = sqliteTable(
  'lead_activity',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    leadId: integer('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    /** کاربری که ثبتش کرده؛ خالی یعنی خود سیستم نوشته */
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    kind: text('kind', {
      enum: ['note', 'call', 'meeting', 'message', 'status', 'system'],
    })
      .notNull()
      .default('note'),
    body: text('body'),
    /** فقط برای kind = status */
    statusFrom: text('status_from'),
    statusTo: text('status_to'),
    createdAt: timestamp('created_at').notNull().default(now()),
  },
  (t) => [index('lead_activity_lead_idx').on(t.leadId, t.createdAt)],
);

/* ============================================================
   تایپ‌های استخراج‌شده
   ============================================================ */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Media = typeof media.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Article = typeof articles.$inferSelect;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type Redirect = typeof redirects.$inferSelect;
export type NotFound = typeof notFound.$inferSelect;
export type LeadStatus = Lead['status'];
export type Visitor = typeof visitors.$inferSelect;
export type AnalyticsEvent = typeof events.$inferSelect;
export type NewAnalyticsEvent = typeof events.$inferInsert;
export type LeadActivity = typeof leadActivity.$inferSelect;
export type ActivityKind = LeadActivity['kind'];

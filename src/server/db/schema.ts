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
    status: text('status', { enum: ['new', 'contacted', 'won', 'lost'] })
      .notNull()
      .default('new'),
    assignedTo: integer('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    notes: text('notes'),
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
    kind: text('kind', { enum: ['email'] }).notNull().default('email'),
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

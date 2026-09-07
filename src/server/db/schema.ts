import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * ساختار دیتابیس — منبع حقیقت.
 *
 * تایپ‌های TypeScript از همین‌جا استخراج می‌شوند، پس اگر ستونی عوض شود،
 * هر جای کد که با آن کار می‌کند در زمان کامپایل خطا می‌دهد نه در زمان اجرا.
 *
 * قرارداد نام‌گذاری: نام ستون‌ها snake_case (رسم Postgres) و نام فیلدها در
 * کد camelCase (رسم TypeScript).
 */

/* ============================================================
   کاربران و ورود
   ============================================================ */

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  /** هش argon2 — رمز خام هرگز ذخیره نمی‌شود */
  passwordHash: text('password_hash').notNull(),
  /** admin: همه‌چیز · editor: محتوا · sales: فقط لیدها */
  role: text('role', { enum: ['admin', 'editor', 'sales'] }).notNull().default('editor'),
  active: boolean('active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  'sessions',
  {
    /** شناسهٔ تصادفی که در کوکی می‌نشیند */
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

/* ============================================================
   رسانه
   ============================================================ */

export const media = pgTable('media', {
  id: serial('id').primaryKey(),
  /** کلید فایل در فضای ذخیره‌سازی */
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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
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
  noindex: boolean('noindex').notNull().default(false),
});

const contentColumns = () => ({
  published: boolean('published').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(999),
  featured: boolean('featured').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable(
  'products',
  {
    id: serial('id').primaryKey(),
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
    inStock: boolean('in_stock'),
    ...contentColumns(),
    ...seoColumns(),
  },
  (t) => [
    uniqueIndex('products_slug_idx').on(t.slug),
    index('products_cat_idx').on(t.cat),
  ],
);

export const projects = pgTable(
  'projects',
  {
    id: serial('id').primaryKey(),
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

export const articles = pgTable(
  'articles',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    category: text('category', { enum: ['edu', 'market', 'news'] }).notNull(),
    /** بدنهٔ مارک‌داون */
    body: text('body').notNull().default(''),
    /** تاریخ نمایشی شمسی، همان شکلی که در سایت دیده می‌شود */
    dateFa: text('date_fa').notNull(),
    /** همان تاریخ به میلادی، برای مرتب‌سازی و داده‌های ساختاریافته */
    publishedAt: timestamp('published_at', { withTimezone: true }),
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
 * به‌جای یک جدول برای هر کدام، یک جدول کلید-مقدار با ستون jsonb: این داده‌ها
 * شکل‌های خیلی متفاوتی دارند، به‌ندرت کوئری‌ای روی محتوایشان زده می‌شود و
 * همیشه یک‌جا خوانده می‌شوند. ساختن ده جدول برایشان پیچیدگی بی‌فایده بود.
 */
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: integer('updated_by').references(() => users.id, { onDelete: 'set null' }),
});

/* ============================================================
   لیدها
   ============================================================ */

export const leads = pgTable(
  'leads',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull(),
    /** همان چیزی که کاربر تایپ کرده */
    phone: text('phone').notNull(),
    /** شکل یکتا (`+989…`) برای تشخیص تکراری و جست‌وجو */
    phoneNormalized: text('phone_normalized'),
    capacity: text('capacity'),
    area: text('area'),
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
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
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
export const outbox = pgTable(
  'outbox',
  {
    id: serial('id').primaryKey(),
    kind: text('kind', { enum: ['email'] }).notNull().default('email'),
    payload: jsonb('payload').notNull(),
    attempts: integer('attempts').notNull().default(0),
    /** قبل از این زمان تلاش نمی‌شود — مبنای backoff */
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
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
export const redirects = pgTable(
  'redirects',
  {
    id: serial('id').primaryKey(),
    fromPath: text('from_path').notNull(),
    toPath: text('to_path').notNull(),
    statusCode: integer('status_code').notNull().default(301),
    /** true یعنی خودکار هنگام تغییر slug ساخته شده، نه دستی */
    auto: boolean('auto').notNull().default(false),
    hits: integer('hits').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('redirects_from_idx').on(t.fromPath)],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
    /** نام جدول، مثل `products` */
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    action: text('action', { enum: ['create', 'update', 'delete', 'login'] }).notNull(),
    /** فقط فیلدهای تغییرکرده، به شکل { field: [قبل, بعد] } */
    diff: jsonb('diff'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
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
export type LeadStatus = Lead['status'];

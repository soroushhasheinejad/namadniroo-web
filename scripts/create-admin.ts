/**
 * ساخت یا به‌روزرسانی کاربر پنل.
 *
 *   npm run db:admin -- ali@namadniroo.ir "علی رضایی" admin
 *
 * اگر رمز داده نشود، یک رمز تصادفی ساخته و یک بار چاپ می‌شود. اگر ایمیل از
 * قبل باشد، رمزش عوض می‌شود — همان مسیر بازیابی رمز فراموش‌شده.
 */
import { eq } from 'drizzle-orm';
import { getDb } from '../src/server/db/client';
import { users } from '../src/server/db/schema';
import { hashPassword, suggestPassword } from '../src/server/auth/password';

/* نقش و رمز از انتها برداشته می‌شوند و هرچه می‌ماند نام است.
   دلیلش این است که نام معمولاً چند کلمه است و وقتی این اسکریپت از راه دور
   اجرا می‌شود (`liara shell`) نقل‌قول‌ها به‌درستی عبور نمی‌کنند و نام تکه
   می‌شود. این‌طور دیگر به نقل‌قول وابسته نیست. */
const argv = process.argv.slice(2);
const email = argv.shift();

const ROLES = ['admin', 'editor', 'sales'] as const;

let password: string | undefined;
let role = 'admin';

// آخرین آرگومان اگر نقش نبود، رمز است
if (argv.length > 1 && !ROLES.includes(argv.at(-1) as never)) password = argv.pop();
if (argv.length > 1 && ROLES.includes(argv.at(-1) as never)) role = argv.pop()!;

const name = argv.join(' ').trim();

if (!email || !name) {
  console.error('استفاده: npm run db:admin -- <ایمیل> "<نام>" [admin|editor|sales] [رمز]');
  process.exit(1);
}

if (!ROLES.includes(role as never)) {
  console.error(`نقش نامعتبر: ${role} — یکی از admin، editor یا sales`);
  process.exit(1);
}

const plain = password || suggestPassword();

const db = await getDb();
const passwordHash = await hashPassword(plain);

const [existing] = await db
  .select({ id: users.id })
  .from(users)
  .where(eq(users.email, email.toLowerCase()))
  .limit(1);

if (existing) {
  await db
    .update(users)
    .set({ name, role: role as 'admin', passwordHash, active: true })
    .where(eq(users.id, existing.id));
  console.log(`کاربر «${email}» به‌روز شد.`);
} else {
  await db.insert(users).values({
    email: email.toLowerCase(),
    name,
    role: role as 'admin',
    passwordHash,
  });
  console.log(`کاربر «${email}» ساخته شد.`);
}

if (!password) {
  console.log(`\nرمز عبور: ${plain}`);
  console.log('این رمز فقط همین یک بار نمایش داده می‌شود — جایی امن ذخیره‌اش کنید.\n');
}

process.exit(0);

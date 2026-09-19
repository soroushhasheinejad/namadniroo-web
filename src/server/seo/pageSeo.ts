import { mediaIndex, urlFrom } from '../media/resolve';

/**
 * سئوی ذخیره‌شدهٔ یک صفحه → ویژگی‌هایی که `Base` می‌پذیرد.
 *
 * توضیح یا تصویر خالی `undefined` می‌شود نه رشتهٔ خالی، تا `Base` سراغ
 * پیش‌فرض‌های «تنظیمات سئو» برود — وگرنه صفحه با توضیح خالی منتشر می‌شد.
 */
export interface PageSeo {
  title: string;
  description: string;
  image: string;
  noindex: boolean;
}

export async function seoProps(seo: PageSeo) {
  const index = seo.image ? await mediaIndex().catch(() => new Map()) : new Map();
  return {
    title: seo.title,
    description: seo.description || undefined,
    image: urlFrom(index, seo.image) ?? undefined,
    noindex: seo.noindex,
  };
}

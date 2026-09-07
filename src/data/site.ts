import activity1 from '../assets/activity-1.jpg';
import activity2 from '../assets/activity-2.jpg';
import activity3 from '../assets/activity-3.jpg';
import banner1 from '../assets/banner-1.jpg';
import banner2 from '../assets/banner-2.jpg';
import area1 from '../assets/area-1.jpg';
import area2 from '../assets/area-2.jpg';
import area3 from '../assets/area-3.jpg';
import * as content from './siteContent';

/**
 * متن‌های ثابت سایت به‌همراه تصاویرشان.
 *
 * خودِ متن‌ها در `siteContent.ts` هستند و اینجا فقط تصویر به آن‌ها اضافه
 * می‌شود. علت این جدایی: تصاویر با `import` وارد می‌شوند تا Astro بتواند
 * بهینه‌شان کند، و چنین فایلی را فقط باندلر می‌فهمد — در حالی که
 * اسکریپت‌های خط فرمان هم باید به همین متن‌ها دسترسی داشته باشند.
 *
 * صفحات همچنان همه‌چیز را از همین فایل می‌گیرند؛ چیزی برایشان عوض نشده.
 */

export const {
  site,
  portfolio,
  nav,
  stats,
  timeline,
  capabilities,
  brands,
  clients,
  filters,
  categoryLabel,
} = content;

/* اسلایدر صفحهٔ اصلی — پوسترها متن روی خودشان دارند */
export const heroSlides = [
  { img: activity1, ...content.heroSlides[0] },
  { img: activity2, ...content.heroSlides[1] },
  { img: activity3, ...content.heroSlides[2] },
] as const;

export const promoSlides = [
  { img: banner1, ...content.promoSlides[0] },
  { img: banner2, ...content.promoSlides[1] },
];

const areaImages = [area1, area2, area3];

export const areas = content.areas.map((a, i) => ({ ...a, image: areaImages[i]! }));

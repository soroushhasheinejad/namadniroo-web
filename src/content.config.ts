import { defineCollection, z } from 'astro:content';
import { file, glob } from 'astro/loaders';

/* پروژه‌ها — از فایل داده‌ای JSON */
const projects = defineCollection({
  loader: file('src/data/projects.json'),
  schema: z.object({
    name: z.string(),
    capacity: z.string(),
    unit: z.string(),
    tag: z.string(),
    cat: z.enum(['supply', 'build', 'invest']),
    note: z.string().optional(),
    image: z.string().optional(),
    featured: z.boolean().default(false),
    order: z.number().default(999),
  }),
});

/* محصولات — لیدجن امروز، آمادهٔ افزودن سبد خرید در آینده */
const products = defineCollection({
  loader: file('src/data/products.json'),
  schema: z.object({
    name: z.string(),
    brand: z.string(),
    spec: z.string(),
    specUnit: z.string(),
    cat: z.enum(['home', 'industrial']),
    kind: z.enum(['inverter', 'panel', 'storage', 'accessory']),
    image: z.string().optional(),
    featured: z.boolean().default(false),
    order: z.number().default(999),
    // ---- برای فاز فروش آنلاین (فعلاً استفاده نمی‌شود) ----
    price: z.number().optional(),
    sku: z.string().optional(),
    inStock: z.boolean().optional(),
  }),
});

/* مقالات مجله — مارک‌داون */
const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    category: z.enum(['edu', 'market', 'news']),
    date: z.string(),
    readTime: z.number().default(5),
    cover: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { projects, products, articles };

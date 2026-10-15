import { SUBKINDS_BY_KIND, SUBKIND_LABEL } from './shopTaxonomy';

/** گزینه‌های فرم محصول در پنل، از همان تعریف‌های ساختار فروشگاه */
const KIND_LABEL = { inverter: 'اینورتر', panel: 'پنل', storage: 'ذخیره‌ساز', accessory: 'جانبی' } as const;

export const KIND_FIELDS = {
  groups: (Object.keys(SUBKINDS_BY_KIND) as (keyof typeof SUBKINDS_BY_KIND)[]).map((k) => ({
    label: KIND_LABEL[k],
    options: SUBKINDS_BY_KIND[k].map((v) => ({ value: v, label: SUBKIND_LABEL[v] ?? v })),
  })),
  subkinds: Object.values(SUBKINDS_BY_KIND).flat(),
};

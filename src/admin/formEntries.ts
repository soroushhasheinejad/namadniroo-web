import { type Field, childName, rowName } from './fields';

/**
 * همان کاری که مرورگر با فرمی که FieldView ساخته می‌کند: هر مقدار را در
 * فیلد متناظرش می‌گذارد، به همان ترتیبی که روی صفحه ظاهر می‌شوند.
 *
 * برای تست‌هاست — تا بشود بررسی کرد که «باز کردن فرم و ذخیره بدون تغییر»
 * چیزی را عوض نمی‌کند، بی‌آن‌که سرور و مرورگر لازم باشد.
 */
export function toEntries(field: Field, value: unknown, name: string, out: [string, string][] = []): [string, string][] {
  const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});
  switch (field.kind) {
    case 'text':
    case 'textarea':
    case 'select':
    case 'image':
      out.push([name, value == null ? '' : String(value)]);
      break;
    case 'lines':
      out.push([name, Array.isArray(value) ? value.join('\n') : '']);
      break;
    case 'checkbox':
      if (value === true) out.push([name, '1']);
      break;
    case 'group':
      for (const f of field.fields) toEntries(f, obj(value)[f.key], childName(name, f.key), out);
      break;
    case 'list':
      (Array.isArray(value) ? value : []).forEach((row, i) => {
        for (const f of field.item) toEntries(f, obj(row)[f.key], childName(rowName(name, `r${i}`), f.key), out);
      });
      break;
  }
  return out;
}

/** مقدار خالی، null و نبود یکی حساب می‌شوند — روی سایت هر سه یعنی «ندارد» */
export function comparable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(comparable);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === '' || v === false || v === undefined || v === null) continue;
      out[k] = comparable(v);
    }
    return out;
  }
  return value;
}

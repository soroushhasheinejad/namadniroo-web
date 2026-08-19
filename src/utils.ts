/** تبدیل ارقام لاتین به فارسی */
export const fa = (v: string | number): string =>
  String(v).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

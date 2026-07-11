// تطبيع رقم الجوال بأي صيغة إلى الصيغة القياسية 05XXXXXXXX:
// يقبل الأرقام العربية/الفارسية (٠٥٥…)، والمسافات والشرطات والأقواس،
// و+966 / 00966 / 966 / 5XXXXXXXX — كلها تؤول لصيغةٍ واحدة موحّدة.
export function normalizePhone(input: unknown): string {
  let s = String(input ?? '');
  // الأرقام العربية والفارسية → لاتينية
  const AR = '٠١٢٣٤٥٦٧٨٩', FA = '۰۱۲۳۴۵۶۷۸۹';
  s = s.replace(/[٠-٩۰-۹]/g, (ch) => {
    const i = AR.indexOf(ch); if (i >= 0) return String(i);
    const j = FA.indexOf(ch); return j >= 0 ? String(j) : ch;
  });
  s = s.replace(/\D/g, '');
  if (s.startsWith('00966')) s = s.slice(5);
  else if (s.startsWith('966')) s = s.slice(3);
  if (s.length === 9 && s.startsWith('5')) s = '0' + s;
  return s;
}

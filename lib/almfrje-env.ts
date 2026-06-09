// =============================================================================
//  إعداد بيئة تطبيق «المفرجي» (شجرة النسب) — مصدرٌ واحدٌ معزول.
// =============================================================================
//  يخصّ المفرجي وحده. لا تستورده مسارات الاستشارات (lib/db.ts) ولا مراح.
//  الهدف: جعل هدف قاعدة بيانات المفرجي صريحاً في مكانٍ واحد، فلا يُربط
//  التطبيق بقاعدة تطبيقٍ آخر بالخطأ، وتُمنع نقاط التداخل المتفرّقة مستقبلاً.
//
//  يُفضّل متغيّرات ALMFRJE_* الخاصة، ويرجع للمشتركة NEXT_PUBLIC_*/SERVICE_ROLE
//  فقط حين لا تُضبط الخاصة (وضعٌ انتقالي). للعزل التام اضبط ALMFRJE_* وأفرغ
//  المشتركة — راجع SEPARATION.md.
// =============================================================================

export interface AlmfrjeEnv {
  url?: string;
  anon?: string;
  service?: string;
  pat?: string;
  /** true حين يعمل التطبيق على قاعدته الخاصة بالكامل (بلا رجوعٍ للمشتركة). */
  isolated: boolean;
}

export function almfrjeEnv(): AlmfrjeEnv {
  const ownUrl = process.env.ALMFRJE_SUPABASE_URL;
  const ownAnon = process.env.ALMFRJE_SUPABASE_ANON_KEY;
  const ownService = process.env.ALMFRJE_SERVICE_ROLE_KEY;
  const ownPat = process.env.ALMFRJE_SUPABASE_PAT;

  const url = ownUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = ownAnon || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = ownService || process.env.SUPABASE_SERVICE_ROLE_KEY;
  // الـPAT يخصّ قاعدة المفرجي وحدها (بلا رجوع للمشتركة) — عزلٌ صارم لإنشاء المخطط.
  const pat = ownPat || process.env.SUPABASE_PAT;

  const isolated = !!(ownUrl && ownAnon && ownService);
  return { url, anon, service, pat, isolated };
}

/** true حين تتوفّر القيم الثلاث اللازمة لتشغيل مسارات الخادم. */
export function almfrjeEnvOk(e: AlmfrjeEnv = almfrjeEnv()): boolean {
  return !!(e.url && e.anon && e.service);
}

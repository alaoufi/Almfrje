// =============================================================================
//  إعداد بيئة تطبيق «مراح» (mrahi) — مصدرٌ واحدٌ معزول.
// =============================================================================
//  يخصّ مراح وحده. لا تستورده مسارات المفرجي ولا الاستشارات ولا notes.
//  مراح ويب يعمل بمفتاح anon + RLS فقط (لا مفتاح خدمي على الويب).
//  يُفضّل متغيّرات MRAHI_* الخاصة، ويرجع للمشتركة فقط حين لا تُضبط — راجع SEPARATION.md.
// =============================================================================

export interface MrahiEnv {
  url?: string;
  anon?: string;
  /** true حين يعمل على قاعدته الخاصة بالكامل (بلا رجوعٍ للمشتركة). */
  isolated: boolean;
}

export function mrahiEnv(): MrahiEnv {
  const ownUrl = process.env.MRAHI_SUPABASE_URL;
  const ownAnon = process.env.MRAHI_SUPABASE_ANON_KEY;
  const url = ownUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = ownAnon || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return { url, anon, isolated: !!(ownUrl && ownAnon) };
}

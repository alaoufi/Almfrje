// =============================================================================
//  إعداد بيئة تطبيق «notes» (alaoufi.me/notes) — مصدرٌ واحدٌ معزول.
// =============================================================================
//  يخصّ notes وحده. لا تستورده مسارات المفرجي/الاستشارات/مراح.
//  يُفضّل متغيّرات NOTES_* الخاصة، ويرجع للمشتركة فقط حين لا تُضبط — راجع SEPARATION.md.
//  ملاحظة: notes هيكلٌ مبدئي معزول؛ يُبنى عليه لاحقاً دون مساس بالمشاريع الأخرى.
// =============================================================================

export interface NotesEnv {
  url?: string;
  anon?: string;
  service?: string;
  /** true حين يعمل على قاعدته الخاصة بالكامل (بلا رجوعٍ للمشتركة). */
  isolated: boolean;
}

export function notesEnv(): NotesEnv {
  const ownUrl = process.env.NOTES_SUPABASE_URL;
  const ownAnon = process.env.NOTES_SUPABASE_ANON_KEY;
  const ownService = process.env.NOTES_SERVICE_ROLE_KEY;
  const url = ownUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = ownAnon || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = ownService || process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, anon, service, isolated: !!(ownUrl && ownAnon && ownService) };
}

// تطبيق notes — هيكلٌ مبدئي معزول. يُبنى عليه لاحقاً دون مساس بالمشاريع الأخرى.
// الإعداد يأتي من window.NOTES_CONFIG (config.js الثابت ثم تجاوز /api/notes-config).
(function () {
  'use strict';
  var cfg = window.NOTES_CONFIG || { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' };
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    // لا إعداد بعد — التطبيق هيكلٌ فارغ حتى تُضبط متغيّرات NOTES_* في النشر.
    return;
  }
  // نقطة البناء المستقبلي لتطبيق الملاحظات (Supabase + RLS بقاعدته الخاصة).
})();

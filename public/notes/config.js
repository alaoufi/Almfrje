// إعداد احتياطي ثابت لتطبيق notes — يُستبدل عند توفّر متغيّرات البيئة عبر /api/notes-config.
// اتركه فارغاً حتى تُضبط NOTES_SUPABASE_URL / NOTES_SUPABASE_ANON_KEY في النشر.
window.NOTES_CONFIG = window.NOTES_CONFIG || { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' };

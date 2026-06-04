-- ============================================================
--  حماية مشاركة القاعدة: تفعيل RLS على كل جداول المخطط public
-- ------------------------------------------------------------
--  لماذا؟ تطبيق mrahi يعمل في المتصفّح بمفتاح anon العلني.
--  أي جدول بلا RLS في نفس المشروع يصبح مكشوفاً عبر REST API لأي
--  شخص يملك المفتاح. تفعيل RLS (بدون سياسات) يمنع anon تماماً،
--  بينما الخادم (service_role) يتخطّى RLS فتستمر منصة alaoufi.me
--  بالعمل دون أي تغيير.
--
--  نفّذه مرة واحدة في: Supabase → SQL Editor → Run
--  آمن للتكرار، ولا يحذف ولا يعدّل أي بيانات.
-- ============================================================

do $$
declare
  r record;
begin
  for r in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security;', r.tablename);
  end loop;
end $$;

-- تحقق (اختياري): يجب أن تكون rowsecurity = true لكل الجداول
-- select tablename, rowsecurity from pg_tables where schemaname='public' order by tablename;

-- ملاحظة:
--  • جداول mrahi_* لديها سياساتها الخاصة (من schema.sql) فتعمل عادي.
--  • جداول منصة alaoufi.me القديمة ستصبح محميّة من anon،
--    والخادم يصل لها عبر service_role كالمعتاد.

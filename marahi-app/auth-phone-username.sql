-- ============================================================
--  ترقية الدخول: جوال + اسم مستخدم + رقم سري (٤ خانات) بلا بريد
--  نفّذ هذا الملف في: Supabase → SQL Editor → Run
--  (آمن للتكرار — لا يحذف أي بيانات موجودة)
-- ============================================================

-- 1) أعمدة الجوال واسم المستخدم على جدول الأعضاء
alter table public.mrahi_members add column if not exists username text;
alter table public.mrahi_members add column if not exists phone    text;

create unique index if not exists mrahi_members_phone_key
  on public.mrahi_members (phone) where phone is not null and phone <> '';
create unique index if not exists mrahi_members_username_key
  on public.mrahi_members (lower(username)) where username is not null and username <> '';

-- 2) تحديث مُشغّل إنشاء العضو ليحفظ الجوال واسم المستخدم من بيانات التسجيل
create or replace function public.mrahi_handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  insert into public.mrahi_members (user_id, full_name, username, phone, role, is_active, perms)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', ''),
          nullif(new.raw_user_meta_data->>'username', ''),
          nullif(new.raw_user_meta_data->>'phone', ''),
          'member', false, '{}'::jsonb)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- 3) دالة تحويل (الجوال أو اسم المستخدم) إلى البريد الداخلي للدخول
create or replace function public.mrahi_resolve_login(ident text) returns text
  language sql stable security definer set search_path = public, auth as $$
  select u.email
    from public.mrahi_members m
    join auth.users u on u.id = m.user_id
   where m.phone = ident or lower(m.username) = lower(ident)
   order by (m.phone = ident) desc
   limit 1;
$$;
revoke all on function public.mrahi_resolve_login(text) from public;
grant execute on function public.mrahi_resolve_login(text) to anon, authenticated;

-- ============================================================
--  مهم — في Supabase → Authentication → Sign In / Providers → Email:
--  أوقِف خيار «Confirm email» (تأكيد البريد) حتى يعمل الدخول فوراً
--  بعد التسجيل (لأن البريد الداخلي وهمي ولا يصله رابط تأكيد).
-- ============================================================

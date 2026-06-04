-- ============================================================
--  المفرجة (almfrje) — نظام شجرة الأنساب وإدارة الفروع
--  مخطط قاعدة البيانات والصلاحيات (Supabase / Postgres)
--  جداول معزولة ببادئة almfrje_ ليسهل فصلها/نقلها لاحقاً.
--  نفّذ هذا الملف كاملاً في: Supabase → SQL Editor → Run
-- ============================================================

create extension if not exists pg_trgm;   -- بحث نصي سريع (اختياري لكنه مفيد)

-- ============================================================
-- 1) الفروع
--    كل فرع يبدأ من شخص (جذر الفرع) وله مسؤول مستقل (عضو).
-- ============================================================
create table if not exists public.almfrje_branches (
  id          bigint generated always as identity primary key,
  name        text not null,
  root_id     bigint,                 -- جذر الفرع (شخص) — يُربط لاحقاً بعد إنشاء الأشخاص
  manager_id  uuid references auth.users(id) on delete set null,  -- مسؤول الفرع
  notes       text default '',
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 2) الأعضاء والصلاحيات
--    الأدوار: admin (مدير) / branch_manager (مسؤول فرع) / viewer (زائر)
--    مسؤول الفرع يُربط بفرع واحد (branch_id) ويرى/يدير فرعه فقط.
-- ============================================================
create table if not exists public.almfrje_members (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  full_name  text,
  username   text,
  phone      text,
  role       text not null default 'viewer' check (role in ('admin','branch_manager','viewer')),
  branch_id  bigint references public.almfrje_branches(id) on delete set null,
  is_active  boolean not null default false,
  -- صلاحيات إضافية للزائر: { "add":false, "edit":false, "export":true }
  perms      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists almfrje_members_phone_key
  on public.almfrje_members (phone) where phone is not null and phone <> '';
create unique index if not exists almfrje_members_username_key
  on public.almfrje_members (lower(username)) where username is not null and username <> '';

-- ============================================================
-- 3) الأشخاص (الشجرة)
--    father_id = الأب المباشر (NULL للأصل). generation = الجيل (1 للأصل).
--    branch_id = الفرع الرئيسي (يُحسب آلياً: فرع الجدّ من الجيل الثاني).
-- ============================================================
create table if not exists public.almfrje_persons (
  id          bigint generated always as identity primary key,
  name        text not null,
  father_id   bigint references public.almfrje_persons(id) on delete set null,
  branch_id   bigint references public.almfrje_branches(id) on delete set null,
  generation  int  not null default 1,
  sex         text not null default 'male' check (sex in ('male','female')),
  status      text not null default 'alive' check (status in ('alive','dead')),
  birth       text default '',          -- سنة/تاريخ الميلاد (نص مرن: 1380هـ، 1960م، ...)
  death       text default '',          -- سنة/تاريخ الوفاة
  phone       text default '',
  email       text default '',
  city        text default '',
  photo_url   text default '',
  notes       text default '',
  sort        int  not null default 0,  -- ترتيب بين الإخوة
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid()
);
create index if not exists almfrje_persons_father_idx on public.almfrje_persons(father_id);
create index if not exists almfrje_persons_branch_idx on public.almfrje_persons(branch_id);
create index if not exists almfrje_persons_gen_idx    on public.almfrje_persons(generation);
create index if not exists almfrje_persons_name_trgm  on public.almfrje_persons using gin (name gin_trgm_ops);

-- ربط جذر الفرع بالأشخاص (بعد إنشاء الجدول)
do $$ begin
  alter table public.almfrje_branches
    add constraint almfrje_branches_root_fk
    foreign key (root_id) references public.almfrje_persons(id) on delete set null;
exception when duplicate_object then null; end $$;

-- ============================================================
-- 4) الوثائق والصور لكل شخص
-- ============================================================
create table if not exists public.almfrje_documents (
  id          bigint generated always as identity primary key,
  person_id   bigint not null references public.almfrje_persons(id) on delete cascade,
  kind        text not null default 'doc' check (kind in ('photo','pdf','doc')),
  url         text not null,
  label       text default '',
  created_at  timestamptz not null default now(),
  created_by  uuid default auth.uid()
);
create index if not exists almfrje_documents_person_idx on public.almfrje_documents(person_id);

-- ============================================================
-- 5) الإعدادات (مفتاح/قيمة) — مثل signup_open و imported
-- ============================================================
create table if not exists public.almfrje_settings (
  key        text primary key,
  value      jsonb,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 6) سلة المحذوفات (تراجع عن الحذف/التعديل)
-- ============================================================
create table if not exists public.almfrje_trash (
  id         bigint generated always as identity primary key,
  tbl        text not null,
  rec_id     bigint,
  action     text not null,          -- delete | edit
  label      text default '',
  data       jsonb not null,
  actor      uuid default auth.uid(),
  actor_name text default '',
  created_at timestamptz not null default now()
);

-- ============================================================
-- 7) دوال الصلاحية (SECURITY DEFINER لتفادي التكرار في RLS)
-- ============================================================
create or replace function public.almfrje_role() returns text
  language sql stable security definer set search_path = public as $$
  select role from public.almfrje_members where user_id = auth.uid() and is_active;
$$;

create or replace function public.almfrje_is_member() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.almfrje_members where user_id = auth.uid() and is_active);
$$;

create or replace function public.almfrje_is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.almfrje_members
                 where user_id = auth.uid() and is_active and role = 'admin');
$$;

-- فرع العضو الحالي (NULL = يرى كل الفروع: مدير/زائر)
create or replace function public.almfrje_my_branch() returns bigint
  language sql stable security definer set search_path = public as $$
  select branch_id from public.almfrje_members
   where user_id = auth.uid() and is_active limit 1;
$$;

-- صلاحية إضافية للزائر (add/edit/export)
create or replace function public.almfrje_perm(act text) returns boolean
  language sql stable security definer set search_path = public as $$
  select public.almfrje_is_admin() or exists (
    select 1 from public.almfrje_members
     where user_id = auth.uid() and is_active
       and coalesce((perms ->> act)::boolean, false)
  );
$$;

-- هل يرى العضو الحالي هذا الشخص؟ (المدير يرى الكل، المسؤول فرعه + الجذع، الزائر الكل)
create or replace function public.almfrje_can_see_person(pid bigint) returns boolean
  language sql stable security definer set search_path = public as $$
  select public.almfrje_is_admin() or (
    public.almfrje_is_member() and exists (
      select 1 from public.almfrje_persons p
       where p.id = pid
         and (public.almfrje_my_branch() is null
              or p.branch_id = public.almfrje_my_branch()
              or p.branch_id is null)
    )
  );
$$;

-- هل يعدّل العضو الحالي هذا الشخص؟ (المدير الكل، المسؤول فرعه فقط)
create or replace function public.almfrje_can_edit_person(pid bigint) returns boolean
  language sql stable security definer set search_path = public as $$
  select public.almfrje_is_admin() or (
    public.almfrje_role() = 'branch_manager' and exists (
      select 1 from public.almfrje_persons p
       where p.id = pid and p.branch_id = public.almfrje_my_branch()
    )
  );
$$;

-- أبناء/ذرية شخص (recursive) — للتقارير والإحصاءات على الخادم عند الحاجة
create or replace function public.almfrje_descendant_ids(root bigint) returns table(id bigint)
  language sql stable as $$
  with recursive d as (
    select p.id from public.almfrje_persons p where p.father_id = root
    union all
    select c.id from public.almfrje_persons c join d on c.father_id = d.id
  ) select id from d;
$$;

-- ============================================================
-- 8) إنشاء صف عضو تلقائياً عند تسجيل مستخدم جديد
-- ============================================================
-- أوّل مَن يسجّل يصبح مديراً مفعّلاً تلقائياً (بلا تدخّل يدوي)، والبقية زوّار موقوفون.
create or replace function public.almfrje_handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare _first boolean;
begin
  select not exists (select 1 from public.almfrje_members) into _first;
  insert into public.almfrje_members (user_id, full_name, username, phone, role, is_active, perms)
  values (new.id,
          coalesce(new.raw_user_meta_data->>'full_name', ''),
          nullif(new.raw_user_meta_data->>'username', ''),
          nullif(new.raw_user_meta_data->>'phone', ''),
          case when _first then 'admin' else 'viewer' end,
          _first, '{}'::jsonb)
  on conflict (user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_almfrje on auth.users;
create trigger on_auth_user_created_almfrje
  after insert on auth.users
  for each row execute function public.almfrje_handle_new_user();

-- استرجاع بريد الدخول من الجوال أو اسم المستخدم (قبل المصادقة)
create or replace function public.almfrje_resolve_login(ident text) returns text
  language sql stable security definer set search_path = public, auth as $$
  select u.email
    from public.almfrje_members m
    join auth.users u on u.id = m.user_id
   where m.phone = ident or lower(m.username) = lower(ident)
   order by (m.phone = ident) desc
   limit 1;
$$;
revoke all on function public.almfrje_resolve_login(text) from public;
grant execute on function public.almfrje_resolve_login(text) to anon, authenticated;

-- تبنّي صلاحية المدير: أوّل مستخدم يطلبها يصبح مديراً ما لم يوجد مديرٌ مفعّل بعد.
-- يعالج «بانتظار التفعيل» للمستخدم الأول، وآمن لأنه يرفض الترقية فور وجود مدير.
create or replace function public.almfrje_claim_admin() returns text
  language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid(); _has_admin boolean;
begin
  if _uid is null then return 'unauthenticated'; end if;
  select exists (select 1 from public.almfrje_members where is_active and role = 'admin') into _has_admin;
  if _has_admin then return 'exists'; end if;
  insert into public.almfrje_members (user_id, role, is_active, perms)
    values (_uid, 'admin', true, '{}'::jsonb)
    on conflict (user_id) do update set role = 'admin', is_active = true;
  return 'claimed';
end;
$$;
revoke all on function public.almfrje_claim_admin() from public;
grant execute on function public.almfrje_claim_admin() to authenticated;

-- ============================================================
-- 9) تفعيل RLS
-- ============================================================
alter table public.almfrje_branches  enable row level security;
alter table public.almfrje_members   enable row level security;
alter table public.almfrje_persons   enable row level security;
alter table public.almfrje_documents enable row level security;
alter table public.almfrje_settings  enable row level security;
alter table public.almfrje_trash     enable row level security;

-- ---------- الأعضاء ----------
drop policy if exists members_select on public.almfrje_members;
create policy members_select on public.almfrje_members for select
  using (public.almfrje_is_member() or user_id = auth.uid());
drop policy if exists members_insert on public.almfrje_members;
create policy members_insert on public.almfrje_members for insert
  with check (public.almfrje_is_admin());
drop policy if exists members_update on public.almfrje_members;
create policy members_update on public.almfrje_members for update
  using (public.almfrje_is_admin()) with check (public.almfrje_is_admin());
drop policy if exists members_delete on public.almfrje_members;
create policy members_delete on public.almfrje_members for delete
  using (public.almfrje_is_admin() and user_id <> auth.uid());

-- ---------- الفروع ----------
drop policy if exists branches_select on public.almfrje_branches;
create policy branches_select on public.almfrje_branches for select
  using (public.almfrje_is_member());
drop policy if exists branches_ins on public.almfrje_branches;
create policy branches_ins on public.almfrje_branches for insert
  with check (public.almfrje_is_admin());
drop policy if exists branches_upd on public.almfrje_branches;
create policy branches_upd on public.almfrje_branches for update
  using (public.almfrje_is_admin()) with check (public.almfrje_is_admin());
drop policy if exists branches_del on public.almfrje_branches;
create policy branches_del on public.almfrje_branches for delete
  using (public.almfrje_is_admin());

-- ---------- الأشخاص ----------
drop policy if exists persons_sel on public.almfrje_persons;
create policy persons_sel on public.almfrje_persons for select
  using (public.almfrje_is_member()
         and (public.almfrje_my_branch() is null
              or branch_id = public.almfrje_my_branch()
              or branch_id is null));
drop policy if exists persons_ins on public.almfrje_persons;
create policy persons_ins on public.almfrje_persons for insert
  with check (public.almfrje_is_admin()
              or (public.almfrje_role() = 'branch_manager' and branch_id = public.almfrje_my_branch())
              or (public.almfrje_role() = 'viewer' and public.almfrje_perm('add')));
drop policy if exists persons_upd on public.almfrje_persons;
create policy persons_upd on public.almfrje_persons for update
  using (public.almfrje_is_admin()
         or (public.almfrje_role() = 'branch_manager' and branch_id = public.almfrje_my_branch())
         or (public.almfrje_role() = 'viewer' and public.almfrje_perm('edit')))
  with check (public.almfrje_is_admin()
         or (public.almfrje_role() = 'branch_manager' and branch_id = public.almfrje_my_branch())
         or (public.almfrje_role() = 'viewer' and public.almfrje_perm('edit')));
drop policy if exists persons_del on public.almfrje_persons;
create policy persons_del on public.almfrje_persons for delete
  using (public.almfrje_is_admin()
         or (public.almfrje_role() = 'branch_manager' and branch_id = public.almfrje_my_branch()));

-- ---------- الوثائق ----------
drop policy if exists docs_sel on public.almfrje_documents;
create policy docs_sel on public.almfrje_documents for select
  using (public.almfrje_can_see_person(person_id));
drop policy if exists docs_ins on public.almfrje_documents;
create policy docs_ins on public.almfrje_documents for insert
  with check (public.almfrje_can_edit_person(person_id) or public.almfrje_perm('edit'));
drop policy if exists docs_del on public.almfrje_documents;
create policy docs_del on public.almfrje_documents for delete
  using (public.almfrje_can_edit_person(person_id) or public.almfrje_is_admin());

-- ---------- الإعدادات ----------
drop policy if exists settings_sel on public.almfrje_settings;
create policy settings_sel on public.almfrje_settings for select using (true);
drop policy if exists settings_ins on public.almfrje_settings;
create policy settings_ins on public.almfrje_settings for insert with check (public.almfrje_is_admin());
drop policy if exists settings_upd on public.almfrje_settings;
create policy settings_upd on public.almfrje_settings for update
  using (public.almfrje_is_admin()) with check (public.almfrje_is_admin());

-- ---------- سلة المحذوفات ----------
drop policy if exists trash_sel on public.almfrje_trash;
create policy trash_sel on public.almfrje_trash for select using (public.almfrje_is_admin());
drop policy if exists trash_ins on public.almfrje_trash;
create policy trash_ins on public.almfrje_trash for insert with check (public.almfrje_is_member());
drop policy if exists trash_del on public.almfrje_trash;
create policy trash_del on public.almfrje_trash for delete using (public.almfrje_is_admin());

grant select on public.almfrje_settings to anon, authenticated;

-- ============================================================
--  بعد التنفيذ:
--  1) في Authentication → Providers → Email: أوقِف «Confirm email».
--  2) أنشئ حسابك أول مرة من التطبيق («حساب جديد»).
--  3) اجعل حسابك مديراً (استبدل اسم المستخدم أو الجوال):
--
--     update public.almfrje_members
--        set role = 'admin', is_active = true
--      where username = 'اسم_المستخدم';   -- أو: where phone = '05xxxxxxxx';
--
--  4) (اختياري) أنشئ مجلّد تخزين عاماً للصور/الوثائق:
--     Storage → New bucket → الاسم: almfrje → Public.
-- ============================================================

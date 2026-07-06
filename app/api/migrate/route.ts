import { NextRequest, NextResponse } from 'next/server';
import { authFromHeader, isAuthError } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ─── ترقيات تلقائية للقاعدة (ALTER TABLE … IF NOT EXISTS) ────────────
const MIGRATIONS: { id: string; sql: string; about: string }[] = [
  {
    id: 'users.allow_chat',
    sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS allow_chat SMALLINT DEFAULT 1;',
    about: 'إضافة عمود السماح بالمحادثات',
  },
  {
    id: 'users.password_reset_token',
    sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token TEXT;',
    about: 'إضافة رمز إعادة تعيين كلمة المرور',
  },
  {
    id: 'users.password_reset_expires',
    sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ;',
    about: 'إضافة تاريخ انتهاء رمز إعادة التعيين',
  },
  {
    id: 'users.last_seen',
    sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;',
    about: 'إضافة عمود آخر ظهور للمتصلين الآن',
  },
  {
    id: 'reports.table',
    sql: `CREATE TABLE IF NOT EXISTS reports (
      id SERIAL PRIMARY KEY,
      reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      file_url TEXT NOT NULL,
      file_type TEXT NOT NULL DEFAULT 'image',
      file_name TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_reports_reviewer ON reports(reviewer_id);
    CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);`,
    about: 'إضافة جدول التقارير والصور',
  },
  {
    id: 'report_comments.table',
    sql: `CREATE TABLE IF NOT EXISTS report_comments (
      id SERIAL PRIMARY KEY,
      report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_report_comments_report ON report_comments(report_id);`,
    about: 'إضافة جدول تعليقات التقارير',
  },
  {
    id: 'users.profile_fields',
    sql: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS height INTEGER;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS weight INTEGER;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS occupation TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS residence TEXT;
    `,
    about: 'إضافة حقول البيانات الشخصية للمراجعين',
  },
  {
    id: 'users.admin_perms',
    sql: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_perms TEXT;',
    about: 'إضافة عمود صلاحيات المدير (JSON)',
  },
  {
    id: 'perf.hot_indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_messages_to_read    ON messages(to_id, is_read);
      CREATE INDEX IF NOT EXISTS idx_messages_thread_id  ON messages(thread_id, id DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_partners   ON messages(from_id, to_id);
      CREATE INDEX IF NOT EXISTS idx_messages_status     ON messages(status);
      CREATE INDEX IF NOT EXISTS idx_threads_admin       ON threads(admin_id, status);
      CREATE INDEX IF NOT EXISTS idx_threads_reviewer    ON threads(reviewer_id, status);
      CREATE INDEX IF NOT EXISTS idx_submissions_rev     ON submissions(reviewer_id, status);
      CREATE INDEX IF NOT EXISTS idx_submissions_status  ON submissions(status);
      CREATE INDEX IF NOT EXISTS idx_appointments_rev    ON appointments(reviewer_id, status);
      CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
      CREATE INDEX IF NOT EXISTS idx_users_role_status   ON users(role, status);
      CREATE INDEX IF NOT EXISTS idx_users_last_seen     ON users(last_seen);
      CREATE INDEX IF NOT EXISTS idx_form_fields_form    ON form_fields(form_id, sort_order);
      CREATE INDEX IF NOT EXISTS idx_form_assigns_user   ON form_assignments(user_id);
      CREATE INDEX IF NOT EXISTS idx_appointment_dates   ON appointment_dates(date, status);
    `,
    about: 'فهارس لتسريع الاستعلامات الساخنة (محادثات/استمارات/مواعيد)',
  },
  {
    id: 'report_comments.is_private',
    sql: 'ALTER TABLE report_comments ADD COLUMN IF NOT EXISTS is_private SMALLINT DEFAULT 0;',
    about: 'تعليقات خاصة بالإدارة لا يراها المراجع',
  },
  {
    id: 'appointment_dates.unique_slot_date',
    sql: `
      -- أزل التكرارات إن وُجدت قبل إنشاء القيد الفريد
      DELETE FROM appointment_dates a USING appointment_dates b
        WHERE a.id > b.id AND a.slot_id = b.slot_id AND a.date = b.date;
      CREATE UNIQUE INDEX IF NOT EXISTS uq_appointment_dates_slot_date
        ON appointment_dates(slot_id, date);
    `,
    about: 'قيد فريد لمنع تكرار (الفترة + التاريخ) في المواعيد',
  },
  {
    id: 'session_evals.table',
    sql: `
      CREATE TABLE IF NOT EXISTS session_evals (
        id SERIAL PRIMARY KEY,
        appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
        author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        author_role TEXT NOT NULL,
        symptoms TEXT,      -- ١. أعراض المرض
        vision TEXT,        -- ٢. النظر (العيون)
        body_state TEXT,    -- ٣. الجسم و خفته
        cheer TEXT,         -- ٤. الانشراح والنفسية
        mood TEXT,          -- ٥. تغير المزاج
        enjoyment TEXT,     -- ٦. الاستمتاع بالأكل والسوالف
        notes TEXT,         -- ٧. الملاحظات والتغيرات
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_session_evals_apt
        ON session_evals(appointment_id, created_at DESC);
    `,
    about: 'جدول تقييمات ما بعد الجلسة (مراجع + ردّ المدير)',
  },
  {
    id: 'session_evals.answers_jsonb',
    sql: 'ALTER TABLE session_evals ADD COLUMN IF NOT EXISTS answers JSONB;',
    about: 'إجابات ديناميكية كـ JSON (لدعم تعديل المعايير من الإعدادات)',
  },
  {
    id: 'session_eval_fields.table',
    sql: `
      CREATE TABLE IF NOT EXISTS session_eval_fields (
        id SERIAL PRIMARY KEY,
        label TEXT NOT NULL,
        icon TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        legacy_col TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_session_eval_fields_order ON session_eval_fields(sort_order, id);
      INSERT INTO session_eval_fields (label, icon, sort_order, legacy_col)
      SELECT * FROM (VALUES
        ('أعراض المرض',                 '🩺', 10, 'symptoms'),
        ('النظر (العيون)',               '👁️', 20, 'vision'),
        ('الجسم وخفته',                  '💪', 30, 'body_state'),
        ('الانشراح والنفسية',            '🌤️', 40, 'cheer'),
        ('تغير المزاج',                  '🎭', 50, 'mood'),
        ('الاستمتاع بالأكل والسوالف',     '🍽️', 60, 'enjoyment'),
        ('الملاحظات والتغيّرات',          '📝', 70, 'notes')
      ) AS v(label, icon, sort_order, legacy_col)
      WHERE NOT EXISTS (SELECT 1 FROM session_eval_fields);
    `,
    about: 'معايير التقييم — قابلة للتعديل من الإعدادات',
  },
  {
    id: 'tips.table',
    sql: `
      CREATE TABLE IF NOT EXISTS tips (
        id SERIAL PRIMARY KEY,
        tip_key TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 100,
        status TEXT NOT NULL DEFAULT 'active',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_tips_key ON tips(tip_key);
      INSERT INTO tips (tip_key, title, body, sort_order)
      SELECT * FROM (VALUES
        ('home_welcome',         'الصفحة الرئيسية',     'لوحة متابعتك الشخصية. تجد فيها كل ما تحتاجه: استماراتك، محادثاتك، ومواعيدك. اضغط على أي قسم لفتح تفاصيله.', 10),
        ('forms_section',        'الاستمارات',           'هنا تظهر الاستمارات المرشّحة لك. اضغط "تعبئة" لبدء الاستمارة. تستطيع الحفظ كمسودّة وإكمالها لاحقاً.', 20),
        ('form_fill',            'كيفية تعبئة الاستمارة','اقرأ كل سؤال جيّداً قبل الإجابة. الحقول المُعلّمة بـ (*) إلزامية. تقدر تحفظ كمسودّة وتُكمل لاحقاً من نفس مكانك.', 25),
        ('chat_section',         'المحادثات',            'محادثاتك الخاصة مع الإدارة. اضغط "محادثة جديدة" واكتب موضوع الرسالة، ثم انتظر فتح المحادثة من الإدارة.', 30),
        ('chat_topic',           'بدء محادثة',           'اختر المدير ثم اكتب موضوع الرسالة بوضوح في ٤-٧ كلمات. الموضوع الواضح يساعد المدير يردّ عليك أسرع.', 35),
        ('apt_section',          'المواعيد',             'مواعيدك الحالية والمتاحة. تستطيع حجز موعد واحد فقط في كل مرّة. ألغ موعدك الحالي قبل حجز جديد.', 40),
        ('apt_calendar',         'قراءة التقويم',        'الأخضر = متاح للحجز.\nالأزرق = حجزك الحالي.\nالرمادي = محجوز/مغلق.\nاضغط على أي يوم لرؤية الفترات.', 50),
        ('apt_book',             'كيفية الحجز',          'اختر التاريخ من التقويم، ثم اختر الفترة المناسبة، واضغط "حجز". يتم تأكيد المواعيد في نفس اليوم بعد الظهر.', 60),
        ('apt_eval',             'تقييم بعد الجلسة',     'بعد اعتماد المشرف لجلستك، يظهر زر 📝 على الموعد. اكتب ملاحظاتك في المعايير المعنيّة. تستطيع إرسال أكثر من تقييم.', 70),
        ('pub_section',          'النشرات',              'النشرات والملفات التي تنشرها الإدارة. اضغط على أي نشرة لقراءتها داخل الموقع بدون تحميل.', 80),
        ('report_upload',        'رفع التقارير',         'تستطيع رفع صور أو ملفات PDF. يمكنك رفع عدّة ملفات دفعة واحدة وإضافة تعليق على كل تقرير.', 90),
        ('report_upload_modal',  'قبل الرفع',            'تأكّد أن الصورة واضحة والـ PDF غير مشفّر. عند رفع أكثر من ملف، اكتب عنواناً مختصراً لكل ملف يساعدك تجده لاحقاً.', 95),
        ('profile_edit',         'الملف الشخصي',         'احرص على تعبئة بياناتك بدقّة (الجنس، العمر، الوزن، السكن). تساعد المشرف على تقديم استشارة أفضل.', 100)
      ) AS v(tip_key, title, body, sort_order)
      WHERE NOT EXISTS (SELECT 1 FROM tips);
    `,
    about: 'تعليمات (i) للمراجع قابلة للتعديل من الإعدادات',
  },
  {
    id: 'mrahi.auth_phone_username',
    sql: `
      -- جدول الأعضاء + أعمدة الجوال/اسم المستخدم للدخول
      CREATE TABLE IF NOT EXISTS public.mrahi_members (
        user_id uuid primary key references auth.users(id) on delete cascade,
        full_name text, username text, phone text,
        role text not null default 'member' check (role in ('admin','member')),
        is_active boolean not null default false,
        perms jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );
      ALTER TABLE public.mrahi_members ADD COLUMN IF NOT EXISTS username text;
      ALTER TABLE public.mrahi_members ADD COLUMN IF NOT EXISTS phone    text;
      CREATE UNIQUE INDEX IF NOT EXISTS mrahi_members_phone_key
        ON public.mrahi_members (phone) WHERE phone IS NOT NULL AND phone <> '';
      CREATE UNIQUE INDEX IF NOT EXISTS mrahi_members_username_key
        ON public.mrahi_members (lower(username)) WHERE username IS NOT NULL AND username <> '';

      -- دوال الصلاحية (مطلوبة لسياسات RLS)
      CREATE OR REPLACE FUNCTION public.mrahi_is_member() RETURNS boolean
        LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $func$
        select exists (select 1 from mrahi_members where user_id = auth.uid() and is_active); $func$;
      CREATE OR REPLACE FUNCTION public.mrahi_is_admin() RETURNS boolean
        LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $func$
        select exists (select 1 from mrahi_members where user_id = auth.uid() and is_active and role = 'admin'); $func$;
      CREATE OR REPLACE FUNCTION public.mrahi_can(mod text, act text) RETURNS boolean
        LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $func$
        select public.mrahi_is_admin() or exists (
          select 1 from mrahi_members where user_id = auth.uid() and is_active
            and coalesce((perms #>> array[mod, act])::boolean, false)); $func$;

      -- مُشغّل إنشاء العضو: أول مَن يسجّل يصبح مديراً مفعّلاً تلقائياً
      CREATE OR REPLACE FUNCTION public.mrahi_handle_new_user() RETURNS trigger
        LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $func$
      declare _first boolean;
      begin
        select not exists (select 1 from public.mrahi_members) into _first;
        begin
          insert into public.mrahi_members (user_id, full_name, username, phone, role, is_active, perms)
          values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''),
                  nullif(new.raw_user_meta_data->>'username',''),
                  nullif(new.raw_user_meta_data->>'phone',''),
                  case when _first then 'admin' else 'member' end,
                  _first,
                  case when _first then '{"animals":{"view":true,"add":true,"edit":true,"delete":true},"breeding":{"view":true,"add":true,"edit":true,"delete":true},"vaccines":{"view":true,"add":true,"edit":true,"delete":true},"treatments":{"view":true,"add":true,"edit":true,"delete":true},"backup":{"view":true}}'::jsonb else '{}'::jsonb end);
        exception when others then null;  -- لا تُفشل التسجيل مهما حدث
        end;
        return new;
      end; $func$;
      DROP TRIGGER IF EXISTS on_auth_user_created_marahi ON auth.users;
      CREATE TRIGGER on_auth_user_created_marahi AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.mrahi_handle_new_user();

      -- تحويل (الجوال أو اسم المستخدم) إلى البريد الداخلي عند الدخول
      CREATE OR REPLACE FUNCTION public.mrahi_resolve_login(ident text) RETURNS text
        LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $func$
        select u.email from public.mrahi_members m join auth.users u on u.id = m.user_id
         where m.phone = ident or lower(m.username) = lower(ident)
         order by (m.phone = ident) desc limit 1; $func$;
      REVOKE ALL ON FUNCTION public.mrahi_resolve_login(text) FROM public;
      GRANT EXECUTE ON FUNCTION public.mrahi_resolve_login(text) TO anon, authenticated;

      -- RLS + سياسات الأعضاء
      ALTER TABLE public.mrahi_members ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS members_select ON public.mrahi_members;
      CREATE POLICY members_select ON public.mrahi_members FOR SELECT
        USING (public.mrahi_is_member() or user_id = auth.uid());
      DROP POLICY IF EXISTS members_update ON public.mrahi_members;
      CREATE POLICY members_update ON public.mrahi_members FOR UPDATE
        USING (public.mrahi_is_admin()) WITH CHECK (public.mrahi_is_admin());
      DROP POLICY IF EXISTS members_insert ON public.mrahi_members;
      CREATE POLICY members_insert ON public.mrahi_members FOR INSERT
        WITH CHECK (public.mrahi_is_admin());
      DROP POLICY IF EXISTS members_delete ON public.mrahi_members;
      CREATE POLICY members_delete ON public.mrahi_members FOR DELETE
        USING (public.mrahi_is_admin() and user_id <> auth.uid());

      -- جداول البيانات
      CREATE TABLE IF NOT EXISTS public.mrahi_animals (
        id bigint generated always as identity primary key,
        type text not null default 'sheep', pen text default '', code text default '',
        idkind text default 'number', name text default '', sex text default 'female',
        birth date, color text default '', status text default 'present',
        mother_id bigint references public.mrahi_animals(id) on delete set null,
        father_id bigint references public.mrahi_animals(id) on delete set null,
        father_name text default '', notes text default '',
        created_at timestamptz not null default now(), created_by uuid default auth.uid());
      CREATE TABLE IF NOT EXISTS public.mrahi_matings (
        id bigint generated always as identity primary key,
        animal_id bigint references public.mrahi_animals(id) on delete cascade,
        date date, sire_code text default '', sire_name text default '', notes text default '',
        created_at timestamptz not null default now(), created_by uuid default auth.uid());
      CREATE TABLE IF NOT EXISTS public.mrahi_pregnancies (
        id bigint generated always as identity primary key,
        animal_id bigint references public.mrahi_animals(id) on delete cascade,
        mating_date date, gest int default 150, expected date, status text default 'monitoring',
        notes text default '', created_at timestamptz not null default now(), created_by uuid default auth.uid());
      CREATE TABLE IF NOT EXISTS public.mrahi_births (
        id bigint generated always as identity primary key,
        mother_id bigint references public.mrahi_animals(id) on delete cascade,
        offspring_id bigint references public.mrahi_animals(id) on delete set null,
        offspring_code text default '', date date, sex text default 'female',
        father_name text default '', notes text default '',
        created_at timestamptz not null default now(), created_by uuid default auth.uid());
      CREATE TABLE IF NOT EXISTS public.mrahi_vaccine_types (
        id bigint generated always as identity primary key,
        name text not null, vaccine_name text default '', withdrawal_days int default 0,
        notes text default '', created_at timestamptz not null default now(), created_by uuid default auth.uid());
      CREATE TABLE IF NOT EXISTS public.mrahi_vaccinations (
        id bigint generated always as identity primary key,
        animal_id bigint references public.mrahi_animals(id) on delete cascade,
        type_id bigint references public.mrahi_vaccine_types(id) on delete set null,
        date date, withdrawal_end date, next_due date, notes text default '',
        created_at timestamptz not null default now(), created_by uuid default auth.uid());
      CREATE TABLE IF NOT EXISTS public.mrahi_treatments (
        id bigint generated always as identity primary key,
        animal_id bigint references public.mrahi_animals(id) on delete cascade,
        treatment_type text default '', med_name text default '', withdrawal_days int default 0,
        date date, withdrawal_end date, action text default '', notes text default '',
        created_at timestamptz not null default now(), created_by uuid default auth.uid());
      CREATE TABLE IF NOT EXISTS public.mrahi_backups (
        id bigint generated always as identity primary key,
        owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
        label text default '', note text default '', payload jsonb not null,
        animals_count int default 0, created_at timestamptz not null default now());
      CREATE INDEX IF NOT EXISTS mrahi_backups_owner_idx ON public.mrahi_backups(owner_id, created_at desc);

      -- تفعيل RLS على كل الجداول
      ALTER TABLE public.mrahi_animals       ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.mrahi_matings       ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.mrahi_pregnancies   ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.mrahi_births        ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.mrahi_vaccine_types ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.mrahi_vaccinations  ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.mrahi_treatments    ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.mrahi_backups       ENABLE ROW LEVEL SECURITY;

      -- سياسات الأقسام (view/add/edit/delete)
      DROP POLICY IF EXISTS animals_sel ON public.mrahi_animals; CREATE POLICY animals_sel ON public.mrahi_animals FOR SELECT USING (public.mrahi_can('animals','view'));
      DROP POLICY IF EXISTS animals_ins ON public.mrahi_animals; CREATE POLICY animals_ins ON public.mrahi_animals FOR INSERT WITH CHECK (public.mrahi_can('animals','add'));
      DROP POLICY IF EXISTS animals_upd ON public.mrahi_animals; CREATE POLICY animals_upd ON public.mrahi_animals FOR UPDATE USING (public.mrahi_can('animals','edit')) WITH CHECK (public.mrahi_can('animals','edit'));
      DROP POLICY IF EXISTS animals_del ON public.mrahi_animals; CREATE POLICY animals_del ON public.mrahi_animals FOR DELETE USING (public.mrahi_can('animals','delete'));
      DROP POLICY IF EXISTS matings_sel ON public.mrahi_matings; CREATE POLICY matings_sel ON public.mrahi_matings FOR SELECT USING (public.mrahi_can('breeding','view'));
      DROP POLICY IF EXISTS matings_ins ON public.mrahi_matings; CREATE POLICY matings_ins ON public.mrahi_matings FOR INSERT WITH CHECK (public.mrahi_can('breeding','add'));
      DROP POLICY IF EXISTS matings_upd ON public.mrahi_matings; CREATE POLICY matings_upd ON public.mrahi_matings FOR UPDATE USING (public.mrahi_can('breeding','edit')) WITH CHECK (public.mrahi_can('breeding','edit'));
      DROP POLICY IF EXISTS matings_del ON public.mrahi_matings; CREATE POLICY matings_del ON public.mrahi_matings FOR DELETE USING (public.mrahi_can('breeding','delete'));
      DROP POLICY IF EXISTS preg_sel ON public.mrahi_pregnancies; CREATE POLICY preg_sel ON public.mrahi_pregnancies FOR SELECT USING (public.mrahi_can('breeding','view'));
      DROP POLICY IF EXISTS preg_ins ON public.mrahi_pregnancies; CREATE POLICY preg_ins ON public.mrahi_pregnancies FOR INSERT WITH CHECK (public.mrahi_can('breeding','add'));
      DROP POLICY IF EXISTS preg_upd ON public.mrahi_pregnancies; CREATE POLICY preg_upd ON public.mrahi_pregnancies FOR UPDATE USING (public.mrahi_can('breeding','edit')) WITH CHECK (public.mrahi_can('breeding','edit'));
      DROP POLICY IF EXISTS preg_del ON public.mrahi_pregnancies; CREATE POLICY preg_del ON public.mrahi_pregnancies FOR DELETE USING (public.mrahi_can('breeding','delete'));
      DROP POLICY IF EXISTS births_sel ON public.mrahi_births; CREATE POLICY births_sel ON public.mrahi_births FOR SELECT USING (public.mrahi_can('breeding','view'));
      DROP POLICY IF EXISTS births_ins ON public.mrahi_births; CREATE POLICY births_ins ON public.mrahi_births FOR INSERT WITH CHECK (public.mrahi_can('breeding','add'));
      DROP POLICY IF EXISTS births_upd ON public.mrahi_births; CREATE POLICY births_upd ON public.mrahi_births FOR UPDATE USING (public.mrahi_can('breeding','edit')) WITH CHECK (public.mrahi_can('breeding','edit'));
      DROP POLICY IF EXISTS births_del ON public.mrahi_births; CREATE POLICY births_del ON public.mrahi_births FOR DELETE USING (public.mrahi_can('breeding','delete'));
      DROP POLICY IF EXISTS vt_sel ON public.mrahi_vaccine_types; CREATE POLICY vt_sel ON public.mrahi_vaccine_types FOR SELECT USING (public.mrahi_can('vaccines','view'));
      DROP POLICY IF EXISTS vt_ins ON public.mrahi_vaccine_types; CREATE POLICY vt_ins ON public.mrahi_vaccine_types FOR INSERT WITH CHECK (public.mrahi_can('vaccines','add'));
      DROP POLICY IF EXISTS vt_upd ON public.mrahi_vaccine_types; CREATE POLICY vt_upd ON public.mrahi_vaccine_types FOR UPDATE USING (public.mrahi_can('vaccines','edit')) WITH CHECK (public.mrahi_can('vaccines','edit'));
      DROP POLICY IF EXISTS vt_del ON public.mrahi_vaccine_types; CREATE POLICY vt_del ON public.mrahi_vaccine_types FOR DELETE USING (public.mrahi_can('vaccines','delete'));
      DROP POLICY IF EXISTS vac_sel ON public.mrahi_vaccinations; CREATE POLICY vac_sel ON public.mrahi_vaccinations FOR SELECT USING (public.mrahi_can('vaccines','view'));
      DROP POLICY IF EXISTS vac_ins ON public.mrahi_vaccinations; CREATE POLICY vac_ins ON public.mrahi_vaccinations FOR INSERT WITH CHECK (public.mrahi_can('vaccines','add'));
      DROP POLICY IF EXISTS vac_upd ON public.mrahi_vaccinations; CREATE POLICY vac_upd ON public.mrahi_vaccinations FOR UPDATE USING (public.mrahi_can('vaccines','edit')) WITH CHECK (public.mrahi_can('vaccines','edit'));
      DROP POLICY IF EXISTS vac_del ON public.mrahi_vaccinations; CREATE POLICY vac_del ON public.mrahi_vaccinations FOR DELETE USING (public.mrahi_can('vaccines','delete'));
      DROP POLICY IF EXISTS trt_sel ON public.mrahi_treatments; CREATE POLICY trt_sel ON public.mrahi_treatments FOR SELECT USING (public.mrahi_can('treatments','view'));
      DROP POLICY IF EXISTS trt_ins ON public.mrahi_treatments; CREATE POLICY trt_ins ON public.mrahi_treatments FOR INSERT WITH CHECK (public.mrahi_can('treatments','add'));
      DROP POLICY IF EXISTS trt_upd ON public.mrahi_treatments; CREATE POLICY trt_upd ON public.mrahi_treatments FOR UPDATE USING (public.mrahi_can('treatments','edit')) WITH CHECK (public.mrahi_can('treatments','edit'));
      DROP POLICY IF EXISTS trt_del ON public.mrahi_treatments; CREATE POLICY trt_del ON public.mrahi_treatments FOR DELETE USING (public.mrahi_can('treatments','delete'));
      DROP POLICY IF EXISTS bkp_sel ON public.mrahi_backups; CREATE POLICY bkp_sel ON public.mrahi_backups FOR SELECT USING (owner_id = auth.uid() and public.mrahi_can('backup','view'));
      DROP POLICY IF EXISTS bkp_ins ON public.mrahi_backups; CREATE POLICY bkp_ins ON public.mrahi_backups FOR INSERT WITH CHECK (owner_id = auth.uid() and public.mrahi_can('backup','view'));
      DROP POLICY IF EXISTS bkp_del ON public.mrahi_backups; CREATE POLICY bkp_del ON public.mrahi_backups FOR DELETE USING (owner_id = auth.uid() and public.mrahi_can('backup','view'));
    `,
    about: 'مراحي: مخطط كامل (جداول + RLS) + أول مستخدم يصبح مديراً تلقائياً',
  },
  // (أُزيل مخطط المفارجة من هنا — للمفرجي مسار إعدادٍ مستقلّ /api/almfrje-setup يستهدف
  //  قاعدته الخاصة. لا يجوز لمُهجِّر الاستشارات أن يُنشئ جداول مشروعٍ آخر — عزلٌ تام.)
  {
    id: 'users.invite_quota',
    sql: `
      ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_quota INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_used  INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_days  INTEGER NOT NULL DEFAULT 5;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by   INTEGER REFERENCES users(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_users_invited_by ON users(invited_by);
    `,
    about: 'رصيد الدعوات + مدّتها لكل مستخدم + ربط المدعو بمن دعاه',
  },
  {
    id: 'invitations.table',
    sql: `
      CREATE TABLE IF NOT EXISTS invitations (
        id SERIAL PRIMARY KEY,
        inviter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'pending',
        invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        registered_at TIMESTAMPTZ,
        new_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS idx_invitations_inviter ON invitations(inviter_id, status);
      CREATE INDEX IF NOT EXISTS idx_invitations_phone   ON invitations(phone);
      CREATE INDEX IF NOT EXISTS idx_invitations_token   ON invitations(token);
    `,
    about: 'جدول الدعوات بسقف ومدّة (٥ أيام)',
  },
];

async function runOne(pat: string, ref: string, sql: string) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${pat}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await r.text();
  let data: unknown = text;
  try { data = JSON.parse(text); } catch { /* keep text */ }
  return { ok: r.ok, status: r.status, data };
}

async function handle(request: NextRequest) {
  const a = authFromHeader(request.headers.get('authorization'), true);
  if (isAuthError(a)) return NextResponse.json({ ok: false, error: a.error }, { status: a.status });

  const pat = process.env.SUPABASE_PAT;
  if (!pat) return NextResponse.json({ ok: false, error: 'SUPABASE_PAT غير مضاف في Vercel' }, { status: 500 });

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const m = supaUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  if (!m) return NextResponse.json({ ok: false, error: 'لا يمكن استخراج project ref من NEXT_PUBLIC_SUPABASE_URL' }, { status: 500 });
  const ref = m[1];

  const results: Array<Record<string, unknown>> = [];
  for (const mig of MIGRATIONS) {
    const r = await runOne(pat, ref, mig.sql);
    results.push({ id: mig.id, about: mig.about, ok: r.ok, status: r.status });
  }
  // أَطلق NOTIFY pgrst لتحديث ذاكرة PostgREST للـ schema. بدون هذا،
  // الأعمدة الجديدة قد لا تُرى عبر REST API حتى تنتهي مهلة الـ cache.
  try { await runOne(pat, ref, "NOTIFY pgrst, 'reload schema';"); } catch { /* best-effort */ }

  // تطبيق مراحي: ألغِ اشتراط تأكيد البريد (التسجيل يصبح فورياً) لأن البريد
  // الداخلي وهمي. أمر إداري عبر Management API — أفضل جهد دون إيقاف الترقيات.
  let autoconfirm: Record<string, unknown> = { ok: false };
  try {
    const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${pat}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mailer_autoconfirm: true }),
    });
    autoconfirm = { ok: r.ok, status: r.status };
  } catch (e) { autoconfirm = { ok: false, error: String(e) }; }

  const allOk = results.every((r) => r.ok);
  return NextResponse.json({ ok: allOk, results, autoconfirm });
}

export async function GET(request: NextRequest) { return handle(request); }
export async function POST(request: NextRequest) { return handle(request); }

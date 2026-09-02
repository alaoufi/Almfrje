-- ══════════════════════════════════════════════════════════════════════
-- ترقية مكتبة الصور/الوثائق — قبيلة المفارجة
-- تُنفَّذ مرّة واحدة في: لوحة Supabase ← SQL Editor ← الصق ثم Run
-- آمنة تماماً: لا تحذف أي بيانات (كل الأوامر IF NOT EXISTS / OR REPLACE).
-- ══════════════════════════════════════════════════════════════════════

-- 1) أعمدة مكتبة الشخص (القسم + الخصوصية + نصّ القصيدة)
ALTER TABLE public.almfrje_documents ADD COLUMN IF NOT EXISTS category  text    default '';
ALTER TABLE public.almfrje_documents ADD COLUMN IF NOT EXISTS is_public boolean not null default true;
ALTER TABLE public.almfrje_documents ADD COLUMN IF NOT EXISTS body      text    default '';

-- 2) دالّة معرّفات الذرية (لمن يرى المخفيّ «لذريّته فقط»)
CREATE OR REPLACE FUNCTION public.almfrje_descendant_ids(root bigint) RETURNS table(id bigint)
  LANGUAGE sql STABLE AS $func$
  with recursive d as (
    select p.id from public.almfrje_persons p where p.father_id = root
    union all
    select c.id from public.almfrje_persons c join d on c.father_id = d.id
  ) select id from d; $func$;

-- 3) دالّة رؤية عنصر المكتبة: العامّ يراه الجميع، والمخفيّ لصاحبه/ذريّته/الإدارة فقط
CREATE OR REPLACE FUNCTION public.almfrje_can_see_doc(doc_person bigint, is_pub boolean) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $func$
  select public.almfrje_is_member() and (
    coalesce(is_pub, true)
    or public.almfrje_is_admin()
    or exists (select 1 from public.almfrje_members m
                where m.user_id = auth.uid() and m.is_active and m.person_id = doc_person)
    or exists (select 1 from public.almfrje_members m
                 join public.almfrje_descendant_ids(doc_person) d on d.id = m.person_id
                where m.user_id = auth.uid() and m.is_active)
  ); $func$;

-- 4) سياسة القراءة: تطبّق الخصوصية أعلاه على كل صف
DROP POLICY IF EXISTS docs_sel ON public.almfrje_documents;
CREATE POLICY docs_sel ON public.almfrje_documents FOR SELECT
  USING (public.almfrje_can_see_doc(person_id, is_public));

-- 5) إعلام PostgREST بتحديث المخطط فوراً (فلا تظهر «تعذّر الوصول لعمود»)
NOTIFY pgrst, 'reload schema';

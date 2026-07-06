# نشر «قاعدة بيانات قبيلة المفارجة» كمشروع مستقل

هذا المستودع (`Almfrje`) خاصٌّ بتطبيق المفرجي فقط. لتجنّب التداخل: **مستودع واحد ↔ مشروع Vercel واحد ↔ نطاق واحد.**

## خطوات النشر (Vercel)
1. **Add New → Project** ثم استورد المستودع `alaoufi/Almfrje`.
2. Framework: **Next.js** (تلقائي). Build/Output: الافتراضي.
3. **Settings → Environment Variables** — أضف متغيّرات المفرجي (Production + Preview):
   - `ALMFRJE_SUPABASE_URL`
   - `ALMFRJE_SUPABASE_ANON_KEY`
   - `ALMFRJE_SERVICE_ROLE_KEY`
   - `ALMFRJE_SUPABASE_PAT`
   - (اختياري كبدائل) `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY`
   > انسخ القيم من مشروعك الحالي في Vercel. **لا تضع `service_role` في أي متغيّر يبدأ بـ `NEXT_PUBLIC`.**
4. **Redeploy** بعد إضافة المتغيّرات.
5. **Settings → Domains**: أضف نطاقاً خاصاً (مثل `almfrje.alaoufi.me`).

## الرابط بعد النشر
- المفرجي على المسار: **alaoufi.me/almfrji** (ومرادفه `/almfrje`).
- الجذر `alaoufi.me/` يبقى صفحة فارغة (`blank.html`).

## منع التداخل (الأهمّ)
- **مستودع واحد فقط لكل مشروع Vercel.** التداخل حدث لأن مستودعين رُبطا بنفس المشروع.
- ليبقى الرابط `alaoufi.me/almfrji`: مشروع Vercel المالك لنطاق `alaoufi.me` يجب أن يكون مربوطاً **بهذا المستودع (`Almfrje`)** الذي يحوي توجيه `/almfrji` (و`/mrahi` و`/con`).
- عزل البيانات يكون بقاعدة Supabase ومتغيّرات بيئة **مستقلة لكل تطبيق** (المفرجي له قاعدته الخاصة بالفعل) — فلا تتداخل البيانات حتى لو تشاركت المسارات نطاقاً واحداً.

powered by Mohamad Shaman almfrji

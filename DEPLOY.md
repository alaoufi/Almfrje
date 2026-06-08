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

## الروابط بعد النشر
- جذر النطاق يفتح التطبيق مباشرة (تم ضبط `next.config.mjs`: `/` → تطبيق المفرجي).
- مسارات بديلة: `/almfrji` و `/almfrje`.

## قاعدة منع التداخل
- لا تستورد مستودعين في مشروع Vercel واحد.
- كل مشروع (المفرجي / مراحي / الاستشارات / مذكراتي) له مستودعه ومشروعه ومتغيّرات بيئته (ويُفضّل قاعدة Supabase) المستقلة.

powered by Mohamad Shaman almfrji

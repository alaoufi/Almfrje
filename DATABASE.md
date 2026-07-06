# قاعدة البيانات والبنية — مصدر الحقيقة الوحيد

> هذا الملف مرجع لمنع الالتباس بين قواعد البيانات والحسابات. **كل شيء موحّد على إعداد واحد فقط.**

## ✅ الإنتاج (المستخدَم فعلاً)

| المكوّن | القيمة |
|---|---|
| **الموقع** | `https://alaoufi.me` |
| **مشروع Vercel** | `alaoufi-me` (فريق `mo`، حساب `alaoufi`) |
| **مستودع GitHub** | `alaoufi/Almfrje` (فرع `main` — نشر تلقائي) |
| **قاعدة البيانات (Supabase)** | مشروع `vzlivdymyiaplnasplvg` — منطقة سنغافورة `ap-southeast-1`، تحت مؤسسة **`alaoufi.me`** |
| **مفتاح anon العام** | `sb_publishable_I7PYbWwN-KxV78vc1WDmpA_fnCEslM1` |

كل التطبيقات الثلاثة تتشارك **نفس القاعدة** (`vzlivdymyiaplnasplvg`)، بجداول معزولة ببادئات:
- **المفارجة** (شجرة الأنساب) — جداول `almfrje_*` — تُخدَم على `/almfrje` (والرئيسية `/`).
- **منصّة الاستشارات** — جداول بلا بادئة (`users`, `submissions`, …) — تُخدَم على `/legacy`.
- **مراحي** — جداول `mrahi_*` — تُخدَم على `/mrahi`.

## ⚙️ متغيّرات البيئة على مشروع Vercel `alaoufi-me`
- `NEXT_PUBLIC_SUPABASE_URL` = `https://vzlivdymyiaplnasplvg.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = المفتاح العام أعلاه
- `SUPABASE_SERVICE_ROLE_KEY` = (سرّي، للخادم)
- `JWT_SECRET` = (لمنصّة الاستشارات)
- `SUPABASE_PAT` = (اختياري — يُمكّن `/api/migrate` و`/api/almfrje-setup` من إنشاء/ترقية الجداول تلقائياً)

ملفات `public/almfrje/config.js` و`public/mrahi/config.js` تشير جميعها لهذه القاعدة (احتياط؛ تُستبدَل من متغيّرات البيئة عبر `/api/*-config`).

## ❌ غير مستخدَم (يُفضّل حذفه لمنع اللبس)
- مشروع Supabase `pdhbcvbsfmhopbrnkdsp` (مؤسسة `marahi`، اسمه «alaoufi's Project») — **فارغ، زائد**، أُنشئ بالخطأ ثم نُظّف. لا تستخدمه.
- مؤسسات/مشاريع Supabase الأخرى تحت حسابات مختلفة (مثل `ryza2030`, `Syanah`, `saud9495's Org` …) لا علاقة لها بهذا الموقع.

> ⚠️ عند العمل على القاعدة من لوحة Supabase، تأكّد أنك في **مشروع «alaoufi» (`vzlivdymyiaplnasplvg`، سنغافورة) تحت مؤسسة `alaoufi.me`** — وفيه ~1507 شخص في `almfrje_persons`. هذا هو الوحيد الصحيح.

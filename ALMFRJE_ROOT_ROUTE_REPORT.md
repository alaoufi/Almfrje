# تقرير خدمة المفرجي من جذر الدومين
# ALMFRJE_ROOT_ROUTE_REPORT

**المرحلة:** PHASE ALMFRJE-ROOT — SERVE ALMFRJE FROM DOMAIN ROOT
**المستودع:** `alaoufi/Almfrje` فقط
**الفرع:** `serve-almfrje-from-root` (من `main`)
**التاريخ:** 2026-06-10

---

## 1) المشكلة السابقة

كان مشروع المفرجي يعرض على **جذر الدومين `/`** صفحةً **فارغة** (`blank.html`)، والتطبيق
الحقيقي «قاعدة بيانات قبيلة المفارجة» يُخدَم فقط على المسار `/almfrje` (و`/almfrji`). لذلك
عند ربط الدومين الفرعي `https://almfrje.alaoufi.me` سيظهر **فارغاً** على الجذر، ويُضطرّ
المستخدم لكتابة `/almfrje` — وهو غير مرغوب.

## 2) لماذا كان الجذر `/` فارغاً؟

بسبب قاعدة rewrite صريحة في `next.config.mjs`:

```js
{ source: '/', destination: '/blank.html' },
```

كانت مقصودة في التصميم القديم (نشرٌ واحد يضمّ عدّة تطبيقات: المفرجي على `/almfrje`،
الاستشارات على `/con` والملاحظات على `/notes`)، فتُرك الجذر فارغاً عمداً
كي لا يتعارض مع تلك التطبيقات. أما الآن وقد صار للمفرجي دومينه الفرعي المستقلّ، فالمطلوب أن
يعرض الجذر تطبيق المفرجي مباشرةً.

## 3) ماذا تم تغييره؟ (محصورٌ في التوجيه — بلا مسٍّ للبيانات أو القاعدة)

| # | الملف | التغيير |
|---|---|---|
| 1 | `next.config.mjs` | قاعدة الجذر صارت `{ source: '/', destination: '/almfrje/index.html' }` بدل `/blank.html`. |
| 2 | `public/almfrje/manifest.webmanifest` | `start_url` و`scope` صارا `"/"` بدل `"/almfrje"` (لِيُثبَّت التطبيق ويُفتَح من الجذر؛ الأيقونة تبقى `/almfrje/icon.svg`). |
| 3 | `public/almfrje/app.js` | زر «مشاركة الموقع»: الرابط صار `location.origin` (الجذر) بدل `location.origin + '/almfrje'` — حتى لا تُنشر روابط `/almfrje`. (سطر واحد، لا يمسّ منطق البيانات.) |

**لماذا تعمل هذه التغييرات؟** أصول تطبيق المفرجي مُشار إليها بمسارات **مطلقة** ثابتة
(`/almfrje/app.js`, `/almfrje/app.css`, `/almfrje/config.js`, `/almfrje/icon.svg`,
`/almfrje/manifest.webmanifest`) ونقطة الإعداد `/almfrje-config` (يخدمها
`app/almfrje-config/route.ts`). هذه كلها تبقى على أماكنها وتُحمَّل بنجاح **بغضّ النظر** عمّا
يُخدَم على الجذر؛ لذا خدمة `index.html` نفسه على `/` تكفي لظهور التطبيق كاملاً بأصوله وبياناته.

**ما الذي لم يُغيَّر؟**
- لم تُحذف `blank.html` (بقيت في `public/`، لكنها لم تَعُد وجهة الجذر).
- لم يُلمَس `config.js` ولا أي إعداد Supabase ولا قاعدة البيانات ولا منطق البيانات.
- لم تُلمَس مسارات `/con`,`/notes` ولا أي API.
- `scripts/check-boundaries.mjs` (حارس prebuild) لا يفحص `next.config.mjs` ولا `public/`
  (يفحص فقط استيرادات/متغيّرات بيئة ملفّات TS/TSX تحت `app/`،`lib/`)، فلم يتأثّر.

## 4) هل `/` أصبح يعرض التطبيق؟

نعم. الجذر `/` يُخدَم الآن من `/almfrje/index.html` (نفس index التطبيق)، وأصوله المطلقة
`/almfrje/*` ونقطة `/almfrje-config` تُحمَّل كما هي ⇒ يظهر التطبيق وبياناته الصحيحة على الجذر.
(حالة البناء في §6؛ والتحقّق الحيّ يكون بعد ربط الدومين/النشر.)

## 5) هل `/almfrje` ما زال يعمل؟

نعم — **يعمل كما هو (alias)**، لم يُحوَّل ولم يُحذف. القاعدتان:

```js
{ source: '/almfrje',  destination: '/almfrje/index.html' },
{ source: '/almfrji',  destination: '/almfrje/index.html' },
```

باقيتان دون تغيير، فيظلّ `/almfrje` و`/almfrji` يعرضان نفس التطبيق (توافقٌ مع الروابط القديمة).
اختير **alias** (لا redirect) لأنه الأبسط والأقلّ خطراً، ولأن أصول التطبيق تحت `/almfrje/*`
يجب ألّا تُحوَّل. أي:
- `/` → التطبيق (الجديد، الأساسي)
- `/almfrje` و`/almfrji` → التطبيق (alias قديم، يعمل)

## 6) حالة البناء (build)

- **`npm install`:** نجح ✅
- **`prebuild` (حارس الحدود `scripts/check-boundaries.mjs`):** اجتاز ✅ —
  «✅ حدود المشاريع سليمة: لا تداخل بين almfrji / con / notes».
- **`npm run build`:** نجح ✅ — `next build` (Next.js 15.5.18): `✓ Compiled successfully in 4.4s`،
  فحص الأنواع/الـlint المدمج اجتاز، `✓ Generating static pages (3/3)`، رمز الخروج `0`.
- **سكربت lint مستقل:** **لا يوجد** في `package.json` (السكربتات: `dev`, `check:boundaries`,
  `prebuild`, `build`, `start`)؛ الفحص يجري ضمن `next build` + حارس الحدود في `prebuild`.

## 7) خطة التراجع (Rollback)

1. **الأبسط:** إغلاق الـ Draft PR دون دمج — لا شيء يصل إلى `main`.
2. **إن دُمج ثمّ لزِم التراجع:** `git revert <commit_sha>` على فرعٍ جديد ثم PR.
3. **يدوياً:** إعادة سطر الجذر إلى `{ source: '/', destination: '/blank.html' }` في
   `next.config.mjs`، وإرجاع `start_url`/`scope` في الـ manifest إلى `"/almfrje"`، وإرجاع سطر
   المشاركة في `app.js` إلى `location.origin + '/almfrje'`. التغييرات صغيرة ومعزولة والتراجع نظيف
   (لا قاعدة بيانات، لا حذف).

## 8) تأكيد عدم لمس Alaoufi.me أو المشاريع الخارجية

تم. **لم يُلمَس مستودع `alaoufi/Alaoufi.me` ولا أي مستودع خارجي** — لا تعديل ولا commit ولا
push. كل العمل داخل `alaoufi/Almfrje` على فرع `serve-almfrje-from-root` فقط. ولم يُلمَس PR #19.

---

### ملخّص الالتزام بالقيود
- ✅ الجذر `/` يعرض المفرجي؛ `/almfrje` يبقى عاملاً كـ alias.
- ✅ لا حذف لملفات مهمة؛ لا تغيير لقاعدة البيانات؛ لا تغيير لمنطق البيانات (سوى رابط مشاركة واحد).
- ✅ لم يُلمَس Alaoufi.me ولا PR #19؛ لا merge؛ لا force push؛ لا main مباشرة.
- ✅ commit واحد، وPR كـ **Draft** إلى `main`.

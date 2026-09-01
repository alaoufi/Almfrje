# دليل المطوّر — موقع قبيلة المفارجة (Almfrje)

توصيفٌ تقنيّ كامل للموقع لأي مطوّر يريد التعديل عليه أو صيانته. يغطّي البنية،
والتقنيات، وتخطيط المستودع، وقاعدة البيانات، والصلاحيات، وواجهات الـ API،
وآلية النشر، والمزالق الشائعة.

---

## 1) نظرة عامة

**Almfrje** موقعُ أنسابٍ للقبيلة: شجرةٌ تفاعلية، بحثٌ، فروعٌ، ملفّاتٌ للأفراد،
مكتبة صور/وثائق/قصائد، لوحة تحكّم إدارية، نسخ احتياطية سحابية، ودخولٌ للزوّار
بمطابقة الاسم. الواجهة تطبيق صفحة واحدة (SPA) بلغة JavaScript صِرفة، وقاعدة
البيانات Postgres على Supabase مع Row-Level Security، ويُستضاف على Cloudflare
Workers عبر OpenNext.

- **النطاق العام:** `https://almfrje.alaoufi.me/` → يعيد التوجيه إلى `/almfrje/`.
- **اللغة:** عربية RTL بالكامل.
- **الجمهور:** أفراد القبيلة (زوّار يتصفّحون) + إدارة (مدير/مشرفون).

هذا المستودع **أحادي متعدّد التطبيقات (monorepo)**: يضمّ أكثر من موقع (المفارجة،
منصّة الاستشارات `con`، الملاحظات `notes`، ومجلّد `legacy` القديم). هذا الدليل
يخصّ **تطبيق المفارجة فقط**؛ ملفّاته معزولة ببادئة `almfrje` في كل مكان.

---

## 2) حزمة التقنيات

| الطبقة | التقنية |
|---|---|
| الإطار | Next.js 16 (App Router) — يُستخدم لتقديم الأصول الثابتة وواجهات الـ API فقط |
| الاستضافة | Cloudflare Workers عبر `@opennextjs/cloudflare` (OpenNext) |
| الواجهة | HTML + CSS + JavaScript صِرف (بلا إطار/بلا بناء) في `public/almfrje/` |
| قاعدة البيانات | Supabase (PostgreSQL، منطقة فرانكفورت) مع RLS |
| المصادقة | Supabase Auth (بريد/كلمة مرور اصطناعيان مشتقّان من الجوال) |
| التخزين | Supabase Storage (الصور/الوثائق/النسخ الاحتياطية) |
| النشر | دفعٌ إلى فرع `main` على GitHub ⇐ يبني وينشر Cloudflare تلقائياً |

**اعتماديات وقت التشغيل:** `@supabase/supabase-js`, `pg`, `bcryptjs`, `react`
(للـ layout فقط). الواجهة لا تستعمل React إطلاقاً.

---

## 3) تخطيط المستودع (ما يخصّ المفارجة)

```
public/almfrje/
├── index.html                  # هيكل الـ SPA + شاشة الترحيب + وسوم المشاركة
├── app.js                      # التطبيق كامله (~6900 سطر، JS صِرف)
├── app.css                     # كل التنسيقات
├── config.js                   # احتياطي: قيم Supabase للاستضافة الثابتة
├── vendor-supabase-2.112.3.js  # مكتبة supabase-js مستضافة محلياً (إصدار مثبّت)
├── manifest.webmanifest        # PWA
├── icon.svg
└── lazma-1173*.jpg             # صور الوثائق التاريخية الافتراضية

lib/
├── almfrje-schema.ts           # مصدر المخطّط الوحيد (SQL نصّي idempotent)
├── almfrje-env.ts              # قراءة متغيّرات البيئة (URL/مفاتيح)
├── almfrje-phone.ts            # تطبيع أرقام الجوال (منطق مشترك خادم/عميل)
└── db.ts                       # عميل pg للاتصال المباشر بالقاعدة (للإعداد/الترقية)

app/
├── page.tsx                    # الجذر «/» → redirect('/almfrje/')
├── layout.tsx                  # layout جذر (غير مستخدم فعلياً للمفارجة)
├── almfrje-config/route.ts     # يُرجع قيم Supabase العامة كـ JS للعميل
└── api/
    ├── almfrje-setup/route.ts        # تشغيل/ترقية المخطّط (idempotent)
    ├── almfrje-admin/route.ts        # عمليات إدارية بمفتاح الخدمة (إنشاء/تعديل حساب)
    ├── almfrje-create-user/route.ts  # إنشاء مستخدم Auth للعضو الجديد
    ├── almfrje-signup/route.ts       # تسجيل الزائر الذاتي (ينشئ عضواً معلّقاً)
    ├── almfrje-guest-verify/route.ts # مطابقة اسم الزائر للدخول
    ├── almfrje-presence/route.ts     # المتواجدون الآن
    ├── almfrje-upload/route.ts       # رفع الملفات إلى Storage بمفتاح الخدمة
    ├── almfrje-delete-person/route.ts# حذف شخص (مدير فقط) مع نسخة للسلة
    ├── almfrje-feedback/route.ts     # ملاحظات/طلبات الزوّار
    ├── almfrje-backup/route.ts       # النسخ السحابية (يومي + فوري + استعادة)
    └── almfrje-config/route.ts       # نسخة API من إعدادات العميل

next.config.mjs                 # التوجيه (rewrites) + ترويسات الأمان/التخزين
wrangler.jsonc                  # إعداد Cloudflare Worker
open-next.config.ts             # إعداد OpenNext
.github/workflows/almfrje-daily-backup.yml   # كرون يومي يستدعي /api/almfrje-backup
```

> ملاحظة: `public/legacy/` و`database/` وملفّات README القديمة تخصّ تطبيقاتٍ
> أخرى في نفس المستودع (منصّة الاستشارات). لا تُعدّلها عند العمل على المفارجة.

---

## 4) التوجيه والنشر

### التوجيه (`next.config.mjs`)
- الجذر `/` → `app/page.tsx` يعيد التوجيه إلى `/almfrje/`.
- `/almfrje`, `/almfrje/`, `/almfrji`, `/almfrji/` → تُخدَم `public/almfrje/index.html`.
- `/almfrje/:path*` → أصول ثابتة مع ترويسة `revalidate` (تحديثٌ متكرّر مضبوط).
- ترويسات الأمان تُطبَّق على كل المسارات؛ و`no-cache` على `index.html` والـ API.

### النشر
1. ادفع إلى `main` على GitHub.
2. يلتقط Cloudflare الدفع، يبني عبر OpenNext، وينشر خلال ~دقيقة.
3. **إبطال التخزين المؤقّت للواجهة إلزامي:** الملفّات مربوطة بمَعلَمة إصدار في
   `index.html`:
   ```html
   app.css?v=20260823c   app.js?v=20260823c
   ```
   **مع كل تعديل على `app.js`/`app.css` غيّر رقم الإصدار في المواضع الثلاثة**
   (preload، noscript، سكربت app.js). الصيغة `YYYYMMDD` + حرف تسلسلي.

### التحقّق من وصول النسخة للحافة
بعد الدفع، تحقّق أن الحافة قدّمت الإصدار الجديد فعلاً (لا القديم من الكاش):
```bash
curl -fsSL "https://almfrje.alaoufi.me/almfrje/app.js?v=<VER>" | grep -c '<علامة مميّزة من تعديلك>'
curl -fsSL "https://almfrje.alaoufi.me/" | grep -c 'app.js?v=<VER>'
```
يجب أن يعيد كلاهما ≥ 1.

---

## 5) طبقة البيانات في الواجهة (`app.js`)

### التهيئة والحالة
- عميل Supabase يُنشأ من القيم القادمة من `/almfrje-config` (أو `config.js`
  احتياطاً)، والمكتبة مستضافة محلياً `vendor-supabase-*.js`.
- الحالة العامة في الكائن `C` (persons/branches/members/settings…) و`byId`
  (خريطة id→شخص) و`childrenOf`/`descCount` (فهارس مشتقّة تُبنى بعد التحميل).
- `me` = سجلّ العضو الحالي، و`meResolved` علمٌ يمنع وميض «يحتاج تفعيل».

### الجلب — قاعدة حرجة
```js
fetchAll(table, cols='*', pageSize=1000)
```
> **PostgREST يحدّ كل استجابة بـ 1000 صف.** لذلك `pageSize` يجب ألّا يتجاوز 1000،
> والحلقة تصفّح بالإزاحة حتى `out.length < pageSize`. **لا تجعلها 10000** —
> ذلك يكسر التصفّح فتختفي صفوفٌ (فرعٌ كامل) بصمت. الأشخاص تُجلب بإسقاط أعمدة عبر
> `PERSONS_FULL_COLS` / `PERSONS_PUB_COLS`؛ والملاحظات تُجلب عند الطلب في
> `loadPersonExtra(id)`.

### التوجيه داخل الـ SPA
- التنقّل بالـ hash: `#/tree/123`, `#/person/45`, …
- كائن `ROUTES` يربط الاسم بـ `{ t: العنوان, back: زرّ الرجوع, fn: دالة الشاشة }`.
- `render()` يقرأ الـ hash، يضبط العنوان/التبويب، **يعرض مؤشّر فتحٍ فوريّاً**
  (`.screen-spin`) ثم يستدعي `fn(arg)`. الشاشات المتزامنة تستبدل المؤشّر في نفس
  اللحظة (بلا وميض)، والشاشات التي تجلب أولاً تُبقيه حتى تجهز.
- إضافة شاشة جديدة: اكتب `function screenX(arg){…}` واربطها في `ROUTES`، وأضِف
  زرّ دخولٍ `data-go="#/x"` (يُفعّله `bindGo`).

### بنية `app.js` (خرائط الأقسام)
الملف مقسّم بلافتات `/* ===== … ===== */`. أبرزها: المسميّات، أدوات عامة، نظام
التعليمات (i)، نوافذ التأكيد (Promise)، الحالة العامة، طبقة البيانات، التوجيه،
المكوّنات المشتركة، العارض (Lightbox)، لوحة التحكم، البحث المتقدّم، أدوات
المشجّرة، خط الأجيال، الدائرية، الطباعة، **صفحة الشخص**، فهرسة الذرية، الشجرة
التفاعلية، تتبّع الفرع، حاسبة القرابة، إضافة/تعديل شخص، الفروع، التقارير،
ملاحظات الزوّار، **التسجيل الذاتي**، المزيد، الاستيراد، التعديل الجماعي، الدليل،
الأسئلة الشائعة، المناقشات، سجل التعديلات، **النسخ الاحتياطية**، الملف الشخصي،
الأعضاء والصلاحيات، سلة المحذوفات، المودال. (~47 دالة شاشة.)

### مكوّنات متكرّرة
- `openModal(title, body, onMount, opts)` — نافذة، تُغلق بزرّ ✕ في الزاوية.
- `openLightbox(list, i)` — عارض صور بتنقّل.
- `confirm2()/prompt2()` — نوافذ تعِد Promise.
- `avatar(p, lg)` — صورة الشخص أو أيقونة احتياطية.
- `toast()`, `showLoading(bool)`, `esc()`, `normalizeAr()`, `lineageShort()`.

---

## 6) المصادقة ونموذج الحسابات

- لكل عضو مستخدمٌ في Supabase Auth ببريدٍ وكلمة مرور **اصطناعيَّيْن** مشتقَّين
  من جواله — لا يُدخل المستخدم بريداً حقيقياً:
  ```js
  phoneToEmail(phone) = `${normPhone(phone)}@almfrje.app`
  pinToPass(pin)      = `${pin}@Almfrje`      // ← لاحقة إلزامية للتوافق الرجعي
  ```
  > **لا تغيّر لاحقة `@Almfrje` ولا نطاق `@almfrje.app`** — تغييرها يُعطّل دخول كل
  > الحسابات القائمة. `normPhone` في العميل مطابقٌ تماماً لـ `normalizePhone`
  > في الخادم (`lib/almfrje-phone.ts`).
- كلمة المرور حرّة (٤ خانات فأكثر، أحرف/أرقام/رموز، غير رقمية بحتة):
  `PIN_RE = /^.{4,}$/`.
- **تسريع الدخول:** المسار السريع يجرّب `signInWithPassword` مباشرةً بالجوال قبل
  اللجوء إلى RPC `almfrje_resolve_login` (الأبطأ).
- **الزائر:** يدخل بمطابقة اسمه الثلاثي بالشجرة (`almfrje-guest-verify`) دون حساب.
  الموقع خاصّ: عدم المطابقة يعيد رسالة خصوصية. بعد المطابقة يُطلب تسجيلٌ ذاتي
  (`almfrje-signup`) ينشئ عضواً `role='viewer'` بحالة `perms.unverified` ينتظر
  توثيق الإدارة، لكنه يتصفّح فوراً (قراءةً فقط).

### الأدوار والصلاحيات
- الأدوار: `admin` (مدير النظام) > `general_manager` (مشرف عام) > `branch_manager`
  (مشرف فرع) > `viewer` (زائر).
- صلاحيات المشرفين دقيقة في `members.perms` (jsonb) ونطاقها في `members.branch_ids`.
- دوالّ العميل: `isAdmin()`, `isManager()`, `canEditPerson(p)`, `canDelete()`,
  `canReorder(p)`, `hideForGuest(what)` — كلّها تعكس منطق RLS في القاعدة.

---

## 7) قاعدة البيانات

**المصدر الوحيد للمخطّط:** `lib/almfrje-schema.ts` (نصّ SQL كامل، كل الأوامر
`IF NOT EXISTS` / `OR REPLACE` فيمكن إعادة تشغيله بأمان). يُطبَّق عبر
`/api/almfrje-setup` (وأيضاً `/api/migrate`). طابعُ الإصدار `schema_rev` في جدول
`almfrje_settings`.

> **الترقية تلقائية:** عند دخول **مدير النظام** يُستدعى `/api/almfrje-setup`
> بتوكنه بصمت فتُطبَّق أي تغييرات بنيوية جديدة. عند إضافة عمودٍ/دالة، عدّل ملف
> المخطّط وارفع `schema_rev`، ثم يكفي دخول المدير مرّة لتطبيقها. كما أن بعض
> عمليات الإدراج تُعيد استدعاء `almfrje-setup` عند اكتشاف عمودٍ مفقود (مرونة).

### الجداول (بادئة `almfrje_`)
| الجدول | الغرض |
|---|---|
| `branches` | الفروع (جدّ + ذريّته)، `root_id`, `manager_id`, `branch_ids` |
| `members` | الحسابات: `role`, `perms` jsonb, `branch_ids`, `person_id`, `phone_public` |
| `persons` | الأشخاص (الشجرة): `father_id`, `branch_id`, `generation`, `sort`, `status`, `photo_url`, `phone`, … |
| `documents` | مكتبة الشخص: `person_id`, `kind`(photo/pdf/doc), `url`, `label`, `category`('' / poem_by / poem_about), `is_public`, `body` |
| `settings` | إعدادات مفتاح/قيمة (نصوص الواجهة، schema_rev، …) |
| `trash` | نسخ العناصر المحذوفة/المعدّلة للاسترجاع |
| `audit` | سجل التعديلات (من/متى) |
| `backups` | فهرسة النسخ الاحتياطية |
| `feedback` | ملاحظات/طلبات الزوّار |
| `topics`, `topic_msgs`, `topic_reads` | المناقشات الداخلية (إدارة عليا) |

### الدوال الأساسية (RPC / RLS)
`almfrje_role`, `almfrje_is_member`, `almfrje_is_admin`, `almfrje_is_supervisor`,
`almfrje_my_branch`, `almfrje_manages_branch`, `almfrje_perm`,
`almfrje_can_see_person`, `almfrje_can_edit_person`, `almfrje_descendant_ids`,
`almfrje_can_see_doc`, `almfrje_public_search`, `almfrje_resolve_login`,
`almfrje_norm_phone`, `almfrje_claim_admin`, `almfrje_ensure_guest`,
`almfrje_can_discuss`, `almfrje_admin_wipe_persons`, `almfrje_handle_new_user`.

### الخصوصية (RLS) — أمثلة مهمّة
- **الجوال:** يُحفظ في `persons.phone` لكن لا يُعرض للعامة؛ يظهر لصاحبه وللإدارة
  فقط (منطق العرض في العميل + إسقاط الأعمدة العامة `PERSONS_PUB_COLS`).
- **عناصر المكتبة:** `docs_sel` تستخدم `almfrje_can_see_doc(person_id, is_public)`:
  يُرى العنصر إذا كان عامّاً، أو المستخدم مدير، أو صاحبه (عبر `members.person_id`)،
  أو من ذريّته (عبر `almfrje_descendant_ids`). المخفيّ يظهر بقفلٍ 🔒 لمن يراه.

---

## 8) واجهات الـ API (خادم)

كلّها Route Handlers في `app/api/`، معظمها `force-dynamic`، وتستخدم **مفتاح
الخدمة** (`SUPABASE_SERVICE_ROLE_KEY`) للعمليات التي تتجاوز RLS بأمانٍ من الخادم:

- `almfrje-setup` — تشغيل/ترقية المخطّط. بتوكن المدير أو داخلياً.
- `almfrje-admin` / `almfrje-create-user` — إنشاء/تعديل حسابات؛ تحقّق كلمة المرور
  `length >= 4`.
- `almfrje-signup` — تسجيل الزائر: عضو `is_active:true, perms:{unverified:true}`.
- `almfrje-guest-verify` — مطابقة الاسم؛ عدم المطابقة يعيد رسالة الموقع الخاص.
- `almfrje-presence` — يخزّن الاسم؛ يُرجع قائمة المتواجدين للمدير/المشرف العام فقط.
- `almfrje-upload` — رفع إلى Storage (folders: photos/docs).
- `almfrje-delete-person` — حذف مع نسخة للسلة (مدير فقط).
- `almfrje-backup` — انظر القسم التالي.

---

## 9) النسخ الاحتياطية السحابية

- **يومي تلقائي:** `.github/workflows/almfrje-daily-backup.yml` (كرون +
  `workflow_dispatch`) يستدعي `/api/almfrje-backup` مع الترويسة
  `Authorization: Bearer ${{ secrets.ALMFRJE_CRON_SECRET }}`.
- **٧ خانات دوّارة** حسب يوم الأسبوع: `almfrje_wday-{0..6}-{sun..sat}.json`
  (السبت يستبدل السبت)، مع حذف الملفّات غير الأسبوعية. تُخزَّن في Supabase Storage.
- **فوري + استعادة:** من لوحة التحكم ← «النسخ والتصدير» ← «☁️ النسخ السحابية»:
  إنشاء نسخة فورية، سرد النسخ بالتاريخ/الوقت، والاستعادة مع تأكيدات —
  **الاستعادة لمدير النظام فقط**.
- **التنزيل** يستخدم `showSaveFilePicker` (اختيار مجلّد على سطح المكتب) مع اسم
  ملفٍّ مؤرّخ، ويسقط تلقائياً إلى رابط تنزيلٍ على الجوال.

سرّ `ALMFRJE_CRON_SECRET` مضبوطٌ في: أسرار GitHub Actions **و** متغيّرات بيئة
Cloudflare (يجب تطابق القيمتين).

---

## 10) متغيّرات البيئة

انظر `.env.example`. الأساسية للمفارجة:
```
NEXT_PUBLIC_SUPABASE_URL        = https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY   = eyJ...            (عام — للعميل)
SUPABASE_SERVICE_ROLE_KEY       = eyJ...            (سرّي — للخادم فقط)
ALMFRJE_CRON_SECRET             = <سرّ النسخ اليومية>
```
تُضبَط في لوحة Cloudflare (Production) وفي أسرار GitHub للنسخ اليومية. لا تُسرّب
مفتاح الخدمة إلى العميل إطلاقاً.

---

## 11) التطوير محلياً

```bash
cp .env.example .env.local     # عبّئ القيم
npm install
npm run dev                    # http://localhost:3000  → يعيد التوجيه إلى /almfrje/
```
- تعديل الواجهة = تعديل `public/almfrje/app.js` / `app.css` مباشرةً (لا خطوة بناء).
- **بعد كل تعديل:** `node --check public/almfrje/app.js` للتحقّق النحوي، ثم ارفع
  رقم الإصدار في `index.html`.
- `npm test` يشغّل اختبارات `test/*.test.mjs`. `npm run check:boundaries` يمنع
  تسرّب الاعتماديات بين التطبيقات (يعمل في `prebuild`).

---

## 12) مسارات عملٍ شائعة

- **إضافة حقلٍ لشخص:** عدّل نموذج `screenPersonEdit`/`savePerson` + أضِف العمود في
  `almfrje-schema.ts` وارفع `schema_rev` + أضِفه إلى `PERSONS_FULL_COLS` (وإلى
  `PERSONS_PUB_COLS` إن كان عامّاً).
- **إضافة شاشة:** `function screenX(){…}` + قيدٌ في `ROUTES` + زرّ `data-go`.
- **إضافة قسمٍ للمكتبة:** وسّع `DOC_CATS` وعرضَ `loadDocsCard` وحفظَ `addDocModal`.
- **تعديل نصوص الواجهة:** معظمها في جدول `settings` ويحرّرها المدير من «النصوص»؛
  الدليل والأسئلة الشائعة في مصفوفتَي `GUIDE`/`FAQ` داخل `app.js`.

---

## 13) مزالق يجب الانتباه لها

1. **حدّ 1000 صف في PostgREST:** `fetchAll` يجب أن يبقى `pageSize <= 1000`.
2. **لاحقة كلمة المرور والبريد الاصطناعي:** `@Almfrje` و`@almfrje.app` ثابتتان.
3. **إبطال الكاش:** ارفع `?v=` في المواضع الثلاثة بـ `index.html` مع كل تعديل واجهة.
4. **الترقية عند دخول المدير:** أي تغيير مخطّط يحتاج دخول مدير مرّة (أو استدعاء
   `almfrje-setup`) — لا تفترض وجود العمود فوراً؛ اكتب إدراجاً مرِناً يعيد الترقية
   عند خطأ عمودٍ مفقود.
5. **`guest_branch` للأعضاء:** لا تستعمل `almfrje_guest_branch` (sessionStorage)
   إلا للزائر (`isGuestUser()`)؛ استعماله للأعضاء ينسب الفرع خطأً.
6. **الجوال يُحفظ لا يُحذف:** الخصوصية بالإخفاء عن العامة، لا بحذف القيمة.
7. **عزل التطبيقات:** لا تلمس `public/legacy/` ولا جداول بغير بادئة `almfrje_`.

---

## 14) الأمان — الحالة والتوصيات

**مطبّق ومؤكّد:**
- ترويسات الحماية (CSP، X‑Frame‑Options، nosniff، Referrer‑Policy، Permissions‑Policy، HSTS)
  على كل المسارات — بما فيها أصول `/almfrje/*` الثابتة عبر `public/_headers` (أصول
  Cloudflare لا تمرّ عبر `next.config`). يمنع التأطير/clickjacking وأنواعاً من XSS.
- كل مسارات الـ API المميّزة (إنشاء/تعديل المستخدمين، الحذف، الإعداد، النسخ) تتحقّق من
  رمز جلسة المُنادي عبر `auth.getUser()` ثم تعيد التأكّد أنه `admin && is_active` بمفتاح
  الخدمة قبل أي إجراء. مفتاح الخدمة لا يصل العميل أبداً (العميل يستلم مفتاح anon فقط).
- **التسجيل الذاتي محميٌّ من الانتحال:** `almfrje-guest-verify` يُصدر رمزاً موقّعاً
  (HMAC‑SHA256 عبر Web Crypto بمفتاح الخدمة، صلاحية ساعة) يربط الجلسة بالشخص المطابَق،
  و`almfrje-signup` يرفض أي `pid` بلا رمزٍ صالح — فلا يُنشأ حسابٌ باسم شخصٍ لم تُطابقه الجلسة.
- **قراءة ردود الملاحظات مربوطة بالهوية:** `myreplies`/`replyseen` لا يكشفان ردود مرسِلٍ
  إلا لصاحب الاسم (العضو باسمه المسجّل، والزائر برمز تحقّقه) — سدّ IDOR.
- مقارنة `CRON_SECRET` ثابتة الزمن.

**مؤجَّل — يحتاج إعداداً في لوحة Cloudflare (لا كوداً):**
- **حدّ معدّل على `almfrje-guest-verify`:** المسار عامٌّ (بلا رمز) ويمسح جدول الأشخاص كاملاً
  لكل طلب (لازمٌ لتتبّع سلسلة النسب)، فيمكن استنزافه أو استخدامه لتعداد الأسماء. المعالجة
  الصحيحة قاعدةُ **Rate Limiting** في Cloudflare (مثلاً: `/api/almfrje-guest-verify`
  ≤ ١٠ طلبات/دقيقة لكل IP). تُركت خارج الكود لأن الخنق داخل مسار الدخول الحرج قد يحجب
  مستخدمين شرعيين؛ والخطر محدود (يتطلّب ٣ أسماء صحيحة للكشف، والموقع خاصٌّ بالقبيلة).

## 15) مرجع سريع

| الحاجة | الموضع |
|---|---|
| منطق الشاشات كله | `public/almfrje/app.js` |
| التنسيقات | `public/almfrje/app.css` |
| هيكل الصفحة + الإصدار | `public/almfrje/index.html` |
| المخطّط والدوال وRLS | `lib/almfrje-schema.ts` |
| تطبيع الجوال | `lib/almfrje-phone.ts` |
| واجهات الخادم | `app/api/almfrje-*/route.ts` |
| التوجيه/الترويسات | `next.config.mjs` |
| النسخ اليومية | `.github/workflows/almfrje-daily-backup.yml` |
| إعداد Cloudflare | `wrangler.jsonc`, `open-next.config.ts` |
```

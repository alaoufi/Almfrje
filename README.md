# منصة الاستشارات

تطبيق ويب كامل (إدارة + مراجع) — منقول من LAMP إلى **Vercel + Supabase + Next.js**.

## البنية

- **الواجهة**: HTML + CSS + Vanilla JS (في `public/legacy/`)
- **الـ API**: Next.js Route Handler واحد في `app/api/php/[[...path]]/route.ts`
- **قاعدة البيانات**: Supabase (Postgres) — Schema في `database/schema.sql`
- **المصادقة**: JWT (HMAC-SHA256) متوافق مع التطبيق الأصلي

## الإعداد

### ١. Supabase
1. أنشئ مشروع على https://supabase.com
2. في **SQL Editor** نفّذ:
   ```
   database/schema.sql    ← المخطط (16 جدول)
   database/data.sql      ← البيانات + sequences
   ```

### ٢. متغيرات البيئة
في Vercel → Settings → Environment Variables، أضف:

```
NEXT_PUBLIC_SUPABASE_URL       = https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY      = eyJ...
JWT_SECRET                     = alaoufi_secret_2026_x9k2p   (نفس قيمة config.php الأصلي)
```

اختر **Production + Preview + Development** للثلاثة.

### ٣. النشر
أي push على الفرع الافتراضي يُنشر تلقائياً. أو من Vercel Dashboard → Deployments → Redeploy.

## التطوير محلياً

```bash
cp .env.example .env.local
# عبّئ القيم الثلاثة
npm install
npm run dev
# http://localhost:3000
```

## التنظيم

```
app/
├── layout.tsx                                # Next.js root layout (لا يُستخدم لـ /)
└── api/php/[[...path]]/route.ts              # كل endpoints API (≈20 resource)

lib/
└── db.ts                                     # Supabase client + JWT generate/verify

public/legacy/
├── index.html                                # الـ SPA الرئيسية (يُخدَم من /)
├── core.js, app.js, ...                      # 30 ملف JS/CSS
└── (كل ملفات الواجهة الأصلية بدون تعديل)

database/
├── schema.sql                                # CREATE TABLE × 16
└── data.sql                                  # INSERT INTO + setval

next.config.mjs                               # rewrite: / → /legacy/index.html
```

## ملاحظات نشر

- `force-dynamic` افتراضي على API لأن المصادقة تعتمد على الطلب
- لا توجد صفحات React مولّدة بشكل ثابت — كل شيء واجهة كلاسيكية يخدمها Vercel كأصول ثابتة + Function للـ API
- كلمات السر المُخزّنة hashed بـ bcrypt (PHP `password_hash`) ومتوافقة مع `bcryptjs` المستخدم في الـ API

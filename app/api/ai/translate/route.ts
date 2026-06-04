import { NextRequest, NextResponse } from 'next/server';
import { authFromHeader, isAuthError, db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// قد تحتاج 8-15 ثانية للـ PDFs المتعدّدة الصفحات
export const maxDuration = 60;

// المُقدّم المفضّل: Gemini (مجاني) — مع Claude كاحتياط لو وُجد مفتاحه
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';
const ANTHROPIC_VERSION = '2023-06-01';

interface ContentBlock {
  type: string;
  text?: string;
  source?: { type: string; media_type?: string; data?: string; url?: string };
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  error?: { message?: string };
}

// Body shape: { report_id: number }  (preferred — server-side lookup)
//          or  { url: string, type: 'image' | 'pdf' }  (legacy)
export async function POST(req: NextRequest) {
  // متاحة لكل من سجّل دخوله (مدير أو مراجع) — كل واحد يترجم تقاريره فقط.
  const auth = authFromHeader(req.headers.get('authorization'));
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!geminiKey && !anthropicKey) {
    return NextResponse.json({
      error: 'الذكاء الاصطناعي غير مهيّأ — أضف GEMINI_API_KEY (مجاني) أو ANTHROPIC_API_KEY في Vercel، ثم Redeploy',
    }, { status: 500 });
  }

  // قراءة اختيار المدير من جدول settings (auto / gemini / claude)
  let providerChoice: 'auto' | 'gemini' | 'claude' = 'auto';
  try {
    const sup0 = db();
    const { data: s } = await sup0.from('settings').select('value').eq('key_name', 'ai_provider').maybeSingle();
    const v = (s as { value?: string } | null)?.value;
    if (v === 'gemini' || v === 'claude') providerChoice = v;
  } catch { /* الإعدادات اختيارية */ }

  // فرض الاختيار
  if (providerChoice === 'gemini' && !geminiKey) {
    return NextResponse.json({ error: 'تم اختيار Gemini لكن لا يوجد GEMINI_API_KEY في Vercel' }, { status: 500 });
  }
  if (providerChoice === 'claude' && !anthropicKey) {
    return NextResponse.json({ error: 'تم اختيار Claude لكن لا يوجد ANTHROPIC_API_KEY في Vercel' }, { status: 500 });
  }
  // useGemini: true لو الاختيار gemini، أو auto مع توفّر مفتاح gemini
  const useGemini = providerChoice === 'gemini' || (providerChoice === 'auto' && !!geminiKey);

  let body: { url?: string; type?: string; report_id?: number | string };
  try { body = await req.json(); } catch { body = {}; }

  let url = '';
  let kind: 'pdf' | 'image' = 'image';
  const reportId = Number(body.report_id || 0);

  // المسار المفضّل: ابحث عن التقرير في القاعدة (موثوق وآمن)
  if (reportId > 0) {
    try {
      const supabase = db();
      const { data: rpt } = await supabase
        .from('reports')
        .select('id, reviewer_id, file_url, file_type')
        .eq('id', reportId)
        .maybeSingle();
      if (!rpt) return NextResponse.json({ error: 'التقرير غير موجود' }, { status: 404 });
      const r = rpt as { id: number; reviewer_id: number; file_url: string; file_type: string };
      // المراجع يستطيع ترجمة تقاريره فقط؛ المدير يستطيع ترجمة أيّ تقرير
      if (auth.role !== 'admin' && r.reviewer_id !== auth.uid) {
        return NextResponse.json({ error: 'لا تستطيع ترجمة ملف ليس لك' }, { status: 403 });
      }
      url = r.file_url || '';
      kind = r.file_type === 'pdf' ? 'pdf' : 'image';
    } catch (e: unknown) {
      return NextResponse.json({ error: 'فشل قراءة التقرير: ' + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
    }
  } else {
    // مسار قديم — URL مباشر
    url = typeof body.url === 'string' ? body.url : '';
    kind = body.type === 'pdf' ? 'pdf' : 'image';
  }

  if (!url) return NextResponse.json({ error: 'الرابط مطلوب' }, { status: 400 });

  // Download the file from public URL, send as base64 to Claude
  let mediaType = kind === 'pdf' ? 'application/pdf' : 'image/jpeg';
  let base64Data = '';
  try {
    const fileRes = await fetch(url);
    if (!fileRes.ok) {
      return NextResponse.json({ error: 'تعذّر جلب الملف من Supabase (' + fileRes.status + ')' }, { status: 400 });
    }
    const ct = fileRes.headers.get('content-type') || '';
    // Claude يقبل: jpeg, png, gif, webp للصور — و application/pdf للوثائق.
    // طبّع content-type ليكون مقبولاً (مثل image/jpg → image/jpeg).
    if (kind === 'pdf') {
      mediaType = 'application/pdf';
    } else {
      const lc = ct.toLowerCase();
      if (lc.indexOf('png') >= 0)       mediaType = 'image/png';
      else if (lc.indexOf('gif') >= 0)  mediaType = 'image/gif';
      else if (lc.indexOf('webp') >= 0) mediaType = 'image/webp';
      else if (lc.indexOf('jpeg') >= 0 || lc.indexOf('jpg') >= 0) mediaType = 'image/jpeg';
      else if (lc.indexOf('heic') >= 0 || lc.indexOf('heif') >= 0) {
        return NextResponse.json({ error: 'صيغة HEIC/HEIF غير مدعومة. حوّل الصورة إلى JPG أو PNG.' }, { status: 400 });
      }
      else mediaType = 'image/jpeg'; // افتراض آمن
    }
    const buf = await fileRes.arrayBuffer();
    if (buf.byteLength === 0) {
      return NextResponse.json({ error: 'الملف فارغ' }, { status: 400 });
    }
    if (buf.byteLength > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'الملف كبير جداً للترجمة (الحد 20MB)' }, { status: 400 });
    }
    base64Data = Buffer.from(buf).toString('base64');
  } catch (e: unknown) {
    return NextResponse.json({ error: 'فشل تحميل الملف: ' + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }

  const prompt = `أنت مترجم طبي متخصّص. هذا الملف غالباً تقرير طبي (مختبر، أشعة، وصفة، استشارة، أو ما شابه). مهمّتك ترجمته إلى العربية الفصحى مع الحفاظ على الدقّة الطبية.

تعليمات إلزامية:
1. اقرأ كامل محتوى الملف — قد يحتوي **عدّة صفحات** أو أقسام، اقرأها كلها بالترتيب.
2. لو النص بلغة غير العربية (إنجليزية مثلاً)، ترجمه ترجمة طبية دقيقة بمصطلحات الطب الصحيحة.
3. أبقِ كل مصطلح طبي إنجليزي بين قوسين بعد ترجمته. مثال: «ضغط الدم (Blood Pressure)»، «التهاب الكبد الفيروسي (Hepatitis)»، «صورة دم كاملة (CBC)».
4. حافظ على **كل الأرقام كما هي** بلا تقريب: نتائج التحاليل، الجرعات، التواريخ، التركيزات، الوحدات (mg, mmol/L, mmHg…).
5. لو الملف عربي أصلاً، أعد عرضه بترتيب واضح + استخرج المصطلحات الإنجليزية المقابلة لمساعدة الفهم.
6. **لا تُشخّص ولا تنصح طبيّاً** — مهمّتك الترجمة فقط. التفسير الطبي والقرار للطبيب المعالج.
7. لو الملف صورة بدون نصوص واضحة، صفها وصفاً دقيقاً (نوع الفحص، الجهة، المنطقة المُصوَّرة...).
8. **إبراز القيم خارج المعدل الطبيعي** (مهمّ جداً): استخدم الترميز التالي حول أي قيمة شاذّة لتظهر بلون مميّز للمستخدم:
   - مرتفعة:  \`{{HIGH:القيمة + الوحدة (مرتفع)}}\`
   - منخفضة: \`{{LOW:القيمة + الوحدة (منخفض)}}\`
   - حديّة/مشكوك فيها: \`{{BORDER:القيمة (على الحد)}}\`
   استخدم الترميز في كل مكان يَرِد فيه ذِكر القيمة (المحتوى المُترجم + جدول القيم + الملخّص + الملاحظات).
   اعتمد فقط على:
   • قيم وُسِمَت فعلياً في التقرير (بـ H, L, ↑, ↓, *, خط أحمر، أو ذُكرت كملاحظة)
   • أو قيم لها مدى مرجعي مكتوب في التقرير وقيمتها خارجه فعلاً
   لا تَستَنتِج من معرفة طبية عامة — فقط ما يمكن إثباته من التقرير نفسه. عند الشك، **لا تُعَلِّم**.
   أمثلة صحيحة:
   • {{HIGH:Glucose: 180 mg/dL (مرتفع)}}
   • {{LOW:Hemoglobin (Hb): 8.5 g/dL (منخفض)}}
   • {{BORDER:140/85 mmHg (على الحد)}}

اعرض النتيجة بهذا الشكل بالضبط:

**📋 نوع التقرير:**
(مثال: نتيجة تحليل دم، تقرير أشعة سينية، وصفة دواء، تقرير استشارة، خطة علاج...)

**📝 المحتوى مترجَم:**
(الترجمة الكاملة منظّمة بنفس ترتيب الأصل — كل قسم تحت عنوان فرعي إن أمكن. المصطلحات الإنجليزية بين قوسين.)

**🔢 القيم والنتائج العددية:**
(لو وُجدت نتائج عددية، اعرضها كقائمة:
- اسم الفحص (English): القيمة + الوحدة | المدى الطبيعي إن ذُكر في التقرير
…)
لو لا توجد قيم عددية اكتب: «—».

**📌 ملخّص في نقاط:**
(٣-٥ نقاط مختصرة جداً عن أهم ما في التقرير.)

**⚠️ ملاحظات جديرة بالانتباه:**
(أي قيمة موسومة في التقرير نفسه بأنّها خارج المعدل الطبيعي، أو ملاحظة مكتوبة من الطبيب في الملف. **لا تستنتج من عندك** — فقط ما هو مكتوب فعلياً في الملف. لو لا شيء اكتب: «لا توجد ملاحظات معلّمة في التقرير».)

**ℹ️ تنبيه:**
هذه ترجمة آلية للمساعدة على فهم محتوى التقرير. القرار الطبي والتفسير يعودان لطبيبك المعالج.`;

  // ─── المُقدّم: حسب اختيار المدير ───────────────────────────────
  let text = '';
  let modelUsed = '';

  if (useGemini && geminiKey) {
    interface GeminiResponse {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
      error?: { message?: string };
    }
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(geminiKey)}`;
    try {
      const r = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mediaType, data: base64Data } },
              { text: prompt },
            ],
          }],
          generationConfig: {
            maxOutputTokens: 4096,
            temperature: 0.2, // أدنى لأن الترجمة الطبية تحتاج دقّة لا إبداع
          },
        }),
      });
      const gRes = await r.json() as GeminiResponse;
      if (!r.ok) {
        return NextResponse.json({ error: 'خطأ من Gemini: ' + (gRes?.error?.message || r.statusText) }, { status: 500 });
      }
      text = gRes.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
      modelUsed = GEMINI_MODEL;
    } catch (e: unknown) {
      return NextResponse.json({ error: 'تعذّر الاتصال بـ Gemini: ' + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
    }
  } else if (anthropicKey) {
    const fileBlock: ContentBlock = kind === 'pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Data } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } };
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 4096,
          messages: [
            { role: 'user', content: [fileBlock as object, { type: 'text', text: prompt }] },
          ],
        }),
      });
      const aiRes = await r.json() as AnthropicResponse;
      if (!r.ok) {
        return NextResponse.json({ error: 'خطأ من Claude: ' + (aiRes?.error?.message || r.statusText) }, { status: 500 });
      }
      text = aiRes.content?.find((c) => c.type === 'text')?.text || '';
      modelUsed = ANTHROPIC_MODEL;
    } catch (e: unknown) {
      return NextResponse.json({ error: 'تعذّر الاتصال بـ Claude: ' + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
    }
  }

  if (!text) return NextResponse.json({ error: 'لم يصل رد من الذكاء' }, { status: 500 });

  return NextResponse.json({ ok: true, text, model: modelUsed });
}

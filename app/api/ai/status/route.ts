import { NextRequest, NextResponse } from 'next/server';
import { authFromHeader, isAuthError, db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// يُعيد حالة مُقدّمي الذكاء الاصطناعي دون كشف المفاتيح نفسها.
// المدير يستخدمها لمعرفة أيّ مفتاح مُهيّأ في Vercel.
export async function GET(req: NextRequest) {
  const auth = authFromHeader(req.headers.get('authorization'), true);
  if (isAuthError(auth)) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const geminiReady = !!process.env.GEMINI_API_KEY;
  const claudeReady = !!process.env.ANTHROPIC_API_KEY;

  let provider: 'auto' | 'gemini' | 'claude' = 'auto';
  try {
    const supabase = db();
    const { data } = await supabase.from('settings').select('value').eq('key_name', 'ai_provider').maybeSingle();
    const v = (data as { value?: string } | null)?.value;
    if (v === 'gemini' || v === 'claude') provider = v;
  } catch { /* اختيار افتراضي auto */ }

  return NextResponse.json({
    ok: true,
    gemini_ready: geminiReady,
    claude_ready: claudeReady,
    provider, // 'auto' | 'gemini' | 'claude'
  });
}

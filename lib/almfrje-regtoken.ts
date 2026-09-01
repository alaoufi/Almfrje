// رمز تسجيلٍ موقّع يربط جلسة التحقّق بالاسم بالشخص (pid) الذي طابقه فعلاً.
// يُصدره /api/almfrje-guest-verify عند المطابقة، ويتحقّق منه /api/almfrje-signup
// قبل إنشاء الحساب — فلا يستطيع أحدٌ التسجيل باسم شخصٍ لم يُطابقه (منع الانتحال).
// التوقيع HMAC-SHA256 عبر Web Crypto (متاحٌ أصلاً على Cloudflare Workers) بمفتاح
// الخدمة السرّي (لا يصل العميل أبداً). صلاحيةٌ قصيرة.
const TTL_MS = 60 * 60 * 1000;   // ساعة — تكفي لملء نموذج التسجيل بعد التحقّق

function toHex(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0');
  return s;
}

async function hmacHex(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return toHex(sig);
}

export async function signRegToken(pid: number, secret: string): Promise<string> {
  const exp = Date.now() + TTL_MS;
  const body = `${pid}.${exp}`;
  return `${body}.${await hmacHex(body, secret)}`;
}

export async function verifyRegToken(token: unknown, pid: number, secret: string): Promise<boolean> {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return false;
  const [p, exp, sig] = parts;
  if (Number(p) !== Number(pid)) return false;
  const e = Number(exp);
  if (!Number.isFinite(e) || Date.now() > e) return false;
  const expected = await hmacHex(`${p}.${exp}`, secret);
  // مقارنةٌ ثابتة الزمن (بلا خروجٍ مبكر يكشف عدد المحارف المطابقة)
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';

let _db: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (_db) return _db;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars missing');
  _db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _db;
}

function jwtSecret(): string {
  const s = process.env.JWT_SECRET;
  // If a strong secret is configured, use it. Otherwise fall back to the
  // original Hostinger value so existing tokens keep working — set
  // JWT_SECRET in Vercel to override this with a stronger value.
  return s && s.length >= 16 ? s : 'alaoufi_secret_2026_x9k2p';
}

export interface AuthPayload {
  uid: number;
  role: 'admin' | 'reviewer' | 'inviter';
  exp: number;
}

export function generateToken(uid: number, role: 'admin' | 'reviewer' | 'inviter'): string {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  // 31536000s = 365 days — long enough that returning visitors stay logged in
  // without a fresh prompt, matching the "remember me" behaviour the user asked for.
  const p = Buffer.from(JSON.stringify({ uid, role, exp: Math.floor(Date.now() / 1000) + 31536000 })).toString('base64');
  const s = createHmac('sha256', jwtSecret()).update(`${h}.${p}`).digest('base64');
  return `${h}.${p}.${s}`;
}

export function verifyToken(token: string | null): AuthPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  let expected: string;
  try {
    expected = createHmac('sha256', jwtSecret()).update(`${h}.${p}`).digest('base64');
  } catch {
    return null;
  }
  // Constant-time signature compare to deny byte-by-byte timing oracle.
  const a = Buffer.from(s);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const d = JSON.parse(Buffer.from(p, 'base64').toString('utf8'));
    if (!d || typeof d.exp !== 'number' || d.exp <= Math.floor(Date.now() / 1000)) return null;
    return d as AuthPayload;
  } catch {
    return null;
  }
}

export function authFromHeader(authHeader: string | null, adminOnly = false): AuthPayload | { error: string; status: number } {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim() ?? '';
  const d = verifyToken(token);
  if (!d) return { error: 'غير مصرح', status: 401 };
  if (adminOnly && d.role !== 'admin') return { error: 'للمدير فقط', status: 403 };
  return d;
}

export function isAuthError(x: AuthPayload | { error: string; status: number }): x is { error: string; status: number } {
  return (x as { error?: string }).error !== undefined;
}

/**
 * Best-effort presence touch: update the calling user's `last_seen` so the
 * admin can see who's currently active. Silently no-ops if the request is
 * unauthenticated, the token is bad, or the column is missing.
 */
export async function touchLastSeen(authHeader: string | null): Promise<void> {
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim() ?? '';
  const d = verifyToken(token);
  if (!d) return;
  try {
    await db().from('users').update({ last_seen: new Date().toISOString() }).eq('id', d.uid);
  } catch { /* column may be missing on old DBs — ignore */ }
}

/**
 * Quote a literal value for use inside a PostgREST filter expression
 * such as `.or("name.eq.${quote(v)}")`. Commas, parens, and dots are
 * meaningful syntax characters in PostgREST; wrapping the value in
 * double quotes and escaping inner quotes/backslashes keeps user
 * input from breaking out of its slot.
 */
export function pgrstQuote(v: unknown): string {
  const s = String(v ?? '');
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

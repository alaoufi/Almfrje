import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Pool } from 'pg';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function findConnectionString(): string | null {
  const host = process.env.POSTGRES_HOST;
  const password = process.env.POSTGRES_PASSWORD;
  if (host && password) {
    let derivedUser = 'postgres';
    if (!process.env.POSTGRES_USER) {
      const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
      const m = supaUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
      if (m && host.includes('pooler.supabase.com')) derivedUser = `postgres.${m[1]}`;
    }
    const user = process.env.POSTGRES_USER || derivedUser;
    const port = process.env.POSTGRES_PORT || '6543';
    const database = process.env.POSTGRES_DATABASE || 'postgres';
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
  }
  for (const key of ['POSTGRES_URL_NON_POOLING', 'POSTGRES_URL', 'DATABASE_URL', 'SUPABASE_DB_URL']) {
    const v = process.env[key];
    if (v && v.trim()) return v;
  }
  return null;
}

function describeErr(e: unknown): Record<string, unknown> {
  if (!e || typeof e !== 'object') return { value: String(e) };
  const o: Record<string, unknown> = {};
  for (const k of ['name', 'message', 'code', 'errno', 'syscall', 'hostname', 'address', 'port', 'severity', 'detail', 'hint', 'position', 'where', 'schema', 'table', 'constraint', 'file', 'line', 'routine']) {
    const v = (e as Record<string, unknown>)[k];
    if (v !== undefined && v !== null && v !== '') o[k] = v;
  }
  if (e instanceof Error && e.stack) o.stack = e.stack.split('\n').slice(0, 5).join('\n');
  if (Object.keys(o).length === 0) o.raw = JSON.stringify(e, Object.getOwnPropertyNames(e)).slice(0, 500);
  return o;
}

function projectRef(): string | null {
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const m = supaUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m?.[1] ?? null;
}

function envSnapshot() {
  const out: Record<string, string> = {};
  out.SUPABASE_PAT = process.env.SUPABASE_PAT ? `<set, len=${process.env.SUPABASE_PAT.length}>` : '<missing>';
  out.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '<missing>';
  out.derived_project_ref = projectRef() ?? '<could not derive>';
  out.POSTGRES_HOST = process.env.POSTGRES_HOST || '<missing>';
  out.POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD ? `<set, len=${process.env.POSTGRES_PASSWORD.length}>` : '<missing>';
  if (process.env.POSTGRES_USER) {
    out.POSTGRES_USER = process.env.POSTGRES_USER;
  } else {
    const ref = projectRef();
    const host = process.env.POSTGRES_HOST || '';
    out.POSTGRES_USER = (ref && host.includes('pooler.supabase.com'))
      ? `<derived: postgres.${ref}>` : '<default: postgres>';
  }
  out.POSTGRES_PORT = process.env.POSTGRES_PORT || '<default: 6543>';
  out.POSTGRES_DATABASE = process.env.POSTGRES_DATABASE || '<default: postgres>';
  for (const k of ['POSTGRES_URL_NON_POOLING', 'POSTGRES_URL', 'DATABASE_URL', 'SUPABASE_DB_URL']) {
    const v = process.env[k];
    if (!v) { out[k] = '<missing>'; continue; }
    try {
      const u = new URL(v);
      out[k] = `parsed: ${u.protocol}//${u.username}@${u.hostname}:${u.port}${u.pathname} (len=${v.length})`;
    } catch {
      const atIdx = v.indexOf('@');
      const colonAfterCreds = v.indexOf(':', v.indexOf('//') + 2);
      const prefix = colonAfterCreds > 0 ? v.slice(0, colonAfterCreds + 1) : v.slice(0, Math.min(30, v.length));
      const tail = atIdx > 0 ? v.slice(atIdx) : '';
      out[k] = `unparsable len=${v.length} prefix="${prefix}***${tail}"`;
    }
  }
  return out;
}

async function tableHasRows(pool: Pool, table: string): Promise<number | 'missing'> {
  try {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM ${table}`);
    return rows[0]?.c ?? 0;
  } catch (e) {
    if (e instanceof Error && /does not exist/.test(e.message)) return 'missing';
    throw e;
  }
}

async function runViaManagementApi(force: boolean) {
  const pat = process.env.SUPABASE_PAT!;
  const ref = projectRef();
  if (!ref) {
    return NextResponse.json({
      ok: false,
      error: 'تعذّر استخراج project ref من NEXT_PUBLIC_SUPABASE_URL',
      env: envSnapshot(),
    }, { status: 500 });
  }
  const endpoint = `https://api.supabase.com/v1/projects/${ref}/database/query`;

  async function runSql(query: string): Promise<{ ok: boolean; data?: unknown; error?: unknown; status: number }> {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${pat}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const text = await r.text();
    let data: unknown = text;
    try { data = JSON.parse(text); } catch { /* keep as text */ }
    if (!r.ok) return { ok: false, error: data, status: r.status };
    return { ok: true, data, status: r.status };
  }

  if (!force) {
    const probe = await runSql('SELECT COUNT(*)::int AS c FROM users');
    if (probe.ok && Array.isArray(probe.data) && (probe.data[0] as { c?: number })?.c && (probe.data[0] as { c: number }).c > 0) {
      const c = (probe.data[0] as { c: number }).c;
      return NextResponse.json({
        ok: true, already_set_up: true, users: c,
        message: `الجداول موجودة وفيها ${c} مستخدم. أضف ?force=1 لإعادة التشغيل من الصفر.`,
      });
    }
  }

  const sqlPath = join(process.cwd(), 'database', 'setup.sql');
  const sql = readFileSync(sqlPath, 'utf8');

  const run = await runSql(sql);
  if (!run.ok) {
    return NextResponse.json({
      ok: false,
      via: 'management_api',
      status: run.status,
      error_details: run.error,
      env: envSnapshot(),
    }, { status: 500 });
  }

  const counts = await runSql(`
    SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM forms) AS forms,
      (SELECT COUNT(*) FROM submissions) AS submissions,
      (SELECT COUNT(*) FROM appointments) AS appointments,
      (SELECT COUNT(*) FROM messages) AS messages,
      (SELECT COUNT(*) FROM publications) AS publications,
      (SELECT COUNT(*) FROM settings) AS settings
  `);
  return NextResponse.json({ ok: true, via: 'management_api', counts: counts.ok ? (counts.data as unknown[])[0] : null });
}

async function runViaPostgres(force: boolean) {
  const url = findConnectionString()!;
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1, connectionTimeoutMillis: 10000 });
  try {
    const userCount = await tableHasRows(pool, 'users');
    if (!force && typeof userCount === 'number' && userCount > 0) {
      return NextResponse.json({
        ok: true, via: 'postgres', already_set_up: true, users: userCount,
        message: `الجداول موجودة وفيها ${userCount} مستخدم. أضف ?force=1 لإعادة التشغيل من الصفر.`,
      });
    }
    const sqlPath = join(process.cwd(), 'database', 'setup.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    await pool.query(sql);
    const { rows: counts } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM forms) AS forms,
        (SELECT COUNT(*) FROM submissions) AS submissions,
        (SELECT COUNT(*) FROM appointments) AS appointments,
        (SELECT COUNT(*) FROM messages) AS messages,
        (SELECT COUNT(*) FROM publications) AS publications,
        (SELECT COUNT(*) FROM settings) AS settings
    `);
    return NextResponse.json({ ok: true, via: 'postgres', counts: counts[0] });
  } catch (e) {
    return NextResponse.json({
      ok: false, via: 'postgres',
      error_details: describeErr(e),
      env: envSnapshot(),
    }, { status: 500 });
  } finally {
    try { await pool.end(); } catch { /* ignore */ }
  }
}

async function runSetup(force: boolean) {
  // Prefer Management API if PAT is set — it sidesteps URL parsing issues entirely.
  if (process.env.SUPABASE_PAT) return runViaManagementApi(force);
  // Otherwise try direct Postgres connection.
  if (findConnectionString()) return runViaPostgres(force);
  return NextResponse.json({
    ok: false,
    error: 'لم يُعثر على أي طريقة اتصال. أضف SUPABASE_PAT (موصى به) أو POSTGRES_HOST+POSTGRES_PASSWORD أو POSTGRES_URL_NON_POOLING في Vercel.',
    hints: {
      management_api: 'الأسهل: ولّد Personal Access Token من https://supabase.com/dashboard/account/tokens وأضفه كـ SUPABASE_PAT.',
      split_vars: 'أو أضف POSTGRES_HOST (host الـ pooler) و POSTGRES_PASSWORD (كلمة السر كما هي).',
      full_url: 'أو أضف POSTGRES_URL_NON_POOLING (URI كامل من Supabase Connection pooling section).',
    },
    env: envSnapshot(),
  }, { status: 500 });
}

function checkSetupAuth(request: Request): NextResponse | null {
  // /api/setup is destructive (DROP TABLE … CASCADE on every table). Require
  // a SETUP_TOKEN env var to be configured AND presented as ?token=… or as
  // an `X-Setup-Token` header. Without it, refuse every request.
  const expected = process.env.SETUP_TOKEN;
  if (!expected || expected.length < 8) {
    return NextResponse.json({
      ok: false,
      error: 'SETUP_TOKEN env var is missing or too short. Set it in Vercel before calling /api/setup.',
    }, { status: 503 });
  }
  const url = new URL(request.url);
  const provided = url.searchParams.get('token') || request.headers.get('x-setup-token') || '';
  if (provided !== expected) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  const denial = checkSetupAuth(request); if (denial) return denial;
  const force = new URL(request.url).searchParams.get('force') === '1';
  return runSetup(force);
}
export async function POST(request: Request) {
  const denial = checkSetupAuth(request); if (denial) return denial;
  const force = new URL(request.url).searchParams.get('force') === '1';
  return runSetup(force);
}

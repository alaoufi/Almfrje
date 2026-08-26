#!/usr/bin/env node
// =============================================================================
//  حارس حدود المشاريع — يمنع التداخل البرمجي بين مشاريع المنصّة الأربعة.
// =============================================================================
//  يفشل البناء (exit 1) إذا:
//   (أ) استورد ملفُ مشروعٍ وحدةَ @/lib مملوكةً لمشروعٍ آخر.
//   (ب) أشار ملفُ مشروعٍ إلى متغيّر بيئةٍ يخصّ مشروعاً آخر (ALMFRJE_/CON_/NOTES_).
//  المتغيّرات المشتركة (NEXT_PUBLIC_*, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PAT)
//  مسموحة للجميع كرجوعٍ انتقالي. راجع SEPARATION.md و PROJECTS.md.
//
//  يُشغَّل تلقائياً قبل البناء (prebuild) فيتعطّل النشر عند أي تداخل جديد.
// =============================================================================
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');

// ── ملكية ملفات lib (وحدات قابلة للاستيراد عبر @/lib/...) ──
const LIB_OWNER = {
  'almfrje-env': 'almfrji',
  'almfrje-schema': 'almfrji',
  'db': 'con',
  'notes-env': 'notes',
};

// ── بادئات متغيّرات البيئة الخاصة بكل مشروع ──
const ENV_OWNER = { ALMFRJE_: 'almfrji', CON_: 'con', NOTES_: 'notes' };

// ── تحديد مشروع أي ملف من مساره (نسبةً للجذر، بفواصل /) ──
function projectOf(rel) {
  const p = rel.replace(/\\/g, '/');
  if (p.startsWith('lib/')) {
    const base = p.slice(4).replace(/\.tsx?$/, '');
    return LIB_OWNER[base] || 'shared';
  }
  if (p.startsWith('app/api/almfrje-')) return 'almfrji';
  if (p.startsWith('app/api/notes-')) return 'notes';
  if (/^app\/api\/(php|migrate|setup|upload|ai|keepalive)\b/.test(p)) return 'con';
  // app/layout.tsx وغيره من البنية المشتركة
  return 'shared';
}

// ── جمع كل ملفات TS/TSX تحت app/ و lib/ ──
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const files = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'lib'))];
const violations = [];

for (const full of files) {
  const rel = relative(ROOT, full);
  const proj = projectOf(rel);
  if (proj === 'shared') continue; // البنية المشتركة قد تستورد أي شيء
  const src = readFileSync(full, 'utf8');

  // (أ) استيرادات @/lib
  for (const m of src.matchAll(/from\s+['"]@\/lib\/([a-z0-9-]+)['"]/gi)) {
    const owner = LIB_OWNER[m[1]];
    if (owner && owner !== proj) {
      violations.push(`${rel}\n    ← يستورد @/lib/${m[1]} المملوك لمشروع «${owner}» (هذا الملف لمشروع «${proj}»)`);
    }
  }

  // (ب) متغيّرات بيئة مشروعٍ آخر
  for (const m of src.matchAll(/process\.env\.([A-Z]+_)[A-Z0-9_]*/g)) {
    const owner = ENV_OWNER[m[1]];
    if (owner && owner !== proj) {
      violations.push(`${rel}\n    ← يستخدم متغيّر بيئة «${m[0].replace('process.env.', '')}» الخاص بمشروع «${owner}» (هذا الملف لمشروع «${proj}»)`);
    }
  }
}

if (violations.length) {
  console.error('\n❌ تداخلٌ بين المشاريع — البناء متوقّف:\n');
  for (const v of violations) console.error('  • ' + v + '\n');
  console.error('كل مشروع يستورد وحداته ومتغيّراته فقط. راجع PROJECTS.md.\n');
  process.exit(1);
}

console.log('✅ حدود المشاريع سليمة: لا تداخل بين almfrji / con / notes.');

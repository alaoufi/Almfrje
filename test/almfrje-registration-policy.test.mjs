import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {
  registrationInputError,
  isReservedRegistrationName,
  pendingMemberRecord,
  memberCanUseApp,
} from '../lib/almfrje-registration-policy.ts';

test('requires an existing living person, mobile number, password, and verified token', () => {
  assert.match(registrationInputError({ person: null, phone: '0500000000', password: '1234', tokenVerified: true }) || '', /قاعدة البيانات/);
  assert.match(registrationInputError({ person: { name: 'محمد', status: 'alive' }, phone: '', password: '1234', tokenVerified: true }) || '', /الجوال/);
  assert.match(registrationInputError({ person: { name: 'محمد', status: 'alive' }, phone: '0500000000', password: '', tokenVerified: true }) || '', /كلمة المرور/);
  assert.match(registrationInputError({ person: { name: 'محمد', status: 'alive' }, phone: '0500000000', password: '1234', tokenVerified: false }) || '', /التحقق/);
  assert.match(registrationInputError({ person: { name: 'محمد', status: 'dead' }, phone: '0500000000', password: '1234', tokenVerified: true }) || '', /الاسم/);
  assert.equal(registrationInputError({ person: { name: 'محمد', status: 'alive' }, phone: '0500000000', password: '1234', tokenVerified: true }), null);
});

test('inactive and legacy unverified accounts cannot use the application', () => {
  assert.equal(memberCanUseApp({ is_active: false, perms: {} }), false);
  assert.equal(memberCanUseApp({ is_active: true, perms: { unverified: true } }), false);
  assert.equal(memberCanUseApp({ is_active: true, perms: {} }), true);
});

test('rejects visitor as a registration name after Arabic normalization', () => {
  for (const name of ['زائر', ' الزائر ', 'زَائِر', 'زائر']) assert.equal(isReservedRegistrationName(name), true, name);
  assert.equal(isReservedRegistrationName('زاهر'), false);
});

test('browser gate also blocks legacy unverified accounts and promises no immediate browsing', () => {
  const source = fs.readFileSync(new URL('../public/almfrje/app.js', import.meta.url), 'utf8');
  assert.match(source, /function memberCanUseApp\(m\)/);
  assert.doesNotMatch(source, /تم تسجيلك — تصفّح الآن/);
});

test('new self-registration is inactive and has no administrative permissions', () => {
  assert.deepEqual(pendingMemberRecord({ userId: 'u1', fullName: 'محمد بن علي', phone: '0500000000', personId: 9, phonePublic: true }), {
    user_id: 'u1', full_name: 'محمد بن علي', phone: '0500000000', role: 'viewer',
    is_active: false, person_id: 9, perms: {}, phone_public: true,
  });
});

test('signup route does not modify the family-tree person before approval', () => {
  const source = fs.readFileSync(new URL('../app/api/almfrje-signup/route.ts', import.meta.url), 'utf8');
  const signup = source.slice(source.indexOf('const pid = Number(b.pid)'));
  assert.match(signup, /pendingMemberRecord/);
  assert.doesNotMatch(signup, /from\('almfrje_persons'\)\.update\(patch\)/);
  assert.doesNotMatch(signup, /is_active:\s*true/);
});

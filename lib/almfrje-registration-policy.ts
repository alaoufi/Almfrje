type RegistrationPerson = { name?: unknown; status?: unknown } | null;

function normalizedArabicName(value: unknown) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/gi, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}]/gu, '')
    .replace(/^ال/, '');
}

export function isReservedRegistrationName(value: unknown) {
  return normalizedArabicName(value) === 'زاير';
}

export function registrationInputError(input: {
  person: RegistrationPerson;
  phone: unknown;
  password: unknown;
  tokenVerified: boolean;
}) {
  if (!input.tokenVerified) return 'تعذّر التحقق من الاسم المسجّل';
  if (!input.person) return 'لا يسمح بالتسجيل إلا لمن كان مسجلاً مسبقاً في قاعدة البيانات';
  if (isReservedRegistrationName(input.person.name)) return 'لا يقبل التسجيل باسم زائر';
  if (String(input.person.status || '') === 'dead') return 'لا يمكن التسجيل بهذا الاسم';
  if (String(input.phone || '').length < 9) return 'أدخل رقم الجوال الصحيح لإكمال التسجيل';
  if (String(input.password || '').trim().length < 4) return 'أدخل كلمة المرور لإكمال التسجيل';
  return null;
}

export function pendingMemberRecord(input: {
  userId: string;
  fullName: string;
  phone: string;
  personId: number;
  phonePublic: boolean;
}) {
  return {
    user_id: input.userId,
    full_name: input.fullName,
    phone: input.phone,
    role: 'viewer',
    is_active: false,
    person_id: input.personId,
    perms: {},
    phone_public: input.phonePublic,
  };
}

export function memberCanUseApp(member: { is_active?: unknown; perms?: unknown } | null) {
  if (!member || member.is_active !== true) return false;
  const permissions = member.perms && typeof member.perms === 'object'
    ? member.perms as Record<string, unknown>
    : {};
  return permissions.unverified !== true;
}

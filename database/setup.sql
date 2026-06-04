-- منصة الاستشارات — مخطط Postgres
-- يُنفّذ في Supabase SQL Editor

-- تنظيف ما قد يكون باقي من المخطط القديم
DROP TABLE IF EXISTS submission_answers CASCADE;
DROP TABLE IF EXISTS submission_discussions CASCADE;
DROP TABLE IF EXISTS submissions CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS appointment_dates CASCADE;
DROP TABLE IF EXISTS slots CASCADE;
DROP TABLE IF EXISTS form_fields CASCADE;
DROP TABLE IF EXISTS form_assignments CASCADE;
DROP TABLE IF EXISTS forms CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS threads CASCADE;
DROP TABLE IF EXISTS publications CASCADE;
DROP TABLE IF EXISTS sections CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- تنظيف الجداول من النسخة السابقة (Supabase-style)
DROP TABLE IF EXISTS post_comments, post_likes, posts, conversations,
  reviewer_followups, session_evaluations, session_evaluation_fields,
  appointment_slots, appointment_periods, form_recommendations,
  form_submissions, form_sections, categories, app_settings,
  password_reset_requests, user_roles, profiles CASCADE;

CREATE TABLE users (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(100) NOT NULL,
  username        VARCHAR(50)  NOT NULL UNIQUE,
  phone           VARCHAR(20)  NOT NULL,
  password        VARCHAR(255) NOT NULL,
  role            VARCHAR(20)  DEFAULT 'reviewer',
  allowed_special SMALLINT     DEFAULT 0,
  created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  status          VARCHAR(20)  DEFAULT 'active'
);

CREATE TABLE settings (
  id        SERIAL PRIMARY KEY,
  key_name  VARCHAR(100) NOT NULL UNIQUE,
  value     TEXT
);

CREATE TABLE sections (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order  INTEGER   DEFAULT 0,
  active      SMALLINT  DEFAULT 1,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE forms (
  id         SERIAL PRIMARY KEY,
  section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL,
  title      VARCHAR(100) NOT NULL,
  subtitle   VARCHAR(200),
  status     VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE form_fields (
  id                SERIAL PRIMARY KEY,
  form_id           INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  label             VARCHAR(100) NOT NULL,
  field_type        VARCHAR(30) DEFAULT 'text',
  required          SMALLINT DEFAULT 0,
  sort_order        INTEGER DEFAULT 0,
  category          VARCHAR(100) DEFAULT 'عام',
  placeholder       VARCHAR(300) DEFAULT '',
  conditional_field VARCHAR(100),
  conditional_value VARCHAR(200),
  options           TEXT,
  sub_fields        JSONB
);

CREATE TABLE form_assignments (
  id         SERIAL PRIMARY KEY,
  form_id    INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uniq_fa UNIQUE (form_id, user_id)
);

CREATE TABLE assignments (
  id         SERIAL PRIMARY KEY,
  form_id    INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hidden     SMALLINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT unique_assignment UNIQUE (form_id, user_id)
);

CREATE TABLE submissions (
  id                  SERIAL PRIMARY KEY,
  form_id             INTEGER REFERENCES forms(id) ON DELETE SET NULL,
  reviewer_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status              VARCHAR(30) DEFAULT 'pending',
  notes               TEXT,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  internal_notes      TEXT,
  reviewer_notes      TEXT,
  highlighted_answers JSONB
);

CREATE TABLE submission_answers (
  id              SERIAL PRIMARY KEY,
  submission_id   INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  field_id        INTEGER REFERENCES form_fields(id) ON DELETE SET NULL,
  answer          TEXT,
  highlight_color VARCHAR(20),
  admin_note      TEXT
);

CREATE TABLE submission_discussions (
  id            SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  from_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body          TEXT NOT NULL,
  is_read       SMALLINT DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE slots (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  time_from  TIME,
  time_to    TIME,
  status     VARCHAR(20) DEFAULT 'closed',
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE appointment_dates (
  id      SERIAL PRIMARY KEY,
  slot_id INTEGER REFERENCES slots(id) ON DELETE CASCADE,
  date    DATE NOT NULL,
  status  VARCHAR(20) DEFAULT 'available'
);

CREATE TABLE appointments (
  id             SERIAL PRIMARY KEY,
  reviewer_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  date_id        INTEGER REFERENCES appointment_dates(id) ON DELETE SET NULL,
  status         VARCHAR(30) DEFAULT 'pending',
  notes          TEXT,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_exceptional SMALLINT DEFAULT 0
);

CREATE TABLE threads (
  id          SERIAL PRIMARY KEY,
  reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  status      VARCHAR(20) DEFAULT 'active',
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  archived_at TIMESTAMP
);

CREATE TABLE messages (
  id            SERIAL PRIMARY KEY,
  from_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  to_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body          TEXT NOT NULL,
  is_read       SMALLINT DEFAULT 0,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  file_url      VARCHAR(500),
  file_type     VARCHAR(20),
  file_name     VARCHAR(255),
  file_size     INTEGER DEFAULT 0,
  status        VARCHAR(20) DEFAULT 'sent',
  thread_id     INTEGER REFERENCES threads(id) ON DELETE SET NULL,
  thread_title  VARCHAR(200)
);

CREATE TABLE publications (
  id                SERIAL PRIMARY KEY,
  title             VARCHAR(200) NOT NULL,
  content           TEXT,
  type              VARCHAR(20) DEFAULT 'article',
  file_path         VARCHAR(300),
  views             INTEGER DEFAULT 0,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status            VARCHAR(20) DEFAULT 'active',
  description       TEXT,
  thumbnail_data    TEXT,
  original_filename VARCHAR(300),
  file_size         INTEGER DEFAULT 0
);

-- مؤشرات للأداء
CREATE INDEX idx_messages_to    ON messages(to_id);
CREATE INDEX idx_messages_from  ON messages(from_id);
CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_apt_reviewer   ON appointments(reviewer_id);
CREATE INDEX idx_apt_date       ON appointments(date_id);
CREATE INDEX idx_sub_form       ON submissions(form_id);
CREATE INDEX idx_sub_reviewer   ON submissions(reviewer_id);
CREATE INDEX idx_sub_answers    ON submission_answers(submission_id);
CREATE INDEX idx_form_fields    ON form_fields(form_id);
-- تعطيل فحص الـ FK والـ triggers أثناء استيراد البيانات (للتغلب على ترتيب التبعيات)
SET session_replication_role = replica;

INSERT INTO appointments (id, reviewer_id, date_id, status, notes, created_at, is_exceptional) VALUES
(1, NULL, 1, 'cancelled_reviewer', 'ممكن الحجز', '2026-05-10 04:25:08', 0),
(2, NULL, NULL, 'completed', NULL, '2026-05-10 04:25:08', 0),
(3, 11, NULL, 'completed', NULL, '2026-05-10 04:25:08', 0),
(4, NULL, 1, 'cancelled_admin', NULL, '2026-05-10 04:25:08', 0),
(5, 4, 6, 'cancelled_admin', '', '2026-05-10 13:34:35', 0),
(6, 8, 7, 'cancelled_reviewer', '', '2026-05-10 21:33:23', 0),
(7, 8, 10, 'confirmed', '', '2026-05-15 17:51:51', 0);
INSERT INTO appointment_dates (id, slot_id, date, status) VALUES
(1, 2, '2026-04-30', 'available'),
(2, 1, '2026-05-25', ''),
(3, 1, '2026-05-23', 'locked'),
(4, 1, '2026-05-20', 'locked'),
(5, 2, '2026-05-09', 'locked'),
(6, 1, '2026-05-06', 'available'),
(7, 1, '2026-05-07', 'available'),
(8, 1, '2026-05-11', 'locked'),
(9, 1, '2026-05-13', 'locked'),
(10, 1, '2026-05-14', ''),
(11, 1, '2026-05-16', 'locked'),
(12, 1, '2026-05-18', 'locked'),
(13, 1, '2026-05-21', 'locked'),
(14, 1, '2026-05-30', 'locked'),
(15, 1, '2026-05-28', 'locked'),
(16, 1, '2026-05-27', 'locked'),
(17, 1, '2026-05-17', 'available');
INSERT INTO forms (id, section_id, title, subtitle, status, created_at) VALUES
(1, 1, 'التشنجات والصرع', 'التشنجات والصرع', 'active', '2026-05-10 04:25:07'),
(2, 1, 'الذئبة الحمراء', NULL, 'active', '2026-05-10 04:25:07'),
(3, 2, 'القولون التقرحي', '', 'active', '2026-05-10 04:25:07'),
(4, 1, 'التصلب المتعدد', '', 'active', '2026-05-10 04:25:07'),
(6, 3, 'حالة عامة', '', 'active', '2026-05-10 04:25:07');
INSERT INTO form_assignments (id, form_id, user_id, created_at) VALUES
(1, 6, 4, '2026-05-10 13:04:45'),
(2, 6, 8, '2026-05-10 21:29:55'),
(3, 4, 8, '2026-05-15 17:18:24'),
(6, 3, 8, '2026-05-16 21:52:53'),
(7, 6, 10, '2026-05-19 15:14:30'),
(9, 3, 10, '2026-05-19 15:42:21'),
(10, 4, 10, '2026-05-19 15:44:31');
INSERT INTO form_fields (id, form_id, label, field_type, required, sort_order, category, placeholder, conditional_field, conditional_value, options, sub_fields) VALUES
(3, 2, 'هل فيه عوامل  تثير تهيج', 'radio', 1, 17, 'أعراض المرض', 'مثل تتأثر من أكل معين او من الشمس ', NULL, NULL, NULL, NULL),
(4, 2, 'هل تستخدم أدوية ', 'radio', 1, 14, 'الحالة الصحية', 'اذا موجود تذكر بالتفاصيل', NULL, NULL, NULL, NULL),
(7, 2, 'هل هناك تأثر في', 'checkbox', 1, 18, 'أعراض المرض', NULL, NULL, NULL, NULL, NULL),
(8, 1, 'بداية الشكوى', 'text', 1, 12, 'الحالة الصحية', 'تقريبا من متى يشتكي', NULL, NULL, NULL, NULL),
(9, 1, 'التشخيص', 'text', 1, 13, 'الحالة الصحية', 'ان وجد', NULL, NULL, NULL, NULL),
(11, 1, 'الاسم', 'text', 1, 1, 'البيانات الشخصية', ' الاسم المرجعي', NULL, NULL, NULL, NULL),
(12, 1, 'رقم الجوال', 'phone', 1, 2, 'البيانات الشخصية', '05xxxxxxxx', NULL, NULL, NULL, NULL),
(13, 1, 'العمر', 'number', 1, 6, 'البيانات الشخصية', NULL, NULL, NULL, NULL, NULL),
(14, 1, 'الطول', 'number', 0, 7, 'البيانات الشخصية', NULL, NULL, NULL, NULL, NULL),
(15, 1, 'الوزن', 'number', 0, 8, 'البيانات الشخصية', NULL, NULL, NULL, NULL, NULL),
(16, 1, 'مكان الإقامة', 'text', 1, 9, 'البيانات الشخصية', 'مكان الاقامة الحالي', NULL, NULL, NULL, NULL),
(17, 1, 'المؤهل', 'select', 0, 10, 'البيانات الشخصية', NULL, NULL, NULL, NULL, NULL),
(18, 1, 'التخصص', 'text', 0, 11, 'البيانات الشخصية', 'يفضل', NULL, NULL, NULL, NULL),
(19, 1, 'طبيعة العمل', 'text', 0, 12, 'البيانات الشخصية', 'نشاطه اليومي', NULL, NULL, NULL, NULL),
(20, 1, 'الضغط', 'radio', 1, 14, 'الحالة الصحية', NULL, NULL, NULL, NULL, NULL),
(21, 1, 'النبض', 'radio', 1, 15, 'الحالة الصحية', NULL, NULL, NULL, NULL, NULL),
(22, 1, 'السكر', 'radio', 1, 16, 'الحالة الصحية', NULL, NULL, NULL, NULL, NULL),
(37, 1, 'الاكسوجين', 'radio', 1, 17, 'الحالة الصحية', NULL, NULL, NULL, NULL, NULL),
(38, 1, 'الأعضاء المتأثرة ', 'text', 1, 18, 'أعراض المرض', NULL, NULL, NULL, NULL, NULL),
(39, 1, 'أي الجانبين متأثر أكثر', 'checkbox', 1, 19, 'أعراض المرض', NULL, NULL, NULL, NULL, NULL),
(40, 1, 'مستوى الحالة النفسية', 'radio', 1, 19, 'الحالة الصحية', 'اذا غير طبيعي يذكر بالتفاصيل', NULL, NULL, NULL, NULL),
(41, 1, 'هل هناك تأثر في', 'checkbox', 1, 20, 'أعراض المرض', NULL, NULL, NULL, NULL, NULL),
(42, 1, 'مستوى حركة الأطراف ', 'number', 1, 21, 'أعراض المرض', 'نسبة مئوية مثل  100%', NULL, NULL, NULL, NULL),
(43, 1, 'مستوى المشي', 'number', 1, 22, 'أعراض المرض', 'نسبة مئوية مثل  100%', NULL, NULL, NULL, NULL),
(44, 1, 'مستوى البلع', 'number', 0, 23, 'أعراض المرض', 'نسبة مئوية مثل  100%', NULL, NULL, NULL, NULL),
(45, 1, 'مستوى التنفس', 'number', 0, 24, 'أعراض المرض', 'نسبة مئوية مثل  100%', NULL, NULL, NULL, NULL),
(46, 1, 'هل هناك ضعف بالاطراف', 'radio', 1, 25, 'أعراض المرض', 'حركة واستخدام الاطراف', NULL, NULL, NULL, NULL),
(48, 1, 'مستوى حجم الكتلة العضلية', 'radio', 1, 26, 'أعراض المرض', NULL, NULL, NULL, NULL, NULL),
(50, 1, 'هل هناك تيبس في الأطراف', 'radio', 1, 27, 'أعراض المرض', 'حركة المفاصل خاصة الأرجل', NULL, NULL, NULL, NULL),
(53, 1, 'هل هناك امراض مصاحبة', 'radio', 1, 28, 'الحالة الصحية', 'اذا موجود تذكر بالتفاصيل', NULL, NULL, NULL, NULL),
(54, 1, 'هل تستخدم أدوية ', 'radio', 1, 29, 'الحالة الصحية', NULL, NULL, NULL, NULL, NULL),
(55, 1, 'هل تستخدم نظام غذائي', 'radio', 1, 30, 'الحالة الصحية', 'نطام غذائي علاجي', NULL, NULL, NULL, NULL),
(56, 1, 'هل عمل علاج طبيعي', 'radio', 1, 32, 'الحالة الصحية', NULL, NULL, NULL, NULL, NULL),
(57, 1, 'هل الملاحظ تحسن ام نزول', 'radio', 1, 34, 'أعراض المرض', 'خلال المدة الماضية', NULL, NULL, NULL, NULL),
(58, 1, 'هل يحتاج مساعدة', 'radio', 1, 36, 'أعراض المرض', 'في حاجاته الخلصة', NULL, NULL, NULL, NULL),
(59, 1, 'تفاصيل الحالة من البداية', 'textarea', 1, 37, 'أعراض المرض', 'تفاصيل للحالة من بدايتها ', NULL, NULL, NULL, NULL),
(60, 1, 'تفاصيل الحالة', 'textarea', 1, 34, 'الحالة الصحية', 'تفاصيل شاملة عن الحالة', NULL, NULL, NULL, NULL),
(61, 1, 'الأعراض والشكوى', 'textarea', 1, 18, 'أعراض المرض', 'تكتب الاعراض على هيئة نقاط مختصرة', NULL, NULL, NULL, NULL),
(79, 2, 'الاسم', 'text', 1, 0, 'البيانات الشخصية', ' الاسم المرجعي', NULL, NULL, NULL, NULL),
(80, 2, 'الأعضاء المتأثرة ', 'textarea', 1, 19, 'أعراض المرض', 'الأعضاء سواء داخلية او حركية', NULL, NULL, NULL, NULL),
(83, 2, 'هل يوجد حرارة متكررة', 'radio', 0, 29, 'أعراض المرض', 'حرارة بالأعضاء او بالجسم ', NULL, NULL, NULL, NULL),
(84, 2, 'الوزن', 'number', 0, 5, 'البيانات الشخصية', 'تقريبي', NULL, NULL, NULL, NULL),
(85, 2, 'الأعراض والشكوى', 'textarea', 1, 16, 'أعراض المرض', 'تكتب الاعراض على هيئة نقاط مختصرة', NULL, NULL, NULL, NULL),
(86, 2, 'هل هناك امراض مصاحبة', 'radio', 1, 13, 'الحالة الصحية', NULL, NULL, NULL, NULL, NULL),
(87, 2, 'العمر', 'number', 1, 3, 'البيانات الشخصية', 'تقريبي', NULL, NULL, NULL, NULL),
(88, 2, 'هل تستخدم نظام غذائي', 'radio', 1, 15, 'الحالة الصحية', 'نطام غذائي علاجي', NULL, NULL, NULL, NULL),
(89, 2, 'مكان الإقامة', 'text', 1, 1, 'البيانات الشخصية', 'مكان الاقامة الحالي', NULL, NULL, NULL, NULL),
(90, 2, 'السكر', 'radio', 1, 11, 'الحالة الصحية', NULL, NULL, NULL, NULL, NULL),
(91, 2, 'التشخيص', 'text', 1, 7, 'الحالة الصحية', 'التشخيص الطبي ان وجد', NULL, NULL, NULL, NULL),
(92, 2, 'الضغط', 'radio', 1, 8, 'الحالة الصحية', NULL, NULL, NULL, NULL, NULL),
(116, 2, 'هل هناك ضعف بالاطراف', 'radio', 1, 21, 'أعراض المرض', 'حركة واستخدام الاطراف', NULL, NULL, NULL, NULL),
(117, 2, 'هل يوجد طفح جلدي او احمرار', 'radio', 1, 24, 'أعراض المرض', NULL, NULL, NULL, NULL, NULL),
(118, 2, 'هل يوجد آلام وتورمات في المفاصل', 'radio', 1, 23, 'أعراض المرض', NULL, NULL, NULL, NULL, NULL),
(119, 2, 'هل يحتاج مساعدة', 'radio', 1, 26, 'أعراض المرض', 'في حاجاته الخلصة', NULL, NULL, NULL, NULL),
(120, 2, 'هل الملاحظ تحسن ام نزول', 'radio', 1, 30, 'أعراض المرض', 'خلال المدة الماضية', NULL, NULL, NULL, NULL),
(121, 2, 'تفاصيل الحالة من البداية', 'textarea', 1, 31, 'أعراض المرض', 'تفاصيل للحالة من بدايتها ', NULL, NULL, NULL, NULL),
(122, 2, ' *  هل فيه حكة ثابته / متنقلة', 'radio', 0, 28, 'أعراض المرض', NULL, NULL, NULL, NULL, NULL),
(150, 2, 'طبيعة العمل', 'text', 0, 2, 'البيانات الشخصية', 'نشاطك اليومي', NULL, NULL, NULL, NULL),
(151, 2, 'هل هناك تيبس في الأطراف', 'radio', 1, 22, 'أعراض المرض', 'حركة المفاصل خاصة الأرجل', NULL, NULL, NULL, NULL),
(152, 2, 'الطول', 'number', 0, 4, 'البيانات الشخصية', 'تقريبي', NULL, NULL, NULL, NULL),
(155, 2, 'الاكسوجين', 'radio', 1, 10, 'الحالة الصحية', NULL, NULL, NULL, NULL, NULL),
(156, 2, 'بداية الشكوى', 'text', 1, 6, 'الحالة الصحية', 'تقريبا مما يشتكي ومن  متى', NULL, NULL, NULL, NULL),
(169, 2, 'هل هناك آلام متنقلة', 'radio', 1, 25, 'أعراض المرض', NULL, NULL, NULL, NULL, NULL),
(170, 2, 'هل لها تأثيرات  مرضية أخرى ', 'radio', 1, 27, 'أعراض المرض', 'هل لها تبين امراض أخرى مصاحبة', NULL, NULL, NULL, NULL),
(171, 2, 'النبض', 'radio', 1, 9, 'الحالة الصحية', NULL, NULL, NULL, NULL, NULL),
(172, 2, 'مستوى الحالة النفسية', 'radio', 1, 12, 'الحالة الصحية', NULL, NULL, NULL, NULL, NULL),
(177, 2, 'مستوى حركة الأطراف ', 'checkbox', 1, 20, 'أعراض المرض', 'نسبة مئوية مثل  100%', NULL, NULL, NULL, NULL),
(365, 3, 'الاسم', 'text', 1, 0, 'البيانات الشخصية', ' الاسم المرجعي', NULL, NULL, NULL, NULL),
(366, 3, 'مكان الإقامة', 'text', 1, 1, 'البيانات الشخصية', 'مكان الاقامة الحالي', NULL, NULL, NULL, NULL),
(367, 3, 'العمر', 'number', 1, 2, 'البيانات الشخصية', '', NULL, NULL, NULL, NULL),
(368, 3, 'الطول', 'number', 0, 3, 'البيانات الشخصية', '', NULL, NULL, NULL, NULL),
(369, 3, 'الوزن', 'number', 0, 4, 'البيانات الشخصية', '', NULL, NULL, NULL, NULL),
(370, 3, 'طبيعة العمل', 'text', 0, 5, 'البيانات الشخصية', 'نشاطه اليومي', NULL, NULL, NULL, NULL),
(371, 3, 'سامي5', 'select', 1, 6, 'البيانات الشخصية', '', NULL, NULL, '[]', NULL),
(372, 3, 'سامي5', 'select', 1, 7, 'البيانات الشخصية', '', NULL, NULL, '[]', NULL),
(373, 3, 'بداية الشكوى', 'text', 1, 100, 'الحالة الصحية', 'تقريبا من متى يشتكي', NULL, NULL, NULL, NULL),
(374, 3, 'التشخيص', 'text', 1, 101, 'الحالة الصحية', 'ان وجد', NULL, NULL, NULL, NULL),
(375, 3, 'الضغط', 'radio', 1, 102, 'الحالة الصحية', '', NULL, NULL, '[{\"label\":\"نعم\",\"has_sub\":true,\"sub\":{\"type\":\"text\",\"label\":\"كم النتيجة\",\"placeholder\":\"\",\"required\":true}},{\"label\":\"لا\",\"has_sub\":true,\"sub\":{\"type\":\"text\",\"label\":\"الحمدلله\",\"placeholder\":\"\",\"required\":false}}]', NULL),
(376, 3, 'النبض', 'radio', 1, 103, 'الحالة الصحية', '', NULL, NULL, '[]', NULL),
(377, 3, 'السكر', 'radio', 1, 104, 'الحالة الصحية', '', NULL, NULL, '[]', NULL),
(378, 3, 'الاكسوجين', 'radio', 1, 105, 'الحالة الصحية', '', NULL, NULL, '[]', NULL),
(379, 3, 'مستوى الحالة النفسية', 'radio', 1, 106, 'الحالة الصحية', 'اذا غير طبيعي يذكر بالتفاصيل', NULL, NULL, '[]', NULL),
(380, 3, 'هل هناك امراض مصاحبة', 'radio', 1, 107, 'الحالة الصحية', 'اذا موجود تذكر بالتفاصيل', NULL, NULL, '[]', NULL),
(381, 3, 'هل تستخدم أدوية ', 'radio', 1, 108, 'الحالة الصحية', '', NULL, NULL, '[]', NULL),
(382, 3, 'هل تستخدم نظام غذائي', 'radio', 1, 109, 'الحالة الصحية', 'نطام غذائي علاجي', NULL, NULL, '[]', NULL),
(383, 3, 'تحديد مكان الألم ', 'text', 1, 110, 'الحالة الصحية', '', NULL, NULL, NULL, NULL),
(384, 3, 'هل هناك قلق او اضطرابات  نفسية ', 'radio', 1, 111, 'الحالة الصحية', '', NULL, NULL, '[]', NULL),
(385, 3, 'تفاصيل الحالة', 'textarea', 1, 112, 'الحالة الصحية', 'تفاصيل شاملة عن الحالة', NULL, NULL, NULL, NULL),
(386, 3, 'هل اخذ خزعة مع النتيجة ', 'radio', 1, 113, 'الحالة الصحية', '', NULL, NULL, '[]', NULL),
(387, 3, 'هل تم استئصال جزء من الامعاء او القولون', 'radio', 0, 114, 'الحالة الصحية', '', NULL, NULL, '[]', NULL),
(388, 3, 'هل يوجد آلام  في البطن', 'radio', 1, 115, 'الحالة الصحية', '', NULL, NULL, '[]', NULL),
(389, 3, 'بعد الاكل مباشرة هل يذهب للحمام اسهال ', 'radio', 1, 116, 'الحالة الصحية', '', NULL, NULL, '[]', NULL),
(390, 3, 'هل الشكوى في الغالب مغص ام  الالام', 'radio', 0, 117, 'الحالة الصحية', '', NULL, NULL, '[]', NULL),
(391, 3, 'بعد الاكل مباشرة هل هناك استفراغ', 'radio', 0, 118, 'الحالة الصحية', '', NULL, NULL, '[]', NULL),
(392, 3, 'الأعضاء المتأثرة ', 'text', 1, 200, 'أعراض المرض', '', NULL, NULL, NULL, NULL),
(393, 3, 'الأعراض والشكوى', 'textarea', 1, 201, 'أعراض المرض', 'تكتب الاعراض على هيئة نقاط مختصرة', NULL, NULL, NULL, NULL),
(394, 3, 'أي الجانبين متأثر أكثر', 'checkbox', 1, 202, 'أعراض المرض', '', NULL, NULL, '[]', NULL),
(395, 3, 'هل هناك تأثر في', 'checkbox', 1, 203, 'أعراض المرض', '', NULL, NULL, '[]', NULL),
(396, 3, 'مستوى حركة الأطراف ', 'number', 1, 204, 'أعراض المرض', 'نسبة مئوية مثل  100%', NULL, NULL, NULL, NULL),
(397, 3, 'مستوى المشي', 'number', 1, 205, 'أعراض المرض', 'نسبة مئوية مثل  100%', NULL, NULL, NULL, NULL),
(398, 3, 'مستوى البلع', 'number', 0, 206, 'أعراض المرض', 'نسبة مئوية مثل  100%', NULL, NULL, NULL, NULL),
(399, 3, 'مستوى التنفس', 'number', 0, 207, 'أعراض المرض', 'نسبة مئوية مثل  100%', NULL, NULL, NULL, NULL),
(400, 3, 'هل هناك ضعف بالاطراف', 'radio', 1, 208, 'أعراض المرض', 'حركة واستخدام الاطراف', NULL, NULL, '[]', NULL),
(401, 3, 'مستوى حجم الكتلة العضلية', 'radio', 1, 209, 'أعراض المرض', '', NULL, NULL, '[]', NULL),
(402, 3, 'هل هناك تيبس في الأطراف', 'radio', 1, 210, 'أعراض المرض', 'حركة المفاصل خاصة الأرجل', NULL, NULL, '[]', NULL),
(403, 3, 'هل الملاحظ تحسن ام نزول', 'radio', 1, 211, 'أعراض المرض', 'خلال المدة الماضية', NULL, NULL, '[]', NULL),
(404, 3, 'هل يحتاج مساعدة', 'radio', 1, 212, 'أعراض المرض', 'في حاجاته الخلصة', NULL, NULL, '[]', NULL),
(405, 3, 'تفاصيل الحالة من البداية', 'textarea', 1, 213, 'أعراض المرض', 'تفاصيل للحالة من بدايتها ', NULL, NULL, NULL, NULL),
(406, 3, 'هل يوجد آلام  مع قضاء الحاجة', 'radio', 1, 214, 'أعراض المرض', '', NULL, NULL, '[]', NULL),
(407, 3, 'لون الدم ان وجد ', 'radio', 1, 215, 'أعراض المرض', '', NULL, NULL, '[]', NULL),
(408, 3, 'غزارة النزف الدموي ان وجد مستمر او متقطع', 'radio', 0, 216, 'أعراض المرض', '', NULL, NULL, '[]', NULL),
(931, 6, 'الاسم', 'text', 1, 0, 'البيانات الشخصية', ' الاسم المرجعي', NULL, NULL, NULL, NULL),
(932, 6, 'العمر', 'number', 1, 1, 'البيانات الشخصية', '', NULL, NULL, NULL, NULL),
(933, 6, 'الوزن', 'number', 0, 2, 'البيانات الشخصية', '', NULL, NULL, NULL, NULL),
(934, 6, 'الطول', 'number', 0, 3, 'البيانات الشخصية', '', NULL, NULL, NULL, NULL),
(935, 6, 'مكان الإقامة', 'text', 1, 4, 'البيانات الشخصية', 'مكان الاقامة الحالي', NULL, NULL, NULL, NULL),
(936, 6, 'طبيعة العمل', 'text', 0, 5, 'البيانات الشخصية', 'نشاطه اليومي', NULL, NULL, NULL, NULL),
(937, 6, 'بداية الشكوى', 'text', 1, 100, 'الحالة الصحية', 'تقريبا من متى يشتكي', NULL, NULL, NULL, NULL),
(938, 6, 'التشخيص', 'text', 1, 101, 'الحالة الصحية', 'ان وجد', NULL, NULL, NULL, NULL),
(939, 6, 'الضغط', 'select', 1, 102, 'الحالة الصحية', '', NULL, NULL, '[{\"label\":\"طبيعي\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"مرتفع\",\"has_sub\":true,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"لا اعلم\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}}]', NULL),
(940, 6, 'النبض', 'select', 1, 103, 'الحالة الصحية', '', NULL, NULL, '[{\"label\":\"طبيعي\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"منخفض\",\"has_sub\":true,\"sub\":{\"type\":\"text\",\"label\":\"كم يصل\",\"placeholder\":\"اكتب رقم\",\"required\":false}},{\"label\":\"لا اعلم\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}}]', NULL),
(941, 6, 'الاكسوجين', 'select', 1, 104, 'الحالة الصحية', '', NULL, NULL, '[{\"label\":\"طبيعي\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"منخفض\",\"has_sub\":true,\"sub\":{\"type\":\"text\",\"label\":\"كم يصل\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"لا اعلم\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}}]', NULL),
(942, 6, 'السكر', 'select', 1, 105, 'الحالة الصحية', '', NULL, NULL, '[{\"label\":\"نعم\",\"has_sub\":true,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"لا\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}}]', NULL),
(943, 6, 'مستوى الحالة النفسية', 'select', 1, 106, 'الحالة الصحية', 'اذا غير مرتاح يذكر بالتفاصيل', NULL, NULL, '[{\"label\":\"طبيعي\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"غير مرتاح\",\"has_sub\":true,\"sub\":{\"type\":\"text\",\"label\":\"السبب\",\"placeholder\":\"يكتب هنا\",\"required\":false}}]', NULL),
(944, 6, 'هل تستخدم أدوية ', 'select', 1, 107, 'الحالة الصحية', 'اذا نعم تذكر بالتفاصيل', NULL, NULL, '[{\"label\":\"نعم\",\"has_sub\":true,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"لا\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}}]', NULL),
(945, 6, 'هل تستخدم نظام غذائي', 'select', 1, 108, 'الحالة الصحية', 'نطام غذائي علاجي', NULL, NULL, '[{\"label\":\"لا\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"نعم\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"النظام الغذائي\",\"placeholder\":\"باختصار\",\"required\":false}}]', NULL),
(946, 6, 'الأعراض والشكوى', 'textarea', 1, 200, 'أعراض المرض', 'تكتب الاعراض على هيئة نقاط مختصرة', NULL, NULL, NULL, NULL),
(947, 6, 'هل الملاحظ تحسن ام نزول', 'select', 1, 201, 'أعراض المرض', 'خلال المدة الماضية', NULL, NULL, '[{\"label\":\"تحسن\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"نزول\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}}]', NULL),
(948, 6, 'تفاصيل الحالة من البداية', 'textarea', 1, 202, 'أعراض المرض', 'تفاصيل للحالة من بدايتها ', NULL, NULL, NULL, NULL),
(1007, 4, 'الاسم', 'text', 1, 0, 'البيانات الشخصية', ' الاسم المرجعي', NULL, NULL, NULL, NULL),
(1008, 4, 'مكان الإقامة', 'text', 1, 1, 'البيانات الشخصية', 'مكان الاقامة الحالي', NULL, NULL, NULL, NULL),
(1009, 4, 'طبيعة العمل', 'text', 0, 2, 'البيانات الشخصية', 'نشاطه اليومي', NULL, NULL, NULL, NULL),
(1010, 4, 'العمر', 'number', 1, 3, 'البيانات الشخصية', '', NULL, NULL, NULL, NULL),
(1011, 4, 'الطول', 'number', 0, 4, 'البيانات الشخصية', '', NULL, NULL, NULL, NULL),
(1012, 4, 'الوزن', 'number', 0, 5, 'البيانات الشخصية', '', NULL, NULL, NULL, NULL),
(1013, 4, 'بداية الشكوى', 'text', 1, 100, 'الحالة الصحية', 'تقريبا من متى يشتكي', NULL, NULL, NULL, NULL),
(1014, 4, 'التشخيص', 'text', 1, 101, 'الحالة الصحية', 'ان وجد', NULL, NULL, NULL, NULL),
(1015, 4, 'الضغط', 'select', 1, 102, 'الحالة الصحية', 'Placeholder', 'حقل آخر', '90', '[{\"label\":\"طبيعي\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"مرتفع\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"لا اعلم\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}}]', NULL),
(1016, 4, 'النبض', 'select', 1, 103, 'الحالة الصحية', '', NULL, NULL, '[{\"label\":\"طبيعي\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"منخفض\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"مرتفع\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"لا اعلم\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}}]', NULL),
(1017, 4, 'الاكسوجين', 'select', 1, 104, 'الحالة الصحية', 'نص توضيحي', 'اسم الحقل', '٩٠', '[{\"label\":\"طبيعي\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"منخفض\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"لا اعلم\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}}]', NULL),
(1018, 4, 'السكر', 'select', 1, 105, 'الحالة الصحية', '', NULL, NULL, '[{\"label\":\"طبيعي\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"مرتفع\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"منخفص\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"لا اعلم\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}}]', NULL),
(1019, 4, 'مستوى الحالة النفسية', 'select', 1, 106, 'الحالة الصحية', 'اذا غير طبيعي يذكر بالتفاصيل', NULL, NULL, '[{\"label\":\"طبيعي\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"غير مستقر \",\"has_sub\":true,\"sub\":{\"type\":\"text\",\"label\":\"التشخيص\",\"placeholder\":\"مختصر الحالة\",\"required\":false}}]', NULL),
(1020, 4, 'هل هناك امراض مصاحبة', 'select', 1, 107, 'الحالة الصحية', 'اذا موجود تذكر بالتفاصيل', NULL, NULL, '[{\"label\":\"لا\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"نعم\",\"has_sub\":true,\"sub\":{\"type\":\"text\",\"label\":\"تذكر هنا\",\"placeholder\":\"\",\"required\":true}}]', NULL),
(1021, 4, 'هل تستخدم أدوية ', 'select', 1, 108, 'الحالة الصحية', '', NULL, NULL, '[{\"label\":\"لا\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"نعم\",\"has_sub\":true,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}}]', NULL),
(1022, 4, 'هل تستخدم نظام غذائي', 'select', 1, 109, 'الحالة الصحية', 'نطام غذائي علاجي', NULL, NULL, '[{\"label\":\"لا\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"نعم\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}}]', NULL),
(1023, 4, 'هل عمل علاج طبيعي', 'select', 1, 110, 'الحالة الصحية', '', NULL, NULL, '[{\"label\":\"نعم\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"لا\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}}]', NULL),
(1024, 4, 'تفاصيل الحالة', 'textarea', 1, 111, 'الحالة الصحية', 'تفاصيل شاملة عن الحالة', NULL, NULL, NULL, NULL),
(1025, 4, 'الأعراض والشكوى', 'textarea', 1, 200, 'أعراض المرض', 'تكتب الاعراض على هيئة نقاط مختصرة', NULL, NULL, NULL, NULL),
(1026, 4, 'الأعضاء المتأثرة ', 'checkbox', 1, 201, 'أعراض المرض', '', NULL, NULL, '[{\"label\":\"الاطراف السفلية\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"الاطراف العلوية\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"العيون\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"الرقبة\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}}]', NULL),
(1027, 4, 'أي الجانبين متأثر أكثر', 'checkbox', 1, 202, 'أعراض المرض', '', NULL, NULL, '[{\"label\":\"اليمين\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"اليسار\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}}]', NULL),
(1028, 4, 'هل هناك تأثر في', 'checkbox', 1, 203, 'أعراض المرض', '', NULL, NULL, '[{\"label\":\"الحركة\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"العيون\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"البلع\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}}]', NULL),
(1029, 4, 'مستوى حركة الأطراف ', 'text', 1, 204, 'أعراض المرض', 'نسبة مئوية مثل  100%', NULL, NULL, NULL, NULL),
(1030, 4, 'هل هناك ضعف بالاطراف', 'checkbox', 1, 205, 'أعراض المرض', 'حركة واستخدام الاطراف', NULL, NULL, '[{\"label\":\"نعم\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"لا\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}}]', NULL),
(1031, 4, 'مستوى حجم الكتلة العضلية', 'select', 1, 206, 'أعراض المرض', '', NULL, NULL, '[{\"label\":\"طبيعي\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"ضامرة\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}}]', NULL),
(1032, 4, 'هل هناك تيبس في الأطراف', 'select', 1, 207, 'أعراض المرض', 'حركة المفاصل خاصة الأرجل', NULL, NULL, '[{\"label\":\"لا\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"نعم\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}}]', NULL),
(1033, 4, 'هل يحتاج مساعدة', 'select', 1, 208, 'أعراض المرض', 'في حاجاته الخلصة', NULL, NULL, '[{\"label\":\"لا\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"نعم\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}}]', NULL),
(1034, 4, 'هل الملاحظ تحسن ام نزول', 'select', 1, 209, 'أعراض المرض', 'خلال المدة الماضية', NULL, NULL, '[{\"label\":\"تحسن\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}},{\"label\":\"نزول\",\"has_sub\":false,\"sub\":{\"type\":\"text\",\"label\":\"\",\"placeholder\":\"\",\"required\":false}}]', NULL),
(1035, 4, 'تفاصيل الحالة من البداية', 'textarea', 1, 210, 'أعراض المرض', 'تفاصيل للحالة من بدايتها ', NULL, NULL, NULL, NULL);
INSERT INTO messages (id, from_id, to_id, body, is_read, created_at, file_url, file_type, file_name, file_size, status, thread_id, thread_title) VALUES
(1, 1, NULL, 'السلام عليكم', 1, '2026-05-10 04:25:08', NULL, NULL, NULL, 0, 'sent', NULL, NULL),
(2, NULL, 1, 'السلام عليكم ورحمة الله وبركاته', 1, '2026-05-10 04:25:08', NULL, NULL, NULL, 0, 'sent', NULL, NULL),
(3, NULL, 1, 'اخوكم صالح', 1, '2026-05-10 04:25:08', NULL, NULL, NULL, 0, 'sent', NULL, NULL),
(4, 3, NULL, 'عليكم السلام', 1, '2026-05-10 04:25:08', NULL, NULL, NULL, 0, 'sent', NULL, NULL),
(5, 3, NULL, 'مرحبا', 1, '2026-05-10 04:25:08', NULL, NULL, NULL, 0, 'sent', NULL, NULL),
(6, 3, NULL, 'عليكم السلام', 1, '2026-05-10 04:25:08', NULL, NULL, NULL, 0, 'sent', NULL, NULL),
(7, 3, NULL, 'ادخل عليه وانشره', 1, '2026-05-10 04:25:08', NULL, NULL, NULL, 0, 'sent', NULL, NULL),
(8, 3, NULL, 'رفعتك مدير', 1, '2026-05-10 04:25:08', NULL, NULL, NULL, 0, 'sent', NULL, NULL),
(9, 10, 1, 'اهلا', 1, '2026-05-10 04:25:08', NULL, NULL, NULL, 0, 'archived', 2, NULL),
(10, 3, NULL, 'السلام <span style=\"color: rgb(124, 58, 237);\">عليكم</span>', 1, '2026-05-10 04:25:08', NULL, NULL, NULL, 0, 'sent', NULL, NULL),
(11, 3, NULL, '<span style=\"font-weight: bold; color: rgb(124, 58, 237);\">السلام</span> عليكم', 1, '2026-05-10 04:25:08', NULL, NULL, NULL, 0, 'sent', NULL, NULL),
(12, 4, 1, '<b style=\"background-color: rgb(254, 215, 170);\">السلام</b> <span style=\"color: rgb(124, 58, 237);\">عليكم</span>', 1, '2026-05-10 04:25:08', NULL, NULL, NULL, 0, 'sent', NULL, NULL),
(13, 3, NULL, '<b style=\"color: rgb(220, 38, 38);\">بسم</b> الله', 1, '2026-05-10 04:25:08', NULL, NULL, NULL, 0, 'sent', NULL, NULL),
(14, NULL, 1, '<b><i><u>السلام عليكم ممكن موعد </u></i></b>', 1, '2026-05-10 04:25:08', NULL, NULL, NULL, 0, 'sent', NULL, NULL),
(15, NULL, 1, '<span style=\"font-weight: bold; background-color: rgb(254, 240, 138); color: rgb(220, 38, 38);\">الحمدلله</span> رب العالمين<div>كل <b>شي</b> تمام </div>', 1, '2026-05-10 04:25:08', NULL, NULL, NULL, 0, 'sent', NULL, NULL),
(16, NULL, 1, 'تمام', 1, '2026-05-10 04:25:08', NULL, NULL, NULL, 0, 'sent', NULL, NULL),
(17, 4, 1, 'السلام عليكم', 0, '2026-05-10 13:34:54', NULL, NULL, NULL, 0, 'sent', NULL, NULL),
(18, 4, 1, 'مرحبا', 0, '2026-05-10 13:35:04', NULL, NULL, NULL, 0, 'sent', NULL, NULL),
(19, 3, NULL, 'عليكم السلام', 0, '2026-05-10 15:08:44', NULL, NULL, NULL, 0, 'sent', NULL, NULL),
(20, 8, 1, 'السلام عليكم', 1, '2026-05-10 21:32:55', NULL, NULL, NULL, 0, 'archived', 3, NULL),
(21, 8, 1, 'شفت استمارتي', 1, '2026-05-10 21:33:09', NULL, NULL, NULL, 0, 'archived', 3, NULL),
(22, 3, 8, 'تمام', 1, '2026-05-10 21:36:15', NULL, NULL, NULL, 0, 'archived', 5, NULL),
(23, 3, 8, 'عليكم السلام', 1, '2026-05-15 19:12:08', NULL, NULL, NULL, 0, 'archived', 5, NULL),
(24, 8, 8, 'ماشاء الله', 1, '2026-05-15 19:12:51', NULL, NULL, NULL, 0, 'archived', NULL, NULL),
(25, 8, 1, 'السلام عليكم 2', 1, '2026-05-15 19:17:30', NULL, NULL, NULL, 0, 'archived', 3, NULL),
(26, 3, 8, 'ما شاء الله', 1, '2026-05-15 19:36:13', NULL, NULL, NULL, 0, 'archived', 5, NULL),
(27, 8, 3, 'السلام عليكم', 1, '2026-05-15 19:36:55', NULL, NULL, NULL, 0, 'archived', 5, NULL),
(28, 8, 1, 'مرحبا', 1, '2026-05-15 20:01:31', NULL, NULL, NULL, 0, 'archived', 3, NULL),
(29, 8, 3, 'مرحبا', 1, '2026-05-15 20:02:00', NULL, NULL, NULL, 0, 'archived', 5, NULL),
(30, 3, 8, '📢 تم تحويل محادثتك إلى احمد العبدالله. سيتابع معك قريباً.', 1, '2026-05-15 20:03:02', NULL, NULL, NULL, 0, 'archived', 5, NULL),
(31, 3, NULL, '📋 تم تحويل محادثة المراجع \"خالد\" إليك. يرجى المتابعة.', 0, '2026-05-15 20:03:02', NULL, NULL, NULL, 0, 'sent', NULL, NULL),
(32, 3, 8, '📢 تم تحويل محادثتك إلى Mo. سيتابع معك قريباً.', 1, '2026-05-15 20:03:21', NULL, NULL, NULL, 0, 'archived', 5, NULL),
(33, 3, 1, '📋 تم تحويل محادثة المراجع \"خالد\" إليك. يرجى المتابعة.', 0, '2026-05-15 20:03:21', NULL, NULL, NULL, 0, 'sent', NULL, NULL),
(34, 1, 8, 'السلام عليكم', 1, '2026-05-15 21:24:49', NULL, NULL, NULL, 0, 'archived', 3, NULL),
(35, 1, 8, 'ماشاء الله لا قوة الا بالله نسأل الله العفو العافية', 1, '2026-05-15 21:25:55', NULL, NULL, NULL, 0, 'archived', 3, NULL),
(36, 1, 8, '📢 تم تحويل محادثتك إلى المشرف العام. سيتابع معك قريباً.', 1, '2026-05-15 21:32:47', NULL, NULL, NULL, 0, 'archived', 3, NULL),
(37, 1, 3, '📋 تم تحويل محادثة المراجع \"خالد\" إليك. يرجى المتابعة.', 0, '2026-05-15 21:32:47', NULL, NULL, NULL, 0, 'sent', NULL, NULL),
(38, 1, 8, 'السلام', 1, '2026-05-15 23:34:47', NULL, NULL, NULL, 0, 'archived', 3, NULL),
(39, 1, 8, 'الل', 1, '2026-05-15 23:36:55', NULL, NULL, NULL, 0, 'archived', 3, NULL),
(40, 1, 8, 'بسم الله\nالخمدلله', 1, '2026-05-15 23:40:01', NULL, NULL, NULL, 0, 'archived', 3, NULL),
(41, 1, 10, 'مرحبا', 0, '2026-05-16 07:36:27', NULL, NULL, NULL, 0, 'archived', 2, NULL),
(42, 1, 10, 'السلام عليكم ورحمة الله وبركاته \nاليوم ااسيت', 0, '2026-05-16 07:37:05', NULL, NULL, NULL, 0, 'archived', 2, NULL),
(43, 8, 1, 'لا اله الا الله', 0, '2026-05-16 07:39:01', NULL, NULL, NULL, 0, 'archived', 3, NULL),
(44, 8, 4, 'السلام عليكم', 0, '2026-05-16 13:39:56', NULL, NULL, NULL, 0, 'archived', 7, NULL),
(45, 8, 4, 'مرحبا دكتور', 0, '2026-05-16 13:40:14', NULL, NULL, NULL, 0, 'archived', 7, NULL),
(46, 3, 8, 'ممتاز', 1, '2026-05-16 13:59:51', NULL, NULL, NULL, 0, 'archived', 5, NULL),
(47, 8, 3, 'السلام عايكم ورحمة الله وبركاته 33', 1, '2026-05-16 14:12:35', NULL, NULL, NULL, 0, 'archived', 5, NULL),
(48, 3, 8, 'الحمد لله', 1, '2026-05-16 14:25:23', NULL, NULL, NULL, 0, 'archived', 5, NULL),
(49, 8, 3, 'السلام عليكم', 1, '2026-05-16 16:57:59', NULL, NULL, NULL, 0, 'archived', 5, NULL),
(50, 3, 8, 'عليكم السلام', 1, '2026-05-16 16:58:24', NULL, NULL, NULL, 0, 'archived', 5, NULL),
(51, 8, 3, '..', 1, '2026-05-16 16:59:05', NULL, NULL, NULL, 0, 'archived', 5, NULL),
(52, 3, 8, 'جيد', 1, '2026-05-16 16:59:13', NULL, NULL, NULL, 0, 'archived', 5, NULL),
(53, 8, 3, '.', 1, '2026-05-16 16:59:24', NULL, NULL, NULL, 0, 'archived', 5, NULL),
(54, 8, 3, 'الو', 1, '2026-05-16 16:59:41', NULL, NULL, NULL, 0, 'archived', 5, NULL),
(55, 8, 3, 'الو', 1, '2026-05-16 17:02:12', NULL, NULL, NULL, 0, 'archived', 5, NULL),
(56, 3, 8, '🤣', 1, '2026-05-16 18:10:10', '', '', NULL, 0, 'archived', 5, NULL),
(57, 3, 8, 'السلام\nعليكم', 1, '2026-05-17 08:28:57', '', '', NULL, 0, 'archived', 5, NULL),
(58, 3, 8, 'لاا', 1, '2026-05-17 08:59:10', '', '', NULL, 0, 'archived', 5, NULL),
(59, 3, 8, 'الحمدلله', 1, '2026-05-17 09:03:45', '', '', NULL, 0, 'archived', 5, NULL),
(60, 3, 8, 'الحمدلله', 1, '2026-05-17 09:04:06', '', '', NULL, 0, 'archived', 5, NULL),
(61, 3, 8, 'السلام', 1, '2026-05-17 16:40:23', '', '', NULL, 0, 'archived', 5, NULL),
(62, 3, 8, 'مرحبا', 1, '2026-05-17 16:40:28', '', '', NULL, 0, 'archived', 5, NULL),
(63, 3, 8, 'السلام', 1, '2026-05-17 16:40:33', '', '', NULL, 0, 'archived', 5, NULL),
(64, 3, 8, 'الحم', 1, '2026-05-17 17:04:35', '', '', NULL, 0, 'archived', 5, NULL),
(65, 3, 8, 'Gfgg', 1, '2026-05-17 17:15:38', '', '', NULL, 0, 'archived', 5, NULL),
(66, 3, 8, 'Ggf\nHgf', 1, '2026-05-17 17:22:25', '', '', NULL, 0, 'archived', 5, NULL),
(67, 3, 8, 'Fgg', 1, '2026-05-17 18:27:15', '', '', NULL, 0, 'archived', 5, NULL),
(68, 3, 8, 'الل\nااللل', 1, '2026-05-17 18:56:12', '', '', NULL, 0, 'archived', 5, NULL),
(69, 3, 8, 'تااتن', 1, '2026-05-17 19:07:02', '', '', NULL, 0, 'archived', 5, NULL),
(70, 3, 8, 'ناا', 1, '2026-05-17 19:07:07', '', '', NULL, 0, 'archived', 5, NULL),
(71, 3, 8, 'تاتت', 1, '2026-05-17 19:26:42', '', '', NULL, 0, 'archived', 5, NULL),
(72, 3, 8, 'الحمد لله\nما شاء الل\nا', 1, '2026-05-17 19:29:46', '', '', NULL, 0, 'archived', 5, NULL),
(73, 3, 8, 'بسم الله\nالرحمن', 1, '2026-05-17 19:32:51', '', '', NULL, 0, 'archived', 5, NULL),
(74, 3, 8, 'ما شاء الله', 1, '2026-05-17 19:33:33', '', '', NULL, 0, 'archived', 5, NULL),
(75, 3, 8, 'الحمدلاه', 1, '2026-05-17 19:35:32', '', '', NULL, 0, 'archived', 5, NULL),
(76, 3, 8, 'ماشاء الله', 1, '2026-05-17 19:35:40', '', '', NULL, 0, 'archived', 5, NULL),
(77, 3, 8, 'ما شاء الله', 1, '2026-05-17 19:40:47', '', '', NULL, 0, 'archived', 5, NULL),
(78, 3, 8, 'ممتاز\nم', 1, '2026-05-17 21:12:52', '', '', NULL, 0, 'archived', 5, NULL),
(79, 3, 8, 'الحمدلله', 1, '2026-05-17 21:16:33', '', '', NULL, 0, 'archived', 5, NULL),
(80, 3, 8, 'الىوت', 1, '2026-05-17 21:16:39', '', '', NULL, 0, 'archived', 5, NULL),
(81, 3, 8, 'تااا', 1, '2026-05-17 21:20:55', '', '', NULL, 0, 'archived', 5, NULL),
(82, 3, 8, 'تتلل', 1, '2026-05-17 21:21:00', '', '', NULL, 0, 'archived', 5, NULL),
(83, 3, 8, 'تلىوز\nاةىىر', 1, '2026-05-17 21:23:15', '', '', NULL, 0, 'archived', 5, NULL),
(84, 3, 8, 'الخمدلله تمام', 1, '2026-05-17 21:23:25', '', '', NULL, 0, 'archived', 5, NULL),
(85, 3, 8, 'هذي الرسالة اختبار', 1, '2026-05-17 21:41:48', '', '', NULL, 0, 'archived', 5, NULL),
(86, 8, 3, 'ما ظهرت', 1, '2026-05-17 21:42:29', '', '', NULL, 0, 'archived', 5, NULL),
(87, 8, 3, 'ممتاز', 1, '2026-05-17 21:48:08', '', '', NULL, 0, 'archived', 5, NULL),
(88, 8, 3, 'الحمدلله', 1, '2026-05-17 21:54:21', '', '', NULL, 0, 'archived', 5, NULL),
(89, 8, 3, 'ما شاء الله', 1, '2026-05-17 22:01:27', '', '', NULL, 0, 'archived', 5, NULL),
(90, 8, 3, 'الحمدلله', 1, '2026-05-17 22:01:51', '', '', NULL, 0, 'archived', 5, NULL),
(91, 8, 3, 'تاىة\nاالبات', 1, '2026-05-17 22:02:12', '', '', NULL, 0, 'archived', 5, NULL),
(92, 8, 3, 'تمام', 1, '2026-05-17 22:28:17', '', '', NULL, 0, 'archived', 5, NULL),
(93, 8, 3, 'الاا', 1, '2026-05-17 22:48:50', '', '', NULL, 0, 'archived', 5, NULL),
(94, 8, 3, 'تمام', 1, '2026-05-17 22:50:52', '', '', NULL, 0, 'archived', 5, NULL),
(95, 8, 3, '😂ممتاز\nاللن', 1, '2026-05-17 23:00:44', '', '', NULL, 0, 'archived', 5, NULL),
(96, 3, 8, 'تمام', 1, '2026-05-17 23:01:19', '', '', NULL, 0, 'archived', 5, NULL),
(97, 3, 8, 'جيد', 1, '2026-05-17 23:01:27', '', '', NULL, 0, 'archived', 5, NULL),
(98, 3, 8, '🙂', 1, '2026-05-17 23:06:12', '', '', NULL, 0, 'archived', 5, NULL),
(99, 3, 8, 'ممتاز', 1, '2026-05-17 23:10:01', '', '', NULL, 0, 'archived', 5, NULL),
(100, 3, 8, 'Gfgghhh', 1, '2026-05-17 23:22:03', '', '', NULL, 0, 'archived', 5, NULL),
(101, 3, 8, '😂', 1, '2026-05-18 01:29:03', '', '', NULL, 0, 'archived', 5, NULL),
(102, 3, 8, 'ممتاز 😂', 1, '2026-05-18 07:17:04', '', '', NULL, 0, 'archived', 5, NULL),
(103, 3, 8, 'لاا\nاالللىىبو الىى   االلل', 1, '2026-05-18 07:17:51', '', '', NULL, 0, 'archived', 5, NULL),
(104, 3, 8, '🤣', 1, '2026-05-18 07:20:44', '', '', NULL, 0, 'archived', 5, NULL),
(105, 3, 8, 'ممتاز\nتاللل', 1, '2026-05-18 07:20:54', '', '', NULL, 0, 'archived', 5, NULL),
(106, 3, 8, 'معم', 1, '2026-05-18 07:33:40', '', '', NULL, 0, 'archived', 5, NULL),
(107, 3, 8, '😂', 1, '2026-05-18 07:33:47', '', '', NULL, 0, 'archived', 5, NULL),
(108, 3, 8, 'ممتاز', 1, '2026-05-18 07:34:03', '', '', NULL, 0, 'archived', 5, NULL),
(109, 3, 8, 'الىاا', 1, '2026-05-18 07:37:19', '', '', NULL, 0, 'archived', 5, NULL),
(110, 8, 3, 'ممتاز😀', 1, '2026-05-18 07:38:00', '', '', NULL, 0, 'archived', 5, NULL),
(111, 3, 8, 'ما شاء الله', 1, '2026-05-18 07:47:09', '', '', NULL, 0, 'archived', 5, NULL),
(112, 3, 8, '😂😂', 1, '2026-05-18 07:47:40', '', '', NULL, 0, 'archived', 5, NULL),
(113, 8, 3, 'عععععع', 1, '2026-05-18 07:48:34', '', '', NULL, 0, 'archived', 5, NULL),
(114, 8, 3, 'االللل', 1, '2026-05-18 07:48:40', '', '', NULL, 0, 'archived', 5, NULL),
(115, 8, 3, 'ممتاز', 1, '2026-05-18 07:51:28', '', '', NULL, 0, 'archived', 5, NULL),
(116, 8, 3, 'الاتتن', 1, '2026-05-18 07:53:51', '', '', NULL, 0, 'archived', 5, NULL),
(117, 8, 3, '🤣', 1, '2026-05-18 07:53:58', '', '', NULL, 0, 'archived', 5, NULL),
(118, 8, 3, 'تلاتن😂', 1, '2026-05-18 12:42:59', '', '', NULL, 0, 'archived', 5, NULL),
(119, 8, 3, '🤣', 1, '2026-05-18 12:43:10', '', '', NULL, 0, 'archived', 5, NULL),
(120, 8, 3, '🤩', 1, '2026-05-18 13:07:31', '', '', NULL, 0, 'archived', 5, NULL),
(121, 8, 3, 'ممتاز', 1, '2026-05-18 13:07:42', '', '', NULL, 0, 'archived', 5, NULL),
(122, 3, 8, 'لاا', 1, '2026-05-18 13:09:24', '', '', NULL, 0, 'archived', 5, NULL),
(123, 3, 8, 'ممتاز جدا', 1, '2026-05-18 13:09:40', '', '', NULL, 0, 'archived', 5, NULL),
(124, 8, 3, 'جيد', 1, '2026-05-18 13:10:27', '', '', NULL, 0, 'archived', 5, NULL),
(125, 8, 3, 'هههههه', 1, '2026-05-18 13:13:13', '', '', NULL, 0, 'archived', 5, NULL),
(126, 8, 3, 'نفس المشكلة', 1, '2026-05-18 13:17:02', '', '', NULL, 0, 'archived', 5, NULL),
(127, 8, 3, 'تمام', 1, '2026-05-18 13:17:11', '', '', NULL, 0, 'archived', 5, NULL),
(128, 3, 8, 'كلها يمين بيضاء', 1, '2026-05-18 13:18:10', '', '', NULL, 0, 'archived', 5, NULL),
(129, 8, 3, 'كيف', 1, '2026-05-18 13:21:54', '', '', NULL, 0, 'archived', 5, NULL),
(130, 8, 3, 'ممتاز الادارة', 1, '2026-05-18 13:22:06', '', '', NULL, 0, 'archived', 5, NULL),
(131, 3, 8, 'هذا', 1, '2026-05-18 13:23:01', '', '', NULL, 0, 'archived', 5, NULL),
(132, 8, 3, 'من خالد', 1, '2026-05-18 13:42:45', '', '', NULL, 0, 'archived', 5, NULL),
(133, 8, 3, 'الان ممتاز  رسالة من خالد', 1, '2026-05-18 13:52:15', '', '', NULL, 0, 'archived', 5, NULL),
(134, 8, 3, 'اللوت', 1, '2026-05-18 13:54:23', '', '', NULL, 0, 'archived', 5, NULL),
(135, 8, 3, 'خالد', 1, '2026-05-18 13:58:48', '', '', NULL, 0, 'archived', 5, NULL),
(136, 8, 3, 'اللال', 1, '2026-05-18 13:58:59', '', '', NULL, 0, 'archived', 5, NULL),
(137, 8, 3, 'خالد', 1, '2026-05-18 14:00:41', '', '', NULL, 0, 'archived', 5, NULL),
(138, 8, 3, 'تمام', 1, '2026-05-18 14:03:11', '', '', NULL, 0, 'archived', 5, NULL),
(139, 8, 3, 'خالد', 1, '2026-05-18 14:03:39', '', '', NULL, 0, 'archived', 5, NULL),
(140, 3, 8, 'ااا', 1, '2026-05-18 19:31:09', '', '', NULL, 0, 'archived', 5, NULL),
(141, 3, 8, 'ممتاز', 1, '2026-05-18 19:54:34', '', '', NULL, 0, 'archived', 5, NULL),
(142, 3, 8, '😊', 1, '2026-05-18 19:55:19', '', '', NULL, 0, 'archived', 5, NULL),
(143, 8, 3, 'خالد', 1, '2026-05-18 19:56:21', '', '', NULL, 0, 'archived', 5, NULL),
(144, 3, 8, 'الادارة', 1, '2026-05-18 21:08:28', '', '', NULL, 0, 'archived', 5, NULL),
(145, 3, 8, 'الللا', 1, '2026-05-18 21:09:50', '', '', NULL, 0, 'archived', 5, NULL),
(146, 8, 3, 'خالد 99', 1, '2026-05-18 21:56:41', '', '', NULL, 0, 'archived', 5, NULL),
(147, 3, 8, 'الادارة', 1, '2026-05-19 08:35:06', '', '', NULL, 0, 'archived', 5, NULL),
(148, 3, 8, '📢 تم تحويل محادثتك إلى الدكتور. سيتابع معك قريباً.', 1, '2026-05-19 08:52:33', '', '', NULL, 0, 'archived', 5, NULL),
(149, 3, 4, '📋 تم تحويل محادثة المراجع \"خالد\" إليك. يرجى المتابعة.', 0, '2026-05-19 08:52:33', '', '', NULL, 0, 'sent', NULL, NULL),
(150, 3, 8, '📢 تم تحويل محادثتك إلى الدكتور. سيتابع معك قريباً.', 1, '2026-05-19 09:03:52', '', '', NULL, 0, 'archived', 5, NULL),
(151, 3, 4, '📋 تم تحويل محادثة المراجع \"خالد\" إليك. يرجى المتابعة.', 0, '2026-05-19 09:03:52', '', '', NULL, 0, 'sent', NULL, NULL),
(152, 3, 8, '📢 تم تحويل محادثتك إلى الدكتور. سيتابع معك قريباً.', 1, '2026-05-19 09:20:43', '', '', NULL, 0, 'archived', 5, NULL),
(153, 3, 4, '📋 تم تحويل محادثة المراجع \"خالد\" إليك. يرجى المتابعة.', 0, '2026-05-19 09:20:43', '', '', NULL, 0, 'sent', NULL, NULL),
(154, 3, 8, '📢 تم تحويل محادثتك إلى Mo. سيتابع معك قريباً.', 1, '2026-05-19 09:24:07', '', '', NULL, 0, 'archived', 5, NULL),
(155, 3, 1, '📋 تم تحويل محادثة المراجع \"خالد\" إليك. يرجى المتابعة.', 0, '2026-05-19 09:24:07', '', '', NULL, 0, 'sent', NULL, NULL),
(156, 3, 8, '📢 تم تحويل محادثتك إلى الدكتور. سيتابع معك قريباً.', 1, '2026-05-19 09:48:12', '', '', NULL, 0, 'archived', 5, NULL),
(157, 3, 4, '📋 تم تحويل محادثة المراجع \"خالد\" إليك. يرجى المتابعة.', 0, '2026-05-19 09:48:12', '', '', NULL, 0, 'sent', NULL, NULL),
(158, 3, 8, '📁 تم أرشفة هذه المحادثة.', 1, '2026-05-19 10:31:49', '', '', NULL, 0, 'archived', 5, NULL),
(159, 3, 8, '📁 تم أرشفة هذه المحادثة.', 1, '2026-05-19 10:32:26', '', '', NULL, 0, 'archived', 5, NULL),
(160, 3, 8, '📁 تم أرشفة هذه المحادثة.', 1, '2026-05-19 10:36:31', '', '', NULL, 0, 'archived', 5, NULL),
(161, 8, 3, 'السلام عليكم', 1, '2026-05-19 10:38:52', '', '', NULL, 0, 'archived', 5, NULL),
(162, 8, 3, 'مخادثة جديدة', 1, '2026-05-19 10:39:07', '', '', NULL, 0, 'archived', 5, NULL),
(163, 3, 8, '📁 تم أرشفة هذه المحادثة.', 1, '2026-05-19 10:40:11', '', '', NULL, 0, 'archived', 6, NULL),
(164, 8, 3, 'السلام عليكم', 1, '2026-05-19 11:27:48', NULL, NULL, NULL, 0, 'archived', 6, NULL),
(165, 8, 3, 'انا خالد 🤣', 1, '2026-05-19 11:28:02', NULL, NULL, NULL, 0, 'archived', 6, NULL),
(166, 3, 8, 'مرحبا 👍😴', 0, '2026-05-19 11:29:06', NULL, NULL, NULL, 0, 'archived', 6, NULL),
(167, 3, 8, 'السلام عليكم', 0, '2026-05-19 13:41:11', NULL, NULL, NULL, 0, 'archived', 11, NULL),
(168, 3, 8, 'مرحلا', 0, '2026-05-19 13:41:22', NULL, NULL, NULL, 0, 'archived', 11, NULL),
(169, 3, 8, 'اننةىىى', 0, '2026-05-19 13:41:48', NULL, NULL, NULL, 0, 'archived', 11, NULL),
(170, 3, 10, 'السلام', 0, '2026-05-19 13:45:57', NULL, NULL, NULL, 0, 'archived', 9, NULL),
(171, 3, 10, '📢 تم تحويل محادثتك إلى الدكتور. سيتابع معك قريباً.', 0, '2026-05-19 13:46:08', '', '', NULL, 0, 'sent', NULL, NULL),
(172, 3, 4, '📋 تم تحويل محادثة المراجع \"سامي محمد\" إليك. يرجى المتابعة.', 0, '2026-05-19 13:46:09', '', '', NULL, 0, 'sent', NULL, NULL),
(173, 3, 10, '📢 تم تحويل محادثتك إلى الدكتور. سيتابع معك قريباً.', 0, '2026-05-19 13:47:01', '', '', NULL, 0, 'sent', NULL, NULL),
(174, 3, 4, '📋 تم تحويل محادثة المراجع \"سامي محمد\" إليك. يرجى المتابعة.', 0, '2026-05-19 13:47:01', '', '', NULL, 0, 'sent', NULL, NULL),
(175, 3, 10, '📢 تم تحويل محادثتك إلى الدكتور. سيتابع معك قريباً.', 0, '2026-05-19 13:50:13', '', '', NULL, 0, 'sent', NULL, NULL),
(176, 3, 4, '📋 تم تحويل محادثة المراجع \"سامي محمد\" إليك. يرجى المتابعة.', 0, '2026-05-19 13:50:13', '', '', NULL, 0, 'sent', NULL, NULL),
(177, 3, 10, 'السلام علبكم', 0, '2026-05-19 13:51:04', NULL, NULL, NULL, 0, 'archived', 12, NULL),
(178, 3, 8, '📢 تم تحويل محادثتك إلى الدكتور. سيتابع معك قريباً.', 0, '2026-05-19 14:00:37', '', '', NULL, 0, 'sent', NULL, NULL),
(179, 3, 4, '📋 تم تحويل محادثة المراجع \"خالد\" إليك. يرجى المتابعة.', 0, '2026-05-19 14:00:37', '', '', NULL, 0, 'sent', NULL, NULL),
(180, 3, 8, 'تاىةننةلل', 0, '2026-05-19 14:00:50', NULL, NULL, NULL, 0, 'sent', 10, NULL),
(181, 3, 8, 'تلللتنت', 0, '2026-05-19 14:00:58', NULL, NULL, NULL, 0, 'sent', 10, NULL),
(182, 3, 8, '📢 تم تحويل محادثتك إلى الدكتور. سيتابع معك قريباً.', 0, '2026-05-19 14:01:05', '', '', NULL, 0, 'sent', NULL, NULL),
(183, 3, 4, '📋 تم تحويل محادثة المراجع \"خالد\" إليك. يرجى المتابعة.', 0, '2026-05-19 14:01:06', '', '', NULL, 0, 'sent', NULL, NULL),
(184, 3, 10, 'السلام عايكم', 0, '2026-05-19 15:07:58', NULL, NULL, NULL, 0, 'archived', 13, NULL),
(185, 3, 10, 'جرب', 0, '2026-05-19 15:11:29', NULL, NULL, NULL, 0, 'archived', 14, NULL),
(186, 3, 10, 'الحمدلله', 0, '2026-05-19 15:11:42', NULL, NULL, NULL, 0, 'archived', 14, NULL),
(187, 3, 10, 'ما شاء الله', 0, '2026-05-19 15:12:08', NULL, NULL, NULL, 0, 'archived', 14, NULL),
(188, 3, 10, 'تمام', 1, '2026-05-19 15:13:28', NULL, NULL, NULL, 0, 'sent', 15, NULL),
(190, 3, 10, 'تمام ١٢٠', 1, '2026-05-19 16:19:39', NULL, NULL, NULL, 0, 'sent', 15, NULL),
(191, 10, 3, 'تللات', 1, '2026-05-19 19:13:26', NULL, NULL, NULL, 0, 'sent', 15, NULL),
(192, 10, 3, 'الاننال', 1, '2026-05-19 19:33:15', NULL, NULL, NULL, 0, 'sent', 15, NULL),
(193, 10, 3, 'ولرتن', 1, '2026-05-19 19:33:32', NULL, NULL, NULL, 0, 'sent', 15, NULL),
(194, 10, 3, 'نوىةنو😂', 1, '2026-05-19 19:45:42', NULL, NULL, NULL, 0, 'sent', 15, NULL);
INSERT INTO publications (id, title, content, type, file_path, views, created_at, status, description, thumbnail_data, original_filename, file_size) VALUES
(1, 'التغذية', 'data:application/pdf;base64,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Y7hLkdRNmWSou2hv89xcYLizySi6HFhgYghWJSh2dXM+NSdzM8j2dFC8ff6GK8EpJrJtDLiID7OJrRVlxZZLaAvBd2NRGT/gjaKmXX60bZkDZV3/cEo11jS9MDt9TgMKpWELkV31qY5OVfg7XLx03j+j4vrV/fBeEE0I9ZZZ09IPbxjfl5whsGf5YNQ5rDTbUI16ctmWUJInXBN3Deduws9kgRLSq4+Upw/LEneJwv8BuMCr8g0KZW5kc3RyZWFtDQplbmRvYmoNCjUgMCBvYmoNCjw8L1R5cGUvRXh0R1N0YXRlL0JNL05vcm1hbC9jYSAxPj4NCmVuZG9iag0KNiAwIG9iag0KPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTAvQmFzZUZvbnQvQXJpYWxNVC9FbmNvZGluZy9JZGVudGl0eS1IL0Rlc2NlbmRhbnRGb250cyA3IDAgUi9Ub1VuaWNvZGUgMzI0IDAgUj4+DQplbmRvYmoNCjcgMCBvYmoNClsgOCAwIFJdIA0KZW5kb2JqDQo4IDAgb2JqDQo8PC9CYXNlRm9udC9BcmlhbE1UL1N1YnR5cGUvQ0lERm9udFR5cGUyL1R5cGUvRm9udC9DSURUb0dJRE1hcC9JZGVudGl0eS9EVyAxMDAwL0NJRFN5c3RlbUluZm8gOSAwIFIvRm9udERlc2NyaXB0b3IgMTAgMCBSL1cgMzI2IDAgUj4+DQplbmRvYmoNCjkgMCBvYmoNCjw8L09yZGVyaW5nKElkZW50aXR5KSAvUmVnaXN0cnkoQWRvYmUpIC9TdXBwbGVtZW50IDA+Pg0KZW5kb2JqDQoxMCAwIG9iag0KPDwvVHlwZS9Gb250RGVzY3JpcHRvci9Gb250TmFtZS9BcmlhbE1UL0ZsYWdzIDMyL0l0YWxpY0FuZ2xlIDAvQXNjZW50IDkwNS9EZXNjZW50IC0yMTAvQ2FwSGVpZ2h0IDcyOC9BdmdXaWR0aCA0NDEvTWF4V2lkdGggMjY2NS9Gb250V2VpZ2h0IDQwMC9YSGVpZ2h0IDI1MC9MZWFkaW5nIDMzL1N0ZW1WIDQ0L0ZvbnRCQm94WyAtNjY1IC0yMTAgMjAwMCA3MjhdIC9Gb250RmlsZTIgMzI1IDAgUj4+DQplbmRvYmoNCjExIDAgb2JqDQo8PC9UeXBlL0V4dEdTdGF0ZS9CTS9Ob3JtYWwvQ0EgMT4+DQplbmRvYmoNCjEyIDAgb2JqDQo8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMC9CYXNlRm9udC9UaW1lc05ld1JvbWFuUFNNVC9FbmNvZGluZy9JZGVudGl0eS1IL0Rlc2NlbmRhbnRGb250cyAxMyAwIFIvVG9Vbmljb2RlIDMyNyAwIFI+Pg0KZW5kb2JqDQoxMyAwIG9iag0KWyAxNCAwIFJdIA0KZW5kb2JqDQoxNCAwIG9iag0KPDwvQmFzZUZvbnQvVGltZXNOZXdSb21hblBTTVQvU3VidHlwZS9DSURGb250VHlwZTIvVHlwZS9Gb250L0NJRFRvR0lETWFwL0lkZW50aXR5L0RXIDEwMDAvQ0lEU3lzdGVtSW5mbyAxNSAwIFIvRm9udERlc2NyaXB0b3IgMTYgMCBSL1cgMzI5IDAgUj4+DQplbmRvYmoNCjE1IDAgb2JqDQo8PC9PcmRlcmluZyhJZGVudGl0eSkgL1JlZ2lzdHJ5KEFkb2JlKSAvU3VwcGxlbWVudCAwPj4NCmVuZG9iag0KMTYgMCBvYmoNCjw8L1R5cGUvRm9udERlc2NyaXB0b3IvRm9udE5hbWUvVGltZXNOZXdSb21hblBTTVQvRmxhZ3MgMzIvSXRhbGljQW5nbGUgMC9Bc2NlbnQgODkxL0Rlc2NlbnQgLTIxNi9DYXBIZWlnaHQgNjkzL0F2Z1dpZHRoIDQwMS9NYXhXaWR0aCAyNjE0L0ZvbnRXZWlnaHQgNDAwL1hIZWlnaHQgMjUwL0xlYWRpbmcgNDIvU3RlbVYgNDAvRm9udEJCb3hbIC01NjggLTIxNiAyMDQ2IDY5M10gL0ZvbnRGaWxlMiAzMjggMCBSPj4NCmVuZG9iag0KMTcgMCBvYmoNCjw8L1R5cGUvRm9udC9TdWJ0eXBlL1RydWVUeXBlL05hbWUvRjMvQmFzZUZvbnQvQkNERUVFK0NhbGlicmkvRW5jb2RpbmcvV2luQW5zaUVuY29kaW5nL0ZvbnREZXNjcmlwdG9yIDE4IDAgUi9GaXJzdENoYXIgMzIvTGFzdENoYXIgMzIvV2lkdGhzIDMzMCAwIFI+Pg0KZW5kb2JqDQoxOCAwIG9iag0KPDwvVHlwZS9Gb250RGVzY3JpcHRvci9Gb250TmFtZS9CQ0RFRUUrQ2FsaWJyaS9GbGFncyAzMi9JdGFsaWNBbmdsZSAwL0FzY2VudCA3NTAvRGVzY2VudCAtMjUwL0NhcEhlaWdodCA3NTAvQXZnV2lkdGggNTIxL01heFdpZHRoIDE3NDMvRm9udFdlaWdodCA0MDAvWEhlaWdodCAyNTAvU3RlbVYgNTIvRm9udEJCb3hbIC01MDMgLTI1MCAxMjQwIDc1MF0gL0ZvbnRGaWxlMiAzMzEgMCBSPj4NCmVuZG9iag0KMTkgMCBvYmoNCjw8L1R5cGUvRm9udC9TdWJ0eXBlL1RydWVUeXBlL05hbWUvRjQvQmFzZUZvbnQvQkNERkVFK1NpbXBsaWZpZWRBcmFiaWMvRW5jb2RpbmcvV2luQW5zaUVuY29kaW5nL0ZvbnREZXNjcmlwdG9yIDIwIDAgUi9GaXJzdENoYXIgMzIvTGFzdENoYXIgMTE3L1dpZHRocyAzMzIgMCBSPj4NCmVuZG9iag0KMjAgMCBvYmoNCjw8L1R5cGUvRm9udERlc2NyaXB0b3IvRm9udE5hbWUvQkNERkVFK1NpbXBsaWZpZWRBcmFiaWMvRmxhZ3MgMzIvSXRhbGljQW5nbGUgMC9Bc2NlbnQgMTE4MC9EZXNjZW50IC00NzgvQ2FwSGVpZ2h0IDExODAvQXZnV2lkdGggNDA4L01heFdpZHRoIDI1MDkvRm9udFdlaWdodCA0MDAvWEhlaWdodCAyNTAvU3RlbVYgNDAvRm9udEJCb3hbIC00OTEgLTQ3OCAyMDE4IDExODBdIC9Gb250RmlsZTIgMzMzIDAgUj4+DQplbmRvYmoNCjIxIDAgb2JqDQo8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMC9CYXNlRm9udC9CQ0RHRUUrU2ltcGxpZmllZEFyYWJpYy1Cb2xkL0VuY29kaW5nL0lkZW50aXR5LUgvRGVzY2VuZGFudEZvbnRzIDIyIDAgUi9Ub1VuaWNvZGUgMzM0IDAgUj4+DQplbmRvYmoNCjIyIDAgb2JqDQpbIDIzIDAgUl0gDQplbmRvYmoNCjIzIDAgb2JqDQo8PC9CYXNlRm9udC9CQ0RHRUUrU2ltcGxpZmllZEFyYWJpYy1Cb2xkL1N1YnR5cGUvQ0lERm9udFR5cGUyL1R5cGUvRm9udC9DSURUb0dJRE1hcC9JZGVudGl0eS9EVyAxMDAwL0NJRFN5c3RlbUluZm8gMjQgMCBSL0ZvbnREZXNjcmlwdG9yIDI1IDAgUi9XIDMzNiAwIFI+Pg0KZW5kb2JqDQoyNCAwIG9iag0KPDwvT3JkZXJpbmcoSWRlbnRpdHkpIC9SZWdpc3RyeShBZG9iZSkgL1N1cHBsZW1lbnQgMD4+DQplbmRvYmoNCjI1IDAgb2JqDQo8PC9UeXBlL0ZvbnREZXNjcmlwdG9yL0ZvbnROYW1lL0JDREdFRStTaW1wbGlmaWVkQXJhYmljLUJvbGQvRmxhZ3MgMzIvSXRhbGljQW5nbGUgMC9Bc2NlbnQgMTE4MC9EZXNjZW50IC00ODMvQ2FwSGVpZ2h0IDExODAvQXZnV2lkdGggNDgxL01heFdpZHRoIDI1NDAvRm9udFdlaWdodCA3MDAvWEhlaWdodCAyNTAvU3RlbVYgNDgvRm9udEJCb3hbIC01NDggLTQ4MyAxOTkyIDExODBdIC9Gb250RmlsZTIgMzM1IDAgUj4+DQplbmRvYmoNCjI2IDAgb2JqDQo8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMC9CYXNlRm9udC9CQ0RIRUUrU2ltcGxpZmllZEFyYWJpYy9FbmNvZGluZy9JZGVudGl0eS1IL0Rlc2NlbmRhbnRGb250cyAyNyAwIFIvVG9Vbmljb2RlIDMzNyAwIFI+Pg0KZW5kb2JqDQoyNyAwIG9iag0KWyAyOCAwIFJdIA0KZW5kb2JqDQoyOCAwIG9iag0KPDwvQmFzZUZvbnQvQkNESEVFK1NpbXBsaWZpZWRBcmFiaWMvU3VidHlwZS9DSURGb250VHlwZTIvVHlwZS9Gb250L0NJRFRvR0lETWFwL0lkZW50aXR5L0RXIDEwMDAvQ0lEU3lzdGVtSW5mbyAyOSAwIFIvRm9udERlc2NyaXB0b3IgMzAgMCBSL1cgMzM5IDAgUj4+DQplbmRvYmoNCjI5IDAgb2JqDQo8PC9PcmRlcmluZyhJZGVudGl0eSkgL1JlZ2lzdHJ5KEFkb2JlKSAvU3VwcGxlbWVudCAwPj4NCmVuZG9iag0KMzAgMCBvYmoNCjw8L1R5cGUvRm9udERlc2NyaXB0b3IvRm9udE5hbWUvQkNESEVFK1NpbXBsaWZpZWRBcmFiaWMvRmxhZ3MgMzIvSXRhbGljQW5nbGUgMC9Bc2NlbnQgMTE4MC9EZXNjZW50IC00NzgvQ2FwSGVpZ2h0IDExODAvQXZnV2lkdGggNDA4L01heFdpZHRoIDI1MDkvRm9udFdlaWdodCA0MDAvWEhlaWdodCAyNTAvU3RlbVYgNDAvRm9udEJCb3hbIC00OTEgLTQ3OCAyMDE4IDExODBdIC9Gb250RmlsZTIgMzM4IDAgUj4+DQplbmRvYmoNCjMxIDAgb2JqDQo8PC9UeXBlL0ZvbnQvU3VidHlwZS9UcnVlVHlwZS9OYW1lL0Y3L0Jhc2VGb250L0FyaWFsTVQvRW5jb2RpbmcvV2luQW5zaUVuY29kaW5nL0ZvbnREZXNjcmlwdG9yIDMyIDAgUi9GaXJzdENoYXIgMzIvTGFzdENoYXIgMzIvV2lkdGhzIDM0MCAwIFI+Pg0KZW5kb2JqDQozMiAwIG9iag0KPDwvVHlwZS9Gb250RGVzY3JpcHRvci9Gb250TmFtZS9BcmlhbE1UL0ZsYWdzIDMyL0l0YWxpY0FuZ2xlIDAvQXNjZW50IDkwNS9EZXNjZW50IC0yMTAvQ2FwSGVpZ2h0IDcyOC9BdmdXaWR0aCA0NDEvTWF4V2lkdGggMjY2NS9Gb250V2VpZ2h0IDQwMC9YSGVpZ2h0IDI1MC9MZWFkaW5nIDMzL1N0ZW1WIDQ0L0ZvbnRCQm94WyAtNjY1IC0yMTAgMjAwMCA3MjhdID4+DQplbmRvYmoNCjMzIDAgb2JqDQo8PC9UeXBlL0ZvbnQvU3VidHlwZS9UeXBlMC9CYXNlRm9udC9IZWx2ZXRpY2EvRW5jb2RpbmcvSWRlbnRpdHktSC9EZXNjZW5kYW50Rm9udHMgMzQgMCBSL1RvVW5pY29kZSAzNDEgMCBSPj4NCmVuZG9iag0KMzQgMCBvYmoNClsgMzUgMCBSXSANCmVuZG9iag0KMzUgMCBvYmoNCjw8L0Jhc2VGb250L0hlbHZldGljYS9TdWJ0eXBlL0NJREZvbnRUeXBlMi9UeXBlL0ZvbnQvQ0lEVG9HSURNYXAvSWRlbnRpdHkvRFcgMTAwMC9DSURTeXN0ZW1JbmZvIDM2IDAgUi9Gb250RGVzY3JpcHRvciAzNyAwIFIvVyAzNDMgMCBSPj4NCmVuZG9iag0KMzYgMCBvYmoN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', 'pdf', 'pdf:%D9%86%D8%B4%D8%B1%D9%87%2015%20%D8%A7%D9%84%D8%AA%D8%BA%D8%B0%D9%8A%D8%A9.pdf', 0, '2026-05-10 14:16:50', 'active', NULL, NULL, NULL, 0);
INSERT INTO sections (id, name, description, sort_order, active, created_at) VALUES
(1, 'الأمراض المناعية والعصبية', 'الامراض المناعية المزمنة المؤثرة مثل التصلب اللويحي', 0, 1, '2026-05-10 04:25:07'),
(2, 'امراض الجهاز الهضمي', 'الامراض المزمنه للجهاز الهضمي مثل القولون التقرحي', 1, 1, '2026-05-10 04:25:07'),
(3, 'حالات عامة', 'الحالات الفير مشخصة', 2, 1, '2026-05-10 04:25:07');
INSERT INTO settings (id, key_name, value) VALUES
(1, 'site_closed', ''),
(2, 'login_app_title', 'المنصة لمزيد من الخصوصية'),
(3, 'login_signin_tab', 'تسجيل الدخول'),
(4, 'login_signup_tab', 'حساب جديد'),
(5, 'site_closed_message', 'خاص و غير متاح .'),
(6, 'allow_registration', '1'),
(7, 'allow_special_login', '1'),
(8, 'site_name', 'منصة خاصة'),
(9, 'welcome_message', 'مرحباً'),
(15, 'admin_whatsapp', '966500000000'),
(94, 'apt_notice', 'يتم تأكيد المواعيد في نفس اليوم بعد الظهر'),
(100, 'allow_reviewer_chat', '1'),
(146, 'thread_label', 'موضوع المحادثة');
INSERT INTO slots (id, name, time_from, time_to, status, sort_order) VALUES
(1, 'بعد صلاة المغرب', '19:30:00', '21:30:00', 'open', 2),
(2, 'بعد صلاة العصر', '17:00:00', '19:00:00', 'open', 1);
INSERT INTO submissions (id, form_id, reviewer_id, status, notes, created_at, internal_notes, reviewer_notes, highlighted_answers) VALUES
(1, 6, 8, 'done', NULL, '2026-05-10 21:32:25', 'ملاحظات خاصة بالطبيب', 'ملاحظات مع المراجع ', NULL),
(2, 4, 8, 'archived', NULL, '2026-05-16 08:10:06', 'ملاحظات للطبيب', 'الحمد لله <b>رب</b> العالمين<div><br></div><div><br></div><div><br></div><div>شكرا</div>', NULL),
(3, 6, 10, 'archived', NULL, '2026-05-19 15:17:20', 'الحمدلله hh', 'طيب ما عنده خلاف', NULL);
INSERT INTO submission_answers (id, submission_id, field_id, answer, highlight_color, admin_note) VALUES
(1, 1, 147, 'اخمد', NULL, NULL),
(2, 1, 137, '23', NULL, NULL),
(3, 1, 142, '50', NULL, NULL),
(4, 1, 149, '160', NULL, NULL),
(5, 1, 145, 'الرياض', NULL, NULL),
(6, 1, 141, '', NULL, NULL),
(7, 1, 136, 'الحمدلله', NULL, NULL),
(8, 1, 148, 'جيد', NULL, NULL),
(9, 1, 138, 'لا', NULL, NULL),
(10, 1, 139, 'لا', NULL, NULL),
(11, 1, 146, 'لا', NULL, NULL),
(12, 1, 140, 'لا', NULL, NULL),
(13, 1, 143, 'لا', NULL, NULL),
(14, 1, 173, 'لا', NULL, NULL),
(15, 1, 174, 'نعم', NULL, NULL),
(16, 1, 144, 'الحمدلله', NULL, NULL),
(17, 1, 176, 'تحسن', NULL, NULL),
(18, 1, 175, 'الحمدلله', NULL, NULL),
(19, 2, 797, 'خالد', NULL, NULL),
(20, 2, 798, 'الرياض', NULL, NULL),
(21, 2, 799, 'خر', NULL, NULL),
(22, 2, 800, '30', NULL, NULL),
(23, 2, 801, '70', NULL, NULL),
(24, 2, 802, '170', NULL, NULL),
(25, 2, 803, 'الحمدلله', NULL, NULL),
(26, 2, 804, 'طيب', NULL, NULL),
(27, 2, 805, 'طبيغي', NULL, NULL),
(28, 2, 806, 'طبيعي', NULL, NULL),
(29, 2, 807, 'طبيعي', NULL, NULL),
(30, 2, 808, 'طبيعي', NULL, NULL),
(31, 2, 809, 'طبيعي', NULL, NULL),
(32, 2, 810, 'لا', NULL, NULL),
(33, 2, 811, 'لا', NULL, NULL),
(34, 2, 812, 'لا', NULL, NULL),
(35, 2, 813, 'نعم', NULL, NULL),
(36, 2, 814, 'تمام', NULL, NULL),
(37, 2, 815, 'طيب ولله الحمد', NULL, NULL),
(38, 2, 816, 'تمام', NULL, NULL),
(39, 2, 817, 'اليمين', NULL, NULL),
(40, 2, 818, 'الحركة، العيون', NULL, NULL),
(41, 2, 819, '100', NULL, NULL),
(42, 2, 820, 'لا', NULL, NULL),
(43, 2, 821, 'طبيعي', NULL, NULL),
(44, 2, 822, 'لا', NULL, NULL),
(45, 2, 823, 'لا', NULL, NULL),
(46, 2, 824, 'تحسن', NULL, NULL),
(47, 2, 825, 'ممتاز', NULL, NULL),
(48, 3, 931, 'سامي', NULL, NULL),
(49, 3, 932, '30', NULL, NULL),
(50, 3, 933, '60', NULL, NULL),
(51, 3, 934, '170', NULL, NULL),
(52, 3, 935, 'البدائع', NULL, NULL),
(53, 3, 936, 'اشعة', NULL, NULL),
(54, 3, 937, 'ممتاز', NULL, NULL),
(55, 3, 938, 'لا يوجد مشكلة', NULL, NULL),
(56, 3, 939, 'طبيعي', NULL, NULL),
(57, 3, 940, 'طبيعي', NULL, NULL),
(58, 3, 941, 'طبيعي', NULL, NULL),
(59, 3, 942, 'لا', NULL, NULL),
(60, 3, 943, 'طبيعي', NULL, NULL),
(61, 3, 944, 'نعم', NULL, NULL),
(62, 3, 945, 'لا', NULL, NULL),
(63, 3, 946, 'ما فيه شي', NULL, NULL),
(64, 3, 947, 'تحسن', NULL, NULL),
(65, 3, 948, 'الحمدلله', NULL, NULL);
INSERT INTO threads (id, reviewer_id, admin_id, title, status, created_at, archived_at) VALUES
(1, 10, 1, 'محادثة أولى', 'archived', '2026-05-19 10:49:54', NULL),
(2, 10, 1, 'المحادثة الحالية', 'archived', '2026-05-19 10:49:54', '2026-05-19 11:08:16'),
(3, 8, 1, 'محادثة أولى', 'archived', '2026-05-19 10:49:54', NULL),
(4, 8, 1, 'المحادثة الحالية', 'archived', '2026-05-19 10:49:54', '2026-05-19 13:40:24'),
(5, 8, 3, 'محادثة أولى', 'archived', '2026-05-19 10:49:54', NULL),
(6, 8, 3, 'المحادثة الحالية', 'archived', '2026-05-19 10:49:54', '2026-05-19 13:39:27'),
(7, 8, 4, 'محادثة أولى', 'archived', '2026-05-19 10:49:54', NULL),
(8, 8, 4, 'المحادثة الحالية', 'archived', '2026-05-19 10:49:54', '2026-05-19 13:41:29'),
(9, 10, 3, 'الموقع', 'archived', '2026-05-19 11:08:16', '2026-05-19 13:50:40'),
(10, 8, 3, 'تجربة جديدة', 'active', '2026-05-19 13:40:24', NULL),
(11, 8, 3, 'تجربة جديدة', 'archived', '2026-05-19 13:40:59', '2026-05-19 13:41:59'),
(12, 10, 3, 'جديدة٩٩', 'archived', '2026-05-19 13:50:53', '2026-05-19 15:07:48'),
(13, 10, 3, 'تجربة ج', 'archived', '2026-05-19 15:07:48', '2026-05-19 15:11:22'),
(14, 10, 3, 'ممتاز', 'archived', '2026-05-19 15:11:22', '2026-05-19 15:13:17'),
(15, 10, 3, 'هذي الاخيرة', 'active', '2026-05-19 15:13:17', NULL);
INSERT INTO users (id, name, username, phone, password, role, allowed_special, created_at, status) VALUES
(1, 'Mo', 'mo', '+966548999968', '$2y$10$dQA1OlPQtHdvdFhnlvVIfO1w59TtvBEZZF.8czT3Zz9aYCP5wiSuK', 'admin', 1, '2026-05-09 17:20:15', 'active'),
(3, 'المشرف العام', 'admin', '0548999968', '$2y$10$04CCZ4GE8eq4v5FtQ1KMp.1eZCumpu8cv.LSxf2BelHokbqhZHheq', 'admin', 1, '2026-05-10 04:25:07', 'active'),
(4, 'الدكتور', 'asdf', '+96600000000', '$2y$10$5hwWETzXFbqOuildmVykB.5XfQoYGhBLqJjN6OfFqG2wvHGKJ9Aaq', 'admin', 1, '2026-05-10 04:25:07', 'active'),
(8, 'خالد', 'ahmd1', '0548999969', '$2y$10$YOskNSirUbmy8Wk.29WTWeRaG7nMj5zatJqQEKqDIsKt43WAVcuYS', 'reviewer', 1, '2026-05-10 04:25:07', 'active'),
(10, 'سامي محمد', 'sami', '0599444486', '$2y$10$OWFGCuor3x3FwIYpVDKTpOz/.GOHBgUi.hACHWDV1cCBpqvavqT1i', 'reviewer', 1, '2026-05-10 04:25:07', 'active'),
(11, 'شعاع حسين', 'shaa', '0501112046', '$2y$10$04CCZ4GE8eq4v5FtQ1KMp.1eZCumpu8cv.LSxf2BelHokbqhZHheq', 'reviewer', 1, '2026-05-10 04:25:07', 'active'),
(12, 'نجلاء', 'njla', '+966 57 649 9444', '$2y$10$JVLYCITOhukMBqrAzmJdvuI8AGgLFMUu5E2OxTI4LHYDdsLQGC7RK', 'reviewer', 1, '2026-05-14 11:52:17', 'active');

-- إعادة تفعيل فحص الـ FK
SET session_replication_role = origin;

-- ضبط sequences لتبدأ بعد آخر ID موجود
SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1));
SELECT setval(pg_get_serial_sequence('settings', 'id'), COALESCE((SELECT MAX(id) FROM settings), 1));
SELECT setval(pg_get_serial_sequence('sections', 'id'), COALESCE((SELECT MAX(id) FROM sections), 1));
SELECT setval(pg_get_serial_sequence('forms', 'id'), COALESCE((SELECT MAX(id) FROM forms), 1));
SELECT setval(pg_get_serial_sequence('form_fields', 'id'), COALESCE((SELECT MAX(id) FROM form_fields), 1));
SELECT setval(pg_get_serial_sequence('form_assignments', 'id'), COALESCE((SELECT MAX(id) FROM form_assignments), 1));
SELECT setval(pg_get_serial_sequence('assignments', 'id'), COALESCE((SELECT MAX(id) FROM assignments), 1));
SELECT setval(pg_get_serial_sequence('submissions', 'id'), COALESCE((SELECT MAX(id) FROM submissions), 1));
SELECT setval(pg_get_serial_sequence('submission_answers', 'id'), COALESCE((SELECT MAX(id) FROM submission_answers), 1));
SELECT setval(pg_get_serial_sequence('submission_discussions', 'id'), COALESCE((SELECT MAX(id) FROM submission_discussions), 1));
SELECT setval(pg_get_serial_sequence('slots', 'id'), COALESCE((SELECT MAX(id) FROM slots), 1));
SELECT setval(pg_get_serial_sequence('appointment_dates', 'id'), COALESCE((SELECT MAX(id) FROM appointment_dates), 1));
SELECT setval(pg_get_serial_sequence('appointments', 'id'), COALESCE((SELECT MAX(id) FROM appointments), 1));
SELECT setval(pg_get_serial_sequence('threads', 'id'), COALESCE((SELECT MAX(id) FROM threads), 1));
SELECT setval(pg_get_serial_sequence('messages', 'id'), COALESCE((SELECT MAX(id) FROM messages), 1));
SELECT setval(pg_get_serial_sequence('publications', 'id'), COALESCE((SELECT MAX(id) FROM publications), 1));

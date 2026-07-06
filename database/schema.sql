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
  allow_chat      SMALLINT     DEFAULT 1,
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

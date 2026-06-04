-- ============================================================
-- Alaoufi Platform - MySQL Schema (Hostinger / phpMyAdmin)
-- Converted from Supabase/PostgreSQL
-- Import via: phpMyAdmin > Import > database.sql
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- ---------- USERS & AUTH ----------
CREATE TABLE IF NOT EXISTS users (
  id            CHAR(36)     NOT NULL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  email_verified TINYINT(1) NOT NULL DEFAULT 0,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS profiles (
  id             CHAR(36) NOT NULL PRIMARY KEY,
  display_name   VARCHAR(255),
  username       VARCHAR(120),
  phone          VARCHAR(40),
  avatar_url     TEXT,
  is_banned      TINYINT(1) NOT NULL DEFAULT 0,
  private_access TINYINT(1) NOT NULL DEFAULT 0,
  is_archived    TINYINT(1) NOT NULL DEFAULT 0,
  archived_at    TIMESTAMP NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_profiles_user FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_profiles_phone (phone),
  INDEX idx_profiles_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_roles (
  id         CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  user_id    CHAR(36) NOT NULL,
  role       ENUM('admin','reviewer','user') NOT NULL DEFAULT 'reviewer',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_role (user_id, role),
  CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS password_reset_requests (
  id          CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  user_id     CHAR(36),
  username    VARCHAR(120),
  phone       VARCHAR(40) NOT NULL,
  status      ENUM('pending','resolved','rejected') NOT NULL DEFAULT 'pending',
  notes       TEXT,
  resolved_at TIMESTAMP NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- APP SETTINGS ----------
CREATE TABLE IF NOT EXISTS app_settings (
  `key`      VARCHAR(120) NOT NULL PRIMARY KEY,
  `value`    JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- CATEGORIES & FORMS ----------
CREATE TABLE IF NOT EXISTS categories (
  id          CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  icon        VARCHAR(80) DEFAULT 'Folder',
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS forms (
  id          CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  category_id CHAR(36),
  title       VARCHAR(255) NOT NULL,
  description TEXT,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_by  CHAR(36),
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_forms_cat FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS form_sections (
  id              CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  form_id         CHAR(36) NOT NULL,
  title           VARCHAR(255) NOT NULL,
  text_color      VARCHAR(40),
  highlight_color VARCHAR(40),
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sections_form FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS form_fields (
  id              CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  form_id         CHAR(36) NOT NULL,
  section_id      CHAR(36),
  section         VARCHAR(255),
  label           VARCHAR(500) NOT NULL,
  field_type      ENUM('text','textarea','number','date','select','radio','checkbox','file','rating','signature') NOT NULL DEFAULT 'text',
  is_required     TINYINT(1) NOT NULL DEFAULT 0,
  options         JSON,
  placeholder     VARCHAR(255),
  text_color      VARCHAR(40),
  highlight_color VARCHAR(40),
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fields_form FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE,
  CONSTRAINT fk_fields_section FOREIGN KEY (section_id) REFERENCES form_sections(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS form_submissions (
  id               CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  form_id          CHAR(36) NOT NULL,
  user_id          CHAR(36) NOT NULL,
  data             JSON NOT NULL,
  status           VARCHAR(40) NOT NULL DEFAULT 'submitted',
  highlights       JSON,
  admin_notes      TEXT,
  discussion_notes TEXT,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_subs_form FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE,
  CONSTRAINT fk_subs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS form_recommendations (
  id              CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  form_id         CHAR(36) NOT NULL,
  user_id         CHAR(36) NOT NULL,
  recommended_by  CHAR(36),
  submission_id   CHAR(36),
  status          VARCHAR(40) NOT NULL DEFAULT 'pending',
  note            TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_form_user (form_id, user_id),
  CONSTRAINT fk_recs_form FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE,
  CONSTRAINT fk_recs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- APPOINTMENTS ----------
CREATE TABLE IF NOT EXISTS appointment_periods (
  id         CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  name       VARCHAR(120) NOT NULL,
  start_time TIME NOT NULL,
  end_time   TIME NOT NULL,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS appointment_slots (
  id         CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  period_id  CHAR(36) NOT NULL,
  slot_date  DATE NOT NULL,
  notes      TEXT,
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_slots_period FOREIGN KEY (period_id) REFERENCES appointment_periods(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS appointments (
  id                    CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  user_id               CHAR(36) NOT NULL,
  slot_id               CHAR(36),
  status                ENUM('waitlist','confirmed','attended','cancelled','no_show') NOT NULL DEFAULT 'waitlist',
  user_note             TEXT,
  admin_note            TEXT,
  cancel_reason         TEXT,
  evaluation_enabled    TINYINT(1) NOT NULL DEFAULT 0,
  evaluation_enabled_at TIMESTAMP NULL,
  confirmed_at          TIMESTAMP NULL,
  cancelled_at          TIMESTAMP NULL,
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_appt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_appt_slot FOREIGN KEY (slot_id) REFERENCES appointment_slots(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- EVALUATIONS ----------
CREATE TABLE IF NOT EXISTS session_evaluation_fields (
  id         CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  label      VARCHAR(255) NOT NULL,
  field_type VARCHAR(40) NOT NULL DEFAULT 'comparison',
  is_active  TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS session_evaluations (
  id                      CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  appointment_id          CHAR(36) NOT NULL,
  user_id                 CHAR(36) NOT NULL,
  state_before            TEXT,
  state_after             TEXT,
  comparisons             JSON,
  custom_fields           JSON,
  expected_results        TEXT,
  overall_change_percent  INT,
  notes                   TEXT,
  extra                   TEXT,
  admin_notes             TEXT,
  submitted_at            TIMESTAMP NULL,
  created_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_eval_appt FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  CONSTRAINT fk_eval_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reviewer_followups (
  id                 CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  user_id            CHAR(36) NOT NULL,
  appointment_id     CHAR(36),
  evaluation_id      CHAR(36),
  notes              TEXT NOT NULL,
  next_followup_date DATE,
  created_by         CHAR(36),
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_fu_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- CHAT ----------
CREATE TABLE IF NOT EXISTS conversations (
  id                  CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  user_id             CHAR(36) NOT NULL,
  subject             VARCHAR(255) NOT NULL DEFAULT 'محادثة جديدة',
  status              VARCHAR(40) NOT NULL DEFAULT 'open',
  user_last_read_at   TIMESTAMP NULL,
  admin_last_read_at  TIMESTAMP NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_conv_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS messages (
  id              CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  conversation_id CHAR(36) NOT NULL,
  sender_id       CHAR(36) NOT NULL,
  content         TEXT NOT NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_msg_conv FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  CONSTRAINT fk_msg_user FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- BLOG / POSTS ----------
CREATE TABLE IF NOT EXISTS posts (
  id               CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  title            VARCHAR(500) NOT NULL,
  post_type        ENUM('rich_text','pdf') NOT NULL DEFAULT 'rich_text',
  content          LONGTEXT,
  pdf_url          TEXT,
  text_color       VARCHAR(40),
  background_color VARCHAR(40),
  font_family      VARCHAR(120),
  font_size        INT DEFAULT 16,
  text_align       VARCHAR(20) DEFAULT 'right',
  status           ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  published_at     TIMESTAMP NULL,
  created_by       CHAR(36),
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS post_likes (
  id         CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  post_id    CHAR(36) NOT NULL,
  user_id    CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_post_like (post_id, user_id),
  CONSTRAINT fk_like_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_like_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS post_comments (
  id          CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  post_id     CHAR(36) NOT NULL,
  user_id     CHAR(36) NOT NULL,
  content     TEXT NOT NULL,
  status      ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  approved_by CHAR(36),
  approved_at TIMESTAMP NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_com_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  CONSTRAINT fk_com_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- SEED DATA
-- ============================================================
-- Default admin: email=admin@alaoufi.local  password=Admin@123
-- bcrypt hash of "Admin@123":
INSERT INTO users (id,email,password_hash,email_verified) VALUES
('11111111-1111-1111-1111-111111111111','admin@alaoufi.local','$2b$10$E0fX7s4Y8s7rMv1bV3yQ1uG9kH0uYqZ8sQ3p6nOv8m8q4lWx2bH8u',1);

INSERT INTO profiles (id,display_name,username,phone,private_access)
VALUES ('11111111-1111-1111-1111-111111111111','مدير النظام','admin','+966500000000',1);

INSERT INTO user_roles (id,user_id,role) VALUES
(UUID(),'11111111-1111-1111-1111-111111111111','admin');

INSERT INTO app_settings (`key`,`value`) VALUES
('site_closed','{"enabled":false}'),
('site_title','{"value":"منصة العوفي"}');

INSERT INTO categories (id,name,icon,sort_order) VALUES
(UUID(),'استمارات عامة','FileText',1),
(UUID(),'تقييمات','ClipboardCheck',2);

INSERT INTO appointment_periods (id,name,start_time,end_time,sort_order) VALUES
(UUID(),'صباحي','09:00:00','12:00:00',1),
(UUID(),'مسائي','17:00:00','21:00:00',2);

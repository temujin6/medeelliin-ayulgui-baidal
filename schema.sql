-- Run once to create the users table.
-- The database itself must already exist (set DB_NAME in .env).

CREATE TABLE IF NOT EXISTS users (
  id              INT                      NOT NULL AUTO_INCREMENT,
  email           VARCHAR(255)             NOT NULL,
  password        VARCHAR(255)             NOT NULL,
  failed_attempts INT                      NOT NULL DEFAULT 0,
  is_blocked      TINYINT(1)               NOT NULL DEFAULT 0,
  otp_code        VARCHAR(10)                       NULL,
  otp_expiry      DATETIME                          NULL,
  otp_type        ENUM('LOGIN', 'UNBLOCK')           NULL,
  created_at      TIMESTAMP                NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP                NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

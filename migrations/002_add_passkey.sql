-- Adds WebAuthn passkey support.
-- Existing users keep their password row; passkey-only users have NULL.

ALTER TABLE users MODIFY password VARCHAR(255) NULL;

CREATE TABLE IF NOT EXISTS passkeys (
  id                    INT             NOT NULL AUTO_INCREMENT,
  user_id               INT             NOT NULL,
  credential_id         VARCHAR(255)    NOT NULL,
  credential_public_key BLOB            NOT NULL,
  counter               BIGINT UNSIGNED NOT NULL DEFAULT 0,
  transports            VARCHAR(255)    NULL,
  created_at            TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_passkeys_credential_id (credential_id),
  KEY idx_passkeys_user (user_id),
  CONSTRAINT fk_passkeys_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

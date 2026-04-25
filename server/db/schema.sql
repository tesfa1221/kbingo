-- ============================================================
-- ቤተሰብ ቢንጎ - MySQL Database Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS bingo_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bingo_db;

-- ============================================================
-- USERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  telegram_id   BIGINT UNIQUE NOT NULL,
  username      VARCHAR(100),
  first_name    VARCHAR(100),
  last_name     VARCHAR(100),
  photo_url     TEXT,
  balance       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  is_admin      TINYINT(1) NOT NULL DEFAULT 0,
  is_banned     TINYINT(1) NOT NULL DEFAULT 0,
  ban_expires_at DATETIME NULL,
  false_bingo_count INT UNSIGNED NOT NULL DEFAULT 0,
  total_wins    INT UNSIGNED NOT NULL DEFAULT 0,
  total_winnings DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_telegram_id (telegram_id),
  INDEX idx_is_banned (is_banned)
) ENGINE=InnoDB;

-- ============================================================
-- GAMES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS games (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  game_code       VARCHAR(20) UNIQUE NOT NULL,
  state           ENUM('WAITING','REGISTRATION','ACTIVE','FINISHED') NOT NULL DEFAULT 'WAITING',
  entry_fee       DECIMAL(10,2) NOT NULL DEFAULT 10.00,
  prize_pool      DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  house_fee_pct   DECIMAL(5,2) NOT NULL DEFAULT 20.00,
  net_prize       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  balls_drawn     JSON NULL COMMENT 'Array of drawn ball numbers',
  winning_pattern ENUM('HORIZONTAL','VERTICAL','DIAGONAL','FOUR_CORNERS','FULL_HOUSE') NULL,
  started_at      DATETIME NULL,
  finished_at     DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_state (state),
  INDEX idx_game_code (game_code)
) ENGINE=InnoDB;

-- ============================================================
-- TICKETS TABLE (Cards selected by users)
-- ============================================================
CREATE TABLE IF NOT EXISTS tickets (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  game_id     INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  card_number INT UNSIGNED NOT NULL COMMENT '1-100 card slot',
  card_data   JSON NOT NULL COMMENT '5x5 grid numbers',
  marked_cells JSON NULL COMMENT 'Array of [row,col] marked by user',
  is_winner   TINYINT(1) NOT NULL DEFAULT 0,
  prize_share DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_game_card (game_id, card_number),
  UNIQUE KEY uq_game_user (game_id, user_id),
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_game_id (game_id),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB;

-- ============================================================
-- TRANSACTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED NOT NULL,
  type            ENUM('DEPOSIT','WITHDRAWAL','ENTRY_FEE','PRIZE','REFUND','PENALTY') NOT NULL,
  amount          DECIMAL(12,2) NOT NULL,
  balance_before  DECIMAL(12,2) NOT NULL,
  balance_after   DECIMAL(12,2) NOT NULL,
  status          ENUM('PENDING','APPROVED','REJECTED','COMPLETED') NOT NULL DEFAULT 'PENDING',
  reference_id    VARCHAR(100) NULL COMMENT 'game_id or external ref',
  screenshot_url  TEXT NULL COMMENT 'Cloudinary URL for deposit proof',
  admin_note      TEXT NULL,
  reviewed_by     INT UNSIGNED NULL,
  reviewed_at     DATETIME NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_type (type),
  INDEX idx_status (status)
) ENGINE=InnoDB;

-- ============================================================
-- WINNERS TABLE (Archive)
-- ============================================================
CREATE TABLE IF NOT EXISTS winners (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  game_id     INT UNSIGNED NOT NULL,
  user_id     INT UNSIGNED NOT NULL,
  ticket_id   INT UNSIGNED NOT NULL,
  pattern     ENUM('HORIZONTAL','VERTICAL','DIAGONAL','FOUR_CORNERS','FULL_HOUSE') NOT NULL,
  prize_share DECIMAL(12,2) NOT NULL,
  winning_ball INT UNSIGNED NOT NULL COMMENT 'Ball number that triggered BINGO',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (game_id) REFERENCES games(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (ticket_id) REFERENCES tickets(id),
  INDEX idx_game_id (game_id),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB;

-- ============================================================
-- LEADERBOARD VIEW (Top Winners of the Week)
-- ============================================================
CREATE OR REPLACE VIEW weekly_leaderboard AS
SELECT
  u.id,
  u.telegram_id,
  u.first_name,
  u.username,
  u.photo_url,
  COUNT(w.id) AS wins_this_week,
  SUM(w.prize_share) AS earnings_this_week
FROM users u
JOIN winners w ON w.user_id = u.id
WHERE w.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY u.id
ORDER BY earnings_this_week DESC
LIMIT 20;

-- ============================================================
-- SEED: Default admin user placeholder
-- ============================================================
-- INSERT INTO users (telegram_id, username, first_name, is_admin) VALUES (123456789, 'admin', 'Admin', 1);

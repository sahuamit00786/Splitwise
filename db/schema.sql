-- /db/schema.sql
-- Complete MySQL DDL for Splitwise Clone Application

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS `splitwise_clone` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `splitwise_clone`;

-- Users table
CREATE TABLE `users` (
  `id` CHAR(36) PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `avatar_url` TEXT NULL,
  `is_verified` BOOLEAN DEFAULT FALSE,
  `verification_token` VARCHAR(255) NULL,
  `verification_token_expires` DATETIME NULL,
  `reset_token` VARCHAR(255) NULL,
  `reset_token_expires` DATETIME NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_email` (`email`),
  INDEX `idx_verification_token` (`verification_token`),
  INDEX `idx_reset_token` (`reset_token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Groups table
CREATE TABLE `groups` (
  `id` CHAR(36) PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `type` ENUM('trip','home','couple','other') DEFAULT 'other',
  `cover_emoji` VARCHAR(10) DEFAULT '💰',
  `created_by` CHAR(36) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_created_by` (`created_by`),
  INDEX `idx_type` (`type`),
  INDEX `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Group members table
CREATE TABLE `group_members` (
  `id` CHAR(36) PRIMARY KEY,
  `group_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `role` ENUM('admin','member') DEFAULT 'member',
  `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `is_active` BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  UNIQUE KEY `unique_group_user` (`group_id`, `user_id`),
  INDEX `idx_group_id` (`group_id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Expenses table
CREATE TABLE `expenses` (
  `id` CHAR(36) PRIMARY KEY,
  `group_id` CHAR(36) NOT NULL,
  `paid_by` CHAR(36) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `currency` VARCHAR(3) DEFAULT 'INR',
  `category` ENUM('food','transport','accommodation','entertainment','shopping','utilities','health','other') DEFAULT 'other',
  `split_type` ENUM('equal','exact','percentage','shares') DEFAULT 'equal',
  `receipt_url` TEXT NULL,
  `notes` TEXT NULL,
  `date` DATE NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL,
  FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`paid_by`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_group_id` (`group_id`),
  INDEX `idx_paid_by` (`paid_by`),
  INDEX `idx_category` (`category`),
  INDEX `idx_date` (`date`),
  INDEX `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Expense splits table
CREATE TABLE `expense_splits` (
  `id` CHAR(36) PRIMARY KEY,
  `expense_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `owed_amount` DECIMAL(12,2) NOT NULL,
  `paid_amount` DECIMAL(12,2) DEFAULT 0,
  `is_settled` BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_expense_id` (`expense_id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_is_settled` (`is_settled`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Settlements table
CREATE TABLE `settlements` (
  `id` CHAR(36) PRIMARY KEY,
  `group_id` CHAR(36) NOT NULL,
  `payer_id` CHAR(36) NOT NULL,
  `payee_id` CHAR(36) NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `currency` VARCHAR(3) DEFAULT 'INR',
  `note` TEXT NULL,
  `settled_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`payer_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`payee_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_group_id` (`group_id`),
  INDEX `idx_payer_id` (`payer_id`),
  INDEX `idx_payee_id` (`payee_id`),
  INDEX `idx_settled_at` (`settled_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Invitations table
CREATE TABLE `invitations` (
  `id` CHAR(36) PRIMARY KEY,
  `group_id` CHAR(36) NOT NULL,
  `invited_by` CHAR(36) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `token` VARCHAR(255) NOT NULL UNIQUE,
  `status` ENUM('pending','accepted','declined','expired') DEFAULT 'pending',
  `expires_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_token` (`token`),
  INDEX `idx_email` (`email`),
  INDEX `idx_status` (`status`),
  INDEX `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Activity log table
CREATE TABLE `activity_log` (
  `id` CHAR(36) PRIMARY KEY,
  `group_id` CHAR(36) NULL,
  `user_id` CHAR(36) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `metadata` JSON NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  INDEX `idx_group_id` (`group_id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_action` (`action`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

COMMIT;

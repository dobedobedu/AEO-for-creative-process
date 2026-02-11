-- Migration: User Activity Tracking
-- Date: 2026-01-20
-- Purpose: Lightweight usage tracking via last_active_at timestamp

-- App users table for tracking activity
CREATE TABLE IF NOT EXISTS app_users (
  user_id UUID PRIMARY KEY,
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying active users
CREATE INDEX IF NOT EXISTS idx_app_users_last_active_at ON app_users(last_active_at);

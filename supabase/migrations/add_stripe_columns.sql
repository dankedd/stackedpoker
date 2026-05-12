-- ============================================================
-- Migration: Add Stripe billing columns to profiles table
-- Run this once in your Supabase SQL Editor (Dashboard → SQL)
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id      TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id  TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status     TEXT,
  ADD COLUMN IF NOT EXISTS current_period_end      TIMESTAMPTZ;

-- Index so the webhook handler can look up users by customer ID in O(log n)
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id
  ON profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- ============================================================
-- Required Supabase RPC: increment_analyses_used
-- Only needed if not already created. Skip if it exists.
-- ============================================================

CREATE OR REPLACE FUNCTION increment_analyses_used(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET hands_analyzed_count = COALESCE(hands_analyzed_count, 0) + 1
  WHERE id = p_user_id;
END;
$$;

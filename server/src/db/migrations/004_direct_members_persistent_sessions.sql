-- Migration: 004_direct_members_persistent_sessions.sql
-- Direct member onboarding, must_change_pin setup, immediate session revocation,
-- unique active phone constraint, nullable refresh token expiry, and rls_auto_enable remediation.

-- 1. Direct member management & PIN setup flags
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS must_change_pin BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS sessions_revoked_at TIMESTAMPTZ;

-- 2. Enforce unambiguous single-family active phone numbers
CREATE UNIQUE INDEX IF NOT EXISTS idx_family_members_active_phone_unique ON family_members (phone) WHERE is_active = true;

-- 3. Allow persistent sliding-window refresh tokens (nullable absolute expiry)
ALTER TABLE refresh_tokens ALTER COLUMN expires_at DROP NOT NULL;

-- 4. Remediate rls_auto_enable SECURITY DEFINER function public permissions
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM anon;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM authenticated;

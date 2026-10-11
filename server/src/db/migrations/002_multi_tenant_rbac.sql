-- Migration: 002_multi_tenant_rbac.sql
-- Multi-Tenant SaaS with RBAC, Secure Invitations, and Database-Level Cross-Tenant Constraints.

-- 1. Update family_members role check constraint to support 'owner', 'admin', 'member'
-- and language_preference check constraint to support 'en', 'ml', 'ta'
ALTER TABLE family_members DROP CONSTRAINT IF EXISTS family_members_role_check;
ALTER TABLE family_members ADD CONSTRAINT family_members_role_check CHECK (role IN ('owner', 'admin', 'member'));

ALTER TABLE family_members DROP CONSTRAINT IF EXISTS family_members_language_preference_check;
ALTER TABLE family_members ADD CONSTRAINT family_members_language_preference_check CHECK (language_preference IN ('en', 'ml', 'ta'));

-- 2. Migrate existing seeded admin of the first family to 'owner'
UPDATE family_members SET role = 'owner' WHERE role = 'admin' AND is_active = true;

-- 3. Create invitations table for secure, high-entropy, revocable invitations
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  invitation_code_hash VARCHAR(255) NOT NULL UNIQUE,
  code_display VARCHAR(32) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_by UUID REFERENCES family_members(id) ON DELETE SET NULL,
  max_uses INTEGER NOT NULL DEFAULT 1,
  uses_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_family ON invitations(family_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invitations_code_hash ON invitations(invitation_code_hash);

-- 4. Cross-Tenant Constraints on Payments, Milk Entries, and Payment Allocations
-- Composite unique constraints allowing composite foreign keys
ALTER TABLE payments DROP CONSTRAINT IF EXISTS uq_payments_id_family;
ALTER TABLE payments ADD CONSTRAINT uq_payments_id_family UNIQUE (id, family_id);

ALTER TABLE milk_entries DROP CONSTRAINT IF EXISTS uq_milk_entries_id_family;
ALTER TABLE milk_entries ADD CONSTRAINT uq_milk_entries_id_family UNIQUE (id, family_id);

-- Add family_id column to payment_allocations if it does not already exist
ALTER TABLE payment_allocations ADD COLUMN IF NOT EXISTS family_id UUID REFERENCES families(id) ON DELETE CASCADE;

-- Backfill family_id in payment_allocations from payments table
UPDATE payment_allocations
SET family_id = payments.family_id
FROM payments
WHERE payment_allocations.payment_id = payments.id AND payment_allocations.family_id IS NULL;

-- Strict composite foreign keys preventing cross-family payment allocations
ALTER TABLE payment_allocations DROP CONSTRAINT IF EXISTS fk_payment_alloc_payment_family;
ALTER TABLE payment_allocations ADD CONSTRAINT fk_payment_alloc_payment_family
  FOREIGN KEY (payment_id, family_id) REFERENCES payments(id, family_id) ON DELETE CASCADE;

ALTER TABLE payment_allocations DROP CONSTRAINT IF EXISTS fk_payment_alloc_entry_family;
ALTER TABLE payment_allocations ADD CONSTRAINT fk_payment_alloc_entry_family
  FOREIGN KEY (milk_entry_id, family_id) REFERENCES milk_entries(id, family_id) ON DELETE CASCADE;

-- 5. Additional index for active phone lookups
CREATE INDEX IF NOT EXISTS idx_family_members_active_phone ON family_members(phone) WHERE is_active = true;

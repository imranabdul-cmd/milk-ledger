-- Migration: 001_initial_schema.sql
-- Production schema for Family Milk Account with strict constraints,
-- exact integer paise money, millilitre quantities, and foreign keys.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table: Schema Migrations (Internal tracker)
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(100) PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: families
CREATE TABLE IF NOT EXISTS families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: family_members
CREATE TABLE IF NOT EXISTS family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  pin_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  language_preference VARCHAR(10) NOT NULL DEFAULT 'ta' CHECK (language_preference IN ('en', 'ml', 'ta')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_family_member_phone UNIQUE (family_id, phone)
);

-- Table: milk_rate_history
CREATE TABLE IF NOT EXISTS milk_rate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  rate_paise_per_litre INTEGER NOT NULL CHECK (rate_paise_per_litre > 0),
  effective_from DATE NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES family_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: milk_entries
CREATE TABLE IF NOT EXISTS milk_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  member_id UUID REFERENCES family_members(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  quantity_ml INTEGER NOT NULL CHECK (quantity_ml > 0),
  rate_paise_per_litre INTEGER NOT NULL CHECK (rate_paise_per_litre > 0),
  total_amount_paise INTEGER NOT NULL CHECK (total_amount_paise >= 0),
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('paid', 'pending', 'partially_paid')),
  notes TEXT,
  is_corrected BOOLEAN NOT NULL DEFAULT false,
  correction_notes TEXT,
  idempotency_key VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  member_id UUID REFERENCES family_members(id) ON DELETE SET NULL,
  date DATE NOT NULL,
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  payment_method VARCHAR(30) NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'upi', 'bank_transfer', 'other')),
  notes TEXT,
  idempotency_key VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: payment_allocations
CREATE TABLE IF NOT EXISTS payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  milk_entry_id UUID REFERENCES milk_entries(id) ON DELETE SET NULL,
  monthly_closure_id UUID,
  allocated_amount_paise INTEGER NOT NULL CHECK (allocated_amount_paise > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: monthly_closures
CREATE TABLE IF NOT EXISTS monthly_closures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  year_month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
  opening_balance_paise INTEGER NOT NULL DEFAULT 0,
  total_milk_charges_paise INTEGER NOT NULL DEFAULT 0,
  total_payments_paise INTEGER NOT NULL DEFAULT 0,
  closing_balance_paise INTEGER NOT NULL DEFAULT 0,
  total_litres NUMERIC(8,2) NOT NULL DEFAULT 0,
  purchase_days INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_by UUID REFERENCES family_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_family_monthly_closure UNIQUE (family_id, year_month)
);

-- Table: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  member_id UUID REFERENCES family_members(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for lightning fast queries and safe concurrency
CREATE INDEX IF NOT EXISTS idx_milk_rate_effective ON milk_rate_history(family_id, effective_from DESC);
CREATE INDEX IF NOT EXISTS idx_milk_entries_date ON milk_entries(family_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_milk_entries_status ON milk_entries(family_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_milk_entries_idempotency ON milk_entries(family_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(family_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_idempotency ON payments(family_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_entry ON payment_allocations(milk_entry_id);
CREATE INDEX IF NOT EXISTS idx_monthly_closures_month ON monthly_closures(family_id, year_month DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_family ON audit_logs(family_id, created_at DESC);

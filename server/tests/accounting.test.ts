import { describe, it, expect, beforeEach } from 'vitest';
import { newDb } from 'pg-mem';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

import {
  calculateMilkCostPaise,
  paiseToRupees,
  rupeesToPaise,
  mlToLitres,
  formatPaise,
  formatMilkQuantity
} from '@family-milk/shared';
import {
  calculateMonthSettlement,
  generateWhatsAppStatementText,
  getDashboardSummary
} from '../src/modules/settlement/settlement.service.js';
import {
  createMilkEntry,
  correctMilkEntry,
  getApplicableRate
} from '../src/modules/milk/milk.service.js';
import { createPayment } from '../src/modules/payments/payments.service.js';
import { setCustomPool } from '../src/config/db.js';

import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Family Milk Account - Core Accounting & Integration Suite', () => {
  let db: any;
  let pool: any;
  let familyId: string;
  let adminId: string;
  let memberId: string;

  beforeEach(async () => {
    // 1. Create fresh in-memory PostgreSQL instance
    db = newDb();

    // Register pgcrypto functions needed by schema (impure: true ensures fresh UUID per call)
    db.public.registerFunction({
      name: 'gen_random_uuid',
      impure: true,
      implementation: () => crypto.randomUUID()
    });

    const pgAdapter = db.adapters.createPg();
    pool = new pgAdapter.Pool();
    setCustomPool(pool);

    // 2. Read and apply all schema migrations
    const migrationsDir = path.resolve(__dirname, '../src/db/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    for (const file of migrationFiles) {
      let sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      sql = sql.replace('CREATE EXTENSION IF NOT EXISTS "pgcrypto";', '');
      sql = sql.replace(/REVOKE ALL ON FUNCTION[^\n;]+;/gi, '');
      sql = sql.replace(/ALTER TABLE refresh_tokens ALTER COLUMN expires_at DROP NOT NULL;/gi, '');
      sql = sql.replace(/WHERE is_active = true/gi, '');
      await pool.query(sql);
    }

    // 3. Create test family & members
    const famRes = await pool.query(
      `INSERT INTO families (name, currency, timezone) VALUES ('Test Family', 'INR', 'Asia/Kolkata') RETURNING id`
    );
    familyId = famRes.rows[0].id;

    const salt = await bcrypt.genSalt(10);
    const pinHash = await bcrypt.hash('1234', salt);

    const adminRes = await pool.query(
      `INSERT INTO family_members (family_id, name, phone, pin_hash, role, language_preference)
       VALUES ($1, 'Admin', '9876543210', $2, 'admin', 'ml') RETURNING id`,
      [familyId, pinHash]
    );
    adminId = adminRes.rows[0].id;

    const memberRes = await pool.query(
      `INSERT INTO family_members (family_id, name, phone, pin_hash, role, language_preference)
       VALUES ($1, 'Member', '9876543211', $2, 'member', 'en') RETURNING id`,
      [familyId, pinHash]
    );
    memberId = memberRes.rows[0].id;

    // 4. Initial rate: ₹50/Litre (5000 paise) effective from 2026-01-01
    await pool.query(
      `INSERT INTO milk_rate_history (family_id, rate_paise_per_litre, effective_from, notes, created_by)
       VALUES ($1, 5000, '2026-01-01', 'Initial rate ₹50', $2)`,
      [familyId, adminId]
    );
  });

  describe('1. Exact Financial & Unit Math', () => {
    it('calculates milk costs accurately using integer paise (no floats)', () => {
      // 500 ml at ₹50/L (5000 paise) => 2500 paise (₹25.00)
      expect(calculateMilkCostPaise(500, 5000)).toBe(2500);

      // 1000 ml at ₹56/L (5600 paise) => 5600 paise (₹56.00)
      expect(calculateMilkCostPaise(1000, 5600)).toBe(5600);

      // 750 ml at ₹56/L (5600 paise) => 4200 paise (₹42.00)
      expect(calculateMilkCostPaise(750, 5600)).toBe(4200);

      // 1500 ml at ₹52.50/L (5250 paise) => round((1500 * 5250)/1000) = 7875 paise (₹78.75)
      expect(calculateMilkCostPaise(1500, 5250)).toBe(7875);
    });

    it('converts between paise and rupees cleanly', () => {
      expect(paiseToRupees(5600)).toBe(56.00);
      expect(paiseToRupees(2550)).toBe(25.50);
      expect(rupeesToPaise(56)).toBe(5600);
      expect(rupeesToPaise('56.50')).toBe(5650);
    });

    it('formats currencies and quantities with Malayalam & English labels', () => {
      expect(formatPaise(5600)).toBe('₹56');
      expect(formatPaise(5650)).toBe('₹56.50');
      expect(formatPaise(-1200)).toBe('-₹12');

      expect(formatMilkQuantity(500, 'en')).toBe('½ Litre');
      expect(formatMilkQuantity(500, 'ml')).toBe('½ ലിറ്റർ');
      expect(formatMilkQuantity(1000, 'en')).toBe('1 Litre');
      expect(formatMilkQuantity(1000, 'ml')).toBe('1 ലിറ്റർ');
      expect(formatMilkQuantity(1500, 'ml')).toBe('1½ ലിറ്റർ');
      expect(mlToLitres(1500)).toBe(1.5);
    });
  });

  describe('2. Rate Changes & Purchase Immutability', () => {
    it('applies new rates to future purchases without rewriting historical purchases', async () => {
      // Purchase on 2026-02-10 at initial rate (₹50/L)
      const entry1 = await createMilkEntry({
        familyId,
        memberId,
        date: '2026-02-10',
        quantityMl: 1000,
        paymentChoice: 'pending',
      });

      expect(entry1.ratePaisePerLitre).toBe(5000);
      expect(entry1.totalAmountPaise).toBe(5000);

      // Rate increase to ₹60/L (6000 paise) effective from 2026-02-15
      await pool.query(
        `INSERT INTO milk_rate_history (family_id, rate_paise_per_litre, effective_from, notes, created_by)
         VALUES ($1, 6000, '2026-02-15', 'Rate hike', $2)`,
        [familyId, adminId]
      );

      // Purchase on 2026-02-20 must get ₹60/L
      const entry2 = await createMilkEntry({
        familyId,
        memberId,
        date: '2026-02-20',
        quantityMl: 1000,
        paymentChoice: 'pending',
      });

      expect(entry2.ratePaisePerLitre).toBe(6000);
      expect(entry2.totalAmountPaise).toBe(6000);

      // Historical purchase on 2026-02-10 MUST retain ₹50/L
      const verifyRes = await pool.query('SELECT rate_paise_per_litre FROM milk_entries WHERE id = $1', [entry1.id]);
      expect(verifyRes.rows[0].rate_paise_per_litre).toBe(5000);
    });
  });

  describe('3. Immediate, Partial, and Multiple Payments', () => {
    it('creates milk purchase with immediate payment and allocation without double-counting', async () => {
      // 1 Litre at ₹50, marked 'paid' immediately
      const entry = await createMilkEntry({
        familyId,
        memberId,
        date: '2026-03-01',
        quantityMl: 1000,
        paymentChoice: 'paid',
      });

      expect(entry.paymentStatus).toBe('paid');

      // Check payment record created
      const payRes = await pool.query('SELECT * FROM payments WHERE family_id = $1', [familyId]);
      expect(payRes.rows.length).toBe(1);
      expect(payRes.rows[0].amount_paise).toBe(5000);

      // Check allocation created
      const allocRes = await pool.query('SELECT * FROM payment_allocations WHERE payment_id = $1', [payRes.rows[0].id]);
      expect(allocRes.rows.length).toBe(1);
      expect(allocRes.rows[0].allocated_amount_paise).toBe(5000);
      expect(allocRes.rows[0].milk_entry_id).toBe(entry.id);

      // Balance check for March: Charges = 5000, Payments = 5000 => Closing = 0 (Nil due)
      const settlement = await calculateMonthSettlement(familyId, '2026-03');
      expect(settlement.totalMilkChargesPaise).toBe(5000);
      expect(settlement.totalPaymentsPaise).toBe(5000);
      expect(settlement.closingBalancePaise).toBe(0);
    });

    it('supports partial payments and sequential allocations', async () => {
      // Two pending purchases on 2026-04-01 and 2026-04-02: ₹50 each (total ₹100 = 10000 paise)
      const entry1 = await createMilkEntry({
        familyId,
        memberId,
        date: '2026-04-01',
        quantityMl: 1000,
        paymentChoice: 'pending',
      });

      const entry2 = await createMilkEntry({
        familyId,
        memberId,
        date: '2026-04-02',
        quantityMl: 1000,
        paymentChoice: 'pending',
      });

      // Partial payment of ₹75 (7500 paise) allocated to entry1 and entry2
      await createPayment({
        familyId,
        memberId,
        date: '2026-04-03',
        amountPaise: 7500,
        paymentMethod: 'cash',
        allocateToEntryIds: [entry1.id, entry2.id],
      });

      // Entry 1 should be fully 'paid' (5000 paise allocated)
      const e1Check = await pool.query('SELECT payment_status FROM milk_entries WHERE id = $1', [entry1.id]);
      expect(e1Check.rows[0].payment_status).toBe('paid');

      // Entry 2 should be 'partially_paid' (2500 paise allocated out of 5000)
      const e2Check = await pool.query('SELECT payment_status FROM milk_entries WHERE id = $1', [entry2.id]);
      expect(e2Check.rows[0].payment_status).toBe('partially_paid');

      // Settlement: Charges = 10000, Payments = 7500 => Closing Due = 2500 paise (₹25.00)
      const settlement = await calculateMonthSettlement(familyId, '2026-04');
      expect(settlement.totalMilkChargesPaise).toBe(10000);
      expect(settlement.totalPaymentsPaise).toBe(7500);
      expect(settlement.closingBalancePaise).toBe(2500);
    });
  });

  describe('4. Advance Credits & Month Rollover', () => {
    it('carries forward advance credits and outstanding due across months', async () => {
      // Month 1 (2026-05): 10 days of 1L @ ₹50 = ₹500 (50000 paise)
      for (let day = 1; day <= 10; day++) {
        const dStr = day < 10 ? `0${day}` : `${day}`;
        await createMilkEntry({
          familyId,
          memberId,
          date: `2026-05-${dStr}`,
          quantityMl: 1000,
          paymentChoice: 'pending',
        });
      }

      // Family makes lump-sum payment of ₹600 (60000 paise) -> ₹100 excess advance credit!
      await createPayment({
        familyId,
        memberId,
        date: '2026-05-25',
        amountPaise: 60000,
        paymentMethod: 'upi',
      });

      const maySettlement = await calculateMonthSettlement(familyId, '2026-05');
      expect(maySettlement.totalMilkChargesPaise).toBe(50000);
      expect(maySettlement.totalPaymentsPaise).toBe(60000);
      expect(maySettlement.closingBalancePaise).toBe(-10000); // -₹100 (Advance credit!)
      expect(maySettlement.purchaseDays).toBe(10);
      expect(maySettlement.totalLitres).toBe(10);

      // Month 2 (2026-06): Opening balance must be -10000 paise
      const juneSettlement = await calculateMonthSettlement(familyId, '2026-06');
      expect(juneSettlement.openingBalancePaise).toBe(-10000);

      // Now buy 1 Litre in June @ ₹50 (5000 paise)
      await createMilkEntry({
        familyId,
        memberId,
        date: '2026-06-01',
        quantityMl: 1000,
        paymentChoice: 'pending',
      });

      // June closing = -10000 + 5000 - 0 = -5000 paise (still ₹50 advance credit remaining)
      const juneUpdated = await calculateMonthSettlement(familyId, '2026-06');
      expect(juneUpdated.closingBalancePaise).toBe(-5000);
    });
  });

  describe('5. Idempotency & Duplicate Protection', () => {
    it('prevents double submissions when using idempotency key', async () => {
      const idempotencyKey = 'unique-purchase-key-12345';

      const firstAttempt = await createMilkEntry({
        familyId,
        memberId,
        date: '2026-07-01',
        quantityMl: 1000,
        paymentChoice: 'pending',
        idempotencyKey,
      });

      const secondAttempt = await createMilkEntry({
        familyId,
        memberId,
        date: '2026-07-01',
        quantityMl: 1000,
        paymentChoice: 'pending',
        idempotencyKey,
      });

      expect(firstAttempt.id).toBe(secondAttempt.id);

      // Database should only have 1 entry
      const countRes = await pool.query('SELECT COUNT(*) FROM milk_entries WHERE idempotency_key = $1', [idempotencyKey]);
      expect(parseInt(countRes.rows[0].count, 10)).toBe(1);
    });
  });

  describe('6. Audited Corrections', () => {
    it('records correction notes and maintains audit history without silent overwrites', async () => {
      const original = await createMilkEntry({
        familyId,
        memberId,
        date: '2026-08-01',
        quantityMl: 1000,
        paymentChoice: 'pending',
      });

      expect(original.totalAmountPaise).toBe(5000);

      // Parent corrects from 1L to 500ml
      const corrected = await correctMilkEntry({
        familyId,
        memberId,
        entryId: original.id,
        quantityMl: 500,
        correctionNotes: 'Parent misclicked 1L instead of half litre',
      });

      expect(corrected.isCorrected).toBe(true);
      expect(corrected.quantityMl).toBe(500);
      expect(corrected.totalAmountPaise).toBe(2500);

      // Audit logs must contain 'correction' action with old and new values
      const auditRes = await pool.query(
        `SELECT * FROM audit_logs WHERE entity_id = $1 AND action = 'correction'`,
        [original.id]
      );
      expect(auditRes.rows.length).toBe(1);
      expect(auditRes.rows[0].new_values.correctionReason).toBe('Parent misclicked 1L instead of half litre');
    });
  });

  describe('7. Bilingual WhatsApp Statement Generation', () => {
    it('formats consistent numbers across Malayalam and English statements without data distortion', () => {
      const calc = {
        yearMonth: '2026-10',
        isClosed: false,
        openingBalancePaise: 2000, // ₹20
        totalMilkChargesPaise: 50000, // ₹500
        totalPaymentsPaise: 40000, // ₹400
        closingBalancePaise: 12000, // ₹120 due
        totalLitres: 10,
        purchaseDays: 8,
        currentRatePaisePerLitre: 5000, // ₹50/L
      };

      const mlText = generateWhatsAppStatementText('Sharma Family', calc, 'ml');
      const enText = generateWhatsAppStatementText('Sharma Family', calc, 'en');

      // Both must include the exact numbers
      expect(mlText).toContain('10 ലിറ്റർ');
      expect(mlText).toContain('8 ദിവസങ്ങൾ');
      expect(mlText).toContain('₹50');
      expect(mlText).toContain('₹120');
      expect(mlText).toContain('ബാക്കി കുടശ്ശിക');

      expect(enText).toContain('10 Litres');
      expect(enText).toContain('8 days');
      expect(enText).toContain('₹50');
      expect(enText).toContain('₹120');
      expect(enText).toContain('Outstanding Due');
    });
  });

  describe('8. Previous Month Settlement & New Month Roll-over Workflow', () => {
    it('accurately identifies previous month due and detects settlement via cash or UPI', async () => {
      // 1. Record purchases in September 2026
      await createMilkEntry({
        familyId,
        memberId: adminId,
        date: '2026-09-10',
        quantityMl: 1000, // 1 Litre @ ₹50 = ₹50
        paymentStatus: 'pending'
      });

      await createMilkEntry({
        familyId,
        memberId: adminId,
        date: '2026-09-15',
        quantityMl: 1000, // 1 Litre @ ₹50 = ₹50
        paymentStatus: 'pending'
      });

      // 2. Query Dashboard summary for October 2026 (New Month)
      const octSummaryBefore = await getDashboardSummary(familyId, '2026-10');

      // October itself starts clean with 0 new charges
      expect(octSummaryBefore.totalMilkChargesPaise).toBe(0);
      expect(octSummaryBefore.totalLitres).toBe(0);
      expect(octSummaryBefore.purchaseDays).toBe(0);

      // Opening balance reflects September due of ₹100 (10000 paise)
      expect(octSummaryBefore.openingBalancePaise).toBe(10000);

      // Previous month settlement prompt is active and unsettled
      expect(octSummaryBefore.previousMonthSettlement).not.toBeNull();
      expect(octSummaryBefore.previousMonthSettlement?.previousMonth).toBe('2026-09');
      expect(octSummaryBefore.previousMonthSettlement?.closingBalancePaise).toBe(10000);
      expect(octSummaryBefore.previousMonthSettlement?.isSettled).toBe(false);

      // 3. User settles previous month via UPI
      const settlementPayment = await createPayment({
        familyId,
        memberId: adminId,
        date: '2026-10-01',
        amountPaise: 10000,
        paymentMethod: 'upi',
        notes: '[Settlement: 2026-09] Full September Settlement via UPI'
      });

      expect(settlementPayment.amountPaise).toBe(10000);
      expect(settlementPayment.paymentMethod).toBe('upi');

      // 4. Re-query October summary: previous month settlement must now be detected as settled
      const octSummaryAfter = await getDashboardSummary(familyId, '2026-10');
      expect(octSummaryAfter.previousMonthSettlement).not.toBeNull();
      expect(octSummaryAfter.previousMonthSettlement?.isSettled).toBe(true);
      expect(octSummaryAfter.previousMonthSettlement?.settlementPaymentMethod).toBe('upi');
      expect(octSummaryAfter.previousMonthSettlement?.settlementPaymentId).toBe(settlementPayment.id);
    });
  });
});

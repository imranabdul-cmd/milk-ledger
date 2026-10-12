import { query, withTransaction } from '../../config/db.js';
import { calculateMilkCostPaise, MilkEntry, MilkRateHistory, PaymentStatus } from '@family-milk/shared';
import { recordAuditLog } from '../audit/audit.service.js';

export interface CreateMilkEntryInput {
  familyId: string;
  memberId: string;
  date: string; // YYYY-MM-DD
  quantityMl: number;
  paymentChoice: 'paid' | 'pending';
  notes?: string;
  idempotencyKey?: string;
  ipAddress?: string;
}

export interface UpdateMilkEntryInput {
  familyId: string;
  memberId: string;
  entryId: string;
  date?: string;
  quantityMl?: number;
  totalAmountPaise?: number;
  paymentStatus?: PaymentStatus;
  notes?: string;
  correctionNotes?: string;
  ipAddress?: string;
}

/**
 * Gets the applicable milk rate for a family on a specific date.
 */
export async function getApplicableRate(familyId: string, date: string, client?: any): Promise<number> {
  const runner = client || { query };
  const res = await runner.query(
    `SELECT rate_paise_per_litre
     FROM milk_rate_history
     WHERE family_id = $1 AND effective_from <= $2
     ORDER BY effective_from DESC, created_at DESC
     LIMIT 1`,
    [familyId, date]
  );

  if (res.rows.length === 0) {
    // If no rate exists on or before that date, fallback to the earliest known rate or default ₹56/L (5600 paise)
    const fallbackRes = await runner.query(
      `SELECT rate_paise_per_litre
       FROM milk_rate_history
       WHERE family_id = $1
       ORDER BY effective_from ASC
       LIMIT 1`,
      [familyId]
    );

    if (fallbackRes.rows.length > 0) {
      return fallbackRes.rows[0].rate_paise_per_litre;
    }

    return 5600; // Default ₹56.00/L
  }

  return res.rows[0].rate_paise_per_litre;
}

/**
 * Creates a milk purchase entry with transactional safety, locked-in rate, and optional immediate payment.
 */
export async function createMilkEntry(input: CreateMilkEntryInput): Promise<MilkEntry> {
  return await withTransaction(async (client) => {
    // 1. Idempotency check
    if (input.idempotencyKey) {
      const existingRes = await client.query(
        `SELECT me.id, me.family_id as "familyId", me.member_id as "memberId",
                me.date, me.quantity_ml as "quantityMl", me.rate_paise_per_litre as "ratePaisePerLitre",
                me.total_amount_paise as "totalAmountPaise", me.payment_status as "paymentStatus",
                me.notes, me.is_corrected as "isCorrected", me.idempotency_key as "idempotencyKey",
                me.created_at as "createdAt", me.updated_at as "updatedAt",
                m.name as "createdByName"
         FROM milk_entries me
         LEFT JOIN family_members m ON m.id = me.member_id
         WHERE me.family_id = $1 AND me.idempotency_key = $2`,
        [input.familyId, input.idempotencyKey]
      );

      if (existingRes.rows.length > 0) {
        return existingRes.rows[0];
      }
    }

    // 2. Resolve applicable rate for this date
    const ratePaise = await getApplicableRate(input.familyId, input.date, client);
    const totalAmountPaise = calculateMilkCostPaise(input.quantityMl, ratePaise);
    const initialStatus: PaymentStatus = input.paymentChoice === 'paid' ? 'paid' : 'pending';

    // 3. Insert into milk_entries
    const insertRes = await client.query(
      `INSERT INTO milk_entries (
        family_id, member_id, date, quantity_ml, rate_paise_per_litre,
        total_amount_paise, payment_status, notes, idempotency_key
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, family_id as "familyId", member_id as "memberId",
                date, quantity_ml as "quantityMl", rate_paise_per_litre as "ratePaisePerLitre",
                total_amount_paise as "totalAmountPaise", payment_status as "paymentStatus",
                notes, is_corrected as "isCorrected", idempotency_key as "idempotencyKey",
                created_at as "createdAt", updated_at as "updatedAt"`,
      [
        input.familyId,
        input.memberId,
        input.date,
        input.quantityMl,
        ratePaise,
        totalAmountPaise,
        initialStatus,
        input.notes || null,
        input.idempotencyKey || null
      ]
    );

    const createdEntry = insertRes.rows[0];

    // 4. If immediate payment was selected, record the corresponding payment and allocation
    if (input.paymentChoice === 'paid' && totalAmountPaise > 0) {
      const paymentRes = await client.query(
        `INSERT INTO payments (
          family_id, member_id, date, amount_paise, payment_method, notes, idempotency_key
        ) VALUES ($1, $2, $3, $4, 'cash', $5, $6)
        RETURNING id`,
        [
          input.familyId,
          input.memberId,
          input.date,
          totalAmountPaise,
          `Immediate payment for milk on ${input.date}`,
          input.idempotencyKey ? `pay-${input.idempotencyKey}` : null
        ]
      );

      const paymentId = paymentRes.rows[0].id;

      // Link payment allocation with tenant isolation
      await client.query(
        `INSERT INTO payment_allocations (payment_id, milk_entry_id, allocated_amount_paise, family_id)
         VALUES ($1, $2, $3, $4)`,
        [paymentId, createdEntry.id, totalAmountPaise, input.familyId]
      );
    }

    // 5. Audit log
    await recordAuditLog({
      familyId: input.familyId,
      memberId: input.memberId,
      action: 'create',
      entityType: 'milk_entry',
      entityId: createdEntry.id,
      newValues: { ...createdEntry, paymentChoice: input.paymentChoice },
      ipAddress: input.ipAddress,
      client
    });

    return createdEntry;
  });
}

/**
 * Updates/corrects an existing milk purchase entry with full audit trail.
 */
export async function correctMilkEntry(input: UpdateMilkEntryInput): Promise<MilkEntry> {
  return await withTransaction(async (client) => {
    // 1. Fetch existing entry
    const existingRes = await client.query(
      `SELECT * FROM milk_entries WHERE id = $1 AND family_id = $2`,
      [input.entryId, input.familyId]
    );

    if (existingRes.rows.length === 0) {
      throw new Error('Milk entry not found');
    }

    const existing = existingRes.rows[0];

    const rawExistingDate = typeof existing.date === 'string'
      ? existing.date
      : (existing.date instanceof Date ? existing.date.toISOString().substring(0, 10) : String(existing.date));

    const newDate = input.date || rawExistingDate;
    const newQuantityMl = input.quantityMl !== undefined ? input.quantityMl : existing.quantity_ml;
    const newNotes = input.notes !== undefined ? input.notes : existing.notes;
    const newPaymentStatus = input.paymentStatus || existing.payment_status;
    const correctionReason = input.correctionNotes && input.correctionNotes.trim()
      ? input.correctionNotes.trim()
      : 'Updated by admin';

    // Resolve rate for newDate
    const ratePaise = await getApplicableRate(input.familyId, newDate, client);

    // If explicit amount passed, use it; otherwise compute from quantity & rate
    const newTotalAmountPaise = input.totalAmountPaise !== undefined
      ? input.totalAmountPaise
      : calculateMilkCostPaise(newQuantityMl, ratePaise);

    // Update milk_entries
    const updateRes = await client.query(
      `UPDATE milk_entries
       SET date = $1,
           quantity_ml = $2,
           rate_paise_per_litre = $3,
           total_amount_paise = $4,
           payment_status = $5,
           notes = $6,
           is_corrected = true,
           correction_notes = $7,
           updated_at = NOW()
       WHERE id = $8 AND family_id = $9
       RETURNING id, family_id as "familyId", member_id as "memberId",
                 date, quantity_ml as "quantityMl", rate_paise_per_litre as "ratePaisePerLitre",
                 total_amount_paise as "totalAmountPaise", payment_status as "paymentStatus",
                 notes, is_corrected as "isCorrected", correction_notes as "correctionNotes",
                 created_at as "createdAt", updated_at as "updatedAt"`,
      [
        newDate,
        newQuantityMl,
        ratePaise,
        newTotalAmountPaise,
        newPaymentStatus,
        newNotes,
        correctionReason,
        input.entryId,
        input.familyId
      ]
    );

    const updatedEntry = updateRes.rows[0];

    // Audit log
    await recordAuditLog({
      familyId: input.familyId,
      memberId: input.memberId,
      action: 'correction',
      entityType: 'milk_entry',
      entityId: input.entryId,
      oldValues: existing,
      newValues: { ...updatedEntry, correctionReason },
      ipAddress: input.ipAddress,
      client
    });

    return updatedEntry;
  });
}

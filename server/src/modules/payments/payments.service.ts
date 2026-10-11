import { query, withTransaction } from '../../config/db.js';
import { Payment, PaymentMethod } from '@family-milk/shared';
import { recordAuditLog } from '../audit/audit.service.js';

export interface CreatePaymentInput {
  familyId: string;
  memberId: string;
  date: string; // YYYY-MM-DD
  amountPaise: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  allocateToEntryIds?: string[];
  idempotencyKey?: string;
  ipAddress?: string;
}

export async function createPayment(input: CreatePaymentInput): Promise<Payment> {
  return await withTransaction(async (client) => {
    // 1. Check idempotency
    if (input.idempotencyKey) {
      const existingRes = await client.query(
        `SELECT p.id, p.family_id as "familyId", p.member_id as "memberId",
                p.date, p.amount_paise as "amountPaise", p.payment_method as "paymentMethod",
                p.notes, p.idempotency_key as "idempotencyKey",
                p.created_at as "createdAt", p.updated_at as "updatedAt",
                m.name as "createdByName"
         FROM payments p
         LEFT JOIN family_members m ON m.id = p.member_id
         WHERE p.family_id = $1 AND p.idempotency_key = $2`,
        [input.familyId, input.idempotencyKey]
      );

      if (existingRes.rows.length > 0) {
        return existingRes.rows[0];
      }
    }

    // 2. Insert payment record
    const paymentRes = await client.query(
      `INSERT INTO payments (
        family_id, member_id, date, amount_paise, payment_method, notes, idempotency_key
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, family_id as "familyId", member_id as "memberId",
                date, amount_paise as "amountPaise", payment_method as "paymentMethod",
                notes, idempotency_key as "idempotencyKey",
                created_at as "createdAt", updated_at as "updatedAt"`,
      [
        input.familyId,
        input.memberId,
        input.date,
        input.amountPaise,
        input.paymentMethod,
        input.notes || null,
        input.idempotencyKey || null
      ]
    );

    const payment = paymentRes.rows[0];
    let remainingAmountToAllocate = input.amountPaise;

    // 3. Optional specific allocation to pending entries
    if (input.allocateToEntryIds && input.allocateToEntryIds.length > 0) {
      for (const entryId of input.allocateToEntryIds) {
        if (remainingAmountToAllocate <= 0) break;

        // Fetch entry and currently allocated amount
        const entryRes = await client.query(
          `SELECT me.id, me.total_amount_paise as "totalAmountPaise",
                  COALESCE(SUM(pa.allocated_amount_paise), 0) as "alreadyAllocatedPaise"
           FROM milk_entries me
           LEFT JOIN payment_allocations pa ON pa.milk_entry_id = me.id
           WHERE me.id = $1 AND me.family_id = $2
           GROUP BY me.id, me.total_amount_paise`,
          [entryId, input.familyId]
        );

        if (entryRes.rows.length === 0) {
          throw new Error('One or more milk entries not found or invalid');
        }

        const row = entryRes.rows[0];
        const pendingForThisEntry = row.totalAmountPaise - parseInt(row.alreadyAllocatedPaise, 10);

        if (pendingForThisEntry > 0) {
          const allocateNow = Math.min(remainingAmountToAllocate, pendingForThisEntry);

          await client.query(
            `INSERT INTO payment_allocations (payment_id, milk_entry_id, allocated_amount_paise, family_id)
             VALUES ($1, $2, $3, $4)`,
            [payment.id, entryId, allocateNow, input.familyId]
          );

          remainingAmountToAllocate -= allocateNow;

          // Update entry status
          const totalNowAllocated = parseInt(row.alreadyAllocatedPaise, 10) + allocateNow;
          const newStatus = totalNowAllocated >= row.totalAmountPaise ? 'paid' : 'partially_paid';

          await client.query(
            `UPDATE milk_entries SET payment_status = $1, updated_at = NOW() WHERE id = $2`,
            [newStatus, entryId]
          );
        }
      }
    }

    // 4. Audit log
    await recordAuditLog({
      familyId: input.familyId,
      memberId: input.memberId,
      action: 'create',
      entityType: 'payment',
      entityId: payment.id,
      newValues: { ...payment, allocated: input.amountPaise - remainingAmountToAllocate },
      ipAddress: input.ipAddress,
      client
    });

    return payment;
  });
}

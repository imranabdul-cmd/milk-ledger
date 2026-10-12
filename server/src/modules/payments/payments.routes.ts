import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../../config/db.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createPayment } from './payments.service.js';
import { recordAuditLog } from '../audit/audit.service.js';
import { rupeesToPaise } from '@family-milk/shared';
import { getMonthDateRange } from '../../utils/timezone.js';

const router = Router();

const createPaymentSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  amountRupees: z.number().positive().optional(),
  amountPaise: z.number().int().positive().optional(),
  paymentMethod: z.enum(['cash', 'upi', 'bank_transfer', 'other']).default('cash'),
  notes: z.string().max(500).optional(),
  allocateToEntryIds: z.array(z.string().uuid()).optional(),
  idempotencyKey: z.string().max(100).optional()
}).refine(data => data.amountRupees !== undefined || data.amountPaise !== undefined, {
  message: 'Either amountRupees or amountPaise must be specified'
});

// GET /api/payments
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.user!.familyId;
  const month = req.query.month as string;

  const conditions = ['p.family_id = $1'];
  const values: any[] = [familyId];

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const { startDate, endDate } = getMonthDateRange(month);
    values.push(startDate, endDate);
    conditions.push(`p.date >= $${values.length - 1} AND p.date <= $${values.length}`);
  }

  const sql = `
    SELECT p.id, p.family_id as "familyId", p.member_id as "memberId",
           p.date, p.amount_paise as "amountPaise", p.payment_method as "paymentMethod",
           p.notes, p.idempotency_key as "idempotencyKey",
           p.created_at as "createdAt", p.updated_at as "updatedAt",
           m.name as "createdByName"
    FROM payments p
    LEFT JOIN family_members m ON m.id = p.member_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY p.date DESC, p.created_at DESC
  `;

  const result = await query(sql, values);
  const payments = result.rows.map(p => {
    const isSettlement = Boolean(p.notes && (p.notes.includes('[Settlement:') || p.notes.includes('Settlement for')));
    const match = p.notes ? p.notes.match(/\[Settlement:\s*(\d{4}-\d{2})\]/) : null;
    const fallbackMatch = !match && p.notes ? p.notes.match(/Settlement for\s*(\d{4}-\d{2})/) : null;
    return {
      ...p,
      isSettlement,
      settlementMonth: match ? match[1] : (fallbackMatch ? fallbackMatch[1] : undefined)
    };
  });
  res.json({ payments });
});

// POST /api/payments
router.post('/', requireAuth, validate({ body: createPaymentSchema }), async (req: Request, res: Response): Promise<void> => {
  const { date, amountRupees, amountPaise, paymentMethod, notes, allocateToEntryIds, idempotencyKey } = req.body;
  const finalPaise = amountPaise !== undefined ? amountPaise : rupeesToPaise(amountRupees!);

  try {
    const payment = await createPayment({
      familyId: req.user!.familyId,
      memberId: req.user!.id,
      date,
      amountPaise: finalPaise,
      paymentMethod,
      notes,
      allocateToEntryIds,
      idempotencyKey,
      ipAddress: req.ip
    });

    res.status(201).json({ payment });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to record payment' });
  }
});

// GET /api/payments/:id
router.get('/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.user!.familyId;
  const paymentId = req.params.id;

  const paymentRes = await query(
    `SELECT p.id, p.family_id as "familyId", p.member_id as "memberId",
            p.date, p.amount_paise as "amountPaise", p.payment_method as "paymentMethod",
            p.notes, p.created_at as "createdAt", m.name as "createdByName"
     FROM payments p
     LEFT JOIN family_members m ON m.id = p.member_id
     WHERE p.id = $1 AND p.family_id = $2`,
    [paymentId, familyId]
  );

  if (paymentRes.rows.length === 0) {
    res.status(404).json({ error: 'Payment not found' });
    return;
  }

  const allocRes = await query(
    `SELECT pa.id, pa.milk_entry_id as "milkEntryId", pa.allocated_amount_paise as "allocatedAmountPaise",
            me.date as "entryDate", me.quantity_ml as "quantityMl"
     FROM payment_allocations pa
     LEFT JOIN milk_entries me ON me.id = pa.milk_entry_id
     WHERE pa.payment_id = $1`,
    [paymentId]
  );

  res.json({
    payment: {
      ...paymentRes.rows[0],
      allocations: allocRes.rows
    }
  });
});

// DELETE /api/payments/:id (Admin only)
router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.user!.familyId;
  const paymentId = req.params.id;

  try {
    await withTransaction(async (client) => {
      const existing = await client.query(
        'SELECT * FROM payments WHERE id = $1 AND family_id = $2',
        [paymentId, familyId]
      );

      if (existing.rows.length === 0) {
        throw new Error('Payment not found');
      }

      await client.query('DELETE FROM payments WHERE id = $1 AND family_id = $2', [paymentId, familyId]);

      await recordAuditLog({
        familyId,
        memberId: req.user!.id,
        action: 'delete',
        entityType: 'payment',
        entityId: paymentId,
        oldValues: existing.rows[0],
        ipAddress: req.ip,
        client
      });
    });

    res.json({ success: true, message: 'Payment deleted successfully' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete payment' });
  }
});

export default router;

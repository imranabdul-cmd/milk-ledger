import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../../config/db.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { createMilkEntry, correctMilkEntry } from './milk.service.js';
import { recordAuditLog } from '../audit/audit.service.js';
import { rupeesToPaise } from '@family-milk/shared';

import { getMonthDateRange } from '../../utils/timezone.js';

const router = Router();

const createEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  quantityMl: z.number().int().min(50).max(50000),
  paymentChoice: z.enum(['paid', 'pending']),
  notes: z.string().max(500).optional(),
  idempotencyKey: z.string().max(100).optional()
});

const correctEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  quantityMl: z.number().int().min(50).max(50000).optional(),
  notes: z.string().max(500).optional(),
  correctionNotes: z.string().min(2, 'Correction reason is required').max(500)
});

const createRateSchema = z.object({
  rateRupees: z.number().positive(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Effective date must be YYYY-MM-DD'),
  notes: z.string().max(500).optional()
});

// GET /api/milk/entries
router.get('/entries', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.user!.familyId;
  const month = req.query.month as string; // 'YYYY-MM'
  const date = req.query.date as string; // 'YYYY-MM-DD'
  const paymentStatus = req.query.paymentStatus as string;

  const conditions: string[] = ['me.family_id = $1'];
  const values: any[] = [familyId];

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const { startDate, endDate } = getMonthDateRange(month);
    values.push(startDate, endDate);
    conditions.push(`me.date >= $${values.length - 1} AND me.date <= $${values.length}`);
  }

  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    values.push(date);
    conditions.push(`me.date = $${values.length}`);
  }

  if (paymentStatus && ['paid', 'pending', 'partially_paid'].includes(paymentStatus)) {
    values.push(paymentStatus);
    conditions.push(`me.payment_status = $${values.length}`);
  }

  const sql = `
    SELECT me.id, me.family_id as "familyId", me.member_id as "memberId",
           me.date, me.quantity_ml as "quantityMl", me.rate_paise_per_litre as "ratePaisePerLitre",
           me.total_amount_paise as "totalAmountPaise", me.payment_status as "paymentStatus",
           me.notes, me.is_corrected as "isCorrected", me.correction_notes as "correctionNotes",
           me.idempotency_key as "idempotencyKey",
           me.created_at as "createdAt", me.updated_at as "updatedAt",
           m.name as "createdByName"
    FROM milk_entries me
    LEFT JOIN family_members m ON m.id = me.member_id
    WHERE ${conditions.join(' AND ')}
    ORDER BY me.date DESC, me.created_at DESC
  `;

  const result = await query(sql, values);
  res.json({ entries: result.rows });
});

// POST /api/milk/entries
router.post('/entries', requireAuth, validate({ body: createEntrySchema }), async (req: Request, res: Response): Promise<void> => {
  try {
    const entry = await createMilkEntry({
      familyId: req.user!.familyId,
      memberId: req.user!.id,
      date: req.body.date,
      quantityMl: req.body.quantityMl,
      paymentChoice: req.body.paymentChoice,
      notes: req.body.notes,
      idempotencyKey: req.body.idempotencyKey,
      ipAddress: req.ip
    });

    res.status(201).json({ entry });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to record milk entry' });
  }
});

// PUT /api/milk/entries/:id (Correction)
router.put('/entries/:id', requireAuth, validate({ body: correctEntrySchema }), async (req: Request, res: Response): Promise<void> => {
  try {
    const updated = await correctMilkEntry({
      familyId: req.user!.familyId,
      memberId: req.user!.id,
      entryId: req.params.id,
      date: req.body.date,
      quantityMl: req.body.quantityMl,
      notes: req.body.notes,
      correctionNotes: req.body.correctionNotes,
      ipAddress: req.ip
    });

    res.json({ entry: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to correct milk entry' });
  }
});

// DELETE /api/milk/entries/:id
router.delete('/entries/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.user!.familyId;
  const entryId = req.params.id;

  try {
    await withTransaction(async (client) => {
      const existing = await client.query(
        'SELECT * FROM milk_entries WHERE id = $1 AND family_id = $2',
        [entryId, familyId]
      );

      if (existing.rows.length === 0) {
        throw new Error('Entry not found');
      }

      await client.query('DELETE FROM milk_entries WHERE id = $1 AND family_id = $2', [entryId, familyId]);

      await recordAuditLog({
        familyId,
        memberId: req.user!.id,
        action: 'delete',
        entityType: 'milk_entry',
        entityId: entryId,
        oldValues: existing.rows[0],
        ipAddress: req.ip,
        client
      });
    });

    res.json({ success: true, message: 'Milk entry deleted' });
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to delete milk entry' });
  }
});

// GET /api/milk/rates
router.get('/rates', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.user!.familyId;
  const result = await query(
    `SELECT r.id, r.family_id as "familyId", r.rate_paise_per_litre as "ratePaisePerLitre",
            r.effective_from as "effectiveFrom", r.notes, r.created_at as "createdAt",
            m.name as "createdByName"
     FROM milk_rate_history r
     LEFT JOIN family_members m ON m.id = r.created_by
     WHERE r.family_id = $1
     ORDER BY r.effective_from DESC, r.created_at DESC`,
    [familyId]
  );

  res.json({ rates: result.rows });
});

// POST /api/milk/rates (Admin only)
router.post('/rates', requireAuth, requireAdmin, validate({ body: createRateSchema }), async (req: Request, res: Response): Promise<void> => {
  const familyId = req.user!.familyId;
  const { rateRupees, effectiveFrom, notes } = req.body;
  const ratePaise = rupeesToPaise(rateRupees);

  const result = await query(
    `INSERT INTO milk_rate_history (family_id, rate_paise_per_litre, effective_from, notes, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, family_id as "familyId", rate_paise_per_litre as "ratePaisePerLitre",
               effective_from as "effectiveFrom", notes, created_at as "createdAt"`,
    [familyId, ratePaise, effectiveFrom, notes || null, req.user!.id]
  );

  await recordAuditLog({
    familyId,
    memberId: req.user!.id,
    action: 'create',
    entityType: 'milk_rate',
    entityId: result.rows[0].id,
    newValues: result.rows[0],
    ipAddress: req.ip
  });

  res.status(201).json({ rate: result.rows[0] });
});

export default router;

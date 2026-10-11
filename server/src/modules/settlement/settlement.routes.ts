import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../../config/db.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  calculateMonthSettlement,
  closeMonthStatement,
  generateWhatsAppStatementText,
  getDashboardSummary
} from './settlement.service.js';
import { getCurrentMonthKolkata } from '../../utils/timezone.js';
import { Language } from '@family-milk/shared';

const router = Router();

const closeMonthSchema = z.object({
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/, 'yearMonth must be YYYY-MM'),
  notes: z.string().max(500).optional()
});

// GET /api/settlement/summary
router.get('/summary', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.user!.familyId;
  const month = (req.query.month as string) || getCurrentMonthKolkata();

  try {
    const summary = await getDashboardSummary(familyId, month);
    res.json({ summary });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to calculate summary' });
  }
});

// GET /api/settlement/monthly
router.get('/monthly', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.user!.familyId;

  // Fetch closures and also all distinct months present in entries/payments
  const closuresRes = await query(
    `SELECT mc.*, m.name as "closedByName"
     FROM monthly_closures mc
     LEFT JOIN family_members m ON m.id = mc.closed_by
     WHERE mc.family_id = $1
     ORDER BY mc.year_month DESC`,
    [familyId]
  );

  res.json({ closures: closuresRes.rows });
});

// POST /api/settlement/close-month (Admin only)
router.post('/close-month', requireAuth, requireAdmin, validate({ body: closeMonthSchema }), async (req: Request, res: Response): Promise<void> => {
  const familyId = req.user!.familyId;
  const { yearMonth, notes } = req.body;

  try {
    const closure = await closeMonthStatement(familyId, yearMonth, req.user!.id, notes);
    res.json({ success: true, closure });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to close month statement' });
  }
});

// GET /api/settlement/whatsapp-text
router.get('/whatsapp-text', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.user!.familyId;
  const month = (req.query.month as string) || getCurrentMonthKolkata();
  const rawLang = req.query.lang as string;
  const lang: Language = (rawLang === 'en' || rawLang === 'ml' || rawLang === 'ta') ? (rawLang as Language) : 'ta';

  try {
    const familyRes = await query('SELECT name FROM families WHERE id = $1', [familyId]);
    const familyName = familyRes.rows[0]?.name || 'Family Milk Account';

    const calc = await calculateMonthSettlement(familyId, month);
    const text = generateWhatsAppStatementText(familyName, calc, lang);
    const shareUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;

    res.json({
      month,
      lang,
      text,
      shareUrl
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to generate WhatsApp statement' });
  }
});

export default router;

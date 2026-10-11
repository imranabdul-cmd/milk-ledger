import { Router, Request, Response } from 'express';
import { query } from '../../config/db.js';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';

const router = Router();

// GET /api/audit (Admin or Owner only)
router.get('/', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.user!.familyId;

  const result = await query(
    `SELECT a.id, a.family_id as "familyId", a.member_id as "memberId",
            a.action, a.entity_type as "entityType", a.entity_id as "entityId",
            a.old_values as "oldValues", a.new_values as "newValues",
            a.created_at as "createdAt",
            m.name as "memberName"
     FROM audit_logs a
     LEFT JOIN family_members m ON m.id = a.member_id
     WHERE a.family_id = $1
     ORDER BY a.created_at DESC
     LIMIT 50`,
    [familyId]
  );

  res.json({ logs: result.rows });
});

export default router;

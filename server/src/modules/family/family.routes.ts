import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { query, withTransaction } from '../../config/db.js';
import { requireAuth, requireAdmin, requireOwner } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { recordAuditLog } from '../audit/audit.service.js';

const router = Router();

// Character set excluding visually ambiguous characters (0, O, 1, I, L)
const INVITATION_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function generateSecureInvitationCode(): string {
  const bytes = crypto.randomBytes(8);
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += INVITATION_CHARS[bytes[i] % INVITATION_CHARS.length];
  }
  return `FAM-${result.slice(0, 4)}-${result.slice(4)}`;
}

const updateFamilyProfileSchema = z.object({
  name: z.string().trim().min(2).max(100)
});

const createMemberSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(5).max(20),
  pin: z.string().min(4).max(10).optional(),
  role: z.enum(['admin', 'member']).default('member'),
  languagePreference: z.enum(['en', 'ml', 'ta']).default('ta')
});

const updateMemberSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  role: z.enum(['owner', 'admin', 'member']).optional(),
  languagePreference: z.enum(['en', 'ml', 'ta']).optional(),
  isActive: z.boolean().optional(),
  resetPin: z.union([z.string().min(4).max(10), z.boolean()]).optional()
});

const createInvitationSchema = z.object({
  role: z.enum(['admin', 'member']).default('member'),
  expiresInDays: z.number().int().min(1).max(90).default(7),
  maxUses: z.number().int().min(1).max(50).default(1)
});

// GET /api/family/profile
router.get('/profile', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.user!.familyId;
  const result = await query(
    `SELECT id, name, currency, timezone, created_at as "createdAt"
     FROM families
     WHERE id = $1`,
    [familyId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Family not found' });
    return;
  }

  res.json({ family: result.rows[0] });
});

// PATCH /api/family/profile (Owner only)
router.patch('/profile', requireAuth, requireOwner, validate({ body: updateFamilyProfileSchema }), async (req: Request, res: Response): Promise<void> => {
  const familyId = req.user!.familyId;
  const { name } = req.body;

  const result = await query(
    `UPDATE families
     SET name = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING id, name, currency, timezone, updated_at as "updatedAt"`,
    [name, familyId]
  );

  await recordAuditLog({
    familyId,
    memberId: req.user!.id,
    action: 'update',
    entityType: 'family_member',
    entityId: familyId,
    newValues: { name },
    ipAddress: req.ip
  });

  res.json({ family: result.rows[0] });
});

// GET /api/family/members
router.get('/members', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.user!.familyId;

  const result = await query(
    `SELECT id, family_id as "familyId", name, phone, role,
            language_preference as "languagePreference", is_active as "isActive",
            must_change_pin as "mustChangePin",
            created_at as "createdAt"
     FROM family_members
     WHERE family_id = $1
     ORDER BY CASE role WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 ELSE 3 END, created_at ASC`,
    [familyId]
  );

  res.json({ members: result.rows });
});

// POST /api/family/members (Admin or Owner adds member directly to their family)
router.post('/members', requireAuth, requireAdmin, validate({ body: createMemberSchema }), async (req: Request, res: Response): Promise<void> => {
  const familyId = req.user!.familyId;
  const { name, phone, pin, role, languagePreference } = req.body;

  // RBAC: Only Owner can create Admin members
  if (req.user!.role === 'admin' && role === 'admin') {
    res.status(403).json({ error: 'Forbidden: Only owners can create administrator accounts' });
    return;
  }

  // Check existing active phone across system
  const existingRes = await query(
    'SELECT id FROM family_members WHERE phone = $1 AND is_active = true',
    [phone]
  );

  if (existingRes.rows.length > 0) {
    res.status(400).json({ error: 'A member with this phone number already exists in an active account' });
    return;
  }

  // Generate secure temporary PIN if not supplied
  const temporaryPin = (pin && pin.trim().length >= 4)
    ? pin.trim()
    : Math.floor(100000 + Math.random() * 900000).toString();

  const salt = await bcrypt.genSalt(10);
  const pinHash = await bcrypt.hash(temporaryPin, salt);

  const insertRes = await query(
    `INSERT INTO family_members (family_id, name, phone, pin_hash, role, language_preference, is_active, must_change_pin)
     VALUES ($1, $2, $3, $4, $5, $6, true, true)
     RETURNING id, family_id as "familyId", name, phone, role,
               language_preference as "languagePreference", is_active as "isActive",
               must_change_pin as "mustChangePin",
               created_at as "createdAt"`,
    [familyId, name, phone, pinHash, role, languagePreference]
  );

  const newMember = insertRes.rows[0];

  await recordAuditLog({
    familyId,
    memberId: req.user!.id,
    action: 'create',
    entityType: 'family_member',
    entityId: newMember.id,
    newValues: { name, phone, role, languagePreference, directMemberAdded: true },
    ipAddress: req.ip
  });

  res.status(201).json({
    member: newMember,
    temporaryPin // Displayed only once upon creation
  });
});

// PUT /api/family/members/:id (Admin or Owner with RBAC safeguards, deactivation, and PIN reset)
router.put('/members/:id', requireAuth, requireAdmin, validate({ body: updateMemberSchema }), async (req: Request, res: Response): Promise<void> => {
  const familyId = req.user!.familyId;
  const targetId = req.params.id;
  const { name, role, languagePreference, isActive, resetPin } = req.body;

  try {
    const updated = await withTransaction(async (client) => {
      const existingRes = await client.query(
        'SELECT * FROM family_members WHERE id = $1 AND family_id = $2',
        [targetId, familyId]
      );

      if (existingRes.rows.length === 0) {
        throw new Error('Member not found');
      }

      const target = existingRes.rows[0];

      // RBAC Safeguard 1: Admin cannot modify an Owner
      if (req.user!.role === 'admin' && target.role === 'owner') {
        const err = new Error('Forbidden: Administrators cannot modify the account of an owner');
        (err as any).status = 403;
        throw err;
      }

      // RBAC Safeguard 2: Admin cannot change any member's role
      if (role && req.user!.role === 'admin' && role !== target.role) {
        const err = new Error('Forbidden: Only the owner can change member roles');
        (err as any).status = 403;
        throw err;
      }

      // RBAC Safeguard 3: Ownership Transfer
      if (role === 'owner' && target.role !== 'owner') {
        if (req.user!.role !== 'owner') {
          const err = new Error('Forbidden: Only the current owner can transfer ownership');
          (err as any).status = 403;
          throw err;
        }

        // Demote current owner to admin, promote target to owner
        await client.query(
          "UPDATE family_members SET role = 'admin', updated_at = NOW() WHERE id = $1 AND family_id = $2",
          [req.user!.id, familyId]
        );
      }

      // RBAC Safeguard 4: Cannot deactivate the owner
      if (isActive === false && target.role === 'owner') {
        throw new Error('Cannot deactivate the family owner. Transfer ownership to another member first.');
      }

      // RBAC Safeguard 5: Admin cannot deactivate another Admin
      if (isActive === false && req.user!.role === 'admin' && target.role === 'admin' && target.id !== req.user!.id) {
        const err = new Error('Forbidden: Administrators cannot deactivate other administrators');
        (err as any).status = 403;
        throw err;
      }

      let pinHash = target.pin_hash;
      let generatedTemporaryPin: string | undefined = undefined;
      let mustChangePin = target.must_change_pin;

      if (resetPin) {
        generatedTemporaryPin = (typeof resetPin === 'string' && resetPin.trim().length >= 4)
          ? resetPin.trim()
          : Math.floor(100000 + Math.random() * 900000).toString();
        const salt = await bcrypt.genSalt(10);
        pinHash = await bcrypt.hash(generatedTemporaryPin, salt);
        mustChangePin = true;
      }

      if (resetPin || isActive === false) {
        // Invalidate all refresh tokens
        await client.query(
          'UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_member_id = $1 AND revoked_at IS NULL',
          [targetId]
        );
        // Immediately revoke all current access tokens
        await client.query(
          'UPDATE family_members SET sessions_revoked_at = NOW() WHERE id = $1',
          [targetId]
        );
      }

      const updatedRes = await client.query(
        `UPDATE family_members
         SET name = COALESCE($1, name),
             role = COALESCE($2, role),
             language_preference = COALESCE($3, language_preference),
             is_active = COALESCE($4, is_active),
             pin_hash = $5,
             must_change_pin = $6,
             updated_at = NOW()
         WHERE id = $7 AND family_id = $8
         RETURNING id, family_id as "familyId", name, phone, role,
                   language_preference as "languagePreference", is_active as "isActive",
                   must_change_pin as "mustChangePin",
                   updated_at as "updatedAt"`,
        [name, role, languagePreference, isActive, pinHash, mustChangePin, targetId, familyId]
      );

      const updatedMember = updatedRes.rows[0];

      await recordAuditLog({
        familyId,
        memberId: req.user!.id,
        action: 'update',
        entityType: 'family_member',
        entityId: targetId,
        oldValues: { name: target.name, role: target.role, isActive: target.is_active },
        newValues: updatedMember,
        ipAddress: req.ip,
        client
      });

      return {
        member: updatedMember,
        temporaryPin: generatedTemporaryPin
      };
    });

    res.json(updated);
  } catch (err: any) {
    res.status(err.status || 400).json({ error: err.message || 'Failed to update member' });
  }
});

// POST /api/family/invitations (Admin or Owner generates invitation)
router.post('/invitations', requireAuth, requireAdmin, validate({ body: createInvitationSchema }), async (req: Request, res: Response): Promise<void> => {
  const familyId = req.user!.familyId;
  const { role, expiresInDays, maxUses } = req.body;

  // RBAC: Admin can only invite Member
  if (req.user!.role === 'admin' && role === 'admin') {
    res.status(403).json({ error: 'Forbidden: Administrators can only invite members. Only owners can invite administrators.' });
    return;
  }

  const rawCode = generateSecureInvitationCode();
  const codeHash = crypto.createHash('sha256').update(rawCode).digest('hex');
  const codeDisplay = `${rawCode.slice(0, 4)}-${rawCode.slice(5, 7)}**-****`;

  const insertRes = await query(
    `INSERT INTO invitations (
       family_id, invitation_code_hash, code_display, role, created_by, max_uses, expires_at
     ) VALUES (
       $1, $2, $3, $4, $5, $6, NOW() + ($7 || ' days')::INTERVAL
     )
     RETURNING id, family_id as "familyId", code_display as "codeDisplay", role,
               max_uses as "maxUses", uses_count as "usesCount",
               expires_at as "expiresAt", created_at as "createdAt"`,
    [familyId, codeHash, codeDisplay, role, req.user!.id, maxUses, expiresInDays]
  );

  const invitation = insertRes.rows[0];

  await recordAuditLog({
    familyId,
    memberId: req.user!.id,
    action: 'create',
    entityType: 'family_member',
    entityId: invitation.id,
    newValues: { invitationId: invitation.id, role, expiresInDays, maxUses },
    ipAddress: req.ip
  });

  // Return invitation with rawCode so caller can present it for copy/share
  res.status(201).json({
    invitation: {
      ...invitation,
      rawCode
    }
  });
});

// GET /api/family/invitations (List active & recent invitations)
router.get('/invitations', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.user!.familyId;

  const result = await query(
    `SELECT i.id, i.family_id as "familyId", i.code_display as "codeDisplay",
            i.role, i.max_uses as "maxUses", i.uses_count as "usesCount",
            i.expires_at as "expiresAt", i.revoked_at as "revokedAt",
            i.created_at as "createdAt",
            m.name as "createdByName"
     FROM invitations i
     LEFT JOIN family_members m ON m.id = i.created_by
     WHERE i.family_id = $1
     ORDER BY i.created_at DESC
     LIMIT 50`,
    [familyId]
  );

  res.json({ invitations: result.rows });
});

// DELETE /api/family/invitations/:id (Revoke an invitation)
router.delete('/invitations/:id', requireAuth, requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const familyId = req.user!.familyId;
  const invitationId = req.params.id;

  const existingRes = await query(
    'SELECT * FROM invitations WHERE id = $1 AND family_id = $2',
    [invitationId, familyId]
  );

  if (existingRes.rows.length === 0) {
    res.status(404).json({ error: 'Invitation not found' });
    return;
  }

  const inv = existingRes.rows[0];

  // RBAC: Admin cannot revoke an Admin invitation created by Owner
  if (req.user!.role === 'admin' && inv.role === 'admin') {
    res.status(403).json({ error: 'Forbidden: Only owners can revoke administrator invitations' });
    return;
  }

  await query(
    'UPDATE invitations SET revoked_at = NOW() WHERE id = $1 AND family_id = $2',
    [invitationId, familyId]
  );

  await recordAuditLog({
    familyId,
    memberId: req.user!.id,
    action: 'delete',
    entityType: 'family_member',
    entityId: invitationId,
    newValues: { revokedAt: new Date().toISOString() },
    ipAddress: req.ip
  });

  res.json({ success: true, message: 'Invitation revoked successfully' });
});

export default router;

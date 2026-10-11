import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { z } from 'zod';
import { query, withTransaction } from '../../config/db.js';
import { config } from '../../config/env.js';
import { requireAuth } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import { checkLockout, recordFailedLoginAttempt, resetFailedLoginAttempts } from '../../middleware/lockout.js';
import { recordAuditLog } from '../audit/audit.service.js';
import {
  issueSessionTokens,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllMemberTokens,
  setRefreshTokenCookie,
  clearRefreshTokenCookie
} from './token.service.js';
import { rupeesToPaise } from '@family-milk/shared';

const router = Router();

const loginSchema = z.object({
  phone: z.string().trim().min(5).max(20),
  pin: z.string().trim().min(4).max(10)
});

const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(200).optional()
});

const logoutSchema = z.object({
  refreshToken: z.string().optional()
});

const setupPinSchema = z.object({
  newPin: z.string().trim().min(4).max(10)
});

const registerFamilySchema = z.object({
  familyName: z.string().trim().min(2).max(100),
  ownerName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(5).max(20),
  pin: z.string().trim().min(4).max(10),
  initialRateRupees: z.number().positive().default(56),
  languagePreference: z.enum(['en', 'ml', 'ta']).default('ta')
});

const verifyInvitationSchema = z.object({
  invitationCode: z.string().trim().min(4).max(50)
});

const joinFamilySchema = z.object({
  invitationCode: z.string().trim().min(4).max(50),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(5).max(20),
  pin: z.string().trim().min(4).max(10),
  languagePreference: z.enum(['en', 'ml', 'ta']).default('ta')
});

const languageSchema = z.object({
  language: z.enum(['en', 'ml', 'ta'])
});

const changePinSchema = z.object({
  currentPin: z.string().min(4),
  newPin: z.string().min(4).max(10)
});

// POST /api/auth/login (Existing account login with lockout protection)
router.post('/login', authLimiter, validate({ body: loginSchema }), async (req: Request, res: Response): Promise<void> => {
  const { phone, pin } = req.body;

  // 1. Lockout check
  const lockoutStatus = checkLockout(phone);
  if (lockoutStatus.isLocked) {
    res.status(429).json({
      error: `Account temporarily locked out due to multiple failed login attempts. Please try again after ${lockoutStatus.remainingSeconds} seconds.`
    });
    return;
  }

  // 2. Query user account
  const result = await query(
    `SELECT m.id, m.family_id as "familyId", m.name, m.phone, m.pin_hash as "pinHash",
            m.role, m.language_preference as "languagePreference", m.is_active as "isActive",
            m.must_change_pin as "mustChangePin",
            f.name as "familyName"
     FROM family_members m
     JOIN families f ON f.id = m.family_id
     WHERE m.phone = $1`,
    [phone]
  );

  if (result.rows.length === 0) {
    const attempt = recordFailedLoginAttempt(phone);
    if (attempt.isNowLocked) {
      res.status(429).json({
        error: 'Too many failed login attempts. Account temporarily locked out for 15 minutes.'
      });
      return;
    }
    res.status(401).json({ error: 'Invalid phone number or PIN' });
    return;
  }

  const member = result.rows[0];

  if (!member.isActive) {
    res.status(403).json({ error: 'Account is deactivated. Please contact your family admin.' });
    return;
  }

  // 3. Compare PIN
  const isMatch = await bcrypt.compare(pin, member.pinHash);
  if (!isMatch) {
    const attempt = recordFailedLoginAttempt(phone);
    if (attempt.isNowLocked) {
      res.status(429).json({
        error: 'Too many failed login attempts. Account temporarily locked out for 15 minutes.'
      });
      return;
    }
    res.status(401).json({ error: 'Invalid phone number or PIN' });
    return;
  }

  // 4. Success - clear failed attempts and issue token
  resetFailedLoginAttempts(phone);

  const session = await issueSessionTokens(member.familyId, member.id, member.role);
  setRefreshTokenCookie(res, session.refreshToken);

  res.json({
    token: session.token,
    refreshToken: session.refreshToken,
    user: {
      id: member.id,
      familyId: member.familyId,
      familyName: member.familyName,
      name: member.name,
      phone: member.phone,
      role: member.role,
      languagePreference: member.languagePreference,
      mustChangePin: Boolean(member.mustChangePin)
    }
  });
});

// POST /api/auth/register-family (Choice A: Create a New Family & Owner)
router.post('/register-family', authLimiter, validate({ body: registerFamilySchema }), async (req: Request, res: Response): Promise<void> => {
  const { familyName, ownerName, phone, pin, initialRateRupees, languagePreference } = req.body;

  try {
    const outcome = await withTransaction(async (client) => {
      // 1. Check if phone already registered in active member account
      const existingRes = await client.query(
        'SELECT id FROM family_members WHERE phone = $1 AND is_active = true',
        [phone]
      );

      if (existingRes.rows.length > 0) {
        throw new Error('A member with this mobile number is already registered. Please log in.');
      }

      // 2. Create family
      const famRes = await client.query(
        `INSERT INTO families (name, currency, timezone)
         VALUES ($1, 'INR', $2)
         RETURNING id, name`,
        [familyName, config.timezone]
      );
      const newFamily = famRes.rows[0];

      // 3. Hash PIN
      const salt = await bcrypt.genSalt(10);
      const pinHash = await bcrypt.hash(pin, salt);

      // 4. Create owner member
      const memberRes = await client.query(
        `INSERT INTO family_members (family_id, name, phone, pin_hash, role, language_preference)
         VALUES ($1, $2, $3, $4, 'owner', $5)
         RETURNING id, family_id as "familyId", name, phone, role,
                   language_preference as "languagePreference", is_active as "isActive"`,
        [newFamily.id, ownerName, phone, pinHash, languagePreference]
      );
      const ownerMember = memberRes.rows[0];

      // 5. Create initial milk rate
      const ratePaise = rupeesToPaise(initialRateRupees);
      await client.query(
        `INSERT INTO milk_rate_history (family_id, rate_paise_per_litre, effective_from, notes, created_by)
         VALUES ($1, $2, CURRENT_DATE, 'Initial family milk rate', $3)`,
        [newFamily.id, ratePaise, ownerMember.id]
      );

      // 6. Audit log
      await recordAuditLog({
        familyId: newFamily.id,
        memberId: ownerMember.id,
        action: 'create',
        entityType: 'family_member',
        entityId: ownerMember.id,
        newValues: { familyName, ownerName, phone, role: 'owner', initialRateRupees },
        ipAddress: req.ip,
        client
      });

      return {
        family: newFamily,
        member: ownerMember
      };
    });

    const session = await issueSessionTokens(outcome.family.id, outcome.member.id, outcome.member.role);
    setRefreshTokenCookie(res, session.refreshToken);

    res.status(201).json({
      token: session.token,
      refreshToken: session.refreshToken,
      user: {
        id: outcome.member.id,
        familyId: outcome.family.id,
        familyName: outcome.family.name,
        name: outcome.member.name,
        phone: outcome.member.phone,
        role: outcome.member.role,
        languagePreference: outcome.member.languagePreference
      }
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to create family account' });
  }
});

// POST /api/auth/verify-invitation (Check invitation code validity before registration)
router.post('/verify-invitation', authLimiter, validate({ body: verifyInvitationSchema }), async (req: Request, res: Response): Promise<void> => {
  const { invitationCode } = req.body;
  const normalizedCode = invitationCode.trim().toUpperCase();
  const codeHash = crypto.createHash('sha256').update(normalizedCode).digest('hex');

  const result = await query(
    `SELECT i.id, i.role, i.max_uses as "maxUses", i.uses_count as "usesCount",
            i.expires_at as "expiresAt", i.revoked_at as "revokedAt",
            f.id as "familyId", f.name as "familyName"
     FROM invitations i
     JOIN families f ON f.id = i.family_id
     WHERE i.invitation_code_hash = $1`,
    [codeHash]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ valid: false, error: 'Invalid invitation code. Please check with your family admin.' });
    return;
  }

  const inv = result.rows[0];

  if (inv.revokedAt) {
    res.status(400).json({ valid: false, error: 'This invitation code has been revoked.' });
    return;
  }

  if (new Date(inv.expiresAt).getTime() < Date.now()) {
    res.status(400).json({ valid: false, error: 'This invitation code has expired.' });
    return;
  }

  if (inv.usesCount >= inv.maxUses) {
    res.status(400).json({ valid: false, error: 'This invitation code has already been used.' });
    return;
  }

  res.json({
    valid: true,
    familyName: inv.familyName,
    role: inv.role
  });
});

// POST /api/auth/join-family (Choice B: Join Existing Family with Invitation Code)
router.post('/join-family', authLimiter, validate({ body: joinFamilySchema }), async (req: Request, res: Response): Promise<void> => {
  const { invitationCode, name, phone, pin, languagePreference } = req.body;
  const normalizedCode = invitationCode.trim().toUpperCase();
  const codeHash = crypto.createHash('sha256').update(normalizedCode).digest('hex');

  try {
    const outcome = await withTransaction(async (client) => {
      // 1. Lock and validate invitation
      const invRes = await client.query(
        `SELECT i.id, i.family_id as "familyId", i.role, i.max_uses as "maxUses",
                i.uses_count as "usesCount", i.expires_at as "expiresAt", i.revoked_at as "revokedAt",
                f.name as "familyName"
         FROM invitations i
         JOIN families f ON f.id = i.family_id
         WHERE i.invitation_code_hash = $1
         FOR UPDATE`,
        [codeHash]
      );

      if (invRes.rows.length === 0) {
        throw new Error('Invalid invitation code. Please check with your family admin.');
      }

      const inv = invRes.rows[0];

      if (inv.revokedAt) {
        throw new Error('This invitation code has been revoked by the family admin.');
      }

      if (new Date(inv.expiresAt).getTime() < Date.now()) {
        throw new Error('This invitation code has expired. Please ask for a new invitation.');
      }

      if (inv.usesCount >= inv.maxUses) {
        throw new Error('This invitation code has already been consumed.');
      }

      // 2. Check if phone is already registered in active member account
      const existingMemberRes = await client.query(
        'SELECT id FROM family_members WHERE phone = $1 AND is_active = true',
        [phone]
      );

      if (existingMemberRes.rows.length > 0) {
        throw new Error('A member with this mobile number is already registered. Please log in.');
      }

      // 3. Hash PIN
      const salt = await bcrypt.genSalt(10);
      const pinHash = await bcrypt.hash(pin, salt);

      // 4. Insert member - role is strictly taken from invitation record (never user input!)
      const memberRes = await client.query(
        `INSERT INTO family_members (family_id, name, phone, pin_hash, role, language_preference)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, family_id as "familyId", name, phone, role,
                   language_preference as "languagePreference", is_active as "isActive"`,
        [inv.familyId, name, phone, pinHash, inv.role, languagePreference]
      );
      const newMember = memberRes.rows[0];

      // 5. Increment invitation usage
      await client.query(
        'UPDATE invitations SET uses_count = uses_count + 1 WHERE id = $1',
        [inv.id]
      );

      // 6. Record audit log
      await recordAuditLog({
        familyId: inv.familyId,
        memberId: newMember.id,
        action: 'create',
        entityType: 'family_member',
        entityId: newMember.id,
        newValues: { name, phone, role: inv.role, joinedViaInvitation: inv.id },
        ipAddress: req.ip,
        client
      });

      return {
        member: newMember,
        familyName: inv.familyName
      };
    });

    const session = await issueSessionTokens(outcome.member.familyId, outcome.member.id, outcome.member.role);
    setRefreshTokenCookie(res, session.refreshToken);

    res.status(201).json({
      token: session.token,
      refreshToken: session.refreshToken,
      user: {
        id: outcome.member.id,
        familyId: outcome.member.familyId,
        familyName: outcome.familyName,
        name: outcome.member.name,
        phone: outcome.member.phone,
        role: outcome.member.role,
        languagePreference: outcome.member.languagePreference
      }
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to join family' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: Request, res: Response): Promise<void> => {
  const memberId = req.user!.id;
  const result = await query(
    `SELECT m.id, m.family_id as "familyId", m.name, m.phone,
            m.role, m.language_preference as "languagePreference",
            m.must_change_pin as "mustChangePin",
            f.name as "familyName"
     FROM family_members m
     JOIN families f ON f.id = m.family_id
     WHERE m.id = $1 AND m.family_id = $2`,
    [memberId, req.user!.familyId]
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({
    user: {
      ...result.rows[0],
      mustChangePin: Boolean(result.rows[0].mustChangePin)
    }
  });
});

// PATCH /api/auth/language
router.patch('/language', requireAuth, validate({ body: languageSchema }), async (req: Request, res: Response): Promise<void> => {
  const { language } = req.body;
  const memberId = req.user!.id;

  await query(
    `UPDATE family_members
     SET language_preference = $1, updated_at = NOW()
     WHERE id = $2 AND family_id = $3`,
    [language, memberId, req.user!.familyId]
  );

  req.user!.languagePreference = language;
  res.json({ success: true, languagePreference: language });
});

// POST /api/auth/refresh (Secure Refresh Token Rotation with Cookie & Grace Period)
router.post('/refresh', authLimiter, validate({ body: refreshSchema }), async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies?.milk_refresh_token || req.body?.refreshToken;
  if (!refreshToken) {
    res.status(401).json({ error: 'Refresh token required' });
    return;
  }

  try {
    const result = await rotateRefreshToken(refreshToken, req.ip);
    setRefreshTokenCookie(res, result.refreshToken);
    res.json(result);
  } catch (err: any) {
    clearRefreshTokenCookie(res);
    res.status(err.status || 401).json({ error: err.message || 'Failed to refresh session' });
  }
});

// POST /api/auth/logout (Revoke active session and clear cookie)
router.post('/logout', validate({ body: logoutSchema }), async (req: Request, res: Response): Promise<void> => {
  const refreshToken = req.cookies?.milk_refresh_token || req.body?.refreshToken;
  if (refreshToken) {
    await revokeRefreshToken(refreshToken);
  }
  clearRefreshTokenCookie(res);
  res.json({ success: true, message: 'Logged out successfully' });
});

// POST /api/auth/setup-pin (First login personal PIN setup replacing temporary PIN)
router.post('/setup-pin', requireAuth, validate({ body: setupPinSchema }), async (req: Request, res: Response): Promise<void> => {
  const { newPin } = req.body;
  const memberId = req.user!.id;

  const salt = await bcrypt.genSalt(10);
  const newPinHash = await bcrypt.hash(newPin, salt);

  await query(
    `UPDATE family_members
     SET pin_hash = $1, must_change_pin = false, updated_at = NOW()
     WHERE id = $2 AND family_id = $3`,
    [newPinHash, memberId, req.user!.familyId]
  );

  // Invalidate any previous temporary setup tokens
  await revokeAllMemberTokens(memberId);

  // Issue fresh session tokens for this device
  const session = await issueSessionTokens(req.user!.familyId, memberId, req.user!.role);
  setRefreshTokenCookie(res, session.refreshToken);

  await recordAuditLog({
    familyId: req.user!.familyId,
    memberId: req.user!.id,
    action: 'update',
    entityType: 'family_member',
    entityId: memberId,
    newValues: { pinSetupCompleted: true },
    ipAddress: req.ip
  });

  res.json({
    success: true,
    message: 'Personal PIN set successfully',
    token: session.token,
    refreshToken: session.refreshToken,
    user: {
      id: req.user!.id,
      familyId: req.user!.familyId,
      name: req.user!.name,
      phone: req.user!.phone,
      role: req.user!.role,
      languagePreference: req.user!.languagePreference,
      mustChangePin: false
    }
  });
});

// POST /api/auth/change-pin (Secure authenticated PIN change with session invalidation)
router.post('/change-pin', requireAuth, validate({ body: changePinSchema }), async (req: Request, res: Response): Promise<void> => {
  const { currentPin, newPin } = req.body;
  const memberId = req.user!.id;

  const userRes = await query(
    'SELECT pin_hash FROM family_members WHERE id = $1 AND family_id = $2',
    [memberId, req.user!.familyId]
  );
  if (userRes.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const isMatch = await bcrypt.compare(currentPin, userRes.rows[0].pin_hash);
  if (!isMatch) {
    res.status(400).json({ error: 'Current PIN is incorrect' });
    return;
  }

  const salt = await bcrypt.genSalt(10);
  const newPinHash = await bcrypt.hash(newPin, salt);

  await query(
    'UPDATE family_members SET pin_hash = $1, must_change_pin = false, updated_at = NOW() WHERE id = $2 AND family_id = $3',
    [newPinHash, memberId, req.user!.familyId]
  );

  // Invalidate all existing sessions on PIN change for security
  await revokeAllMemberTokens(memberId);

  // Issue fresh session tokens for the current device
  const session = await issueSessionTokens(req.user!.familyId, memberId, req.user!.role);
  setRefreshTokenCookie(res, session.refreshToken);

  await recordAuditLog({
    familyId: req.user!.familyId,
    memberId: req.user!.id,
    action: 'update',
    entityType: 'family_member',
    entityId: memberId,
    newValues: { pinChanged: true },
    ipAddress: req.ip
  });

  res.json({
    success: true,
    message: 'PIN updated successfully',
    token: session.token,
    refreshToken: session.refreshToken
  });
});

export default router;

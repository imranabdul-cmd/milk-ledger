import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { PoolClient } from 'pg';
import { query, withTransaction } from '../../config/db.js';
import { config } from '../../config/env.js';
import { Role } from '@family-milk/shared';
import { recordAuditLog } from '../audit/audit.service.js';

export const REFRESH_COOKIE_NAME = 'milk_refresh_token';
export const REFRESH_GRACE_PERIOD_MS = 30 * 1000; // 30 seconds grace period for concurrent tab race conditions

export interface SessionTokens {
  token: string;
  refreshToken: string;
}

export function setRefreshTokenCookie(res: Response, refreshToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 365 * 24 * 60 * 60 * 1000 // 1-year persistent session on mobile devices
  });
}

export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/'
  });
}

export function generateAccessToken(payload: { sub: string; familyId: string; role: Role }): string {
  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as any
  });
}

export function hashRefreshToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Issues a new access token (short-lived, 15m) and persists a rotated refresh token
 */
export async function issueSessionTokens(
  familyId: string,
  memberId: string,
  role: Role,
  dbClient?: PoolClient
): Promise<SessionTokens> {
  const accessToken = generateAccessToken({ sub: memberId, familyId, role });
  const rawRefreshToken = crypto.randomBytes(40).toString('hex');
  const tokenHash = hashRefreshToken(rawRefreshToken);
  // Persistent 1-year sliding window expiry
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

  const sql = `
    INSERT INTO refresh_tokens (family_id, family_member_id, token_hash, expires_at)
    VALUES ($1, $2, $3, $4)
    RETURNING id
  `;
  const params = [familyId, memberId, tokenHash, expiresAt];

  if (dbClient) {
    await dbClient.query(sql, params);
  } else {
    await query(sql, params);
  }

  return {
    token: accessToken,
    refreshToken: rawRefreshToken
  };
}

/**
 * Rotates a refresh token with automatic replay attack detection and
 * a 30-second grace period for concurrent browser tabs.
 */
export async function rotateRefreshToken(
  rawRefreshToken: string,
  ipAddress?: string
): Promise<{ token: string; refreshToken: string; user: any }> {
  const tokenHash = hashRefreshToken(rawRefreshToken);

  return await withTransaction(async (client) => {
    // 1. Lock and inspect token
    const tokenRes = await client.query(
      `SELECT r.id, r.family_id as "familyId", r.family_member_id as "memberId",
              r.expires_at as "expiresAt", r.revoked_at as "revokedAt",
              r.replaced_by_token_id as "replacedByTokenId",
              m.name, m.phone, m.role, m.language_preference as "languagePreference",
              m.is_active as "isActive", m.must_change_pin as "mustChangePin",
              f.name as "familyName"
       FROM refresh_tokens r
       JOIN family_members m ON m.id = r.family_member_id
       JOIN families f ON f.id = r.family_id
       WHERE r.token_hash = $1
       FOR UPDATE`,
      [tokenHash]
    );

    if (tokenRes.rows.length === 0) {
      const err = new Error('Invalid refresh token');
      (err as any).status = 401;
      throw err;
    }

    const row = tokenRes.rows[0];

    // 2. Member active check
    if (!row.isActive) {
      const err = new Error('User account is inactive');
      (err as any).status = 403;
      throw err;
    }

    // 3. Replay attack check with Concurrent Tab Grace Period
    if (row.revokedAt) {
      const timeSinceRevocation = Date.now() - new Date(row.revokedAt).getTime();

      // Grace period: if revoked within last 30s and has a replacement token, treat as concurrent tab refresh
      if (timeSinceRevocation < REFRESH_GRACE_PERIOD_MS && row.replacedByTokenId) {
        const replRes = await client.query(
          `SELECT r.id, r.token_hash, r.expires_at, r.revoked_at
           FROM refresh_tokens r
           WHERE r.id = $1`,
          [row.replacedByTokenId]
        );

        if (replRes.rows.length > 0 && !replRes.rows[0].revoked_at) {
          const newAccessToken = generateAccessToken({
            sub: row.memberId,
            familyId: row.familyId,
            role: row.role as Role
          });

          return {
            token: newAccessToken,
            refreshToken: rawRefreshToken, // Keep active session
            user: {
              id: row.memberId,
              familyId: row.familyId,
              familyName: row.familyName,
              name: row.name,
              phone: row.phone,
              role: row.role as Role,
              languagePreference: row.languagePreference,
              mustChangePin: row.mustChangePin
            }
          };
        }
      }

      // Malicious replay attack! Invalidate all member sessions immediately
      await client.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_member_id = $1 AND revoked_at IS NULL',
        [row.memberId]
      );
      await client.query(
        'UPDATE family_members SET sessions_revoked_at = NOW() WHERE id = $1',
        [row.memberId]
      );

      await recordAuditLog({
        familyId: row.familyId,
        memberId: row.memberId,
        action: 'update',
        entityType: 'family_member',
        entityId: row.memberId,
        newValues: { alert: 'Revoked refresh token reuse detected. All sessions terminated.' },
        ipAddress,
        client
      });

      const err = new Error('Security Alert: Refresh token has already been revoked. All sessions terminated.');
      (err as any).status = 401;
      throw err;
    }

    // 4. Expiration check (if expires_at is set)
    if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
      const err = new Error('Refresh token has expired. Please log in again.');
      (err as any).status = 401;
      throw err;
    }

    // 5. Generate new refresh token
    const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
    const newTokenHash = hashRefreshToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1-year sliding window

    const insertRes = await client.query(
      `INSERT INTO refresh_tokens (family_id, family_member_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [row.familyId, row.memberId, newTokenHash, newExpiresAt]
    );
    const newId = insertRes.rows[0].id;

    // 6. Revoke old refresh token and link to replacement
    await client.query(
      'UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by_token_id = $1 WHERE id = $2',
      [newId, row.id]
    );

    // 7. Issue new access token
    const newAccessToken = generateAccessToken({
      sub: row.memberId,
      familyId: row.familyId,
      role: row.role as Role
    });

    return {
      token: newAccessToken,
      refreshToken: newRawRefreshToken,
      user: {
        id: row.memberId,
        familyId: row.familyId,
        familyName: row.familyName,
        name: row.name,
        phone: row.phone,
        role: row.role as Role,
        languagePreference: row.languagePreference,
        mustChangePin: row.mustChangePin
      }
    };
  });
}

/**
 * Revokes a specific refresh token (used on logout)
 */
export async function revokeRefreshToken(rawRefreshToken: string): Promise<boolean> {
  const tokenHash = hashRefreshToken(rawRefreshToken);
  const res = await query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL',
    [tokenHash]
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * Revokes all refresh tokens and invalidates all active access tokens for a member
 */
export async function revokeAllMemberTokens(memberId: string): Promise<number> {
  const res = await query(
    'UPDATE refresh_tokens SET revoked_at = NOW() WHERE family_member_id = $1 AND revoked_at IS NULL',
    [memberId]
  );
  await query(
    'UPDATE family_members SET sessions_revoked_at = NOW() WHERE id = $1',
    [memberId]
  );
  return res.rowCount ?? 0;
}

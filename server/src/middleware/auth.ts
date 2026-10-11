import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { query } from '../config/db.js';
import { Role, Language } from '@family-milk/shared';

export interface AuthenticatedUser {
  id: string;
  familyId: string;
  name: string;
  phone: string;
  role: Role;
  languagePreference: Language;
  mustChangePin?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Authentication token required' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as {
      sub: string;
      familyId: string;
      iat?: number;
    };

    const result = await query(
      `SELECT id, family_id as "familyId", name, phone, role, 
              language_preference as "languagePreference", is_active as "isActive",
              must_change_pin as "mustChangePin", sessions_revoked_at as "sessionsRevokedAt"
       FROM family_members
       WHERE id = $1 AND family_id = $2`,
      [decoded.sub, decoded.familyId]
    );

    if (result.rows.length === 0 || !result.rows[0].isActive) {
      res.status(401).json({ error: 'Unauthorized: User account is inactive or not found' });
      return;
    }

    const row = result.rows[0];

    // Immediate Revocation check: deny tokens issued prior to revocation event
    if (row.sessionsRevokedAt && decoded.iat) {
      const revokedAtSeconds = Math.floor(new Date(row.sessionsRevokedAt).getTime() / 1000);
      if (decoded.iat < revokedAtSeconds) {
        res.status(401).json({ error: 'Unauthorized: Session has been revoked. Please log in again.' });
        return;
      }
    }

    req.user = {
      id: row.id,
      familyId: row.familyId,
      name: row.name,
      phone: row.phone,
      role: row.role as Role,
      languagePreference: row.languagePreference as Language,
      mustChangePin: row.mustChangePin
    };

    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({ code: 'TOKEN_EXPIRED', error: 'Access token expired. Please refresh your session.' });
      return;
    }
    res.status(401).json({ error: 'Invalid authentication token.' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'owner')) {
    res.status(403).json({ error: 'Forbidden: Admin privilege required' });
    return;
  }
  next();
}

export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'owner') {
    res.status(403).json({ error: 'Forbidden: Owner privilege required' });
    return;
  }
  next();
}

export function requireRole(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
      return;
    }
    next();
  };
}

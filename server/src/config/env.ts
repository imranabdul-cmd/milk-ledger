import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from workspace root or current directory
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '../.env'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env'), override: true });

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

  if (!secret || secret.trim() === '' || secret.startsWith('replace_with') || secret.includes('family-milk-default')) {
    if (isTest) {
      return 'test-suite-secure-jwt-secret-at-least-32-bytes-long';
    }
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'FATAL: Missing or insecure JWT_SECRET. In production, JWT_SECRET must be set to a cryptographically secure key of at least 32 characters in .env or your hosting dashboard.'
      );
    }
    throw new Error(
      'Configuration Error: JWT_SECRET is missing or set to placeholder in .env. Please configure a secure JWT_SECRET of at least 32 characters.'
    );
  }

  if (secret.length < 32) {
    if (isTest) {
      return 'test-suite-secure-jwt-secret-at-least-32-bytes-long';
    }
    throw new Error(
      'Configuration Error: JWT_SECRET is too short. It must be at least 32 characters long for security.'
    );
  }

  return secret;
}

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  databaseSsl: process.env.DATABASE_SSL === 'true' || process.env.NODE_ENV === 'production',
  jwtSecret: resolveJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshTokenExpiresInDays: parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS || '365', 10),
  timezone: process.env.TZ || 'Asia/Kolkata',

  // Initial bootstrap settings
  initialFamilyName: process.env.INITIAL_FAMILY_NAME || 'Family Milk Account',
  initialDefaultRateRupees: parseInt(process.env.INITIAL_DEFAULT_RATE_RUPEES || '56', 10),
  initialAdminPhone: process.env.INITIAL_ADMIN_PHONE || '',
  initialAdminName: process.env.INITIAL_ADMIN_NAME || 'Family Admin',
  initialAdminPin: process.env.INITIAL_ADMIN_PIN || ''
};

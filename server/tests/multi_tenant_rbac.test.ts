import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { newDb } from 'pg-mem';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

import { createApp } from '../src/app.js';
import { setCustomPool } from '../src/config/db.js';
import { config } from '../src/config/env.js';
import { clearAllLockouts } from '../src/middleware/lockout.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Multi-Tenant SaaS Security & RBAC Isolation Suite', () => {
  let db: any;
  let pool: any;
  let app: any;

  // Family 1 (Seeded / Existing)
  let family1Id: string;
  let owner1Token: string;
  let member1Token: string;
  let member1Id: string;

  // Family 2 (Separate Tenant)
  let family2Id: string;
  let owner2Token: string;
  let member2Token: string;

  beforeEach(async () => {
    clearAllLockouts();

    // 1. In-memory PostgreSQL instance
    db = newDb();
    db.public.registerFunction({
      name: 'gen_random_uuid',
      impure: true,
      implementation: () => crypto.randomUUID()
    });

    const pgAdapter = db.adapters.createPg();
    pool = new pgAdapter.Pool();
    setCustomPool(pool);

    // Apply all migrations
    const migrationsDir = path.resolve(__dirname, '../src/db/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    for (const file of migrationFiles) {
      let sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      sql = sql.replace('CREATE EXTENSION IF NOT EXISTS "pgcrypto";', '');
      sql = sql.replace(/REVOKE ALL ON FUNCTION[^\n;]+;/gi, '');
      sql = sql.replace(/ALTER TABLE refresh_tokens ALTER COLUMN expires_at DROP NOT NULL;/gi, '');
      sql = sql.replace(/WHERE is_active = true/gi, '');
      await pool.query(sql);
    }

    app = createApp();

    // 2. Setup Family 1 (Simulate seeded family + owner)
    const fam1Res = await pool.query(
      `INSERT INTO families (name, currency, timezone) VALUES ('Family One', 'INR', 'Asia/Kolkata') RETURNING id`
    );
    family1Id = fam1Res.rows[0].id;

    const salt = await bcrypt.genSalt(10);
    const pinHash = await bcrypt.hash('2005', salt);

    const owner1Res = await pool.query(
      `INSERT INTO family_members (family_id, name, phone, pin_hash, role, language_preference)
       VALUES ($1, 'Family One Owner', '9952590815', $2, 'owner', 'ta') RETURNING id`,
      [family1Id, pinHash]
    );
    const owner1Id = owner1Res.rows[0].id;

    await pool.query(
      `INSERT INTO milk_rate_history (family_id, rate_paise_per_litre, effective_from, created_by)
       VALUES ($1, 5600, '2026-01-01', $2)`,
      [family1Id, owner1Id]
    );

    const mem1Res = await pool.query(
      `INSERT INTO family_members (family_id, name, phone, pin_hash, role, language_preference)
       VALUES ($1, 'Family One Member', '9952590816', $2, 'member', 'ta') RETURNING id`,
      [family1Id, pinHash]
    );
    member1Id = mem1Res.rows[0].id;

    // Logins for Family 1
    const l1 = await request(app).post('/api/auth/login').send({ phone: '9952590815', pin: '2005' });
    owner1Token = l1.body.token;

    const l2 = await request(app).post('/api/auth/login').send({ phone: '9952590816', pin: '2005' });
    member1Token = l2.body.token;

    // 3. Setup Family 2 via registration endpoint
    const regFam2 = await request(app)
      .post('/api/auth/register-family')
      .send({
        familyName: 'Family Two',
        ownerName: 'Family Two Owner',
        phone: '9888877770',
        pin: '9999',
        initialRateRupees: 60,
        languagePreference: 'en'
      });

    expect(regFam2.status).toBe(201);
    owner2Token = regFam2.body.token;
    family2Id = regFam2.body.user.familyId;
  });

  describe('1. Multi-Tenant Registration & Seeded Account Integrity', () => {
    it('seeded owner retains their original family and can log in with short-lived session and refresh token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${owner1Token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.familyId).toBe(family1Id);
      expect(res.body.user.role).toBe('owner');
      expect(res.body.user.phone).toBe('9952590815');
    });

    it('new registration creates an independent family and isolated initial rate', async () => {
      expect(family2Id).not.toBe(family1Id);

      const ratesFam1 = await request(app)
        .get('/api/milk/rates')
        .set('Authorization', `Bearer ${owner1Token}`);
      expect(ratesFam1.body.rates[0].ratePaisePerLitre).toBe(5600);

      const ratesFam2 = await request(app)
        .get('/api/milk/rates')
        .set('Authorization', `Bearer ${owner2Token}`);
      expect(ratesFam2.body.rates[0].ratePaisePerLitre).toBe(6000);
    });

    it('rejects duplicate registration with an already registered phone number', async () => {
      const dup = await request(app)
        .post('/api/auth/register-family')
        .send({
          familyName: 'Duplicate Family',
          ownerName: 'Imposter',
          phone: '9952590815', // Same phone as Family 1 Owner
          pin: '1234',
          initialRateRupees: 50
        });

      expect(dup.status).toBe(400);
      expect(dup.body.error).toMatch(/already registered/i);
    });
  });

  describe('2. Invitations Lifecycle & Race Condition Safeguards', () => {
    it('allows an owner to generate an invitation and a member to join the intended family', async () => {
      // Owner 1 creates invitation for Family 1
      const invRes = await request(app)
        .post('/api/family/invitations')
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({ role: 'member', expiresInDays: 7, maxUses: 1 });

      expect(invRes.status).toBe(201);
      const rawCode = invRes.body.invitation.rawCode;
      expect(rawCode).toMatch(/^FAM-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

      // Verify endpoint checks preview
      const verifyRes = await request(app)
        .post('/api/auth/verify-invitation')
        .send({ invitationCode: rawCode });
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.valid).toBe(true);
      expect(verifyRes.body.familyName).toBe('Family One');
      expect(verifyRes.body.role).toBe('member');

      // Join family using the invitation code
      const joinRes = await request(app)
        .post('/api/auth/join-family')
        .send({
          invitationCode: rawCode,
          name: 'Amma (Mother)',
          phone: '9952500001',
          pin: '1234',
          languagePreference: 'ta'
        });

      expect(joinRes.status).toBe(201);
      expect(joinRes.body.user.familyId).toBe(family1Id);
      expect(joinRes.body.user.role).toBe('member');
      expect(joinRes.body.user.familyName).toBe('Family One');

      // Second use of single-use code is rejected
      const reuseRes = await request(app)
        .post('/api/auth/join-family')
        .send({
          invitationCode: rawCode,
          name: 'Appa (Father)',
          phone: '9952500002',
          pin: '1234',
          languagePreference: 'ta'
        });
      expect(reuseRes.status).toBe(400);
      expect(reuseRes.body.error).toMatch(/already been consumed|used/i);
    });

    it('rejects revoked or invalid invitation codes', async () => {
      const invRes = await request(app)
        .post('/api/family/invitations')
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({ role: 'member', expiresInDays: 7 });

      const rawCode = invRes.body.invitation.rawCode;
      const invId = invRes.body.invitation.id;

      // Revoke the invitation
      const revokeRes = await request(app)
        .delete(`/api/family/invitations/${invId}`)
        .set('Authorization', `Bearer ${owner1Token}`);
      expect(revokeRes.status).toBe(200);

      // Attempt to join with revoked code
      const joinRes = await request(app)
        .post('/api/auth/join-family')
        .send({
          invitationCode: rawCode,
          name: 'Brother',
          phone: '9952500003',
          pin: '1234'
        });
      expect(joinRes.status).toBe(400);
      expect(joinRes.body.error).toMatch(/revoked/i);
    });

    it('never accepts client-supplied role override during registration', async () => {
      const invRes = await request(app)
        .post('/api/family/invitations')
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({ role: 'member', expiresInDays: 7 });

      const rawCode = invRes.body.invitation.rawCode;

      // Attempt to join claiming OWNER or ADMIN role
      const joinRes = await request(app)
        .post('/api/auth/join-family')
        .send({
          invitationCode: rawCode,
          name: 'Hacker',
          phone: '9952500004',
          pin: '1234',
          role: 'owner' // Injected role
        });

      expect(joinRes.status).toBe(201);
      // Strictly assigned 'member' as permitted by the invitation
      expect(joinRes.body.user.role).toBe('member');
    });
  });

  describe('3. RBAC Enforcement Across Roles', () => {
    it('prevents MEMBER from changing milk rates, closing months, or viewing audit logs', async () => {
      // 1. Rate update attempt by MEMBER
      const rateRes = await request(app)
        .post('/api/milk/rates')
        .set('Authorization', `Bearer ${member1Token}`)
        .send({ rateRupees: 65, effectiveFrom: '2026-02-01' });
      expect(rateRes.status).toBe(403);

      // 2. Month close attempt by MEMBER
      const closeRes = await request(app)
        .post('/api/settlement/close-month')
        .set('Authorization', `Bearer ${member1Token}`)
        .send({ yearMonth: '2026-01' });
      expect(closeRes.status).toBe(403);

      // 3. Invitation creation attempt by MEMBER
      const invRes = await request(app)
        .post('/api/family/invitations')
        .set('Authorization', `Bearer ${member1Token}`)
        .send({ role: 'member' });
      expect(invRes.status).toBe(403);

      // 4. Audit logs view attempt by MEMBER
      const auditRes = await request(app)
        .get('/api/audit')
        .set('Authorization', `Bearer ${member1Token}`);
      expect(auditRes.status).toBe(403);
    });

    it('prevents non-owners from updating family profile name', async () => {
      const res = await request(app)
        .patch('/api/family/profile')
        .set('Authorization', `Bearer ${member1Token}`)
        .send({ name: 'Hacked Family Name' });
      expect(res.status).toBe(403);
    });
  });

  describe('4. Tenant Data Isolation & Cross-Family IDOR Prevention', () => {
    let family1EntryId: string;
    let family1PaymentId: string;

    beforeEach(async () => {
      // Record a milk entry in Family 1
      const eRes = await request(app)
        .post('/api/milk/entries')
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({
          date: '2026-01-10',
          quantityMl: 1000,
          paymentChoice: 'pending',
          notes: 'Family 1 secret milk entry'
        });
      family1EntryId = eRes.body.entry.id;

      // Record a payment in Family 1
      const pRes = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({
          date: '2026-01-10',
          amountRupees: 100,
          paymentMethod: 'cash',
          notes: 'Family 1 secret payment'
        });
      family1PaymentId = pRes.body.payment.id;
    });

    it('Family 2 user cannot see Family 1 purchases, payments, or members', async () => {
      // Family 2 lists entries
      const entriesRes = await request(app)
        .get('/api/milk/entries')
        .set('Authorization', `Bearer ${owner2Token}`);
      expect(entriesRes.body.entries).toHaveLength(0);

      // Family 2 lists payments
      const paymentsRes = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${owner2Token}`);
      expect(paymentsRes.body.payments).toHaveLength(0);

      // Family 2 lists members
      const membersRes = await request(app)
        .get('/api/family/members')
        .set('Authorization', `Bearer ${owner2Token}`);
      expect(membersRes.body.members).toHaveLength(1);
      expect(membersRes.body.members[0].name).toBe('Family Two Owner');
    });

    it('rejects attempt by Family 2 to correct, delete, or fetch Family 1 records (IDOR protection)', async () => {
      // Fetch Family 1 payment with Family 2 token
      const getPay = await request(app)
        .get(`/api/payments/${family1PaymentId}`)
        .set('Authorization', `Bearer ${owner2Token}`);
      expect(getPay.status).toBe(404);

      // Delete Family 1 milk entry with Family 2 token
      const delEntry = await request(app)
        .delete(`/api/milk/entries/${family1EntryId}`)
        .set('Authorization', `Bearer ${owner2Token}`);
      expect(delEntry.status).toBe(400);

      // Correct Family 1 milk entry with Family 2 token
      const corrEntry = await request(app)
        .put(`/api/milk/entries/${family1EntryId}`)
        .set('Authorization', `Bearer ${owner2Token}`)
        .send({
          quantityMl: 500,
          correctionNotes: 'Malicious modification'
        });
      expect(corrEntry.status).toBe(400);
    });

    it('strictly rejects cross-family payment allocation attempts', async () => {
      // Family 2 attempts to allocate their payment to Family 1 entry
      const crossAlloc = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${owner2Token}`)
        .send({
          date: '2026-01-10',
          amountRupees: 56,
          paymentMethod: 'upi',
          allocateToEntryIds: [family1EntryId]
        });

      expect(crossAlloc.status).toBe(500);
      expect(crossAlloc.body.error).toMatch(/not found or invalid/i);
    });

    it('ignores client-supplied family_id in payload or query params', async () => {
      // Family 2 attempts to submit purchase with familyId = Family 1
      const spoof = await request(app)
        .post('/api/milk/entries')
        .set('Authorization', `Bearer ${owner2Token}`)
        .send({
          familyId: family1Id, // Spoofed payload
          date: '2026-01-11',
          quantityMl: 1000,
          paymentChoice: 'pending'
        });

      expect(spoof.status).toBe(201);
      // Entry was recorded for Family 2, NOT Family 1!
      expect(spoof.body.entry.familyId).toBe(family2Id);

      // Verify Family 1 did not receive this spoofed entry
      const fam1Entries = await request(app)
        .get('/api/milk/entries')
        .set('Authorization', `Bearer ${owner1Token}`);
      expect(fam1Entries.body.entries).toHaveLength(1);
      expect(fam1Entries.body.entries[0].id).toBe(family1EntryId);
    });
  });

  describe('5. Lockout Protection against Brute-Force Attacks', () => {
    it('locks out a phone number after 5 consecutive incorrect PIN attempts', async () => {
      const phone = '9952590815';

      // 4 failed attempts
      for (let i = 0; i < 4; i++) {
        const fail = await request(app)
          .post('/api/auth/login')
          .send({ phone, pin: '0000' });
        expect(fail.status).toBe(401);
      }

      // 5th failed attempt triggers lockout
      const fifth = await request(app)
        .post('/api/auth/login')
        .send({ phone, pin: '0000' });
      expect(fifth.status).toBe(429);
      expect(fifth.body.error).toMatch(/locked out/i);

      // Even correct PIN is rejected while locked out
      const lockedTry = await request(app)
        .post('/api/auth/login')
        .send({ phone, pin: '2005' });
      expect(lockedTry.status).toBe(429);
      expect(lockedTry.body.error).toMatch(/locked out/i);
    });
  });

  describe('6. Token Lifecycle, Refresh Rotation & Session Revocation', () => {
    it('rejects access tokens that have expired with TOKEN_EXPIRED code', async () => {
      // Craft an expired access token
      const expiredToken = jwt.sign(
        { sub: member1Id, familyId: family1Id, role: 'member' },
        config.jwtSecret,
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('TOKEN_EXPIRED');
    });

    it('rotates refresh token and issues new short-lived access token', async () => {
      // Login returns both token and refreshToken
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ phone: '9952590815', pin: '2005' });

      expect(loginRes.status).toBe(200);
      const initialAccessToken = loginRes.body.token;
      const initialRefreshToken = loginRes.body.refreshToken;
      expect(initialRefreshToken).toBeDefined();

      // Refresh session
      const refreshRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: initialRefreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.token).toBeDefined();
      expect(refreshRes.body.refreshToken).toBeDefined();
      expect(refreshRes.body.refreshToken).not.toBe(initialRefreshToken);

      // Verify new access token works
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${refreshRes.body.token}`);
      expect(meRes.status).toBe(200);
      expect(meRes.body.user.phone).toBe('9952590815');
    });

    it('handles concurrent tab refreshes within grace period and detects replay attack thereafter', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ phone: '9952590815', pin: '2005' });

      const oldRefreshToken = loginRes.body.refreshToken;

      // Legitimate rotation
      const rotationRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: oldRefreshToken });
      expect(rotationRes.status).toBe(200);
      const activeRefreshToken = rotationRes.body.refreshToken;

      // Concurrent browser tab refreshing within 30s grace period succeeds without false lockout
      const concurrentRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: oldRefreshToken });
      expect(concurrentRes.status).toBe(200);

      // Simulate passage of grace window (age revoked_at by 1 minute)
      await pool.query(
        `UPDATE refresh_tokens SET revoked_at = NOW() - INTERVAL '1 minute' WHERE revoked_at IS NOT NULL`
      );

      // Attacker attempts to replay oldRefreshToken after grace period
      const replayRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: oldRefreshToken });

      expect(replayRes.status).toBe(401);
      expect(replayRes.body.error).toMatch(/revoked|security alert/i);

      // The active refresh token must now be invalidated as well due to the security alert
      const followUpRes = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: activeRefreshToken });

      expect(followUpRes.status).toBe(401);
    });

    it('revokes refresh token on explicit logout', async () => {
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ phone: '9952590815', pin: '2005' });

      const { refreshToken } = loginRes.body;

      // Logout
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken });
      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // Attempt to refresh after logout must be rejected
      const refreshTry = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });
      expect(refreshTry.status).toBe(401);
    });

    it('revokes all member sessions when authenticated user changes their PIN', async () => {
      // Login to obtain active session
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ phone: '9952590816', pin: '2005' });
      const oldRefreshToken = loginRes.body.refreshToken;
      const memberAccessToken = loginRes.body.token;

      // Change PIN
      const changeRes = await request(app)
        .post('/api/auth/change-pin')
        .set('Authorization', `Bearer ${memberAccessToken}`)
        .send({ currentPin: '2005', newPin: '8888' });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.success).toBe(true);
      expect(changeRes.body.token).toBeDefined();

      // Old refresh token must be rejected
      const oldRefreshTry = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: oldRefreshToken });
      expect(oldRefreshTry.status).toBe(401);

      // Old PIN must fail login
      const oldLogin = await request(app)
        .post('/api/auth/login')
        .send({ phone: '9952590816', pin: '2005' });
      expect(oldLogin.status).toBe(401);

      // New PIN succeeds
      const newLogin = await request(app)
        .post('/api/auth/login')
        .send({ phone: '9952590816', pin: '8888' });
      expect(newLogin.status).toBe(200);
    });

    it('revokes member sessions when an administrator resets their PIN', async () => {
      // Member logs in
      const memLogin = await request(app)
        .post('/api/auth/login')
        .send({ phone: '9952590816', pin: '2005' });
      const memRefreshToken = memLogin.body.refreshToken;

      // Owner resets member's PIN
      const resetRes = await request(app)
        .put(`/api/family/members/${member1Id}`)
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({ resetPin: '7777' });

      expect(resetRes.status).toBe(200);

      // Member's previous session refresh token must be revoked
      const memRefreshTry = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: memRefreshToken });
      expect(memRefreshTry.status).toBe(401);

      // Member can now log in with the new PIN
      const memNewLogin = await request(app)
        .post('/api/auth/login')
        .send({ phone: '9952590816', pin: '7777' });
      expect(memNewLogin.status).toBe(200);
    });
  });

  describe('7. Direct Member Management, Setup PIN & Persistent Sessions', () => {
    it('allows authorized owner to add member directly without invitation code or expiry', async () => {
      const res = await request(app)
        .post('/api/family/members')
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({
          name: 'Direct Amma',
          phone: '9840123456',
          role: 'member'
        });

      expect(res.status).toBe(201);
      expect(res.body.member.name).toBe('Direct Amma');
      expect(res.body.member.phone).toBe('9840123456');
      expect(res.body.member.role).toBe('member');
      expect(res.body.member.familyId).toBe(family1Id);
      expect(res.body.member.mustChangePin).toBe(true);
      expect(res.body.temporaryPin).toBeDefined();

      // Login with generated temporary PIN succeeds and flags mustChangePin
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ phone: '9840123456', pin: res.body.temporaryPin });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.user.mustChangePin).toBe(true);

      // Verify HttpOnly cookie header was set
      const cookies = loginRes.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((c: string) => c.includes('milk_refresh_token='))).toBe(true);

      // First-login setup PIN
      const setupRes = await request(app)
        .post('/api/auth/setup-pin')
        .set('Authorization', `Bearer ${loginRes.body.token}`)
        .send({ newPin: '4321' });

      expect(setupRes.status).toBe(200);
      expect(setupRes.body.user.mustChangePin).toBe(false);

      // Old temporary PIN no longer works
      const oldTry = await request(app)
        .post('/api/auth/login')
        .send({ phone: '9840123456', pin: res.body.temporaryPin });
      expect(oldTry.status).toBe(401);

      // New personal PIN works
      const newTry = await request(app)
        .post('/api/auth/login')
        .send({ phone: '9840123456', pin: '4321' });
      expect(newTry.status).toBe(200);
    });

    it('rejects duplicate active phone across different families', async () => {
      // Family 1 adds '9840123456'
      const firstAdd = await request(app)
        .post('/api/family/members')
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({
          name: 'Direct Amma',
          phone: '9840123456',
          role: 'member'
        });
      expect(firstAdd.status).toBe(201);

      // Family 2 attempts to add '9840123456' which is already active in Family 1
      const res = await request(app)
        .post('/api/family/members')
        .set('Authorization', `Bearer ${owner2Token}`)
        .send({
          name: 'Another User',
          phone: '9840123456',
          role: 'member'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already exists/i);
    });

    it('immediately denies API access when member is deactivated', async () => {
      // Add member
      const addRes = await request(app)
        .post('/api/family/members')
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({
          name: 'Deactivatable Member',
          phone: '9840999999',
          role: 'member'
        });
      expect(addRes.status).toBe(201);
      const memId = addRes.body.member.id;
      const tempPin = addRes.body.temporaryPin;

      // Member logs in with generated temporary PIN and gets access token
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ phone: '9840999999', pin: tempPin });
      expect(loginRes.status).toBe(200);
      const memToken = loginRes.body.token;

      // Verify protected call succeeds with this token
      const preCheck = await request(app)
        .get('/api/milk/rates')
        .set('Authorization', `Bearer ${memToken}`);
      expect(preCheck.status).toBe(200);

      // Owner deactivates member (soft deactivation)
      const deactRes = await request(app)
        .put(`/api/family/members/${memId}`)
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({ isActive: false });
      expect(deactRes.status).toBe(200);

      // The previously issued access token MUST be rejected immediately due to sessions_revoked_at check
      const postCheck = await request(app)
        .get('/api/milk/rates')
        .set('Authorization', `Bearer ${memToken}`);
      expect(postCheck.status).toBe(401);

      // Refresh token is also rejected with 403 account inactive
      const refreshCheck = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: loginRes.body.refreshToken });
      expect(refreshCheck.status).toBe(403);
    });
  });
});


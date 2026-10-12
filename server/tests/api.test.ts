import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { newDb } from 'pg-mem';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

import { createApp } from '../src/app.js';
import { setCustomPool } from '../src/config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Family Milk Account - Security & API Integration Suite', () => {
  let db: any;
  let pool: any;
  let app: any;
  let familyId: string;
  let adminId: string;
  let memberId: string;
  let adminToken: string;
  let memberToken: string;

  beforeEach(async () => {
    // 1. Fresh in-memory database
    db = newDb();
    db.public.registerFunction({
      name: 'gen_random_uuid',
      impure: true,
      implementation: () => crypto.randomUUID()
    });

    const pgAdapter = db.adapters.createPg();
    pool = new pgAdapter.Pool();
    setCustomPool(pool);

    // Apply all schema migrations
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

    // Seed test family
    const famRes = await pool.query(
      `INSERT INTO families (name, currency, timezone) VALUES ('Smith Family', 'INR', 'Asia/Kolkata') RETURNING id`
    );
    familyId = famRes.rows[0].id;

    const salt = await bcrypt.genSalt(10);
    const pinHash = await bcrypt.hash('1234', salt);

    const adminRes = await pool.query(
      `INSERT INTO family_members (family_id, name, phone, pin_hash, role, language_preference)
       VALUES ($1, 'Admin Mother', '9876543210', $2, 'admin', 'ml') RETURNING id`,
      [familyId, pinHash]
    );
    adminId = adminRes.rows[0].id;

    const memberRes = await pool.query(
      `INSERT INTO family_members (family_id, name, phone, pin_hash, role, language_preference)
       VALUES ($1, 'Member Son', '9876543211', $2, 'member', 'en') RETURNING id`,
      [familyId, pinHash]
    );
    memberId = memberRes.rows[0].id;

    await pool.query(
      `INSERT INTO milk_rate_history (family_id, rate_paise_per_litre, effective_from, notes, created_by)
       VALUES ($1, 5600, '2026-01-01', 'Initial rate', $2)`,
      [familyId, adminId]
    );

    app = createApp();

    // Authenticate and get tokens
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ phone: '9876543210', pin: '1234' });
    adminToken = adminLoginRes.body.token;

    const memberLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ phone: '9876543211', pin: '1234' });
    memberToken = memberLoginRes.body.token;
  });

  describe('1. Authentication & Security', () => {
    it('successfully logs in with valid credentials and returns JWT token and member profile', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ phone: '9876543210', pin: '1234' });

      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
      expect(res.body.user.name).toBe('Admin Mother');
      expect(res.body.user.role).toBe('admin');
    });

    it('rejects invalid PIN with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ phone: '9876543210', pin: '9999' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid phone number or PIN');
    });

    it('rejects protected routes without Authorization header with 401', async () => {
      const res = await request(app).get('/api/milk/entries');
      expect(res.status).toBe(401);
    });

    it('allows changing language preference independently per user without altering accounting records', async () => {
      const res = await request(app)
        .patch('/api/auth/language')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ language: 'en' });

      expect(res.status).toBe(200);
      expect(res.body.languagePreference).toBe('en');

      // Verify in DB
      const userRes = await pool.query('SELECT language_preference FROM family_members WHERE id = $1', [adminId]);
      expect(userRes.rows[0].language_preference).toBe('en');
    });
  });

  describe('2. Authorization & Least Privilege', () => {
    it('restricts milk rate changes to admin only (forbidden for non-admin member)', async () => {
      // Member tries to change rate -> 403 Forbidden
      const res = await request(app)
        .post('/api/milk/rates')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          rateRupees: 60,
          effectiveFrom: '2026-11-01',
          notes: 'Unauthorized attempt',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Admin privilege required');
    });

    it('permits admin to add new milk rate', async () => {
      const res = await request(app)
        .post('/api/milk/rates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          rateRupees: 60,
          effectiveFrom: '2026-11-01',
          notes: 'Authorized rate change',
        });

      expect(res.status).toBe(201);
      expect(res.body.rate.ratePaisePerLitre).toBe(6000);
    });
  });

  describe('3. Validation & Malformed Requests', () => {
    it('rejects negative milk quantities with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/milk/entries')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          date: '2026-10-10',
          quantityMl: -500,
          paymentChoice: 'pending',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('rejects invalid date format with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/milk/entries')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          date: '10/10/2026', // Not YYYY-MM-DD
          quantityMl: 500,
          paymentChoice: 'pending',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });
  });

  describe('4. Health Check Endpoint & Static Frontend Serving', () => {
    it('returns healthy status on /api/health', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('family-milk-account');
    });

    it('serves compiled client index.html at root "/" and SPA route fallback', async () => {
      const rootRes = await request(app).get('/');
      expect(rootRes.status).toBe(200);
      expect(rootRes.headers['content-type']).toContain('text/html');
      expect(rootRes.text).toContain('<!DOCTYPE html>');

      const spaRes = await request(app).get('/dashboard');
      expect(spaRes.status).toBe(200);
      expect(spaRes.headers['content-type']).toContain('text/html');
      expect(spaRes.text).toContain('<!DOCTYPE html>');
    });
  });
});

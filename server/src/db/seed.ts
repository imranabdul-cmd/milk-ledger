import bcrypt from 'bcryptjs';
import { getPool } from '../config/db.js';
import { config } from '../config/env.js';

export async function seedDatabase(): Promise<void> {
  // 1. Guard against unconfigured or placeholder credentials
  const phone = config.initialAdminPhone;
  const pin = config.initialAdminPin;

  if (!phone || phone.includes('REPLACE_WITH') || phone.trim() === '') {
    console.error('❌ Cannot seed database: INITIAL_ADMIN_PHONE is not configured in .env.');
    console.error('👉 Please configure your family admin phone number in .env before running db:seed.');
    process.exit(1);
  }

  if (!pin || pin.includes('REPLACE_WITH') || pin.trim().length < 4) {
    console.error('❌ Cannot seed database: INITIAL_ADMIN_PIN must be at least 4 digits in .env.');
    console.error('👉 Please configure your family admin PIN in .env before running db:seed.');
    process.exit(1);
  }

  if (config.nodeEnv === 'production') {
    if (phone === '9876543210' || pin === '1234') {
      console.error('❌ Production Security Error: Refusing to seed production database with sample credentials (phone: 9876543210, PIN: 1234).');
      console.error('👉 Please configure your real family admin phone and a secure PIN in your production environment variables.');
      process.exit(1);
    }
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    console.log('🌱 Starting initial family database seed...');
    await client.query('BEGIN');

    // 2. Family existence check (idempotent bootstrap)
    const existingFamilyRes = await client.query('SELECT id, name FROM families LIMIT 1');
    let familyId: string;

    if (existingFamilyRes.rows.length === 0) {
      const createFamilyRes = await client.query(
        `INSERT INTO families (name, currency, timezone)
         VALUES ($1, 'INR', $2)
         RETURNING id`,
        [config.initialFamilyName, config.timezone]
      );
      familyId = createFamilyRes.rows[0].id;
      console.log(`✅ Created family: "${config.initialFamilyName}"`);
    } else {
      familyId = existingFamilyRes.rows[0].id;
      console.log(`ℹ️ Existing family found: "${existingFamilyRes.rows[0].name}"`);
    }

    // 3. Admin member existence check
    const existingMemberRes = await client.query(
      'SELECT id FROM family_members WHERE family_id = $1 AND phone = $2',
      [familyId, phone]
    );

    let adminMemberId: string;

    if (existingMemberRes.rows.length === 0) {
      // Hash PIN securely
      const salt = await bcrypt.genSalt(10);
      const hashedPin = await bcrypt.hash(pin, salt);

      const insertRes = await client.query(
        `INSERT INTO family_members (family_id, name, phone, pin_hash, role, language_preference)
         VALUES ($1, $2, $3, $4, 'admin', 'ml')
         RETURNING id`,
        [familyId, config.initialAdminName, phone, hashedPin]
      );
      adminMemberId = insertRes.rows[0].id;
      // Note: Never log plaintext PIN or credentials in terminal/logs
      console.log(`✅ Created family admin: ${config.initialAdminName} (${phone})`);
    } else {
      adminMemberId = existingMemberRes.rows[0].id;
      console.log(`ℹ️ Admin member (${phone}) already exists. Skipped member re-creation.`);
    }

    // 4. Initial milk rate history check
    const existingRateRes = await client.query(
      'SELECT id FROM milk_rate_history WHERE family_id = $1 LIMIT 1',
      [familyId]
    );

    if (existingRateRes.rows.length === 0) {
      const ratePaise = config.initialDefaultRateRupees * 100;
      await client.query(
        `INSERT INTO milk_rate_history (family_id, rate_paise_per_litre, effective_from, notes, created_by)
         VALUES ($1, $2, '2026-01-01', 'Initial standard milk rate', $3)`,
        [familyId, ratePaise, adminMemberId]
      );
      console.log(`✅ Seeded initial milk rate: ₹${config.initialDefaultRateRupees}/Litre (${ratePaise} paise)`);
    } else {
      console.log('ℹ️ Milk rate already exists. Skipped rate re-creation.');
    }

    await client.query('COMMIT');
    console.log('🎉 Seeding completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

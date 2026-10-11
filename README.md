# 🥛 Family Milk Account (குடும்ப பால் கணக்கு)

> **Production-Ready, Mobile-First Family Milk Purchase and Monthly Settlement Web Application**  
> Built for non-technical parents with multilingual **Tamil (தமிழ்)**, **English**, and **Malayalam (മലയാളം)** support, permanent life-long login sessions on family phones, strict accounting guarantees, and single-service deployment on **Render** backed by **Supabase PostgreSQL**.

---

## 🌟 Highlights

- **Multi-Tenant SaaS Architecture**: Completely isolated data partitions for multiple independent families. Zero hardcoding of family IDs or default phone lookups.
- **Strict Role-Based Access Control (RBAC)**:
  - `OWNER`: Family profile administration, member role assignment, ownership transfer, audit logs, invitations, rate updates, monthly closures.
  - `ADMIN`: Member management, rate updates, monthly closures, invitations, audit logs.
  - `MEMBER`: Daily milk entry and payment logging, monthly statement viewing. Restricted from rates, closures, audit logs, or administrative actions.
- **High-Entropy Revocable Invitations**:
  - Secure formatted invitation tokens (`FAM-XXXX-XXXX`), stored as SHA-256 hashes in the database.
  - Atomic redemption using `SELECT ... FOR UPDATE` concurrency locks.
  - Revocable at any time by Owners/Admins; 1-click WhatsApp share and clipboard copy.
- **Brute-Force & Lockout Protection**:
  - In-memory failed attempt tracker locks phone numbers for 15 minutes after 5 consecutive failed login attempts.
- **Zero Cross-Family Leakage (Composite DB Constraints)**:
  - Composite unique keys (`uq_payments_id_family`, `uq_milk_entries_id_family`) and composite foreign keys on `payment_allocations` guarantee cross-tenant foreign key linkage is physically rejected by PostgreSQL.
  - Backend tenant scoping enforced across 100% of routes.
- **Permanent Life-Long Mobile Sessions**: Once logged in on a parent's phone, the session stays authenticated permanently (100-year JWT + persistent storage). Accidental logouts are prevented with a confirmation prompt.
- **Multilingual Interface**: Native Tamil (தமிழ்), English, and Malayalam (മലയാളം) with 1-tap switching. Every single button, prompt, validation error, and statement is translated. Language preference is persisted per family member independently.
- **Parent-Friendly Touch Controls**:
  - Huge 1-tap buttons for **½ Litre (500 ml)** and **1 Litre (1000 ml)**.
  - Custom quantity entry (ml or litres).
  - Clear **Paid (பணம் கொடுத்தாச்சு)** vs **Pending (பாக்கி)** toggle choices.
  - High contrast typography using Google Fonts *Inter*, *Noto Sans Tamil*, and *Noto Sans Malayalam*.
- **Exact Financial Mathematics**:
  - Milk quantities stored in **Integer Millilitres (`quantity_ml`)**.
  - All money stored in exact **Integer Paise (`amount_paise`)** (₹1 = 100 paise). Zero floating-point arithmetic.
  - Formula: `Closing Balance = Opening Balance + Milk Charges − Total Payments`.
  - Rate immutability: Price changes never alter historical purchases.
- **Strict Asia/Kolkata Timezone (`UTC+05:30`)**:
  - "Today", distinct purchase days, and monthly statement cycles align strictly with Indian Standard Time.
- **WhatsApp Monthly Statement**:
  - 1-click share button formatting an auditable monthly summary (purchase days, litres, rates, charges, payments, and due/credit) with native Malayalam or English phrasing.
- **Enterprise Security**:
  - Parameterized SQL queries preventing SQL injection.
  - Server-side Zod validation.
  - Passwords and PINs hashed with `bcrypt`.
  - Signed JWT tokens and role-based authorization (`owner`, `admin`, `member`).
  - Idempotency key tracking on submissions to prevent double entries from multi-taps.
  - Full audit logging on creations, updates, corrections, and monthly closures.

---

## 🔐 Multi-Tenant Architecture & Security Model

### 1. Dynamic Tenant Resolution
- No request is ever allowed to supply or override a `family_id` via route parameters, query strings, or JSON bodies.
- Authentication validates the user's phone and PIN, resolves their actual active `family_id` from `family_members`, and injects the verified family context into the signed JWT session.
- Every subsequent query (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) is scoped on the server side using the authenticated session's `family_id`.

### 2. RBAC Permissions Matrix

| Capability | OWNER | ADMIN | MEMBER |
|---|:---:|:---:|:---:|
| Log daily milk purchases & payments | ✅ | ✅ | ✅ |
| View family dashboard & monthly statements | ✅ | ✅ | ✅ |
| Switch personal display language (`ta`, `ml`, `en`) | ✅ | ✅ | ✅ |
| Generate & revoke family invitations | ✅ | ✅ | ❌ |
| Update current milk purchase rate | ✅ | ✅ | ❌ |
| Perform monthly accounting closures | ✅ | ✅ | ❌ |
| View family audit logs | ✅ | ✅ | ❌ |
| Manage family members (roles/removal) | ✅ | ✅ (non-owners) | ❌ |
| Edit family profile & name | ✅ | ❌ | ❌ |
| Transfer family ownership | ✅ | ❌ | ❌ |

### 3. Invitation Flow & Verification
- **Creation**: Owners/Admins generate invitations specifying the role (`member` or `admin`), expiration date (default 7 days), and max uses (default 1).
- **Security**: The code (`FAM-XXXX-XXXX`) is displayed once to the creator and hashed with SHA-256 before storage in `invitations`.
- **Atomic Join**: When a user registers with an invitation, a database transaction acquires an exclusive row lock (`FOR UPDATE`) on the invitation, checks expiration, status, and use limits, increments `uses_count`, creates the `family_members` record with the exact permitted role, and commits atomically.
- **SMS / Phone Verification Reality**: In environments without an external SMS gateway (e.g. Twilio/MSG91), phone verification is not simulated or claimed. Instead, trust is anchored on high-entropy invitation codes distributed directly through private family channels (e.g., WhatsApp). Brute-force attacks against phone logins are countered with temporary 15-minute lockouts after 5 consecutive failures.

### 4. Database-Level Isolation & PostgreSQL RLS
- In Supabase, the application database connection runs as the database owner (`postgres`), which naturally bypasses PostgreSQL Row-Level Security policies.
- Therefore, reliance on RLS alone is insufficient. Isolation is enforced through:
  1. **Strict Server-Side Scoping**: Every SQL query is parameterized with `WHERE family_id = $1`.
  2. **Composite Foreign Keys**:
     - `payment_allocations` enforces `(family_id, payment_id)` foreign key references to `payments(family_id, id)`.
     - `payment_allocations` enforces `(family_id, milk_entry_id)` foreign key references to `milk_entries(family_id, id)`.
     - Cross-family payment allocation is physically rejected by the PostgreSQL query planner.

---

## 👥 Pre-Seeded Demo Family & Migration Safety

The original seeded family and administrator are fully preserved:
- Existing seeded administrator (`9952590815`) is automatically promoted to `role = 'owner'`.
- All historical rate records, milk entries, payments, and audit logs remain intact.
- Migration `002_multi_tenant_rbac.sql` was authored to be strictly non-destructive and backward-compatible.

---

## 🧪 Automated Testing

Run the full automated test suite:
```bash
npm test
```
The test suite (32 tests across 3 suites) validates:
- **`accounting.test.ts` (10 tests)**: Integer paise math, volume conversions, historical rate immutability, payment allocations, advance credit carry-forwards, Malayalam statement formatting.
- **`api.test.ts` (9 tests)**: API authentication, invalid credentials rejection, header validation, independent language preferences, role authorization restrictions, input validation, health check.
- **`multi_tenant_rbac.test.ts` (13 tests)**:
  - Multi-tenant registration creating independent families and initial rates.
  - Preservation of the seeded family and admin.
  - Rejection of duplicate phone registrations.
  - High-entropy invitation lifecycle (creation, validation, atomic acceptance, revocation).
  - Immunity to client-supplied role escalation.
  - RBAC permission boundary enforcement across Owner, Admin, and Member.
  - IDOR rejection when attempting to query, update, or delete another family's records.
  - Prevention of cross-tenant payment allocations.
  - Phone lockout protection after 5 consecutive failed login attempts.

---

## 🌐 Deploying to Render (Single Web Service)

Deploy the entire full-stack app as **one single Web Service** on [Render.com](https://render.com).

### Step 1: Push Code to GitHub / GitLab
Ensure `.env` is **NOT** committed (protected by `.gitignore`).

### Step 2: Create a Web Service on Render
1. Log in to [dashboard.render.com](https://dashboard.render.com) and click **New +** -> **Web Service**.
2. Connect your Git repository.
3. Configure settings:
   - **Name**: `family-milk-account`
   - **Environment**: `Node`
   - **Branch**: `main`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
   - **Health Check Path**: `/api/health`
4. Add **Environment Variables**:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `DATABASE_URL`: *(Paste your Supabase connection string)*
   - `DATABASE_SSL`: `true`
   - `JWT_SECRET`: *(Generate a secure random string or let Render generate it)*
   - `TZ`: `Asia/Kolkata`
5. Click **Deploy Web Service**.

### Step 3: Run Database Migrations on Supabase
You can run migrations locally pointing to your Supabase connection string before deploying:
```bash
npm run migrate
npm run db:seed
```
Or run `npm run migrate` in Render's Shell tab.

---

## 💾 Database Backup & Export Instructions

### 1. Manual Backup via Supabase Dashboard
1. Go to your Supabase Project Dashboard.
2. Navigate to **Database** -> **Backups**.
3. Download the automated daily backup or click **Backup Now**.

### 2. Export via `pg_dump` CLI
Run this command from your terminal:
```bash
pg_dump "postgresql://postgres.yourprojectref:yourpassword@aws-0-ap-south-1.pooler.supabase.com:6543/postgres" \
  --format=custom \
  --file="family_milk_backup_$(date +%Y%m%d).dump"
```

To restore from a backup:
```bash
pg_restore --clean --if-exists -d "YOUR_DATABASE_URL" "family_milk_backup_20261010.dump"
```

---

## 📱 Installing on Mobile Phones (PWA)

1. Open the deployed application URL in Safari (iOS) or Chrome (Android).
2. **Android**: Tap the menu (three dots) -> **"Install app"** or **"Add to Home screen"**.
3. **iPhone**: Tap the Share button -> **"Add to Home Screen"**.
4. The app will open in fullscreen mode just like a native app.
#   m i l k - l e d g e r  
 
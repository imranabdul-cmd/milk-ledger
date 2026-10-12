# 🥛 Family Milk Account

A family-focused milk ledger and accounting web application for tracking daily milk purchases, managing milk rates, recording payments, and reviewing monthly settlement balances. Built for seamless usability on mobile devices as well as desktop screens.

**Repository:** [https://github.com/imranabdul-cmd/milk-ledger](https://github.com/imranabdul-cmd/milk-ledger)

---

## Features

- **Daily Milk Entry:** Quick single-tap ½-litre and 1-litre options, custom quantities, morning/evening delivery flags, and delivery notes.
- **Dynamic Rate History:** Maintains dated milk rates (₹ per litre); historical entries remain immutable and calculate using the exact rate active on their purchase date.
- **Payments & Monthly Settlement:** Ledger calculations in integer paise to eliminate floating-point rounding errors; tracks partial payments, advances, dues, and automatic month-to-month rollovers.
- **Multi-Tenant Family Management:** Role-based access control (`owner`, `admin`, `member`) with member invitations, custom PIN-based authentication, and brute-force lockout safeguards.
- **Multilingual Support:** Instant language switching between Tamil (தமிழ்), English, and Malayalam (മലയാളം).
- **Accurate Indian Timezone:** Date-based cutoffs and month closing configured for `Asia/Kolkata`.
- **Single-Service Full-Stack Deployment:** The Express backend serves the REST API (`/api/*`) and hosts the compiled React/Vite frontend (`client/dist`) with client-side SPA routing fallback.

---

## Tech Stack & Architecture

| Component | Technology | Description |
|---|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide React | High-performance PWA-ready responsive client |
| **Backend** | Node.js, Express, TypeScript | REST API with Helmet security headers and rate limiting |
| **Database** | PostgreSQL (Supabase) | Connection pooler with parameterized queries and transactions |
| **Shared Types** | TypeScript (`@family-milk/shared`) | Shared domain types, DTO schemas, and calculation rules |
| **Deployment** | Render Web Service | Single-service Node.js deployment serving API and static assets |

---

## Authentication & Session Architecture

The application implements a secure authentication flow designed for persistent family use on mobile phones while preserving security standards:

1. **Short-Lived Access Tokens (JWT):**
   - Duration: Configured to **15 minutes** (`JWT_EXPIRES_IN=15m`).
   - Carried in the `Authorization: Bearer <token>` header for stateless API validation.
2. **Rotating Refresh Tokens:**
   - Duration: **365 days** persistent sliding window (`REFRESH_TOKEN_EXPIRES_IN_DAYS=365`).
   - Delivered exclusively via secure, `httpOnly`, `SameSite=Lax` cookies (`milk_refresh_token`).
   - Stored in the database as SHA-256 cryptographic hashes.
3. **Replay Detection & Grace Period:**
   - Refresh tokens rotate upon every refresh request to `/api/auth/refresh`.
   - Includes a 30-second grace period to accommodate concurrent browser tab refreshes without false lockouts.
   - Automatic replay attack detection: If an already-revoked refresh token is re-submitted after the grace period, all active sessions for that user are immediately invalidated.
4. **Explicit Revocation:**
   - Calling `/api/auth/logout` revokes the refresh token in PostgreSQL and clears the cookie.
   - Changing or resetting a user's PIN automatically revokes all active refresh tokens across all devices.

---

## Repository Structure

```text
milk-ledger/
├── client/          # React + Vite frontend
│   ├── src/         # UI components, pages, hooks, state, translations
│   ├── package.json # Frontend dependencies and build script
│   └── vite.config.ts
├── server/          # Express API & PostgreSQL backend
│   ├── src/         # Routes, controllers, middleware, database config
│   ├── tests/       # Vitest automated test suite (accounting, API, RBAC)
│   ├── package.json # Backend dependencies and scripts
│   └── tsconfig.json
├── shared/          # Shared TypeScript package (@family-milk/shared)
│   ├── src/         # Enums, interfaces, and domain types
│   ├── package.json # Shared package exports
│   └── tsconfig.json
├── render.yaml      # Render Infrastructure-as-Code Blueprint
├── package.json     # Root orchestration scripts
└── .env.example     # Environment variable template
```

---

## Local Development Setup

### 1. Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **PostgreSQL**: Local instance or remote Supabase PostgreSQL database

### 2. Clone the Repository

```bash
git clone https://github.com/imranabdul-cmd/milk-ledger.git
cd milk-ledger
```

### 3. Install Dependencies

Install dependencies for the root orchestrator, frontend, and backend packages:

```bash
npm install
npm --prefix client install
npm --prefix server install
```

### 4. Configure Environment Variables

Copy the template to create a local `.env` file at the root:

```bash
cp .env.example .env
```

Edit `.env` and fill in your local settings:

- `DATABASE_URL`: Your PostgreSQL connection string.
- `DATABASE_SSL`: Set to `true` if connecting to a cloud provider like Supabase.
- `JWT_SECRET`: A secure random string of at least 32 characters.
- `PORT`: Local server port (default: `5000`).
- `TZ`: `Asia/Kolkata`.

> **Note:** Never commit `.env` to Git. The `.gitignore` file excludes `.env` and all environment variations automatically.

### 5. Build Shared Package

Before starting the dev server or running tests, build the shared package:

```bash
npm run build:shared
```

### 6. Run Automated Tests

Execute the comprehensive Vitest test suite (41 tests verifying accounting math, RBAC isolation, and security):

```bash
npm test
```

### 7. Run the Development Server

Start both the backend API server and the Vite client concurrently:

```bash
npm run dev
```

- Frontend: `http://localhost:3000` (proxies `/api` to port 5000)
- Backend API: `http://localhost:5000`

---

## Building for Production

To produce clean production builds for all components:

```bash
npm run build
```

The build sequence executes:
1. `npm run build:shared`: Compiles `@family-milk/shared` TypeScript definitions into `shared/dist/`.
2. `npm --prefix client run build`: Runs Vite production bundling into `client/dist/`.
3. `npm --prefix server run build`: Compiles Express backend TypeScript into `server/dist/`.

To test the compiled production server locally:

```bash
npm run start
```

---

## Render Deployment Guide

The repository includes a verified [render.yaml](file:///c:/Apps/family-milk-account/render.yaml) blueprint to deploy the entire application as a **single Render Web Service** (Free or Starter tier).

### Architecture on Render

- **Single Web Service:** The Node.js Express process serves the REST API routes and acts as the static file server for the built React frontend (`client/dist`), handling single-page application fallback routing.
- **Database Connection:** Connects directly to an external PostgreSQL database (such as Supabase) over SSL.

### 1. Build and Start Commands

| Command Type | Verified Value |
|---|---|
| **Build Command** | `npm ci && npm --prefix client ci && npm --prefix server ci && npm run build` |
| **Start Command** | `npm run start` |
| **Health Check Path** | `/api/health` |

> **Why this build command?**  
> On a clean Linux container, running `npm ci` at the monorepo root only installs root dev dependencies. Adding `npm --prefix client ci` and `npm --prefix server ci` ensures that client and server dependencies are installed reproducibly from their respective lockfiles before the build sequence runs.

### 2. Environment Variables Configuration

Configure these environment variables in your Render Dashboard (**Environment** tab):

| Variable | Recommended Value | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Enables production security and optimizations |
| `PORT` | `10000` | Render default port for web services |
| `TZ` | `Asia/Kolkata` | Standard Indian timezone for daily milk accounting |
| `DATABASE_URL` | `postgresql://postgres.[REF]:[PASS]@[HOST]:5432/postgres` | Set as a secret in Render dashboard |
| `DATABASE_SSL` | `true` | Required for Supabase PostgreSQL connections |
| `JWT_SECRET` | Auto-generated in Render (`generateValue: true`) | Minimum 32-character cryptographically secure secret |
| `JWT_EXPIRES_IN` | `15m` | Short-lived access token duration |
| `REFRESH_TOKEN_EXPIRES_IN_DAYS` | `365` | Sliding window refresh cookie lifetime |

### 3. Database Safety & Migrations

- **Existing Production Database:** If your Supabase database already contains family accounts, milk purchases, and settlements, **do not run `npm run db:seed`**. The application starts cleanly and uses existing records without requiring seed variables.
- **Applying Schema Migrations:**
  Migrations are managed in `server/src/db/migrations/` and executed idempotently via:
  ```bash
  npm run migrate
  ```
  Only run migrations when intentionally upgrading the database schema. Migrations do not run automatically during application boot.
- **Initial Setup of an Empty Database:**
  If you are bootstrapping a completely new, empty database for the first time, you may configure `INITIAL_ADMIN_PHONE` and `INITIAL_ADMIN_PIN` in a secure shell and execute `npm run db:seed`. Never use default PINs (such as `1234`) in production.

---

## Health Check & Verification

Once deployed, the health check endpoint is available at:

```http
GET /api/health
```

Example response:

```json
{
  "status": "ok",
  "service": "family-milk-account",
  "timestamp": "2026-10-12T02:35:00.000Z",
  "uptimeSeconds": 42
}
```

---

## Security Checklist

- [x] No fixed administrator PINs or credentials stored in `render.yaml`.
- [x] No personal phone numbers or credentials hardcoded in source code or documentation.
- [x] `.env` is excluded from Git via `.gitignore`.
- [x] Short-lived JWT access tokens with rotating httpOnly refresh cookies.
- [x] Replay-attack detection with concurrent tab race condition grace periods.
- [x] Brute-force lockout protection on PIN authentication attempts.
- [x] Helmet security headers (Content Security Policy, frameguard, etc.) and API rate limiters active.

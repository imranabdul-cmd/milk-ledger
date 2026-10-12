# 🥛 Family Milk Account

A family-focused milk ledger for recording daily milk purchases, tracking rates and payments, and reviewing monthly balances. The interface is designed to be simple to use on phones as well as desktop screens.

**Repository:** [imranabdul-cmd/milk-ledger](https://github.com/imranabdul-cmd/milk-ledger)

## Features

- **Daily milk entries:** quick ½-litre and 1-litre options, with support for custom quantities.
- **Rate history:** maintain milk prices over time so older entries keep their recorded amounts.
- **Payments and balances:** record payments and track pending or credit balances.
- **Monthly summaries:** review milk quantities, charges, payments, and balances for a period.
- **Family members and permissions:** authenticated accounts with role-based access to family and accounting features.
- **Language options:** Tamil, English, and Malayalam support in the interface.
- **India time zone:** date-based accounting is configured for Asia/Kolkata.
- **Full-stack deployment setup:** the Express server can serve the built React application, with a Render configuration included in the repository.

> This project is under development. Review the implementation, environment settings, and security configuration before using it with important or production family data.

## Tech Stack

| Area | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL, configured to connect to Supabase |
| Validation and security libraries | Zod, bcryptjs, JSON Web Tokens, Helmet |
| Deployment configuration | Render |

## Repository Structure

```text
milk-ledger/
├── client/       # React + Vite frontend
├── server/       # Express API, database code, migrations and tests
├── shared/       # Types and code shared by client and server
├── render.yaml   # Render Web Service configuration
├── package.json  # Root development and build scripts
└── .env.example  # Environment-variable template
```

## Local Setup

### 1. Requirements

Install a current supported version of Node.js and npm. You will also need access to a PostgreSQL database for features that require persisted data.

### 2. Clone the repository

```bash
git clone https://github.com/imranabdul-cmd/milk-ledger.git
cd milk-ledger
```

### 3. Install dependencies

The frontend and backend have their own package files, so install the dependencies in each directory as well as at the repository root.

```bash
npm install
npm --prefix client install
npm --prefix server install
```

### 4. Configure environment variables

Copy `.env.example` to a root-level `.env` file and replace the example values with your own settings. At a minimum, configure:

- `DATABASE_URL` — PostgreSQL connection string.
- `DATABASE_SSL` — use `true` when your database requires SSL.
- `JWT_SECRET` — a unique, randomly generated secret of at least 32 characters.
- `PORT` — local API port; the default is `5000`.
- `TZ` — normally `Asia/Kolkata` for this application's date handling.

The optional `INITIAL_*` variables configure the initial family/admin bootstrap used by the seed script. Keep real credentials and PINs in `.env` or your hosting provider's secret settings, never in Git.

### 5. Prepare and check the database

Build the shared package before starting the app:

```bash
npm run build:shared
```

Check the configured database connection:

```bash
npm run db:test
```

Apply database migrations only after confirming that `DATABASE_URL` points to the intended database and that you understand the migrations being applied:

```bash
npm run migrate
```

**Important:** `npm run db:seed` is intended for an initial, empty/test database bootstrap. Do not run it against a database that already contains family members, entries, payments, or other data.

### 6. Run in development

```bash
npm run dev
```

To build the frontend and backend:

```bash
npm run build
```

To run the automated tests:

```bash
npm test
```

## Deployment Notes

A `render.yaml` configuration is included for a single Render Web Service. Before deploying:

1. Review the build and start commands against the current repository.
2. Set `DATABASE_URL` and all other secrets in Render's Environment settings.
3. Generate a strong `JWT_SECRET`; never use a sample value or a default PIN.
4. Confirm the correct database and run required migrations intentionally.
5. Verify the health endpoint at `/api/health` and test the app using non-sensitive test data.

The presence of deployment configuration in this repository does **not** mean that the app is currently deployed or that production readiness has been verified.

## Security and Data Safety

- Never commit `.env`, database passwords, JWT secrets, or administrator PINs.
- Use a separate test database while developing or testing changes.
- Back up important database data before applying schema changes.
- Review authentication, authorization, database access, session behavior, and hosting settings before exposing the app publicly.

## License

No license has been specified yet. Contact the repository owner before reusing or redistributing this project.

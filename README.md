# RecoverAI

**Recover the revenue you already earned.**

RecoverAI is an intelligent recovery platform for **failed payments, abandoned checkouts, and overdue invoices**. It runs quietly in the background for merchants and gives their customers a simple, secure way to complete or manage payments that fell through — turning "lost" revenue back into completed transactions.

The product ships as a single web app with two experiences behind one sign-in flow:

- **Merchants** get a dashboard to monitor and recover revenue.
- **Customers** get a lightweight portal to manage and retry their own payments.

> 38% average recovery lift · payments monitored at scale · bank-grade encryption · PCI DSS Level 1

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Database Setup](#database-setup)
  - [Running Locally](#running-locally)
- [Available Scripts](#available-scripts)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Features

-  **Payment recovery** — detect failed payments and abandoned checkouts, then re-engage customers to complete them.
-  **Overdue invoice tracking** — surface at-risk invoices before they become lost revenue.
-  **Dual sign-in experience** — a single auth flow that routes merchants and customers to purpose-built views.
-  **Secure by default** — authentication via Supabase, encrypted data in transit and at rest.
-  **Merchant dashboard** — visibility into recovery performance and monitored payment volume.
-  **Customer self-service** — customers can manage and retry their own payments without contacting support.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [TanStack Start](https://tanstack.com/start) (React 19) + [Vite](https://vitejs.dev/) |
| Routing | [TanStack Router](https://tanstack.com/router) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) |
| UI Components | [Radix UI](https://www.radix-ui.com/) primitives + shadcn-style components |
| Data fetching | [TanStack Query](https://tanstack.com/query) |
| Forms & validation | [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) |
| Auth & backend services | [Supabase](https://supabase.com/) |
| Database / ORM | [PostgreSQL](https://www.postgresql.org/) + [Drizzle ORM](https://orm.drizzle.team/) |
| Charts | [Recharts](https://recharts.org/) |
| Tooling | TypeScript, ESLint, Prettier, Bun |
| Hosting / project management | [Lovable](https://lovable.dev/) |


## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (or [Bun](https://bun.sh/), which this project is configured for)
- A [Supabase](https://supabase.com/) project (for auth and backend services)
- A PostgreSQL database (for Drizzle migrations)

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/bv1910/RecoverAI.git
cd RecoverAI

# using Bun (recommended — repo includes a bun.lock)
bun install

# or using npm
npm install
```

### Environment Variables

Create a `.env` file in the project root. At minimum you'll need credentials for Supabase and your Postgres database:

```env
# Supabase
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Database (used by Drizzle Kit for migrations)
LOVABLE_DB_MIGRATION_URL=your_postgres_connection_string
```

> Check the project's own `.env`/Supabase and Lovable project settings for the exact variable names your deployment expects — the ones above reflect what's referenced in `drizzle.config.ts` and the standard Supabase client setup.

### Database Setup

Generate and apply migrations with Drizzle Kit:

```bash
npx drizzle-kit generate   # generate migrations from the schema
npx drizzle-kit migrate    # apply migrations to your database
```

### Running Locally

```bash
bun run dev
# or: npm run dev
```

The app will be available at `http://localhost:5173` (default Vite port).

## Available Scripts

| Script | Description |
|---|---|
| `dev` | Start the Vite dev server |
| `build` | Build the app for production |
| `build:dev` | Build in development mode |
| `preview` | Preview the production build locally |
| `lint` | Run ESLint |
| `format` | Format the codebase with Prettier |

## Deployment

This project is connected to [Lovable](https://lovable.dev). Changes pushed to the connected branch sync back to the Lovable editor, and the app can be published directly from there.




## License

No license has been specified for this project yet. Add a `LICENSE` file to clarify usage rights, or update this section accordingly.

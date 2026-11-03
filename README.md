# Agency AMS — Connect Digitals Agency Management System

Phase 1 of the internal admin portal for Connect Digitals. Built with React + Vite + TypeScript, Tailwind CSS, and Supabase.

---

## Features Implemented

### Authentication
- Secure admin login via Supabase Auth (email + password)
- Protected routes — unauthenticated users are redirected to `/login`
- Session persistence and sign-out

### Dashboard Overview
- Total clients count
- Active projects count
- Completed projects count
- Pending projects count

### Client Management
- Add new clients
- Edit existing clients
- Archive clients (soft-delete via `archived` flag)
- View all active clients in a searchable table
- Fields: name, company, email, phone, location, notes

### Project Management
- Create new projects
- Edit existing projects
- Associate each project with a client
- Fields: title, description, service type, budget, start date, deadline, status
- Status options: Pending, In Progress, Completed, On Hold

### Design
- Connect Digitals brand colours: Navy `#000F33`, Red `#EC1C24`, Gold `#D4AF37`, Cream `#F8F4EF`, Dark `#222222`
- Responsive layout — desktop sidebar + mobile-friendly header
- Premium, minimal, clean interface

---

## Database Migrations

Two SQL migration files are located in `src/db/migrations/`. Run them in order inside the Supabase SQL editor.

| File | Purpose |
|------|---------|
| `001_create_clients.sql` | Creates the `clients` table with RLS policies |
| `002_create_projects.sql` | Creates the `projects` table with RLS policies |

Both tables have Row-Level Security enabled. Only authenticated users can read or write data.

---

## Environment Variables Required

Copy `.env.example` to `.env` and fill in your Supabase project credentials:

```
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
```

> **Never commit `.env` or expose the service-role key in the frontend.**

---

## Manual Supabase Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com) and note the Project URL and `anon` public key.

2. **Run migrations** — open the SQL editor in your Supabase dashboard and run each migration file in order:
   - `src/db/migrations/001_create_clients.sql`
   - `src/db/migrations/002_create_projects.sql`

3. **Enable Email Auth** — in the Supabase dashboard go to **Authentication → Providers** and confirm Email is enabled.

4. **Create your admin user** — in **Authentication → Users** click "Invite user" (or use "Add user") to create the admin account. No self-registration is exposed in the UI.

5. **Set environment variables** — copy `.env.example` to `.env` and paste your Project URL and `anon` key.

---

## Build and Run Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Production build (outputs to dist/)
npm run build
```

---

## Project Structure

```
agency-ams/
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx
│   │   ├── Layout.tsx
│   │   ├── ProtectedRoute.tsx
│   │   ├── ClientModal.tsx
│   │   └── ProjectModal.tsx
│   ├── context/
│   │   └── AuthContext.tsx  # Supabase auth state
│   ├── db/
│   │   └── migrations/
│   │       ├── 001_create_clients.sql
│   │       └── 002_create_projects.sql
│   ├── lib/
│   │   └── supabase.ts      # Supabase client initialisation
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── ClientsPage.tsx
│   │   └── ProjectsPage.tsx
│   ├── types/
│   │   └── index.ts         # Shared TypeScript types
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

*Phase 1 complete. Phase 2 (invoicing, reporting, additional workflows) is not yet implemented.*

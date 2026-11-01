# Implementation Plan — Connect Digitals Agency AMS (Phase 1)

## Context & Decisions

**Workspace confirmed clean:** `c:\Users\BK\Documents\Connect-saas\` contains only a bare `.git` directory. No existing source files will be touched.

**Stack decisions:**
- **React 18.3.1** over React 19 — React 19 is latest but too new for the ecosystem; all Supabase, router, and type packages are tested against React 18. This is the safe production choice.
- **Vite 5.4.21** over Vite 6/8 — Vite 5 has stable peer-dep compatibility with `@vitejs/plugin-react@4` and Tailwind 3. Vite 6 introduced breaking changes; Vite 8 requires extra config. Vite 5 just works.
- **Tailwind CSS 3.4.19** over Tailwind 4 — Tailwind 4 completely changed the config format (no more `tailwind.config.js`). The task specifies `tailwind.config.js` explicitly, so Tailwind 3 is the correct choice.
- **react-router-dom 6.30.6** — stable v6 API with `<Routes>`, `<Route>`, `<Outlet>`, `<NavLink>`, `<Navigate>`. No TanStack Router or v7 complications.
- **@supabase/supabase-js 2.118.0** — latest v2 stable. No v3 edge cases.
- **lucide-react 0.511.0** — lightweight icon library; only one used, no heavy deps. Used in Sidebar and Header.
- **No shadcn/ui, no Radix, no Headless UI** — task says avoid overengineering. All UI is Tailwind utility classes only.
- **Color token `brand_red`** (not `red`) in tailwind.config.js to avoid overriding Tailwind's built-in red scale.
- **Modal pattern**: fixed overlay div (no React portal, no external library) — simpler and sufficient for this admin app.
- **Auth pattern**: Supabase email+password only. No magic links, no OAuth. Admin-only — no signup flow in the UI.

---

## Plan

- [ ] 1. **Create project scaffold — config files and dependencies**
      Create the `agency-ams/` project root with all config and tooling files. This establishes the build system so every subsequent step has a working compiler.
      Files to create:
      - `agency-ams/package.json` — name: agency-ams, scripts: dev/build/preview, all dependencies at exact pinned versions (react@18.3.1, react-dom@18.3.1, react-router-dom@6.30.6, @supabase/supabase-js@2.118.0, lucide-react@0.511.0, typescript@5.7.2, vite@5.4.21, @vitejs/plugin-react@4.7.0, tailwindcss@3.4.19, postcss@8.5.3, autoprefixer@10.4.21, @types/react@18.3.23, @types/react-dom@18.3.7)
      - `agency-ams/index.html` — Vite HTML shell, title "Connect Digitals — Agency AMS", script src="/src/main.tsx"
      - `agency-ams/vite.config.ts` — defineConfig with react() plugin, server port 5173
      - `agency-ams/tsconfig.json` — strict, target ES2020, moduleResolution bundler, jsx react-jsx, noEmit true
      - `agency-ams/tailwind.config.js` — content glob for src/, extend colors (navy, brand_red, gold, cream, dark), fontFamily Inter
      - `agency-ams/postcss.config.js` — tailwindcss + autoprefixer plugins
      - `agency-ams/.env.example` — VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY placeholders with comment about service-role key
      - `agency-ams/.gitignore` — node_modules/, dist/, .env, .env.local, .DS_Store, *.log

      Then run `npm install` inside `agency-ams/`.
      Verify: `cd agency-ams && npm install` completes without errors; `node_modules/` is populated.

- [ ] 2. **Create entry point stubs to enable build verification**
      Create minimal source files so `npm run build` has valid entry points before any real app code is written.
      Files to create:
      - `agency-ams/src/index.css` — Google Fonts Inter import + three Tailwind directives (@tailwind base/components/utilities)
      - `agency-ams/src/main.tsx` — ReactDOM.createRoot render of `<React.StrictMode><div>Loading...</div></React.StrictMode>`

      Verify: `cd agency-ams && npm run build` exits 0 and produces `dist/index.html`.

- [ ] 3. **Create TypeScript types and Supabase client singleton**
      These two files are imported by every other source file; create them before any component.
      Files to create:
      - `agency-ams/src/types/index.ts` — export interfaces: `Client` (id, name, company, email, phone, location, notes?, is_archived, created_at, updated_at), `Project` (id, client_id, title, description?, service, budget?, start_date?, deadline?, status, created_at, updated_at), type alias `ProjectStatus = 'Pending' | 'In Progress' | 'Completed' | 'On Hold'`.
      - `agency-ams/src/lib/supabase.ts` — createClient singleton reading VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from import.meta.env; throws a descriptive Error if either is missing. Never imports or uses the service-role key.

      Verify: `npm run build` still exits 0 (no TS errors in the new files).

- [ ] 4. **Create AuthContext, ProtectedRoute, and stub pages for routing**
      Establish auth state management and a working router structure so all remaining UI can be built inside the correct context.
      Files to create:
      - `agency-ams/src/context/AuthContext.tsx` — AuthContextType interface (user, loading, signIn, signOut); AuthProvider uses useState+useEffect; getSession on mount; onAuthStateChange subscription with cleanup; signIn calls signInWithPassword; signOut calls supabase.auth.signOut. Export `useAuth` hook that throws if used outside provider.
      - `agency-ams/src/components/ProtectedRoute.tsx` — reads useAuth(); shows spinner on loading; redirects to /login if no user; renders `<Outlet />` if authenticated.
      - `agency-ams/src/pages/DashboardPage.tsx` — stub: `export default function DashboardPage() { return <div className="p-6 text-dark">Dashboard</div>; }`
      - `agency-ams/src/pages/ClientsPage.tsx` — stub: `export default function ClientsPage() { return <div className="p-6 text-dark">Clients</div>; }`
      - `agency-ams/src/pages/ProjectsPage.tsx` — stub: `export default function ProjectsPage() { return <div className="p-6 text-dark">Projects</div>; }`
      - `agency-ams/src/App.tsx` — BrowserRouter > AuthProvider > Routes: `/login` → LoginPage (stub), `/` → ProtectedRoute > Layout > [index→Dashboard, clients→Clients, projects→Projects]. Import Layout as stub for now.
      - `agency-ams/src/pages/LoginPage.tsx` — stub for now (just returns `<div>Login</div>`)
      - `agency-ams/src/components/Layout.tsx` — stub: just renders `<Outlet />`
      - Update `agency-ams/src/main.tsx` — render `<App />` wrapped in `<React.StrictMode>`.

      Verify: `npm run build` exits 0.

- [ ] 5. **Create layout shell components: Sidebar, Header, Layout**
      Build the responsive navigation shell. These components wrap all authenticated pages.
      Files to modify/create:
      - `agency-ams/src/components/Sidebar.tsx` — Props: `isOpen: boolean; onClose: () => void`. Desktop: fixed left bar, collapses to 64px (icon-only) and expands to 240px on group hover via Tailwind transition. Background: `bg-navy`. Logo: 'CD' monogram gold collapsed, 'Connect Digitals' expanded. NavLinks (react-router-dom NavLink): Dashboard (`/`, LayoutDashboard icon), Clients (`/clients`, Users icon), Projects (`/projects`, Briefcase icon). Active link: gold left border + bg-white/5. Bottom: sign-out button (LogOut icon). Mobile: absolute overlay panel that slides in when `isOpen=true`, close on backdrop click calls `onClose`. All icons from lucide-react.
      - `agency-ams/src/components/Header.tsx` — Props: `onMenuToggle: () => void; title: string`. Renders only on mobile (hidden md:hidden class on wrapper). Hamburger `Menu` icon left, page title center, bg-navy text-cream.
      - `agency-ams/src/components/Layout.tsx` (replace stub) — useState for `sidebarOpen`. Renders: Header (mobile), Sidebar, `<main>` with `bg-cream min-h-screen`. On mobile when sidebarOpen, renders a fixed dark overlay that closes sidebar. The `<main>` has `md:ml-16` margin to accommodate collapsed sidebar.

      Verify: `npm run build` exits 0.

- [ ] 6. **Create LoginPage (full implementation)**
      Replace the LoginPage stub with the real implementation.
      File to modify:
      - `agency-ams/src/pages/LoginPage.tsx` — Full-screen navy background. Centered white card (max-w-sm, rounded-xl, shadow-xl, p-8). Top: "Connect Digitals" heading (gold) + "Agency Management" subheading (cream). Email input + Password input (both required, show validation error if submitted empty). Submit button: bg-brand_red text-white w-full rounded-lg py-3 font-semibold. On submit: call signIn(email, password); if throws, show error message inline below button. After success, navigate('/') using useNavigate. If user is already logged in (check useAuth), redirect to '/' immediately.

      Verify: `npm run build` exits 0.

- [ ] 7. **Create ClientModal component**
      Reusable modal for creating and editing clients.
      File to create:
      - `agency-ams/src/components/ClientModal.tsx` — Props: `isOpen: boolean; onClose: () => void; client?: Client; onSaved: (client: Client) => void`. Fixed overlay (inset-0, bg-black/50, z-50) with centered card (bg-white, max-w-lg, rounded-xl, p-6). Form fields: Name (required), Company, Email, Phone, Location, Notes (textarea). On submit: if `client?.id` → `supabase.from('clients').update({name,company,email,phone,location,notes}).eq('id',client.id).select().single()`; else → `.insert({...}).select().single()`. On success: call `onSaved(data)` then `onClose()`. On error: show inline error message. Cancel button calls onClose. Close on backdrop click. Submit button: 'Save Client' in bg-navy text-cream.

      Verify: `npm run build` exits 0.

- [ ] 8. **Create ProjectModal component**
      Reusable modal for creating and editing projects.
      File to create:
      - `agency-ams/src/components/ProjectModal.tsx` — Props: `isOpen: boolean; onClose: () => void; project?: Project; clients: Client[]; onSaved: (project: Project) => void`. Same overlay pattern as ClientModal. Form fields: Title (required text), Client (required `<select>` populated from `clients` prop showing client.name, value=client.id), Service (required text), Status (`<select>` with Pending/In Progress/Completed/On Hold options, default Pending), Description (textarea), Budget (number input, min=0, step=0.01), Start Date (date input), Deadline (date input). On submit: insert or update in `projects` table. Same error/success pattern.

      Verify: `npm run build` exits 0.

- [ ] 9. **Implement DashboardPage**
      Replace the dashboard stub with the full stat overview page.
      File to modify:
      - `agency-ams/src/pages/DashboardPage.tsx` — On mount, fetch four counts in parallel with Promise.all: total non-archived clients, active (In Progress) projects, completed projects, pending projects — using `{ count: 'exact', head: true }` select pattern. Show four stat cards in a responsive grid (grid-cols-2 md:grid-cols-4): each card has icon, label, count, and a colored left border (navy/gold/brand_red/green). Below: fetch 5 most-recent projects with client name via `supabase.from('projects').select('title, status, deadline, clients!inner(name)').order('created_at',{ascending:false}).limit(5)`. Render in a white rounded card as a table (desktop) / stacked cards (mobile). Status badge: pill with class based on status value. Show loading skeleton (animated pulse divs) while fetching. Show error state if fetch fails.

      Verify: `npm run build` exits 0.

- [ ] 10. **Implement ClientsPage**
       Replace the clients stub with the full client management page.
       File to modify:
       - `agency-ams/src/pages/ClientsPage.tsx` — Fetch non-archived clients on mount: `supabase.from('clients').select('*').eq('is_archived',false).order('name')`. Local state: `clients: Client[]`, `loading: boolean`, `modalOpen: boolean`, `editingClient: Client | undefined`. Header: page title "Clients" + "Add Client" button (bg-brand_red). Table columns (desktop): Name, Company, Email, Phone, Location, Actions. Mobile: cards. Each row: Edit icon button (PencilLine from lucide) opens modal with client, Archive button (Archive icon) shows a confirmation inline or window.confirm, then calls `supabase.from('clients').update({is_archived:true}).eq('id',id)` and removes from local state. `onSaved` handler: if editingClient was set, replace item in array; else prepend. Empty state: "No active clients. Add your first client." Loading spinner while fetching.

       Verify: `npm run build` exits 0.

- [ ] 11. **Implement ProjectsPage**
       Replace the projects stub with the full project management page.
       File to modify:
       - `agency-ams/src/pages/ProjectsPage.tsx` — Fetch projects with client name and fetch all active clients (for modal) on mount using Promise.all. Local state: `projects`, `clients`, `loading`, `modalOpen`, `editingProject`, `statusFilter: ProjectStatus | 'All'`. Header: "Projects" title + "Add Project" button. Status filter pill bar: "All | Pending | In Progress | Completed | On Hold" — filters displayed list client-side. Table columns (desktop): Title, Client (from joined data), Service, Status badge, Deadline, Budget (formatted as currency), Actions (Edit button). Mobile: stacked cards. `onSaved` handler: prepend or replace. Empty state message.

       Verify: `npm run build` exits 0.

- [ ] 12. **Create SQL migration files**
       Create the two Supabase migration files. These are SQL-only files; no code changes needed.
       Files to create:
       - `agency-ams/src/db/migrations/001_create_clients.sql`:
         ```sql
         CREATE TABLE public.clients (
           id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
           name text NOT NULL,
           company text NOT NULL DEFAULT '',
           email text NOT NULL DEFAULT '',
           phone text NOT NULL DEFAULT '',
           location text NOT NULL DEFAULT '',
           notes text,
           is_archived boolean NOT NULL DEFAULT false,
           created_at timestamptz NOT NULL DEFAULT now(),
           updated_at timestamptz NOT NULL DEFAULT now()
         );

         ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

         CREATE POLICY "Authenticated admins only"
           ON public.clients FOR ALL
           TO authenticated
           USING (true)
           WITH CHECK (true);

         CREATE OR REPLACE FUNCTION public.handle_updated_at()
           RETURNS trigger LANGUAGE plpgsql AS $$
           BEGIN NEW.updated_at = now(); RETURN NEW; END;
         $$;

         CREATE TRIGGER clients_updated_at
           BEFORE UPDATE ON public.clients
           FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
         ```
       - `agency-ams/src/db/migrations/002_create_projects.sql`:
         ```sql
         CREATE TABLE public.projects (
           id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
           client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
           title text NOT NULL,
           description text,
           service text NOT NULL DEFAULT '',
           budget numeric(12,2),
           start_date date,
           deadline date,
           status text NOT NULL DEFAULT 'Pending'
             CHECK (status IN ('Pending','In Progress','Completed','On Hold')),
           created_at timestamptz NOT NULL DEFAULT now(),
           updated_at timestamptz NOT NULL DEFAULT now()
         );

         CREATE INDEX projects_client_id_idx ON public.projects(client_id);
         CREATE INDEX projects_status_idx ON public.projects(status);

         ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

         CREATE POLICY "Authenticated admins only"
           ON public.projects FOR ALL
           TO authenticated
           USING (true)
           WITH CHECK (true);

         CREATE TRIGGER projects_updated_at
           BEFORE UPDATE ON public.projects
           FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
         ```

       Verify: `npm run build` exits 0 (SQL files don't affect TypeScript build but confirm they exist with correct structure for manual Supabase execution).

- [ ] 13. **Final build verification and polish**
       Run the full build clean and confirm the complete app is production-ready.
       - Run `npm run build` inside `agency-ams/` — must exit 0 with no TypeScript errors and no Vite warnings about missing modules.
       - Run `npm run dev` and confirm the dev server starts on port 5173 and the login page renders in the browser.
       - Confirm no `VITE_SUPABASE_URL` or key values are hardcoded anywhere in `src/` (only `import.meta.env.*` references).
       - Confirm `.env` is not present (only `.env.example`).

       Verify: `npm run build` exits 0, `dist/index.html` exists, `dist/assets/` contains JS and CSS bundles.

---

## Environment Variables Required

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Create a `.env` file in `agency-ams/` with these values. Never commit it.

## Manual Supabase Setup Required

1. Create a Supabase project at supabase.com.
2. In the Supabase SQL editor, run `001_create_clients.sql` then `002_create_projects.sql` in order.
3. In Supabase Authentication → Settings, disable email confirmations if you want immediate login.
4. In Supabase Authentication → Users, create your admin user manually (or use the Supabase dashboard invite).
5. Copy your project URL and anon key from Supabase Settings → API into the `.env` file.

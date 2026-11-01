# Implementation Plan — Phase 2: Connect Digitals Agency AMS

> Admin UUID used throughout: `9705a671-4d69-49bb-b5f9-7f69cad4f0f8`
> Build command: `npm run build` (tsc + vite build) — must exit 0.
> All files are inside `c:\Users\BK\Documents\Connect-saas\agency-ams\`.

---

## Ordering constraints

- [ F ] StatusBadge component must be created before any Phase 2 page imports it.
- [ H ] TypeScript types must be extended before any Phase 2 page is written.
- [ G ] SQL migrations are file-only; no execution. No ordering dependency on UI.
- [ J ] Print CSS has no UI dependencies; can be done any time.
- [ E ] Sidebar update has no dependency on new pages (nav items use to= paths).
- [ D ] Dashboard update requires the StatusBadge to already exist (it currently has its own inline copy — after extraction the inline copy is removed).
- [ A,B,C ] Proposals / Contracts / Portal pages depend on H (types) and F (StatusBadge).
- [ I ] App.tsx routing update must happen after all new page files exist.

---

## Step-by-step plan

- [ ] 1. **Extract StatusBadge into a reusable component**
      Create `src/components/StatusBadge.tsx`. The component accepts `status: string` and an optional `colorMap: Record<string, string>` prop. When `colorMap` is omitted it defaults to the ProjectStatus colour set (Pending/In Progress/Completed/On Hold). For proposal statuses a different colour map will be passed by the caller.
      Remove the inline `StatusBadge` function from `src/pages/DashboardPage.tsx` and `src/pages/ProjectsPage.tsx`. Add `import StatusBadge from '../components/StatusBadge'` to both files.
      Files: `src/components/StatusBadge.tsx`, `src/pages/DashboardPage.tsx`, `src/pages/ProjectsPage.tsx`
      Verify: `npm run build` — zero TypeScript errors, build exits 0.

- [ ] 2. **Extend TypeScript types**
      Add to `src/types/index.ts`:
      - `ProposalStatus = 'Draft' | 'Sent' | 'Accepted' | 'Changes Requested' | 'Rejected'`
      - `ProposalResponseAction = 'Accepted' | 'Changes Requested' | 'Rejected'`
      - `ProposalItem` interface: `{ id: string; description: string; quantity: number; unit_price: number; subtotal: number }`
      - `Proposal` interface: `{ id, client_id, title, introduction?, deliverables?, terms?, items: ProposalItem[], total_amount, currency, expiry_date?, status: ProposalStatus, portal_token, created_at, updated_at, client?: Client }`
      - `ProposalResponse` interface: `{ id, proposal_id, action: ProposalResponseAction, comment?, responded_at }`
      - `ContractContent` interface: `{ client_name, client_company, client_email, proposal_title, items: ProposalItem[], total_amount, currency, deliverables?, terms?, issued_at, accepted_at? }`
      - `Contract` interface: `{ id, proposal_id, client_id, content: ContractContent, status: 'Draft' | 'Active', created_at, updated_at }`
      Files: `src/types/index.ts`
      Verify: `npm run build` — zero TypeScript errors.

- [ ] 3. **SQL migration 003 — agency_proposals table**
      Create `src/db/migrations/003_create_agency_proposals.sql`.
      Table `agency_proposals`: id uuid PK, client_id uuid FK → agency_clients ON DELETE RESTRICT, title text NOT NULL, introduction text, deliverables text, terms text, items JSONB NOT NULL DEFAULT '[]', total_amount numeric(14,2) NOT NULL DEFAULT 0, currency text NOT NULL DEFAULT 'ETB', expiry_date date, status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Sent','Accepted','Changes Requested','Rejected')), portal_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32),'hex'), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now().
      Indexes: on client_id, on status, on portal_token.
      RLS enabled; four admin-only policies (SELECT/INSERT/UPDATE/DELETE) checking `auth.uid() = '9705a671-4d69-49bb-b5f9-7f69cad4f0f8'::uuid`.
      Trigger reuses `agency_handle_updated_at()` from migration 001.
      Files: `src/db/migrations/003_create_agency_proposals.sql`
      Verify: file created, build still exits 0 (SQL files are not compiled).

- [ ] 4. **SQL migration 004 — agency_proposal_responses table**
      Create `src/db/migrations/004_create_agency_proposal_responses.sql`.
      Table `agency_proposal_responses`: id uuid PK, proposal_id uuid FK → agency_proposals ON DELETE CASCADE, action text NOT NULL CHECK (action IN ('Accepted','Changes Requested','Rejected')), comment text, responded_at timestamptz NOT NULL DEFAULT now().
      Unique constraint on proposal_id (one response per proposal — prevents repeated submissions from manipulating proposal status).
      RLS enabled. No SELECT/INSERT policy for authenticated (admin reads via `get_portal_data` RPC). INSERT for `anon` role is intentionally NOT granted here — only via the security-definer RPC. Admin SELECT only (auth.uid() = admin UUID).
      Files: `src/db/migrations/004_create_agency_proposal_responses.sql`
      Verify: file created, build exits 0.

- [ ] 5. **SQL migration 005 — agency_contracts table**
      Create `src/db/migrations/005_create_agency_contracts.sql`.
      Table `agency_contracts`: id uuid PK, proposal_id uuid FK → agency_proposals ON DELETE RESTRICT UNIQUE (one contract per proposal), client_id uuid FK → agency_clients ON DELETE RESTRICT, content JSONB NOT NULL, status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Active')), created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now().
      Indexes on client_id, proposal_id.
      RLS enabled; admin-only policies for SELECT/INSERT/UPDATE/DELETE.
      Trigger reuses `agency_handle_updated_at()`.
      Files: `src/db/migrations/005_create_agency_contracts.sql`
      Verify: file created, build exits 0.

- [ ] 6. **SQL migration 006 — portal RPC functions**
      Create `src/db/migrations/006_portal_functions.sql`.
      Two SECURITY DEFINER functions with fixed `search_path = public, pg_temp`:

      **`get_portal_data(p_token text)`** — Returns JSONB of `{ proposal, client (safe fields only: name, company, email), responses, contract (if exists), project (if linked via client_id) }`. Validates token exists AND proposal status != 'Draft'. Returns NULL (not error) if not found/draft. Never returns data from other clients.

      **`submit_proposal_response(p_token text, p_action text, p_comment text)`** — Inserts into `agency_proposal_responses` and updates `agency_proposals.status`. Validates: token exists, status is 'Sent' (not already responded), action is one of the three valid values. Returns error JSON `{ "error": "..." }` on validation failure. Uses `INSERT ... ON CONFLICT DO NOTHING` to be idempotent — but checks for existing response first and returns an error if one already exists (prevents repeated submissions).

      Both functions: `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC; GRANT EXECUTE ON FUNCTION ... TO anon, authenticated;`
      Files: `src/db/migrations/006_portal_functions.sql`
      Verify: file created, build exits 0.

- [ ] 7. **Update Sidebar with Proposals nav item**
      In `src/components/Sidebar.tsx`, add `FileText` to the lucide-react import. Add `{ to: '/proposals', label: 'Proposals', icon: FileText, end: false }` to `navItems` between Projects and the Sign Out button.
      Files: `src/components/Sidebar.tsx`
      Verify: `npm run build` — exits 0.

- [ ] 8. **Update Layout with new page title mappings**
      In `src/components/Layout.tsx`, add entries to `PAGE_TITLES`: `'/proposals': 'Proposals'`, `'/proposals/new': 'New Proposal'`, `'/contracts': 'Contracts'`. These provide the mobile header title. (Detail and editor pages will have more dynamic titles but this covers the static ones.)
      Files: `src/components/Layout.tsx`
      Verify: `npm run build` — exits 0.

- [ ] 9. **Add print CSS to index.css**
      Append to `src/index.css`:
      ```css
      @media print {
        .no-print { display: none !important; }
        body { background: white !important; }
      }
      ```
      Files: `src/index.css`
      Verify: `npm run build` — exits 0.

- [ ] 10. **Create ProposalsPage**
       Create `src/pages/ProposalsPage.tsx`.
       Features:
       - Fetch all proposals from `agency_proposals` with `select('*, agency_clients(name)')`, ordered by `created_at desc`.
       - Status filter pills: All / Draft / Sent / Accepted / Changes Requested / Rejected (matching ProjectsPage pattern).
       - "New Proposal" button (top right, `bg-brand_red` style) navigates to `/proposals/new`.
       - Table columns: Title, Client, Total (ETB, formatted with `Intl.NumberFormat`), Status (uses `StatusBadge` with proposal colour map), Expiry, Created.
       - Click anywhere on a row navigates to `/proposals/:id` (ProposalDetailPage).
       - Loading spinner and empty state follow existing patterns.
       Files: `src/pages/ProposalsPage.tsx`
       Verify: `npm run build` — exits 0.

- [ ] 11. **Create ProposalEditorPage**
       Create `src/pages/ProposalEditorPage.tsx`.
       Features:
       - Used for both `/proposals/new` and `/proposals/:id/edit`.
       - Detects edit vs. new from `useParams()` — if `:id` present, fetches existing proposal on mount.
       - Form fields: Title (required), Client dropdown (required, lists active clients), Introduction (textarea), Deliverables (textarea), Terms (textarea), Expiry Date (date input).
       - Line items table: each row has Description, Quantity (number), Unit Price (number), Subtotal (auto-calculated = qty × price, read-only). Add Row button, Delete Row button per row. Total displayed below table.
       - Two action buttons: "Save as Draft" (sets status='Draft', or keeps existing status for edits) and "Publish" (sets status='Sent').
       - If proposal status is not 'Draft' (i.e. already Sent/Accepted/etc.), entire form is read-only with a banner: "This proposal has been published and cannot be edited." — show Edit button only on ProposalDetailPage, not here.
       - On save, insert or update `agency_proposals`. Items stored as JSONB array. Navigate to `/proposals/:id` after successful save.
       - `portal_token` is generated by the database default on INSERT; never set from frontend.
       Files: `src/pages/ProposalEditorPage.tsx`
       Verify: `npm run build` — exits 0.

- [ ] 12. **Create ProposalDetailPage**
       Create `src/pages/ProposalDetailPage.tsx`.
       Features:
       - Route: `/proposals/:id`. Fetches proposal with `select('*, agency_clients(name, company, email)')` and separately fetches associated responses and contract.
       - Display: title, client name/company, status badge, items table, total, deliverables, terms, expiry.
       - Portal link section: shows full URL `${window.location.origin}/portal/${proposal.portal_token}` with a "Copy Link" button (uses `navigator.clipboard.writeText`).
       - Client responses: if `agency_proposal_responses` row exists, show action badge, comment, and timestamp.
       - "Generate Contract" button: visible only when `status === 'Accepted'` AND no contract exists yet. Calls `supabase.from('agency_contracts').insert(...)` — snapshots all fields from the proposal + client at generation time into the `content` JSONB column. Navigates to `/contracts/:id` on success.
       - "Edit" button: visible only when `status === 'Draft'`. Navigates to `/proposals/:id/edit`.
       - Back link to `/proposals`.
       Files: `src/pages/ProposalDetailPage.tsx`
       Verify: `npm run build` — exits 0.

- [ ] 13. **Create ContractPage**
       Create `src/pages/ContractPage.tsx`.
       Features:
       - Route: `/contracts/:id`. Fetches `agency_contracts` row by id. Content comes from the `content` JSONB column (type `ContractContent`).
       - Display: Connect Digitals logo/wordmark at top, contract header section (client name, company, email, issue date), services table (items from `content.items`), total amount, deliverables, terms.
       - "Print / Download" button: calls `window.print()`. Button has `no-print` class so it disappears in print. Sidebar and Header are hidden in print via `no-print` class (apply `no-print` class to `<Sidebar>` and `<Header>` elements in Layout — see note below).
       - Note on `no-print` in Layout: the `.no-print` CSS class from Step 9 handles hiding. ContractPage itself applies `no-print` to its own buttons. The Sidebar and Header already receive the class because they are rendered by Layout — add `className="no-print"` to the `<Sidebar>` wrapper div and `<Header>` element in `Layout.tsx`. This is the cleanest approach: layout adds `no-print` once, every page benefits.
       Files: `src/pages/ContractPage.tsx`, `src/components/Layout.tsx` (add `no-print` to sidebar wrapper and header)
       Verify: `npm run build` — exits 0.

- [ ] 14. **Create ClientPortalPage**
       Create `src/pages/ClientPortalPage.tsx`.
       Features:
       - Route: `/portal/:token`. Fully public — no auth check, no ProtectedRoute.
       - On mount, calls `supabase.rpc('get_portal_data', { p_token: token })`. If result is null or error, renders graceful "Invalid or expired link" message with Connect Digitals branding.
       - Displays proposal details: title, client name, intro, items table (read-only), total in ETB, deliverables, terms, expiry.
       - Action section (shown only if proposal status is 'Sent'): three buttons — Accept, Request Changes, Reject — plus a comment textarea. On submit, calls `supabase.rpc('submit_proposal_response', { p_token: token, p_action: action, p_comment: comment })`. On success, reloads portal data (re-fetches) and shows confirmation message. Disables buttons while submitting.
       - If response already exists, shows the existing response (action + comment + date) and hides the action buttons.
       - Tabs (if data available): Proposal (default) | Contract (if `contract` in data) | Project (if `project` in data).
       - No admin chrome: no Sidebar, no Header, no ProtectedRoute. Page has its own full-page layout with Connect Digitals wordmark at top (gold on navy background), cream body.
       - Handles invalid token, expired proposal, and network errors gracefully.
       Files: `src/pages/ClientPortalPage.tsx`
       Verify: `npm run build` — exits 0.

- [ ] 15. **Update Dashboard — 5th stat card**
       In `src/pages/DashboardPage.tsx`:
       - Add `FileText` to the lucide-react import.
       - Add `awaitingResponse: number` to the `Stats` interface.
       - Add a 5th parallel Supabase count query: `countProposals('Sent')` — counts `agency_proposals` where `status = 'Sent'`.
       - Add a 5th stat card to `statCards` array: label `'Awaiting Response'`, value `stats?.awaitingResponse ?? 0`, icon `<FileText size={22} className="text-navy" />`, accent `border-navy`.
       - Update the stat cards grid div from `lg:grid-cols-4` to `lg:grid-cols-5`. Update the skeleton loader from `length: 4` to `length: 5`.
       Files: `src/pages/DashboardPage.tsx`
       Verify: `npm run build` — exits 0.

- [ ] 16. **Update App.tsx routing**
       Add all Phase 2 routes to `src/App.tsx`:
       ```
       // Inside ProtectedRoute > Layout:
       <Route path="proposals" element={<ProposalsPage />} />
       <Route path="proposals/new" element={<ProposalEditorPage />} />
       <Route path="proposals/:id" element={<ProposalDetailPage />} />
       <Route path="proposals/:id/edit" element={<ProposalEditorPage />} />
       <Route path="contracts/:id" element={<ContractPage />} />

       // Outside ProtectedRoute (public):
       <Route path="/portal/:token" element={<ClientPortalPage />} />
       ```
       Add all required imports.
       Files: `src/App.tsx`
       Verify: `npm run build` — exits 0 with no missing-module errors.

- [ ] 17. **Final production build verification**
       Run `npm run build` from `agency-ams/`. Confirm exit 0, no TypeScript errors, dist/ produced. Record the output in the FEAT findings.
       Files: none (verification only)
       Verify: `npm run build` exits 0.

---

## Risk notes

1. **`noUnusedLocals` / `noUnusedParameters`** — TypeScript strict mode is on. Every imported type, variable, and parameter in new files must be used. Watch especially in ProposalEditorPage (complex form state) and ContractPage (JSONB casting).

2. **Supabase anon key for portal** — The portal page uses the same `supabase` singleton (anon key). The security-definer RPCs are the only way the portal reads or writes data; no direct table access from `anon` role is permitted. This is correct and safe.

3. **`portal_token` uniqueness** — Generated as `encode(gen_random_bytes(32),'hex')` — 64 hex chars = 256 bits of entropy. Supabase's `gen_random_bytes` uses a CSPRNG. Unguessable in practice.

4. **One response per proposal** — The UNIQUE constraint on `proposal_id` in `agency_proposal_responses` enforces this at the database level, not just at the RPC level. Belt-and-suspenders.

5. **Contract generation is idempotent-safe** — The UNIQUE constraint on `proposal_id` in `agency_contracts` prevents duplicate contracts at the DB layer. The frontend also checks for existence before showing the Generate button.

6. **Print CSS scope** — `.no-print { display: none !important }` hides sidebar, header, and buttons during `window.print()`. Layout.tsx adds `no-print` class to the sidebar `<aside>` and `<header>` elements so all admin pages automatically suppress chrome on print, not just ContractPage.

7. **`items` JSONB default** — `ProposalItem.id` is a client-generated UUID (use `crypto.randomUUID()` in ProposalEditorPage) since JSONB array items have no DB-managed identity. This is correct; the field is for display/ordering only.

8. **Admin UUID** — All RLS policies use `9705a671-4d69-49bb-b5f9-7f69cad4f0f8`. Migration 001 and 002 used the older UUID `8662a535-fa9b-4e26-8c5d-193992607121`. Phase 2 migrations must use the confirmed Phase 2 admin UUID. Do NOT change Phase 1 migrations.

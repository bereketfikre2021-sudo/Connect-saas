import { useState } from 'react';
import { Outlet, useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import Sidebar from './Sidebar';
import Header from './Header';

// Maps path segments to human-readable labels
const SEGMENT_LABELS: Record<string, string> = {
  clients: 'Clients',
  projects: 'Projects',
  proposals: 'Proposals',
  contracts: 'Contracts',
  invoices: 'Invoices',
  payments: 'Payments',
  settings: 'Settings',
  new: 'New',
  edit: 'Edit',
};

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/clients': 'Clients',
  '/projects': 'Projects',
  '/proposals': 'Proposals',
  '/proposals/new': 'New Proposal',
  '/invoices': 'Invoices',
  '/invoices/new': 'New Invoice',
  '/payments': 'Payments',
  '/settings': 'Settings',
  '/tasks': 'Tasks',
  '/creatives': 'Creative Approvals',
  '/files': 'File Library',
};

interface Crumb {
  label: string;
  to: string;
  navigable: boolean;
}

// Segments that have no list page — breadcrumb shows label but not as a link
const NON_NAVIGABLE = new Set(['contracts']);

function buildBreadcrumbs(pathname: string): Crumb[] {
  if (pathname === '/') return [];

  const segments = pathname.split('/').filter(Boolean);
  const crumbs: Crumb[] = [];
  let path = '';

  for (const seg of segments) {
    path += `/${seg}`;
    const isUuid = /^[0-9a-f-]{36}$/.test(seg);
    const label = isUuid ? 'Detail' : (SEGMENT_LABELS[seg] ?? seg);
    crumbs.push({ label, to: path, navigable: !isUuid && !NON_NAVIGABLE.has(seg) });
  }

  return crumbs;
}

function Breadcrumb() {
  const { pathname } = useLocation();
  const crumbs = buildBreadcrumbs(pathname);

  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-gray-500 mb-4 flex-wrap">
      <Link
        to="/"
        className="flex items-center gap-1 hover:text-navy transition-colors"
      >
        <Home size={13} />
        <span>Home</span>
      </Link>
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={crumb.to} className="flex items-center gap-1">
            <ChevronRight size={13} className="text-gray-300" />
            {isLast ? (
              <span className="text-dark font-medium">{crumb.label}</span>
            ) : crumb.navigable ? (
              <Link to={crumb.to} className="hover:text-navy transition-colors">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-gray-500">{crumb.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const title = PAGE_TITLES[location.pathname] ?? 'Agency AMS';

  return (
    <div className="flex h-screen overflow-hidden bg-cream">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main area — offset by desktop sidebar width */}
      <div className="flex flex-col flex-1 md:ml-16 overflow-hidden">
        <div className="no-print">
          <Header title={title} onMenuToggle={() => setSidebarOpen(true)} />
        </div>

        <main className="flex-1 overflow-y-auto bg-cream p-6">
          <div className="no-print">
            <Breadcrumb />
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

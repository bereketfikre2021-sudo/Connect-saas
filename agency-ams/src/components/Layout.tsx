import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/clients': 'Clients',
  '/projects': 'Projects',
  '/proposals': 'Proposals',
  '/proposals/new': 'New Proposal',
};

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
          <Outlet />
        </main>
      </div>
    </div>
  );
}

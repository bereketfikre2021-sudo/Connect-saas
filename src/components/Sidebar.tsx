import { NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard, Users, Briefcase, FileText, Receipt, CreditCard,
  Settings, CheckSquare, Layers, FolderOpen, ClipboardList,
  LogOut, X, ChevronDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NavItem { to: string; label: string; icon: React.ElementType; end?: boolean; }
interface NavGroup { label: string; items: NavItem[]; }

const NAV: NavGroup[] = [
  {
    label: '',
    items: [{ to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true }],
  },
  {
    label: 'Work',
    items: [
      { to: '/clients',  label: 'Clients',  icon: Users },
      { to: '/projects', label: 'Projects', icon: Briefcase },
      { to: '/tasks',    label: 'Tasks',    icon: CheckSquare },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/quotations', label: 'Quotations', icon: ClipboardList },
      { to: '/proposals',  label: 'Proposals',  icon: FileText },
      { to: '/invoices',   label: 'Invoices',   icon: Receipt },
      { to: '/payments',   label: 'Payments',   icon: CreditCard },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: '/creatives', label: 'Creatives', icon: Layers },
      { to: '/files',     label: 'Files',     icon: FolderOpen },
    ],
  },
  {
    label: 'Admin',
    items: [{ to: '/settings', label: 'Settings', icon: Settings }],
  },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { signOut } = useAuth();
  const { pathname } = useLocation();

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    NAV.forEach(g => {
      if (!g.label) return;
      init[g.label] = g.items.some(i =>
        i.end ? pathname === i.to : pathname.startsWith(i.to)
      );
    });
    return init;
  });

  const toggle = (label: string) =>
    setOpenGroups(p => ({ ...p, [label]: !p[label] }));

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={onClose} />
      )}

      <aside className={[
        'fixed top-0 left-0 h-full z-30 flex flex-col bg-navy text-cream overflow-hidden',
        'transition-all duration-300 ease-in-out no-print',
        'md:w-16 md:hover:w-60 group',
        isOpen ? 'w-60' : 'w-0 md:w-16',
      ].join(' ')}>

        {/* Mobile close */}
        <div className="flex items-center justify-between px-4 py-4 md:hidden">
          <span className="text-gold font-bold text-lg">Connect Digitals</span>
          <button onClick={onClose} className="text-cream hover:text-gold" aria-label="Close menu">
            <X size={20} />
          </button>
        </div>

        {/* Logo — desktop */}
        <div className="hidden md:flex items-center h-16 px-4 border-b border-white/10 shrink-0">
          <span className="text-gold font-bold text-xl min-w-[32px] text-center group-hover:hidden">CD</span>
          <span className="text-gold font-bold text-base whitespace-nowrap hidden group-hover:block">Connect Digitals</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden">
          {NAV.map(group => {
            const isOpen_ = !group.label || (openGroups[group.label] ?? false);

            return (
              <div key={group.label || 'home'}>
                {/* Group header — only for labelled groups, only visible when expanded */}
                {group.label && (
                  <button
                    onClick={() => toggle(group.label)}
                    className={[
                      'w-full flex items-center px-4 py-1.5 mt-2 transition-colors',
                      'text-cream/40 hover:text-cream/60',
                      // hidden when collapsed on desktop; visible on mobile and expanded desktop
                      'md:hidden md:group-hover:flex',
                    ].join(' ')}
                  >
                    <span className="flex-1 text-xs font-semibold uppercase tracking-widest text-left">
                      {group.label}
                    </span>
                    <ChevronDown
                      size={12}
                      className={`transition-transform shrink-0 ${isOpen_ ? 'rotate-180' : ''}`}
                    />
                  </button>
                )}

                {/* Items — always show on collapsed desktop (icons only); respect open state otherwise */}
                {group.items.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onClose}
                    className={({ isActive }) => [
                      'flex items-center gap-3 px-4 transition-colors hover:bg-white/10',
                      // On desktop collapsed: show all icons at reduced padding; on expanded: respect group open
                      // We use a trick: always render but hide text when group is closed on expanded sidebar
                      isActive
                        ? 'text-gold border-l-2 border-gold bg-white/5'
                        : 'text-cream/80 border-l-2 border-transparent',
                      // Collapsed: compact py; expanded: normal py
                      'py-2.5',
                      // Hide entirely on expanded sidebar + mobile when group is closed (but not on collapsed desktop)
                      !isOpen_ && group.label
                        ? 'md:flex md:group-hover:hidden'
                        : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <item.icon size={18} className="shrink-0" />
                    <span className="whitespace-nowrap text-sm font-medium md:hidden md:group-hover:block block">
                      {item.label}
                    </span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="border-t border-white/10 p-4 shrink-0">
          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 w-full text-cream/80 hover:text-brand_red transition-colors py-2"
            aria-label="Sign out"
          >
            <LogOut size={20} className="shrink-0" />
            <span className="whitespace-nowrap text-sm font-medium md:hidden md:group-hover:block block">
              Sign Out
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}

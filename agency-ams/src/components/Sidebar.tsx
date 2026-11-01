import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, Briefcase, LogOut, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/clients', label: 'Clients', icon: Users, end: false },
  { to: '/projects', label: 'Projects', icon: Briefcase, end: false },
];

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { signOut } = useAuth();

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={[
          // Base styles
          'fixed top-0 left-0 h-full z-30 flex flex-col',
          'bg-navy text-cream overflow-hidden',
          'transition-all duration-300 ease-in-out',
          // Desktop: collapsed icon bar (64px), expands to 240px on group hover
          'md:w-16 md:hover:w-60 group',
          // Mobile: off-screen by default, slides in when isOpen
          isOpen ? 'w-60' : 'w-0 md:w-16',
        ].join(' ')}
      >
        {/* Mobile close button */}
        <div className="flex items-center justify-between px-4 py-4 md:hidden">
          <span className="text-gold font-bold text-lg whitespace-nowrap overflow-hidden">
            Connect Digitals
          </span>
          <button
            onClick={onClose}
            className="text-cream hover:text-gold transition-colors"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Logo area — desktop */}
        <div className="hidden md:flex items-center h-16 px-4 border-b border-white/10 shrink-0">
          {/* Collapsed: monogram */}
          <span className="text-gold font-bold text-xl min-w-[32px] text-center group-hover:hidden">
            CD
          </span>
          {/* Expanded: wordmark */}
          <span className="text-gold font-bold text-base whitespace-nowrap overflow-hidden hidden group-hover:block">
            Connect Digitals
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => onClose()}
              className={({ isActive }) =>
                [
                  'flex items-center gap-3 px-4 py-3 transition-colors relative',
                  'hover:bg-white/10',
                  isActive
                    ? 'text-gold border-l-2 border-gold bg-white/5'
                    : 'text-cream/80 border-l-2 border-transparent',
                ].join(' ')
              }
            >
              <Icon size={20} className="shrink-0" />
              <span className="whitespace-nowrap overflow-hidden text-sm font-medium md:hidden md:group-hover:block block">
                {label}
              </span>
            </NavLink>
          ))}
        </nav>

        {/* Sign out */}
        <div className="border-t border-white/10 p-4 shrink-0">
          <button
            onClick={() => signOut()}
            className="flex items-center gap-3 w-full text-cream/80 hover:text-brand_red transition-colors py-2"
            aria-label="Sign out"
          >
            <LogOut size={20} className="shrink-0" />
            <span className="whitespace-nowrap overflow-hidden text-sm font-medium md:hidden md:group-hover:block block">
              Sign Out
            </span>
          </button>
        </div>
      </aside>
    </>
  );
}

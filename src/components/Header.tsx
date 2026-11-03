import { Menu } from 'lucide-react';
import GlobalSearch from './GlobalSearch';

interface HeaderProps {
  title: string;
  onMenuToggle: () => void;
}

export default function Header({ title, onMenuToggle }: HeaderProps) {
  return (
    <header className="flex items-center gap-4 h-14 px-4 bg-navy text-cream shrink-0 border-b border-white/10">
      {/* Mobile menu button */}
      <button
        onClick={onMenuToggle}
        className="md:hidden text-cream hover:text-gold transition-colors"
        aria-label="Open menu"
      >
        <Menu size={22} />
      </button>

      {/* Page title */}
      <h1 className="text-base font-semibold flex-1">{title}</h1>

      {/* Global search */}
      <GlobalSearch />
    </header>
  );
}

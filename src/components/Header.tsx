import { Menu } from 'lucide-react';

interface HeaderProps {
  title: string;
  onMenuToggle: () => void;
}

export default function Header({ title, onMenuToggle }: HeaderProps) {
  return (
    <header className="md:hidden flex items-center gap-4 h-14 px-4 bg-navy text-cream shrink-0 border-b border-white/10">
      <button
        onClick={onMenuToggle}
        className="text-cream hover:text-gold transition-colors"
        aria-label="Open menu"
      >
        <Menu size={22} />
      </button>
      <h1 className="text-base font-semibold">{title}</h1>
    </header>
  );
}

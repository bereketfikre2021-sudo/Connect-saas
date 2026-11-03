import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Users, Briefcase, FileText, Receipt } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Result {
  id: string;
  label: string;
  sub: string;
  path: string;
  icon: React.ReactNode;
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else { setQuery(''); setResults([]); }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      const q = `%${query}%`;
      const [clients, projects, proposals, invoices] = await Promise.all([
        supabase.from('agency_clients').select('id, name, company').ilike('name', q).limit(4),
        supabase.from('agency_projects').select('id, title').ilike('title', q).limit(4),
        supabase.from('agency_proposals').select('id, title').ilike('title', q).limit(4),
        supabase.from('agency_invoices').select('id, invoice_number, title').or(`invoice_number.ilike.${q},title.ilike.${q}`).limit(4),
      ]);
      const res: Result[] = [
        ...(clients.data ?? []).map(c => ({ id: c.id, label: c.name, sub: c.company || 'Client', path: '/clients', icon: <Users size={14} className="text-navy" /> })),
        ...(projects.data ?? []).map(p => ({ id: p.id, label: p.title, sub: 'Project', path: `/projects/${p.id}`, icon: <Briefcase size={14} className="text-gold" /> })),
        ...(proposals.data ?? []).map(p => ({ id: p.id, label: p.title, sub: 'Proposal', path: `/proposals/${p.id}`, icon: <FileText size={14} className="text-blue-500" /> })),
        ...(invoices.data ?? []).map(i => ({ id: i.id, label: `${i.invoice_number} — ${i.title}`, sub: 'Invoice', path: `/invoices/${i.id}`, icon: <Receipt size={14} className="text-green-600" /> })),
      ];
      setResults(res);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  function go(path: string) {
    navigate(path);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-cream/70 hover:text-cream rounded-lg text-sm transition-colors border border-white/10"
        title="Search (Ctrl+K)"
      >
        <Search size={14} />
        <span className="hidden sm:inline text-xs">Search…</span>
        <kbd className="hidden sm:inline text-xs bg-white/10 px-1.5 py-0.5 rounded">⌘K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4 bg-black/50" onClick={() => setOpen(false)}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search clients, projects, proposals, invoices…"
            className="flex-1 text-sm text-dark outline-none placeholder-gray-400"
          />
          {loading && <div className="w-4 h-4 border-2 border-navy border-t-transparent rounded-full animate-spin" />}
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-dark"><X size={16} /></button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <ul className="max-h-72 overflow-y-auto py-2">
            {results.map(r => (
              <li key={r.id + r.path}>
                <button onClick={() => go(r.path)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-cream/60 transition-colors text-left">
                  <span className="shrink-0">{r.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-dark truncate">{r.label}</p>
                    <p className="text-xs text-gray-400">{r.sub}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {query && !loading && results.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">No results for "{query}"</p>
        )}

        {!query && (
          <p className="text-xs text-gray-400 text-center py-6">Type to search across clients, projects, proposals and invoices</p>
        )}

        <div className="border-t border-gray-100 px-4 py-2 flex gap-4 text-xs text-gray-400">
          <span><kbd className="bg-gray-100 px-1 rounded">↑↓</kbd> navigate</span>
          <span><kbd className="bg-gray-100 px-1 rounded">Enter</kbd> open</span>
          <span><kbd className="bg-gray-100 px-1 rounded">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

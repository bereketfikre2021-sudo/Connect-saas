import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Loader2, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import StatusBadge from '../components/StatusBadge';
import type { Invoice, InvoiceStatus } from '../types';

const INVOICE_COLORS: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Unpaid: 'bg-blue-100 text-blue-800',
  'Partially Paid': 'bg-yellow-100 text-yellow-800',
  Paid: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-700',
  Overdue: 'bg-red-100 text-red-700',
};

const FILTERS: (InvoiceStatus | 'All' | 'Overdue')[] = [
  'All', 'Draft', 'Unpaid', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled',
];

const etbFormatter = new Intl.NumberFormat('en-ET', {
  style: 'currency',
  currency: 'ETB',
  maximumFractionDigits: 0,
});

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isOverdue(inv: Invoice): boolean {
  const today = new Date().toISOString().split('T')[0];
  return ['Unpaid', 'Partially Paid'].includes(inv.status) && inv.due_date < today && inv.paid_amount < inv.total_amount;
}

interface InvoiceWithClient extends Invoice {
  agency_clients: { name: string; company: string } | null;
}

export default function InvoicesPage() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('All');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function fetchInvoices() {
      try {
        const { data, error: sbError } = await supabase
          .from('agency_invoices')
          .select('*, agency_clients(name, company)')
          .order('created_at', { ascending: false });

        if (cancelled) return;
        if (sbError) throw sbError;
        setInvoices((data ?? []) as unknown as InvoiceWithClient[]);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load invoices');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchInvoices();
    return () => { cancelled = true; };
  }, []);

  const filtered = invoices.filter((inv) => {
    // Status filter
    if (filter === 'Overdue') {
      if (!isOverdue(inv)) return false;
    } else if (filter !== 'All' && inv.status !== filter) {
      return false;
    }
    // Search
    if (search) {
      const q = search.toLowerCase();
      return inv.invoice_number.toLowerCase().includes(q) || inv.title.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-dark">Invoices</h1>
        <button
          onClick={() => navigate('/invoices/new')}
          className="flex items-center gap-2 px-4 py-2 bg-brand_red text-cream rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
        >
          <Plus size={16} />
          New Invoice
        </button>
      </div>

      {error && (
        <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
      )}

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search invoice # or title…"
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy"
        />
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === f
                ? 'bg-navy text-cream'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-navy" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 px-5 py-8 text-center">No invoices found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Invoice #</th>
                  <th className="px-4 py-3 text-left font-medium">Title</th>
                  <th className="px-4 py-3 text-left font-medium">Client</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-right font-medium">Outstanding</th>
                  <th className="px-4 py-3 text-left font-medium">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((inv) => {
                  const overdue = isOverdue(inv);
                  const displayStatus = overdue ? 'Overdue' : inv.status;
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => navigate(`/invoices/${inv.id}`)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3 font-medium text-dark">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-gray-600">{inv.title}</td>
                      <td className="px-4 py-3 text-gray-600">{inv.agency_clients?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={displayStatus} colorMap={INVOICE_COLORS} />
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{etbFormatter.format(inv.total_amount)}</td>
                      <td className="px-4 py-3 text-right font-medium text-dark">
                        {etbFormatter.format(inv.total_amount - inv.paid_amount)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatDate(inv.due_date)}
                        {overdue && <span className="text-brand_red ml-1">⚠</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

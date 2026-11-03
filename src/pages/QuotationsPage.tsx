import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Copy, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import StatusBadge from '../components/StatusBadge';
import type { Quotation, QuotationStatus } from '../types';

const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Sent: 'bg-blue-100 text-blue-800',
  Accepted: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-700',
  Expired: 'bg-orange-100 text-orange-700',
};
const FILTERS: (QuotationStatus | 'All')[] = ['All', 'Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'];
const etb = new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB', maximumFractionDigits: 0 });
const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

interface QuotRow extends Quotation {
  agency_clients: { name: string; company: string; email: string } | null;
}

export default function QuotationsPage() {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState<QuotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<QuotationStatus | 'All'>('All');
  const [search, setSearch] = useState('');

  const fetchAll = useCallback(async () => {
    const { data, error: e } = await supabase
      .from('agency_quotations')
      .select('*, agency_clients(name, company, email)')
      .order('created_at', { ascending: false });
    if (e) setError(e.message);
    else setQuotations((data ?? []) as unknown as QuotRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleDuplicate(q: QuotRow) {
    const { data: newQ, error: e } = await supabase
      .from('agency_quotations')
      .insert({
        client_id: q.client_id, title: `${q.title} (Copy)`,
        issue_date: new Date().toISOString().split('T')[0],
        validity_date: q.validity_date, estimated_delivery: q.estimated_delivery,
        currency: q.currency, discount_type: q.discount_type, discount_value: q.discount_value,
        scope: q.scope, deliverables: q.deliverables, timeline: q.timeline,
        terms: q.terms, payment_terms: q.payment_terms, notes: q.notes,
        original_quotation_id: q.id,
      })
      .select().single();
    if (e || !newQ) { setError('Failed to duplicate'); return; }
    // Copy items
    const { data: items } = await supabase.from('agency_quotation_items').select('*').eq('quotation_id', q.id).order('sort_order');
    if (items?.length) {
      await supabase.from('agency_quotation_items').insert(
        items.map(({ id: _id, quotation_id: _qid, line_total: _lt, ...rest }) => ({ ...rest, quotation_id: (newQ as { id: string }).id }))
      );
    }
    navigate(`/quotations/${(newQ as { id: string }).id}/edit`);
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this quotation?')) return;
    await supabase.from('agency_quotations').delete().eq('id', id);
    setQuotations(p => p.filter(q => q.id !== id));
  }

  const filtered = quotations.filter(q => {
    if (filter !== 'All' && q.status !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      return q.quotation_number.toLowerCase().includes(s) ||
        q.title.toLowerCase().includes(s) ||
        (q.agency_clients?.name ?? '').toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-dark">Quotations</h1>
        <button onClick={() => navigate('/quotations/new')}
          className="flex items-center gap-2 px-4 py-2 bg-brand_red text-cream rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
          <Plus size={16} /> New Quotation
        </button>
      </div>

      {error && <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search quotations…"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === f ? 'bg-navy text-cream' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-navy" /></div>
          : filtered.length === 0 ? <p className="text-sm text-gray-400 px-5 py-8 text-center">No quotations found.</p>
          : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left">Quote #</th>
                    <th className="px-4 py-3 text-left">Title</th>
                    <th className="px-4 py-3 text-left">Client</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    <th className="px-4 py-3 text-left">Valid Until</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(q => (
                    <tr key={q.id} className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/quotations/${q.id}`)}>
                      <td className="px-4 py-3 font-medium text-navy">{q.quotation_number}</td>
                      <td className="px-4 py-3 text-dark">{q.title}</td>
                      <td className="px-4 py-3 text-gray-600">{q.agency_clients?.name ?? '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={q.status} colorMap={STATUS_COLORS} /></td>
                      <td className="px-4 py-3 text-right font-medium text-dark">{etb.format(q.total)}</td>
                      <td className="px-4 py-3 text-gray-600">{fmt(q.validity_date)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                          <button onClick={() => handleDuplicate(q)} title="Duplicate"
                            className="p-1.5 text-gray-400 hover:text-navy rounded hover:bg-gray-100"><Copy size={14} /></button>
                          {q.status === 'Draft' && (
                            <button onClick={() => handleDelete(q.id)} title="Delete"
                              className="p-1.5 text-gray-400 hover:text-brand_red rounded hover:bg-red-50"><Trash2 size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}

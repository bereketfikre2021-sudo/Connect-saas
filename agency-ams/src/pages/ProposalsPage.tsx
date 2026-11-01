import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import StatusBadge from '../components/StatusBadge';
import type { Proposal, ProposalStatus } from '../types';

const PROPOSAL_COLORS: Record<ProposalStatus, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Sent: 'bg-blue-100 text-blue-800',
  Accepted: 'bg-green-100 text-green-800',
  'Changes Requested': 'bg-yellow-100 text-yellow-800',
  Rejected: 'bg-red-100 text-red-700',
};

interface ProposalRow extends Omit<Proposal, 'client'> {
  agency_clients: { name: string } | null;
}

const STATUS_FILTERS: Array<'All' | ProposalStatus> = [
  'All',
  'Draft',
  'Sent',
  'Accepted',
  'Changes Requested',
  'Rejected',
];

const etbFormatter = new Intl.NumberFormat('en-ET', {
  style: 'currency',
  currency: 'ETB',
  maximumFractionDigits: 0,
});

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function ProposalsPage() {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'All' | ProposalStatus>('All');

  useEffect(() => {
    let cancelled = false;

    async function fetchProposals() {
      try {
        const { data, error: fetchError } = await supabase
          .from('agency_proposals')
          .select('*, agency_clients(name)')
          .order('created_at', { ascending: false });

        if (cancelled) return;
        if (fetchError) throw fetchError;

        setProposals((data as unknown as ProposalRow[]) ?? []);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load proposals');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchProposals();
    return () => { cancelled = true; };
  }, []);

  const filtered =
    activeFilter === 'All' ? proposals : proposals.filter((p) => p.status === activeFilter);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-dark">Proposals</h1>
        <button
          onClick={() => navigate('/proposals/new')}
          className="flex items-center gap-2 px-4 py-2 bg-brand_red text-cream rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
        >
          <Plus size={16} />
          New Proposal
        </button>
      </div>

      {error && (
        <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              activeFilter === f
                ? 'bg-navy text-cream'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-navy hover:text-navy'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-navy" />
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-base">
            {proposals.length === 0
              ? 'No proposals yet. Create your first proposal.'
              : `No proposals with status "${activeFilter}".`}
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && filtered.length > 0 && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Title</th>
                  <th className="px-5 py-3 text-left font-medium">Client</th>
                  <th className="px-5 py-3 text-left font-medium">Total</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Expiry</th>
                  <th className="px-5 py-3 text-left font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => navigate(`/proposals/${row.id}`)}
                  >
                    <td className="px-5 py-3 font-medium text-dark">{row.title}</td>
                    <td className="px-5 py-3 text-gray-600">{row.agency_clients?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{etbFormatter.format(row.total_amount)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={row.status} colorMap={PROPOSAL_COLORS} />
                    </td>
                    <td className="px-5 py-3 text-gray-600">{formatDate(row.expiry_date)}</td>
                    <td className="px-5 py-3 text-gray-600">{formatDate(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

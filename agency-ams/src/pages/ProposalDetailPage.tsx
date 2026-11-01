import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Copy, ExternalLink, FileText, Loader2, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';
import StatusBadge from '../components/StatusBadge';
import type { Proposal, ProposalResponse, Contract, ContractContent, ProposalStatus } from '../types';

const PROPOSAL_COLORS: Record<ProposalStatus, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Sent: 'bg-blue-100 text-blue-800',
  Accepted: 'bg-green-100 text-green-800',
  'Changes Requested': 'bg-yellow-100 text-yellow-800',
  Rejected: 'bg-red-100 text-red-700',
};

interface ProposalWithClient extends Omit<Proposal, 'client'> {
  agency_clients: { name: string; company: string; email: string } | null;
}

const etbFormatter = new Intl.NumberFormat('en-ET', {
  style: 'currency',
  currency: 'ETB',
  maximumFractionDigits: 0,
});

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function ProposalDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [proposal, setProposal] = useState<ProposalWithClient | null>(null);
  const [response, setResponse] = useState<ProposalResponse | null>(null);
  const [contract, setContract] = useState<Pick<Contract, 'id'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generatingContract, setGeneratingContract] = useState(false);
  const [contractError, setContractError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      if (!id) return;
      try {
        const [proposalRes, responseRes, contractRes] = await Promise.all([
          supabase
            .from('agency_proposals')
            .select('*, agency_clients(name,company,email)')
            .eq('id', id)
            .single(),
          supabase
            .from('agency_proposal_responses')
            .select('*')
            .eq('proposal_id', id)
            .maybeSingle(),
          supabase
            .from('agency_contracts')
            .select('id')
            .eq('proposal_id', id)
            .maybeSingle(),
        ]);

        if (cancelled) return;

        if (proposalRes.error) throw proposalRes.error;

        setProposal(proposalRes.data as unknown as ProposalWithClient);
        setResponse(responseRes.data as ProposalResponse | null);
        setContract(contractRes.data as Pick<Contract, 'id'> | null);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load proposal');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [id]);

  function handleCopyPortalLink() {
    if (!proposal) return;
    const url = `${window.location.origin}/portal/${proposal.portal_token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleGenerateContract() {
    if (!proposal || !proposal.agency_clients) return;
    setGeneratingContract(true);
    setContractError(null);

    try {
      const content: ContractContent = {
        client_name: proposal.agency_clients.name,
        client_company: proposal.agency_clients.company,
        client_email: proposal.agency_clients.email,
        proposal_title: proposal.title,
        items: proposal.items,
        total_amount: proposal.total_amount,
        currency: proposal.currency,
        deliverables: proposal.deliverables,
        terms: proposal.terms,
        issued_at: new Date().toISOString(),
      };

      const { data, error: insertError } = await supabase
        .from('agency_contracts')
        .insert({
          proposal_id: proposal.id,
          client_id: proposal.client_id,
          content,
          status: 'Active',
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      navigate(`/contracts/${(data as { id: string }).id}`);
    } catch (err: unknown) {
      setContractError(err instanceof Error ? err.message : 'Failed to generate contract');
    } finally {
      setGeneratingContract(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={32} className="animate-spin text-navy" />
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2">
          {error ?? 'Proposal not found.'}
        </p>
        <Link to="/proposals" className="text-sm text-navy hover:underline">
          ← Back to Proposals
        </Link>
      </div>
    );
  }

  const portalUrl = `${window.location.origin}/portal/${proposal.portal_token}`;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/proposals" className="text-sm text-gray-500 hover:text-navy transition-colors">
            ← Proposals
          </Link>
          <h1 className="text-2xl font-semibold text-dark mt-1">{proposal.title}</h1>
        </div>
        <StatusBadge status={proposal.status} colorMap={PROPOSAL_COLORS} />
      </div>

      {/* Client info */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Client</h2>
        {proposal.agency_clients ? (
          <div className="space-y-1 text-sm text-dark">
            <p className="font-medium">{proposal.agency_clients.name}</p>
            {proposal.agency_clients.company && (
              <p className="text-gray-600">{proposal.agency_clients.company}</p>
            )}
            <p className="text-gray-600">{proposal.agency_clients.email}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No client linked.</p>
        )}
      </div>

      {/* Proposal details */}
      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase">Proposal Details</h2>

        {proposal.introduction && (
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{proposal.introduction}</p>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Description</th>
                <th className="px-4 py-2 text-right font-medium">Qty</th>
                <th className="px-4 py-2 text-right font-medium">Unit Price</th>
                <th className="px-4 py-2 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {proposal.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-2 text-dark">{item.description}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{item.quantity}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{etbFormatter.format(item.unit_price)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{etbFormatter.format(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-right text-sm font-semibold text-dark">
          Total: {etbFormatter.format(proposal.total_amount)}
        </p>

        {proposal.expiry_date && (
          <p className="text-sm text-gray-600">
            <span className="font-medium">Expires:</span> {formatDate(proposal.expiry_date)}
          </p>
        )}

        {proposal.deliverables && (
          <div>
            <h3 className="text-sm font-semibold text-dark mb-1">Deliverables</h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{proposal.deliverables}</p>
          </div>
        )}

        {proposal.terms && (
          <div>
            <h3 className="text-sm font-semibold text-dark mb-1">Terms</h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{proposal.terms}</p>
          </div>
        )}
      </div>

      {/* Portal link */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Client Portal Link</h2>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          <ExternalLink size={14} className="text-gray-400 shrink-0" />
          <span className="text-sm text-gray-600 flex-1 truncate">{portalUrl}</span>
          <button
            onClick={handleCopyPortalLink}
            className="flex items-center gap-1 text-xs text-navy hover:underline shrink-0"
          >
            <Copy size={13} />
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Client response */}
      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Client Response</h2>
        {response ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-dark">Action:</span>
              <StatusBadge status={response.action} colorMap={PROPOSAL_COLORS} />
            </div>
            {response.comment && (
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{response.comment}</p>
            )}
            <p className="text-xs text-gray-400">
              Responded: {formatDate(response.responded_at)}
            </p>
          </div>
        ) : proposal.status === 'Sent' ? (
          <p className="text-sm text-gray-400 italic">Awaiting client response…</p>
        ) : (
          <p className="text-sm text-gray-400">No response yet.</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        {proposal.status === 'Draft' && (
          <button
            onClick={() => navigate(`/proposals/${id}/edit`)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-dark rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Pencil size={14} />
            Edit
          </button>
        )}

        {proposal.status === 'Accepted' && !contract && (
          <>
            {contractError && (
              <p className="w-full text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2">
                {contractError}
              </p>
            )}
            <button
              onClick={handleGenerateContract}
              disabled={generatingContract}
              className="flex items-center gap-2 px-4 py-2 bg-brand_red text-cream rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {generatingContract
                ? <Loader2 size={14} className="animate-spin" />
                : <FileText size={14} />
              }
              Generate Contract
            </button>
          </>
        )}

        {contract && (
          <button
            onClick={() => navigate(`/contracts/${contract.id}`)}
            className="flex items-center gap-2 px-4 py-2 bg-navy text-cream rounded-lg text-sm font-medium hover:bg-blue-900 transition-colors"
          >
            <FileText size={14} />
            View Contract
          </button>
        )}
      </div>
    </div>
  );
}

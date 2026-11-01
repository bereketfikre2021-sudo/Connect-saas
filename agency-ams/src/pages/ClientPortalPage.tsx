import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type {
  ProposalItem,
  ProposalStatus,
  ProposalResponseAction,
  ContractContent,
} from '../types';

// ─── Local types (portal-specific, matches RPC return shape) ─────────────────

interface PortalData {
  proposal: {
    id: string;
    title: string;
    introduction?: string;
    deliverables?: string;
    terms?: string;
    items: ProposalItem[];
    total_amount: number;
    currency: string;
    expiry_date?: string;
    status: ProposalStatus;
  };
  client: {
    name: string;
    company: string;
    email: string;
  };
  response?: {
    action: ProposalResponseAction;
    comment?: string;
    responded_at: string;
  };
  contract?: {
    id: string;
    content: ContractContent;
  };
  project?: {
    title: string;
    status: string;
    description?: string;
    start_date?: string;
    deadline?: string;
  };
}

type ActiveTab = 'proposal' | 'contract' | 'project';

// ─── Formatters ──────────────────────────────────────────────────────────────

const etbFormatter = new Intl.NumberFormat('en-ET', {
  style: 'currency',
  currency: 'ETB',
  maximumFractionDigits: 0,
});

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// ─── Color maps ──────────────────────────────────────────────────────────────

const PROPOSAL_STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Sent: 'bg-blue-100 text-blue-800',
  Accepted: 'bg-green-100 text-green-800',
  'Changes Requested': 'bg-yellow-100 text-yellow-800',
  Rejected: 'bg-red-100 text-red-700',
};

const RESPONSE_ACTION_COLORS: Record<string, string> = {
  Accepted: 'bg-green-100 text-green-800',
  'Changes Requested': 'bg-yellow-100 text-yellow-800',
  Rejected: 'bg-red-100 text-red-700',
};

const PROJECT_STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-yellow-100 text-yellow-800',
  'In Progress': 'bg-blue-100 text-blue-800',
  Completed: 'bg-green-100 text-green-800',
  'On Hold': 'bg-gray-100 text-gray-600',
};

// ─── Small helpers ────────────────────────────────────────────────────────────

function StatusPill({ status, colorMap }: { status: string; colorMap: Record<string, string> }) {
  const cls = colorMap[status] ?? 'bg-gray-100 text-gray-500';
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

// ─── Branded error screen ─────────────────────────────────────────────────────

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex flex-col bg-cream">
      {/* Navy header */}
      <header className="bg-navy px-6 py-4">
        <span className="text-gold font-bold text-xl tracking-wide">Connect Digitals</span>
      </header>

      {/* Centered message */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold text-dark">Proposal Not Found</h1>
          <p className="text-gray-600">{message}</p>
          <p className="text-sm text-gray-400">
            Connect Digitals &mdash; Digital Marketing &amp; Management Services
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ClientPortalPage() {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PortalData | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('proposal');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ProposalResponseAction | null>(null);
  const [comment, setComment] = useState('');

  // ── Fetch portal data ──────────────────────────────────────────────────────

  async function fetchPortalData(cancelled: { value: boolean }) {
    if (!token) {
      if (!cancelled.value) {
        setError('This proposal link is invalid, expired, or no longer available.');
        setLoading(false);
      }
      return;
    }

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_portal_data', {
        p_token: token,
      });

      if (cancelled.value) return;

      if (rpcError || rpcData === null) {
        setError('This proposal link is invalid, expired, or no longer available.');
      } else {
        setData(rpcData as PortalData);
      }
    } catch {
      if (!cancelled.value) {
        setError('This proposal link is invalid, expired, or no longer available.');
      }
    } finally {
      if (!cancelled.value) setLoading(false);
    }
  }

  useEffect(() => {
    const cancelled = { value: false };
    fetchPortalData(cancelled);
    return () => { cancelled.value = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Submit response ────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!selectedAction || !token) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const { error: rpcError } = await supabase.rpc('submit_proposal_response', {
        p_token: token,
        p_action: selectedAction,
        p_comment: comment,
      });

      if (rpcError) {
        setSubmitError(rpcError.message ?? 'Failed to submit response. Please try again.');
        return;
      }

      // Re-fetch to get fresh state
      const cancelled = { value: false };
      setLoading(true);
      await fetchPortalData(cancelled);
      setSubmitSuccess(true);
    } catch {
      setSubmitError('Failed to submit response. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render: loading ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-cream">
        <header className="bg-navy px-6 py-4">
          <span className="text-gold font-bold text-xl tracking-wide">Connect Digitals</span>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-navy" />
        </div>
      </div>
    );
  }

  // ── Render: error ──────────────────────────────────────────────────────────

  if (error || !data) {
    return (
      <ErrorScreen
        message={error ?? 'This proposal link is invalid, expired, or no longer available.'}
      />
    );
  }

  // ── Derived flags ──────────────────────────────────────────────────────────

  const hasContract = !!data.contract;
  const hasProject = !!data.project;
  const hasExistingResponse = !!data.response;
  const canRespond = data.proposal.status === 'Sent' && !hasExistingResponse;

  // ── Render: portal ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-cream">
      {/* ── Header ── */}
      <header className="bg-navy px-6 py-4">
        <div className="max-w-3xl mx-auto flex flex-col">
          <span className="text-gold font-bold text-xl tracking-wide">Connect Digitals</span>
          <span className="text-cream/70 text-sm">Client Proposal Portal</span>
        </div>
      </header>

      {/* ── Tab bar (only if contract or project exists) ── */}
      {(hasContract || hasProject) && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-4 flex gap-6">
            <button
              onClick={() => setActiveTab('proposal')}
              className={`py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'proposal'
                  ? 'border-gold text-dark'
                  : 'border-transparent text-gray-500 hover:text-dark'
              }`}
            >
              Proposal
            </button>

            {hasContract && (
              <button
                onClick={() => setActiveTab('contract')}
                className={`py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'contract'
                    ? 'border-gold text-dark'
                    : 'border-transparent text-gray-500 hover:text-dark'
                }`}
              >
                Contract
              </button>
            )}

            {hasProject && (
              <button
                onClick={() => setActiveTab('project')}
                className={`py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'project'
                    ? 'border-gold text-dark'
                    : 'border-transparent text-gray-500 hover:text-dark'
                }`}
              >
                Project
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Body ── */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-6">

        {/* ═══════════════ PROPOSAL TAB ═══════════════ */}
        {activeTab === 'proposal' && (
          <>
            {/* Title + client greeting */}
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-dark">{data.proposal.title}</h1>
              <p className="text-sm text-gray-600">
                Prepared for:{' '}
                <span className="font-medium text-dark">{data.client.name}</span>
                {data.client.company && (
                  <span className="text-gray-500"> &mdash; {data.client.company}</span>
                )}
              </p>
            </div>

            {/* Introduction */}
            {data.proposal.introduction && (
              <div className="bg-white rounded-xl shadow p-6">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {data.proposal.introduction}
                </p>
              </div>
            )}

            {/* Line items */}
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <div className="px-6 pt-5 pb-2">
                <h2 className="text-sm font-semibold text-gray-500 uppercase">Services</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Description</th>
                      <th className="px-4 py-2 text-right font-medium">Qty</th>
                      <th className="px-4 py-2 text-right font-medium">Unit Price (ETB)</th>
                      <th className="px-4 py-2 text-right font-medium">Subtotal (ETB)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.proposal.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2 text-dark">{item.description}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{item.quantity}</td>
                        <td className="px-4 py-2 text-right text-gray-600">
                          {etbFormatter.format(item.unit_price)}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600">
                          {etbFormatter.format(item.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-3 text-right border-t border-gray-100">
                <span className="text-sm font-bold text-dark">
                  Total: {etbFormatter.format(data.proposal.total_amount)}
                </span>
              </div>
            </div>

            {/* Deliverables */}
            {data.proposal.deliverables && (
              <div className="bg-white rounded-xl shadow p-6 space-y-2">
                <h2 className="text-sm font-semibold text-gray-500 uppercase border-b border-gray-100 pb-2">
                  Deliverables
                </h2>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {data.proposal.deliverables}
                </p>
              </div>
            )}

            {/* Terms */}
            {data.proposal.terms && (
              <div className="bg-white rounded-xl shadow p-6 space-y-2">
                <h2 className="text-sm font-semibold text-gray-500 uppercase border-b border-gray-100 pb-2">
                  Terms &amp; Conditions
                </h2>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {data.proposal.terms}
                </p>
              </div>
            )}

            {/* Expiry + Status */}
            <div className="bg-white rounded-xl shadow p-6 flex flex-wrap items-center gap-4">
              <div className="flex-1 space-y-1">
                {data.proposal.expiry_date && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-dark">Expires:</span>{' '}
                    {formatDate(data.proposal.expiry_date)}
                  </p>
                )}
              </div>
              <div>
                <StatusPill
                  status={data.proposal.status}
                  colorMap={PROPOSAL_STATUS_COLORS}
                />
              </div>
            </div>

            {/* ── Action section ── */}
            {canRespond && (
              <div className="bg-white rounded-xl shadow p-6 space-y-4">
                <h2 className="text-sm font-semibold text-gray-500 uppercase">
                  Your Response
                </h2>

                {submitSuccess && (
                  <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                    Your response has been recorded. Thank you.
                  </p>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => setSelectedAction('Accepted')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedAction === 'Accepted'
                        ? 'bg-green-600 text-white ring-2 ring-green-400'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => setSelectedAction('Changes Requested')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedAction === 'Changes Requested'
                        ? 'bg-yellow-500 text-white ring-2 ring-yellow-300'
                        : 'bg-yellow-500 text-white hover:bg-yellow-600'
                    }`}
                  >
                    Request Changes
                  </button>
                  <button
                    onClick={() => setSelectedAction('Rejected')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                      selectedAction === 'Rejected'
                        ? 'border-red-500 text-red-600 bg-red-50 ring-2 ring-red-300'
                        : 'border-red-500 text-red-600 bg-white hover:bg-red-50'
                    }`}
                  >
                    Reject
                  </button>
                </div>

                {/* Comment */}
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="Optional: add a comment or message…"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-navy focus:outline-none resize-none"
                />

                {/* Submit error */}
                {submitError && (
                  <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2">
                    {submitError}
                  </p>
                )}

                {/* Submit button */}
                <button
                  onClick={handleSubmit}
                  disabled={!selectedAction || submitting}
                  className="flex items-center gap-2 px-5 py-2 bg-brand_red text-cream rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  Submit Response
                </button>
              </div>
            )}

            {/* ── Already responded ── */}
            {hasExistingResponse && data.response && (
              <div className="bg-white rounded-xl shadow p-6 space-y-3">
                <h2 className="text-sm font-semibold text-gray-500 uppercase">
                  Your Response
                </h2>
                <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                  Your response has been recorded.
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-dark">Action:</span>
                  <StatusPill
                    status={data.response.action}
                    colorMap={RESPONSE_ACTION_COLORS}
                  />
                </div>
                {data.response.comment && (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {data.response.comment}
                  </p>
                )}
                <p className="text-xs text-gray-400">
                  Responded: {formatDate(data.response.responded_at)}
                </p>
              </div>
            )}
          </>
        )}

        {/* ═══════════════ CONTRACT TAB ═══════════════ */}
        {activeTab === 'contract' && data.contract && (
          <div className="space-y-6">
            {/* Contract header */}
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-bold text-navy uppercase tracking-wide">
                Connect Digitals
              </h1>
              <p className="text-sm text-gray-500">Digital Marketing &amp; Management Services</p>
              <h2 className="text-lg font-semibold text-dark mt-2">Service Contract</h2>
            </div>

            {/* Client info */}
            <div className="bg-white rounded-xl shadow p-6 space-y-3">
              <h3 className="text-sm font-semibold text-gray-500 uppercase border-b border-gray-100 pb-2">
                Client Information
              </h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p>
                  <span className="font-medium text-dark">Name:</span>{' '}
                  {data.contract.content.client_name}
                </p>
                {data.contract.content.client_company && (
                  <p>
                    <span className="font-medium text-dark">Company:</span>{' '}
                    {data.contract.content.client_company}
                  </p>
                )}
                <p>
                  <span className="font-medium text-dark">Email:</span>{' '}
                  {data.contract.content.client_email}
                </p>
              </div>
            </div>

            {/* Services table */}
            <div className="bg-white rounded-xl shadow overflow-hidden">
              <div className="px-6 pt-5 pb-2">
                <h3 className="text-sm font-semibold text-gray-500 uppercase">
                  Agreed Services — {data.contract.content.proposal_title}
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Description</th>
                      <th className="px-4 py-2 text-right font-medium">Qty</th>
                      <th className="px-4 py-2 text-right font-medium">Unit Price (ETB)</th>
                      <th className="px-4 py-2 text-right font-medium">Subtotal (ETB)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.contract.content.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2 text-dark">{item.description}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{item.quantity}</td>
                        <td className="px-4 py-2 text-right text-gray-600">
                          {etbFormatter.format(item.unit_price)}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-600">
                          {etbFormatter.format(item.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-3 text-right border-t border-gray-100">
                <span className="text-sm font-bold text-dark">
                  Total: {etbFormatter.format(data.contract.content.total_amount)}
                </span>
              </div>
            </div>

            {/* Deliverables */}
            {data.contract.content.deliverables && (
              <div className="bg-white rounded-xl shadow p-6 space-y-2">
                <h3 className="text-sm font-semibold text-gray-500 uppercase border-b border-gray-100 pb-2">
                  Deliverables
                </h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {data.contract.content.deliverables}
                </p>
              </div>
            )}

            {/* Terms */}
            {data.contract.content.terms && (
              <div className="bg-white rounded-xl shadow p-6 space-y-2">
                <h3 className="text-sm font-semibold text-gray-500 uppercase border-b border-gray-100 pb-2">
                  Terms &amp; Conditions
                </h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {data.contract.content.terms}
                </p>
              </div>
            )}

            {/* Footer note */}
            <div className="text-center text-xs text-gray-400 space-y-1 pt-2">
              <p>Connect Digitals Agency Management System</p>
              <p>
                Issued: {formatDate(data.contract.content.issued_at)}
              </p>
            </div>
          </div>
        )}

        {/* ═══════════════ PROJECT TAB ═══════════════ */}
        {activeTab === 'project' && data.project && (
          <div className="space-y-4">
            <h1 className="text-xl font-bold text-dark">Project Progress</h1>

            <div className="bg-white rounded-xl shadow overflow-hidden">
              {/* Navy accent bar */}
              <div className="h-1 bg-navy" />
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-lg font-semibold text-dark">{data.project.title}</h2>
                  <StatusPill
                    status={data.project.status}
                    colorMap={PROJECT_STATUS_COLORS}
                  />
                </div>

                {data.project.description && (
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">
                    {data.project.description}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-3 text-sm pt-2">
                  {data.project.start_date && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase font-medium">Start Date</p>
                      <p className="text-dark">{formatDate(data.project.start_date)}</p>
                    </div>
                  )}
                  {data.project.deadline && (
                    <div>
                      <p className="text-xs text-gray-400 uppercase font-medium">Deadline</p>
                      <p className="text-dark">{formatDate(data.project.deadline)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="py-6 text-center text-xs text-gray-400 border-t border-gray-200">
        Connect Digitals &mdash; Digital Marketing &amp; Management Services
      </footer>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type {
  ProposalItem,
  ProposalStatus,
  ProposalResponseAction,
  ContractContent,
  PaymentMethod,
} from '../types';

// ─── Portal payment method logo ───────────────────────────────────────────────

const PORTAL_LOGO_MAP: Array<{ keywords: string[]; src: string }> = [
  { keywords: ['cbe birr', 'cbebirr'],        src: '/Payment Methods/cbe birr.webp' },
  { keywords: ['cbe', 'commercial bank'],     src: '/Payment Methods/commercial-bank-of-ethiopia-logo-png_seeklogo-547506.webp' },
  { keywords: ['telebirr', 'tele birr'],      src: '/Payment Methods/tele birr.webp' },
  { keywords: ['awash birr', 'awashbirr'],    src: '/Payment Methods/Awash-birr.webp' },
  { keywords: ['awash'],                      src: '/Payment Methods/awash bank.webp' },
];

function PortalMethodLogo({ name }: { name: string }) {
  const n = name.toLowerCase();
  for (const e of PORTAL_LOGO_MAP) {
    if (e.keywords.some((k) => n.includes(k))) {
      return (
        <div className="w-9 h-9 rounded-lg border border-gray-100 bg-white flex items-center justify-center shrink-0 overflow-hidden">
          <img src={e.src} alt={name} className="w-8 h-8 object-contain"
            onError={(ev) => { (ev.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        </div>
      );
    }
  }
  const initials = name.trim().slice(0, 2).toUpperCase();
  return (
    <div className="w-9 h-9 rounded-lg bg-navy flex items-center justify-center text-cream font-bold text-xs shrink-0">
      {initials}
    </div>
  );
}

// ─── Local types (portal-specific, matches RPC return shape) ─────────────────

interface PortalData {
  proposal: {
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
  // Invoice data embedded in proposal portal (same client)
  invoices?: PortalInvoice[];
  submissions?: PortalSubmission[];
  payments?: PortalPayment[];
}

interface PortalPaymentSetting {
  id: string;
  method_name: string;
  bank_name: string | null;
  account_holder: string;
  account_number: string;
  instructions: string | null;
}

interface PortalInvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface PortalInvoice {
  id: string;
  invoice_number: string;
  title: string;
  status: string;
  issue_date: string;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  outstanding: number;
  currency: string;
  items: PortalInvoiceItem[];
}

interface PortalSubmission {
  id: string;
  invoice_id: string;
  amount: number;
  payment_method: string;
  transaction_ref: string | null;
  payment_date: string;
  status: string;
}

interface PortalPayment {
  id: string;
  invoice_id: string;
  amount: number;
  payment_method: string;
  transaction_ref: string | null;
  payment_date: string;
}

interface InvoiceData {
  client: { name: string; company: string };
  invoices: PortalInvoice[];
  submissions: PortalSubmission[];
  payments: PortalPayment[];
}

type ActiveTab = 'proposal' | 'contract' | 'project' | 'invoices';

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
          <h1 className="text-2xl font-bold text-dark">Link Not Found</h1>
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
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('proposal');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [selectedAction, setSelectedAction] = useState<ProposalResponseAction | null>(null);
  const [comment, setComment] = useState('');

  // Invoice payment proof state
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [paymentSettings, setPaymentSettings] = useState<PortalPaymentSetting[]>([]);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('CBE');
  const [payRef, setPayRef] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payNote, setPayNote] = useState('');
  const [payFile, setPayFile] = useState<File | null>(null);
  const [payPreviewUrl, setPayPreviewUrl] = useState<string | null>(null);
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [paySuccess, setPaySuccess] = useState(false);

  // ── Fetch portal data ──────────────────────────────────────────────────────

  async function fetchPortalData(cancelled: { value: boolean }) {
    if (!token) {
      if (!cancelled.value) {
        setError('This link is invalid or no longer available.');
        setLoading(false);
      }
      return;
    }

    try {
      // Try both token types in parallel, and fetch payment settings
      const [proposalRpc, invoiceRpc, settingsRpc] = await Promise.all([
        supabase.rpc('get_portal_data', { p_token: token }),
        supabase.rpc('get_portal_invoices', { p_token: token }),
        supabase.rpc('get_payment_settings'),
      ]);

      if (cancelled.value) return;

      const hasProposal = !proposalRpc.error && proposalRpc.data !== null;
      const hasInvoices = !invoiceRpc.error && invoiceRpc.data !== null;

      // Store payment settings regardless of token type
      if (!settingsRpc.error && settingsRpc.data) {
        setPaymentSettings(settingsRpc.data as PortalPaymentSetting[]);
      }

      if (!hasProposal && !hasInvoices) {
        setError('This link is invalid, expired, or no longer available.');
      } else {
        if (hasProposal) setData(proposalRpc.data as PortalData);
        if (hasInvoices) {
          setInvoiceData(invoiceRpc.data as InvoiceData);
          // Default to invoices tab if no proposal data
          if (!hasProposal) setActiveTab('invoices');
        }
      }
    } catch {
      if (!cancelled.value) {
        setError('This link is invalid, expired, or no longer available.');
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

  // ── Submit payment proof ────────────────────────────────────────────────────

  async function handlePaymentProofSubmit() {
    if (!token || !selectedInvoiceId) return;
    const amt = Number(payAmount);
    if (!amt || amt <= 0) { setPayError('Amount must be greater than zero'); return; }

    setPaySubmitting(true);
    setPayError(null);

    try {
      let receiptUrl: string | null = null;

      // Upload image to storage if file is attached
      if (payFile) {
        const ext = payFile.name.split('.').pop();
        const path = `receipts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('payment-receipts')
          .upload(path, payFile, { upsert: false });

        if (uploadErr) {
          // Don't block submission if upload fails — just note the filename
          receiptUrl = null;
        } else {
          const { data: urlData } = supabase.storage
            .from('payment-receipts')
            .getPublicUrl(path);
          receiptUrl = urlData.publicUrl;
        }
      }

      const { data: proofData, error: proofErr } = await supabase.rpc('submit_payment_proof_simple', {
        p_token: token,
        p_invoice_id: selectedInvoiceId,
        p_amount: amt,
        p_method: payMethod,
        p_ref: payRef || null,
        p_note: payNote || null,
        p_receipt_url: receiptUrl,
      });
      if (proofErr) throw proofErr;
      const proofResult = proofData as { error?: string; success?: boolean };
      if (proofResult?.error) { setPayError(proofResult.error); return; }

      // Success: refresh data and reset form
      setPaySuccess(true);
      setPayAmount('');
      setPayRef('');
      setPayNote('');
      setPayFile(null);
      if (payPreviewUrl) URL.revokeObjectURL(payPreviewUrl);
      setPayPreviewUrl(null);
      setSelectedInvoiceId(null);

      const cancelled = { value: false };
      await fetchPortalData(cancelled);
    } catch (err: unknown) {
      setPayError(err instanceof Error ? err.message : 'Failed to submit payment proof');
    } finally {
      setPaySubmitting(false);
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

  if (error || (!data && !invoiceData)) {
    return (
      <ErrorScreen
        message={error ?? 'This link is invalid, expired, or no longer available.'}
      />
    );
  }

  // ── Derived flags ──────────────────────────────────────────────────────────

  const hasContract = !!data?.contract;
  const hasProject = !!data?.project;
  const hasExistingResponse = !!data?.response;
  const canRespond = data?.proposal.status === 'Sent' && !hasExistingResponse;

  // Invoice data: prefer embedded in proposal token, fall back to client token
  const activeInvoiceData: InvoiceData | null = invoiceData ?? (
    data?.invoices
      ? {
          client: data.client,
          invoices: data.invoices,
          submissions: data.submissions ?? [],
          payments: data.payments ?? [],
        }
      : null
  );
  const hasInvoices = !!activeInvoiceData && activeInvoiceData.invoices.length >= 0;

  // ── Render: portal ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex flex-col bg-cream">
      {/* ── Header ── */}
      <header className="bg-navy px-6 py-4">
        <div className="max-w-3xl mx-auto flex flex-col">
          <span className="text-gold font-bold text-xl tracking-wide">Connect Digitals</span>
          <span className="text-cream/70 text-sm">Client Portal</span>
        </div>
      </header>

      {/* ── Tab bar ── */}
      {(data || hasInvoices) && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-4 flex gap-6">
            {data && (
              <button
                onClick={() => setActiveTab('proposal')}
                className={`py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'proposal' ? 'border-gold text-dark' : 'border-transparent text-gray-500 hover:text-dark'}`}
              >
                Proposal
              </button>
            )}
            {hasContract && (
              <button
                onClick={() => setActiveTab('contract')}
                className={`py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'contract' ? 'border-gold text-dark' : 'border-transparent text-gray-500 hover:text-dark'}`}
              >
                Contract
              </button>
            )}
            {hasProject && (
              <button
                onClick={() => setActiveTab('project')}
                className={`py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'project' ? 'border-gold text-dark' : 'border-transparent text-gray-500 hover:text-dark'}`}
              >
                Project
              </button>
            )}
            {hasInvoices && (
              <button
                onClick={() => setActiveTab('invoices')}
                className={`py-3 text-sm font-medium transition-colors border-b-2 ${activeTab === 'invoices' ? 'border-gold text-dark' : 'border-transparent text-gray-500 hover:text-dark'}`}
              >
                Invoices
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Body ── */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-6">

        {/* ═══════════════ PROPOSAL TAB ═══════════════ */}
        {activeTab === 'proposal' && data && (
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
        {activeTab === 'contract' && data && data.contract && (
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
        {activeTab === 'project' && data && data.project && (
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
        {/* ═══════════════ INVOICES TAB ═══════════════ */}
        {activeTab === 'invoices' && activeInvoiceData && (
          <div className="space-y-6">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-dark">Your Invoices</h1>
              <p className="text-sm text-gray-600">
                {activeInvoiceData.client.name}{activeInvoiceData.client.company ? ` — ${activeInvoiceData.client.company}` : ''}
              </p>
            </div>

            {activeInvoiceData.invoices.length === 0 ? (
              <div className="bg-white rounded-xl shadow p-6 text-center text-gray-400 text-sm">No invoices yet.</div>
            ) : (
              activeInvoiceData.invoices.map((inv) => {
                const today = new Date().toISOString().split('T')[0];
                const isOverdue = ['Unpaid', 'Partially Paid'].includes(inv.status) && inv.due_date < today && inv.outstanding > 0;
                const displayStatus = isOverdue ? 'Overdue' : inv.status;
                const invSubmissions = activeInvoiceData.submissions.filter((s) => s.invoice_id === inv.id);
                const invPayments = activeInvoiceData.payments.filter((p) => p.invoice_id === inv.id);
                const hasPending = invSubmissions.some((s) => s.status === 'Pending');
                const isExpanded = selectedInvoiceId === inv.id;

                return (
                  <div key={inv.id} className="bg-white rounded-xl shadow overflow-hidden">
                    {/* Invoice header */}
                    <div
                      className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                      onClick={() => setSelectedInvoiceId(isExpanded ? null : inv.id)}
                    >
                      <div>
                        <p className="font-medium text-dark">{inv.invoice_number} — {inv.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Due: {formatDate(inv.due_date)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusPill status={displayStatus} colorMap={PROPOSAL_STATUS_COLORS} />
                        <span className="text-sm font-bold text-brand_red">{etbFormatter.format(inv.outstanding)} remaining</span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-6 pb-6 space-y-4 border-t border-gray-100">
                        {/* Line items */}
                        <div className="overflow-x-auto mt-4">
                          <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium">Description</th>
                                <th className="px-3 py-2 text-right font-medium">Qty</th>
                                <th className="px-3 py-2 text-right font-medium">Unit Price</th>
                                <th className="px-3 py-2 text-right font-medium">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {inv.items.map((item, i) => (
                                <tr key={i}>
                                  <td className="px-3 py-2 text-dark">{item.description}</td>
                                  <td className="px-3 py-2 text-right text-gray-600">{item.quantity}</td>
                                  <td className="px-3 py-2 text-right text-gray-600">{etbFormatter.format(item.unit_price)}</td>
                                  <td className="px-3 py-2 text-right text-gray-600">{etbFormatter.format(item.subtotal)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Totals */}
                        <div className="flex justify-end text-sm space-y-1">
                          <div className="space-y-1 min-w-40">
                            <div className="flex justify-between"><span className="text-gray-500">Total:</span><span className="font-medium">{etbFormatter.format(inv.total_amount)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-500">Paid:</span><span className="text-green-600">{etbFormatter.format(inv.paid_amount)}</span></div>
                            <div className="flex justify-between border-t border-gray-200 pt-1"><span className="font-medium">Outstanding:</span><span className="font-bold text-brand_red">{etbFormatter.format(inv.outstanding)}</span></div>
                          </div>
                        </div>

                        {/* Payment history */}
                        {(invPayments.length > 0 || invSubmissions.length > 0) && (
                          <div className="space-y-2">
                            <h3 className="text-xs font-semibold text-gray-500 uppercase">Payment Activity</h3>
                            {invPayments.map((p, i) => (
                              <div key={i} className="flex justify-between text-sm bg-green-50 rounded px-3 py-2">
                                <span className="text-gray-600">{p.payment_method} · {formatDate(p.payment_date)}</span>
                                <span className="font-medium text-green-700">{etbFormatter.format(p.amount)} — Confirmed</span>
                              </div>
                            ))}
                            {invSubmissions.map((s, i) => (
                              <div key={i} className={`flex justify-between text-sm rounded px-3 py-2 ${s.status === 'Pending' ? 'bg-yellow-50' : s.status === 'Rejected' ? 'bg-red-50' : 'bg-gray-50'}`}>
                                <span className="text-gray-600">{s.payment_method} · {formatDate(s.payment_date)}</span>
                                <span className={`font-medium ${s.status === 'Rejected' ? 'text-red-600' : 'text-yellow-700'}`}>{etbFormatter.format(s.amount)} — {s.status}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Payment proof submission */}
                        {!hasPending && inv.outstanding > 0 && !['Paid','Cancelled'].includes(inv.status) && (
                          <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                            <h3 className="text-sm font-semibold text-gray-700">Submit Payment Proof</h3>

                            {/* Payment methods grid with logos */}
                            {paymentSettings.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pay to any of these accounts</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {paymentSettings.map((ps) => (
                                    <div key={ps.id} className="bg-white border border-gray-200 rounded-lg p-3 flex items-start gap-3">
                                      {/* Logo */}
                                      <PortalMethodLogo name={ps.method_name} />
                                      {/* Details */}
                                      <div className="min-w-0 flex-1">
                                        <p className="font-semibold text-dark text-sm">{ps.method_name}</p>
                                        {ps.bank_name && <p className="text-xs text-gray-500">{ps.bank_name}</p>}
                                        {ps.account_holder && <p className="text-xs text-gray-600">{ps.account_holder}</p>}
                                        {ps.account_number && (
                                          <p className="text-xs font-mono bg-gray-50 rounded px-1.5 py-0.5 mt-1 text-dark inline-block">
                                            {ps.account_number}
                                          </p>
                                        )}
                                        {ps.instructions && <p className="text-xs text-gray-400 italic mt-1">{ps.instructions}</p>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {paySuccess && (
                              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">Your payment proof has been submitted for review.</p>
                            )}
                            {payError && (
                              <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2">{payError}</p>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-dark mb-1">Amount (ETB) *</label>
                                <input type="number" min={1} step={0.01} value={payAmount} onChange={(e) => setPayAmount(e.target.value)}
                                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" placeholder="0" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-dark mb-1">Payment Method *</label>
                                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
                                  {(paymentSettings.length > 0
                                    ? paymentSettings.map((ps) => ps.method_name)
                                    : (['CBE','Telebirr','Bank Transfer','Cash','Other'] as PaymentMethod[])
                                  ).map((m) => <option key={m} value={m}>{m}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-dark mb-1">Transaction Ref</label>
                                <input value={payRef} onChange={(e) => setPayRef(e.target.value)}
                                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" placeholder="Optional" />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-dark mb-1">Payment Date *</label>
                                <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)}
                                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-dark mb-1">Note</label>
                              <textarea value={payNote} onChange={(e) => setPayNote(e.target.value)} rows={2}
                                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy resize-none" placeholder="Optional" />
                            </div>

                            <div>
                              <label className="block text-xs font-medium text-dark mb-1">Receipt / Screenshot (optional)</label>
                              <label className="flex flex-col items-center justify-center gap-2 px-3 py-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-white hover:border-navy transition-colors">
                                {payPreviewUrl ? (
                                  <img src={payPreviewUrl} alt="Receipt preview" className="max-h-48 rounded-lg object-contain w-full" />
                                ) : (
                                  <>
                                    <Upload size={20} className="text-gray-400" />
                                    <span className="text-sm text-gray-500 text-center">Tap to attach receipt image or screenshot</span>
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp,application/pdf"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0] ?? null;
                                    setPayFile(file);
                                    if (payPreviewUrl) URL.revokeObjectURL(payPreviewUrl);
                                    setPayPreviewUrl(file && file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
                                  }}
                                />
                              </label>
                              {payFile && !payPreviewUrl && (
                                <p className="text-xs text-gray-500 mt-1">📎 {payFile.name}</p>
                              )}
                              {payFile && (
                                <button
                                  type="button"
                                  onClick={() => { setPayFile(null); if (payPreviewUrl) URL.revokeObjectURL(payPreviewUrl); setPayPreviewUrl(null); }}
                                  className="text-xs text-brand_red hover:underline mt-1"
                                >
                                  Remove
                                </button>
                              )}
                            </div>

                            <button
                              onClick={() => { setSelectedInvoiceId(inv.id); handlePaymentProofSubmit(); }}
                              disabled={paySubmitting}
                              className="flex items-center gap-2 px-5 py-2 bg-brand_red text-cream rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                              {paySubmitting && <Loader2 size={14} className="animate-spin" />}
                              Submit Payment Proof
                            </button>
                          </div>
                        )}
                        {hasPending && (
                          <div className="space-y-2">
                            {paySuccess && (
                              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2 font-medium">
                                ✓ Your payment proof has been submitted successfully. We will review it shortly.
                              </p>
                            )}
                            <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                              You have a payment proof pending review for this invoice.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
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

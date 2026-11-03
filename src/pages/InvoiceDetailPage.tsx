import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Copy, Loader2, Pencil, Printer, Ban, DollarSign, ExternalLink, Check, X } from 'lucide-react';
import { DocumentHeader, DocumentFooter, DocumentSection } from '../components/DocumentBranding';
import { supabase } from '../lib/supabase';
import StatusBadge from '../components/StatusBadge';
import RecordPaymentModal from '../components/RecordPaymentModal';
import type { Invoice, InvoiceItem, Payment, PaymentSubmission } from '../types';

const INVOICE_COLORS: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Unpaid: 'bg-blue-100 text-blue-800',
  'Partially Paid': 'bg-yellow-100 text-yellow-800',
  Paid: 'bg-green-100 text-green-800',
  Cancelled: 'bg-red-100 text-red-700',
  Overdue: 'bg-red-100 text-red-700',
};

const etbFormatter = new Intl.NumberFormat('en-ET', {
  style: 'currency',
  currency: 'ETB',
  maximumFractionDigits: 0,
});

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface InvoiceWithClient extends Invoice {
  agency_clients: { name: string; company: string } | null;
  agency_projects: { title: string } | null;
}

export default function InvoiceDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [invoice, setInvoice] = useState<InvoiceWithClient | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([]);
  const [portalToken, setPortalToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function fetchData() {
    if (!id) return;
    try {
      const [invRes, itemsRes, payRes, subRes] = await Promise.all([
        supabase.from('agency_invoices').select('*, agency_clients(name, company), agency_projects(title)').eq('id', id).single(),
        supabase.from('agency_invoice_items').select('*').eq('invoice_id', id).order('sort_order'),
        supabase.from('agency_payments').select('*').eq('invoice_id', id).order('created_at', { ascending: false }),
        supabase.from('agency_payment_submissions').select('*').eq('invoice_id', id).order('created_at', { ascending: false }),
      ]);

      if (invRes.error) throw invRes.error;
      setInvoice(invRes.data as unknown as InvoiceWithClient);
      setItems((itemsRes.data as InvoiceItem[]) ?? []);
      setPayments((payRes.data as Payment[]) ?? []);
      setSubmissions((subRes.data as PaymentSubmission[]) ?? []);

      // Fetch proposal portal token for this client (prefer proposal token over client token)
      if (invRes.data) {
        const clientId = (invRes.data as { client_id: string }).client_id;
        // First try to find a proposal portal token for this client
        const { data: proposalTokenData } = await supabase
          .from('agency_proposals')
          .select('portal_token')
          .eq('client_id', clientId)
          .neq('status', 'Draft')
          .order('created_at', { ascending: false })
          .limit(1);

        if (proposalTokenData?.[0]?.portal_token) {
          setPortalToken(proposalTokenData[0].portal_token);
        } else {
          // Fall back to client portal token
          const { data: tokenData } = await supabase
            .from('agency_portal_tokens')
            .select('token')
            .eq('client_id', clientId)
            .eq('is_active', true)
            .limit(1);
          setPortalToken(tokenData?.[0]?.token ?? null);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleCancel() {
    if (!invoice || !id) return;
    if (!window.confirm('Cancel this invoice? This cannot be undone.')) return;
    setActionLoading('cancel');
    setActionError(null);
    try {
      const { error: updErr } = await supabase
        .from('agency_invoices')
        .update({ status: 'Cancelled' })
        .eq('id', id);
      if (updErr) throw updErr;
      await fetchData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to cancel invoice');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleGeneratePortalToken() {
    if (!invoice) return;
    setActionLoading('token');
    try {
      const { data, error: insErr } = await supabase
        .from('agency_portal_tokens')
        .insert({ client_id: invoice.client_id })
        .select('token')
        .single();
      if (insErr) throw insErr;
      setPortalToken((data as { token: string }).token);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to generate token');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleApproveSubmission(subId: string) {
    setActionLoading(`approve-${subId}`);
    setActionError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('approve_payment_submission', {
        p_submission_id: subId,
      });
      if (rpcErr) throw rpcErr;
      const result = data as { error?: string };
      if (result?.error) {
        setActionError(result.error);
        return;
      }
      await fetchData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRejectSubmission(subId: string) {
    setActionLoading(`reject-${subId}`);
    setActionError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('reject_payment_submission', {
        p_submission_id: subId,
        p_reason: '',
      });
      if (rpcErr) throw rpcErr;
      const result = data as { error?: string };
      if (result?.error) {
        setActionError(result.error);
        return;
      }
      await fetchData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  }

  function handleCopyPortalLink() {
    if (!portalToken) return;
    const url = `${window.location.origin}/portal/${portalToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={32} className="animate-spin text-navy" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2">
          {error ?? 'Invoice not found.'}
        </p>
        <Link to="/invoices" className="text-sm text-navy hover:underline">← Back to Invoices</Link>
      </div>
    );
  }

  const outstanding = invoice.total_amount - invoice.paid_amount;
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = ['Unpaid', 'Partially Paid'].includes(invoice.status) && invoice.due_date < today && outstanding > 0;
  const displayStatus = isOverdue ? 'Overdue' : invoice.status;
  const canCancel = invoice.status === 'Unpaid' && invoice.paid_amount === 0;
  const canRecordPayment = ['Unpaid', 'Partially Paid'].includes(invoice.status);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 no-print">
        <div>
          <Link to="/invoices" className="text-sm text-gray-500 hover:text-navy transition-colors">← Invoices</Link>
          <h1 className="text-2xl font-semibold text-dark mt-1">{invoice.title}</h1>
          <p className="text-sm text-gray-500">{invoice.invoice_number}</p>
        </div>
        <StatusBadge status={displayStatus} colorMap={INVOICE_COLORS} />
      </div>

      {actionError && (
        <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2 no-print">{actionError}</p>
      )}

      {/* Invoice document card — printable */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <DocumentHeader
          docType="Invoice"
          docNumber={invoice.invoice_number}
          docDate={`Due: ${formatDate(invoice.due_date)}`}
          badge={<StatusBadge status={displayStatus} colorMap={INVOICE_COLORS} />}
        />

        <div className="px-8 py-8 space-y-8">

          {/* Billed To + Invoice Details */}
          <div className="grid grid-cols-2 gap-6">
            <DocumentSection title="Billed To">
              <div className="bg-cream/50 rounded-lg p-4 text-sm space-y-1">
                <p className="font-semibold text-dark">{invoice.agency_clients?.name ?? '—'}</p>
                {invoice.agency_clients?.company && <p className="text-gray-500">{invoice.agency_clients.company}</p>}
              </div>
            </DocumentSection>
            <DocumentSection title="Invoice Details">
              <div className="bg-cream/50 rounded-lg p-4 text-sm space-y-1">
                <p><span className="text-gray-400">Invoice #:</span> <span className="font-semibold text-dark">{invoice.invoice_number}</span></p>
                <p><span className="text-gray-400">Issue Date:</span> <span className="text-dark">{formatDate(invoice.issue_date)}</span></p>
                <p><span className="text-gray-400">Due Date:</span> <span className="text-dark">{formatDate(invoice.due_date)}</span></p>
                {invoice.agency_projects && <p><span className="text-gray-400">Project:</span> <span className="text-dark">{invoice.agency_projects.title}</span></p>}
              </div>
            </DocumentSection>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-100" />
            <div className="w-2 h-2 bg-gold rounded-full" />
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Line items */}
          <DocumentSection title="Services">
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-navy text-cream text-xs uppercase">
                    <th className="px-4 py-3 text-left font-semibold">Description</th>
                    <th className="px-4 py-3 text-right font-semibold w-16">Qty</th>
                    <th className="px-4 py-3 text-right font-semibold">Unit Price</th>
                    <th className="px-4 py-3 text-right font-semibold">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, i) => (
                    <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-cream/40'}>
                      <td className="px-4 py-2.5 text-dark">{item.description}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{etbFormatter.format(item.unit_price)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{etbFormatter.format(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-navy/5 border-t-2 border-navy">
                    <td colSpan={3} className="px-4 py-3 text-right font-bold text-dark uppercase text-xs tracking-wide">Total Amount</td>
                    <td className="px-4 py-3 text-right font-bold text-navy text-base">{etbFormatter.format(invoice.total_amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </DocumentSection>

          {/* Payment summary */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-100" />
            <div className="w-2 h-2 bg-gold rounded-full" />
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          <DocumentSection title="Payment Summary">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-cream/50 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-400 uppercase font-medium mb-1">Total</p>
                <p className="font-bold text-dark">{etbFormatter.format(invoice.total_amount)}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-xs text-gray-400 uppercase font-medium mb-1">Paid</p>
                <p className="font-bold text-green-600">{etbFormatter.format(invoice.paid_amount)}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4 text-center border border-red-100">
                <p className="text-xs text-gray-400 uppercase font-medium mb-1">Outstanding</p>
                <p className="font-bold text-brand_red">{etbFormatter.format(outstanding)}</p>
              </div>
            </div>
          </DocumentSection>

        </div>
        <DocumentFooter />
      </div>

      {/* Portal link */}
      <div className="bg-white rounded-xl shadow p-6 no-print">
        <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Client Portal Link</h2>
        {portalToken ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
              <ExternalLink size={14} className="text-gray-400 shrink-0" />
              <span className="text-sm text-gray-600 flex-1 truncate">
                {`${window.location.origin}/portal/${portalToken}`}
              </span>
              <button onClick={handleCopyPortalLink} className="flex items-center gap-1 text-xs text-navy hover:underline shrink-0">
                <Copy size={13} />{copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-gray-400">This is the client's existing portal link — it shows their proposals and invoices.</p>
          </div>
        ) : (
          <button
            onClick={handleGeneratePortalToken}
            disabled={actionLoading === 'token'}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-dark rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {actionLoading === 'token' ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
            Generate Portal Link
          </button>
        )}
      </div>

      {/* Payment history */}
      <div className="bg-white rounded-xl shadow p-6 space-y-3 no-print">
        <h2 className="text-sm font-semibold text-gray-500 uppercase">Payment History</h2>
        {payments.length === 0 ? (
          <p className="text-sm text-gray-400">No confirmed payments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Date</th>
                  <th className="px-4 py-2 text-left font-medium">Method</th>
                  <th className="px-4 py-2 text-left font-medium">Reference</th>
                  <th className="px-4 py-2 text-left font-medium">Source</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((pay) => (
                  <tr key={pay.id}>
                    <td className="px-4 py-2 text-gray-600">{formatDate(pay.payment_date)}</td>
                    <td className="px-4 py-2 text-gray-600">{pay.payment_method}</td>
                    <td className="px-4 py-2 text-gray-600">{pay.transaction_ref ?? '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{pay.source}</td>
                    <td className="px-4 py-2 text-right text-green-600 font-medium">{etbFormatter.format(pay.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pending submissions */}
      {submissions.filter((s) => s.status === 'Pending').length > 0 && (
        <div className="bg-white rounded-xl shadow p-6 space-y-3 no-print">
          <h2 className="text-sm font-semibold text-gray-500 uppercase">Pending Payment Submissions</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Date</th>
                  <th className="px-4 py-2 text-left font-medium">Method</th>
                  <th className="px-4 py-2 text-left font-medium">Reference</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                  <th className="px-4 py-2 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {submissions.filter((s) => s.status === 'Pending').map((sub) => (
                  <tr key={sub.id}>
                    <td className="px-4 py-2 text-gray-600">{formatDate(sub.payment_date)}</td>
                    <td className="px-4 py-2 text-gray-600">{sub.payment_method}</td>
                    <td className="px-4 py-2 text-gray-600">{sub.transaction_ref ?? '—'}</td>
                    <td className="px-4 py-2 text-right text-dark font-medium">{etbFormatter.format(sub.amount)}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleApproveSubmission(sub.id)}
                          disabled={actionLoading === `approve-${sub.id}`}
                          className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === `approve-${sub.id}` ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectSubmission(sub.id)}
                          disabled={actionLoading === `reject-${sub.id}`}
                          className="flex items-center gap-1 px-2 py-1 border border-red-500 text-red-600 rounded text-xs font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === `reject-${sub.id}` ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap no-print">
        {invoice.status === 'Draft' && (
          <button
            onClick={() => navigate(`/invoices/${id}/edit`)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-dark rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            <Pencil size={14} /> Edit
          </button>
        )}
        {canRecordPayment && (
          <button
            onClick={() => setShowPaymentModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-navy text-cream rounded-lg text-sm font-medium hover:bg-blue-900 transition-colors"
          >
            <DollarSign size={14} /> Record Payment
          </button>
        )}
        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={actionLoading === 'cancel'}
            className="flex items-center gap-2 px-4 py-2 border border-red-500 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {actionLoading === 'cancel' ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
            Cancel Invoice
          </button>
        )}
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-dark rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <Printer size={14} /> Print / Download
        </button>
      </div>

      {/* Record Payment Modal */}
      {showPaymentModal && invoice && (
        <RecordPaymentModal
          invoice={invoice}
          onClose={() => setShowPaymentModal(false)}
          onSuccess={fetchData}
        />
      )}
    </div>
  );
}

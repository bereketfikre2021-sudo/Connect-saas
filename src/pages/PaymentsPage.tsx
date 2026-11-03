import { useEffect, useState, useCallback } from 'react';
import { Loader2, Check, X, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import StatusBadge from '../components/StatusBadge';
import type { PaymentSubmission, Payment } from '../types';

const etbFormatter = new Intl.NumberFormat('en-ET', {
  style: 'currency',
  currency: 'ETB',
  maximumFractionDigits: 0,
});

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface SubmissionRow extends PaymentSubmission {
  agency_invoices: {
    invoice_number: string;
    total_amount: number;
    paid_amount: number;
    agency_clients: { name: string } | null;
  } | null;
}

interface PaymentRow extends Payment {
  agency_invoices: { invoice_number: string; agency_clients: { name: string } | null } | null;
}

export default function PaymentsPage() {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [subRes, payRes] = await Promise.all([
        supabase
          .from('agency_payment_submissions')
          .select('*, agency_invoices(invoice_number, total_amount, paid_amount, agency_clients(name))')
          .eq('status', 'Pending')
          .order('created_at', { ascending: false }),
        supabase
          .from('agency_payments')
          .select('*, agency_invoices(invoice_number, agency_clients(name))')
          .order('created_at', { ascending: false })
          .limit(20),
      ]);
      if (subRes.error) throw subRes.error;
      if (payRes.error) throw payRes.error;
      setSubmissions((subRes.data ?? []) as unknown as SubmissionRow[]);
      setPayments((payRes.data ?? []) as unknown as PaymentRow[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleApprove(subId: string) {
    setActionLoading(`approve-${subId}`);
    setActionError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('approve_payment_submission', { p_submission_id: subId });
      if (rpcErr) throw rpcErr;
      const result = data as { error?: string };
      if (result?.error) { setActionError(result.error); return; }
      await fetchData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(subId: string) {
    setActionLoading(`reject-${subId}`);
    setActionError(null);
    try {
      const { data, error: rpcErr } = await supabase.rpc('reject_payment_submission', { p_submission_id: subId, p_reason: '' });
      if (rpcErr) throw rpcErr;
      const result = data as { error?: string };
      if (result?.error) { setActionError(result.error); return; }
      await fetchData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-dark">Payments</h1>

      {(error || actionError) && (
        <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2">
          {error ?? actionError}
        </p>
      )}

      {/* ── Pending Submissions ── */}
      <div>
        <h2 className="text-base font-semibold text-dark mb-3">
          Pending Submissions{submissions.length > 0 && ` (${submissions.length})`}
        </h2>

        <div className="space-y-3">
          {loading ? (
            <div className="bg-white rounded-xl shadow flex justify-center py-10">
              <Loader2 size={24} className="animate-spin text-navy" />
            </div>
          ) : submissions.length === 0 ? (
            <div className="bg-white rounded-xl shadow px-5 py-8 text-center">
              <p className="text-sm text-gray-400">No pending submissions.</p>
            </div>
          ) : (
            submissions.map((sub) => {
              const isExpanded = expandedId === sub.id;
              return (
                <div key={sub.id} className="bg-white rounded-xl shadow overflow-hidden">
                  {/* Summary row */}
                  <div
                    className="flex items-center justify-between gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                  >
                    {/* Left: invoice + client */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-navy text-sm">
                          {sub.agency_invoices?.invoice_number ?? '—'}
                        </span>
                        <span className="text-gray-500 text-sm">
                          {sub.agency_invoices?.agency_clients?.name ?? '—'}
                        </span>
                        {sub.notes && (
                          <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                            <MessageSquare size={10} /> Note
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                        <span>{sub.payment_method}</span>
                        {sub.transaction_ref && <span>Ref: {sub.transaction_ref}</span>}
                        <span>{formatDate(sub.payment_date)}</span>
                      </div>
                    </div>

                    {/* Right: amount + expand */}
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-bold text-dark">{etbFormatter.format(sub.amount)}</span>
                      {isExpanded
                        ? <ChevronUp size={16} className="text-gray-400" />
                        : <ChevronDown size={16} className="text-gray-400" />
                      }
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 px-5 py-4 space-y-4 bg-gray-50">
                      {/* Detail grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-400 uppercase font-medium">Invoice</p>
                          <p className="text-dark font-medium">{sub.agency_invoices?.invoice_number ?? '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase font-medium">Client</p>
                          <p className="text-dark">{sub.agency_invoices?.agency_clients?.name ?? '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase font-medium">Submitted Amount</p>
                          <p className="text-dark font-bold">{etbFormatter.format(sub.amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase font-medium">Invoice Total</p>
                          <p className="text-dark">{etbFormatter.format(sub.agency_invoices?.total_amount ?? 0)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase font-medium">Already Paid</p>
                          <p className="text-green-600">{etbFormatter.format(sub.agency_invoices?.paid_amount ?? 0)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase font-medium">Remaining Balance</p>
                          <p className="font-bold text-brand_red">
                            {etbFormatter.format((sub.agency_invoices?.total_amount ?? 0) - (sub.agency_invoices?.paid_amount ?? 0))}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase font-medium">Payment Method</p>
                          <p className="text-dark">{sub.payment_method}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase font-medium">Transaction Ref</p>
                          <p className="text-dark">{sub.transaction_ref || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase font-medium">Payment Date</p>
                          <p className="text-dark">{formatDate(sub.payment_date)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase font-medium">Submitted</p>
                          <p className="text-dark">{formatDate(sub.created_at)}</p>
                        </div>
                      </div>

                      {/* Notes / receipt info */}
                      {sub.notes && (
                        <div className="bg-white border border-amber-200 rounded-lg p-3">
                          <p className="text-xs font-medium text-amber-700 uppercase mb-1 flex items-center gap-1">
                            <MessageSquare size={11} /> Client Note
                          </p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{sub.notes}</p>
                        </div>
                      )}

                      {/* Receipt image */}
                      {sub.receipt_path && sub.receipt_path.startsWith('http') && (
                        <div className="bg-white border border-gray-200 rounded-lg p-3">
                          <p className="text-xs font-medium text-gray-500 uppercase mb-2">Receipt / Screenshot</p>
                          <a href={sub.receipt_path} target="_blank" rel="noopener noreferrer">
                            <img
                              src={sub.receipt_path}
                              alt="Payment receipt"
                              className="max-h-64 rounded-lg object-contain w-full border border-gray-100 hover:opacity-90 transition-opacity"
                            />
                            <p className="text-xs text-navy mt-1 hover:underline">Click to open full size ↗</p>
                          </a>
                        </div>
                      )}

                      {!sub.notes && (!sub.receipt_path || !sub.receipt_path.startsWith('http')) && (
                        <p className="text-xs text-gray-400 italic">No additional notes or receipt from client.</p>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center gap-3 pt-1">
                        <button
                          onClick={() => handleApprove(sub.id)}
                          disabled={actionLoading === `approve-${sub.id}`}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === `approve-${sub.id}` ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          Approve Payment
                        </button>
                        <button
                          onClick={() => handleReject(sub.id)}
                          disabled={actionLoading === `reject-${sub.id}`}
                          className="flex items-center gap-2 px-4 py-2 border border-red-500 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === `reject-${sub.id}` ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Recent Confirmed Payments ── */}
      <div>
        <h2 className="text-base font-semibold text-dark mb-3">Recent Confirmed Payments</h2>

        <div className="bg-white rounded-xl shadow overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 size={24} className="animate-spin text-navy" />
            </div>
          ) : payments.length === 0 ? (
            <p className="text-sm text-gray-400 px-5 py-8 text-center">No confirmed payments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Invoice</th>
                    <th className="px-4 py-3 text-left font-medium">Client</th>
                    <th className="px-4 py-3 text-right font-medium">Amount</th>
                    <th className="px-4 py-3 text-left font-medium">Method</th>
                    <th className="px-4 py-3 text-left font-medium">Reference</th>
                    <th className="px-4 py-3 text-left font-medium">Date</th>
                    <th className="px-4 py-3 text-left font-medium">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payments.map((pay) => (
                    <tr key={pay.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-navy">
                        {pay.agency_invoices?.invoice_number ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {pay.agency_invoices?.agency_clients?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-green-600 font-medium">
                        {etbFormatter.format(pay.amount)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{pay.payment_method}</td>
                      <td className="px-4 py-3 text-gray-600">{pay.transaction_ref ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(pay.payment_date)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={pay.source}
                          colorMap={{ Manual: 'bg-blue-100 text-blue-800', Submission: 'bg-purple-100 text-purple-800' }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

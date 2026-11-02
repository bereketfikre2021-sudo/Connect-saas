import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Invoice, PaymentMethod } from '../types';

const METHODS: PaymentMethod[] = ['CBE', 'Telebirr', 'Bank Transfer', 'Cash', 'Other'];

const etbFormatter = new Intl.NumberFormat('en-ET', {
  style: 'currency',
  currency: 'ETB',
  maximumFractionDigits: 0,
});

interface RecordPaymentModalProps {
  invoice: Invoice;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RecordPaymentModal({ invoice, onClose, onSuccess }: RecordPaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CBE');
  const [ref, setRef] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = invoice.total_amount - invoice.paid_amount;

  async function handleSubmit() {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError('Amount must be greater than zero');
      return;
    }
    if (amt > remaining) {
      setError(`Amount exceeds remaining balance (${etbFormatter.format(remaining)})`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc('record_manual_payment', {
        p_invoice_id: invoice.id,
        p_amount: amt,
        p_method: method,
        p_ref: ref || null,
        p_payment_date: paymentDate,
        p_notes: notes || null,
      });

      if (rpcError) throw rpcError;
      const result = data as { error?: string; success?: boolean };
      if (result?.error) {
        setError(result.error);
        return;
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-dark">Record Payment</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-dark transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Invoice summary */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
            <p><span className="text-gray-500">Invoice:</span> <span className="font-medium text-dark">{invoice.invoice_number}</span></p>
            <p><span className="text-gray-500">Total:</span> <span className="font-medium text-dark">{etbFormatter.format(invoice.total_amount)}</span></p>
            <p><span className="text-gray-500">Paid:</span> <span className="font-medium text-dark">{etbFormatter.format(invoice.paid_amount)}</span></p>
            <p><span className="text-gray-500">Remaining:</span> <span className="font-bold text-brand_red">{etbFormatter.format(remaining)}</span></p>
          </div>

          {error && (
            <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
          )}

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-dark mb-1">Amount (ETB) *</label>
            <input
              type="number"
              min={1}
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
              placeholder="0"
            />
          </div>

          {/* Payment method */}
          <div>
            <label className="block text-sm font-medium text-dark mb-1">Payment Method *</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
            >
              {METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Transaction ref */}
          <div>
            <label className="block text-sm font-medium text-dark mb-1">Transaction / Reference #</label>
            <input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
              placeholder="Optional"
            />
          </div>

          {/* Payment date */}
          <div>
            <label className="block text-sm font-medium text-dark mb-1">Payment Date *</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-dark mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy resize-none"
              placeholder="Optional"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-500 hover:text-dark transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-brand_red text-cream rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Record Payment
          </button>
        </div>
      </div>
    </div>
  );
}

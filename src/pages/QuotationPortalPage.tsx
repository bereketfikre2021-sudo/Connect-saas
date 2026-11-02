import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Printer } from 'lucide-react';
import { supabase } from '../lib/supabase';

const etb = new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB', maximumFractionDigits: 0 });
const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

interface PortalQuotation {
  quotation_number: string; title: string; status: string;
  issue_date: string; validity_date: string | null; estimated_delivery: string | null;
  currency: string; subtotal: number; discount_type: string | null;
  discount_value: number; discount_amount: number; total: number;
  scope: string | null; deliverables: string | null; timeline: string | null;
  terms: string | null; payment_terms: string | null; notes: string | null;
}
interface PortalItem { service_name: string; description: string | null; quantity: number; unit: string; unit_price: number; line_total: number; }
interface PortalClient { name: string; company: string; }
interface PortalResponse { action: string; comment: string | null; responded_at: string; }
interface PortalData { quotation: PortalQuotation; client: PortalClient; items: PortalItem[]; response: PortalResponse | null; }

export default function QuotationPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<'Accepted' | 'Rejected' | 'Changes Requested' | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) { setError('Invalid link'); setLoading(false); return; }
    supabase.rpc('get_quotation_portal', { p_token: token })
      .then(({ data: d, error: e }) => {
        if (e || !d) setError('This quotation link is invalid or no longer available.');
        else setData(d as PortalData);
        setLoading(false);
      });
  }, [token]);

  async function handleRespond() {
    if (!action || !token) return;
    setSubmitting(true); setSubmitError(null);
    const { data: res, error: e } = await supabase.rpc('respond_to_quotation', { p_token: token, p_action: action, p_comment: comment });
    if (e) { setSubmitError(e.message); setSubmitting(false); return; }
    const r = res as { error?: string; success?: boolean };
    if (r?.error) { setSubmitError(r.error); setSubmitting(false); return; }
    // Refresh
    const { data: fresh } = await supabase.rpc('get_quotation_portal', { p_token: token });
    if (fresh) setData(fresh as PortalData);
    setSubmitted(true); setSubmitting(false);
  }

  if (loading) return (
    <div className="min-h-screen bg-cream flex flex-col">
      <div className="bg-navy px-6 py-4"><span className="text-gold font-bold text-xl">Connect Digitals</span></div>
      <div className="flex-1 flex items-center justify-center"><Loader2 size={28} className="animate-spin text-navy" /></div>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen bg-cream flex flex-col">
      <div className="bg-navy px-6 py-4"><span className="text-gold font-bold text-xl">Connect Digitals</span></div>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center space-y-3 max-w-md">
          <h1 className="text-2xl font-bold text-dark">Quotation Not Found</h1>
          <p className="text-gray-500">{error ?? 'This link is invalid or no longer available.'}</p>
        </div>
      </div>
    </div>
  );

  const q = data.quotation;
  const canRespond = q.status === 'Sent' && !data.response && !submitted;

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="bg-navy px-6 py-4 no-print">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <span className="text-gold font-bold text-xl tracking-wide">Connect Digitals</span>
            <p className="text-cream/60 text-xs mt-0.5">Client Quotation Portal</p>
          </div>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-cream rounded-lg text-sm transition-colors">
            <Printer size={14} /> Print / Save PDF
          </button>
        </div>
      </header>
      {/* Gold bar */}
      <div className="h-1 bg-gold no-print" />

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

        {/* Document */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Navy print header */}
          <div className="bg-navy px-8 py-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/Connect.jpg" alt="" className="w-12 h-12 rounded-full object-cover border-2 border-gold" />
              <div>
                <p className="text-gold font-bold text-lg">Connect Digitals</p>
                <p className="text-cream/60 text-xs">Digital Marketing &amp; Management Services</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-gold/70 text-xs font-semibold uppercase tracking-widest">Quotation</p>
              <p className="text-cream font-bold text-lg">{q.quotation_number}</p>
            </div>
          </div>
          <div className="h-1 bg-gold" />

          <div className="px-8 py-8 space-y-8">
            {/* Client + meta */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-400 uppercase font-medium mb-2">Prepared For</p>
                <div className="bg-cream/50 rounded-lg p-4 text-sm space-y-0.5">
                  <p className="font-semibold text-dark">{data.client.name}</p>
                  {data.client.company && <p className="text-gray-500">{data.client.company}</p>}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-medium mb-2">Quotation Details</p>
                <div className="bg-cream/50 rounded-lg p-4 text-sm space-y-1">
                  <p><span className="text-gray-400">Issued:</span> <span className="text-dark">{fmt(q.issue_date)}</span></p>
                  {q.validity_date && <p><span className="text-gray-400">Valid until:</span> <span className="text-dark">{fmt(q.validity_date)}</span></p>}
                  {q.estimated_delivery && <p><span className="text-gray-400">Est. delivery:</span> <span className="text-dark">{q.estimated_delivery}</span></p>}
                </div>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-dark">{q.title}</h2>

            {/* Divider */}
            <div className="flex items-center gap-3"><div className="flex-1 h-px bg-gray-100" /><div className="w-2 h-2 bg-gold rounded-full" /><div className="flex-1 h-px bg-gray-100" /></div>

            {/* Line items */}
            <div>
              <p className="text-xs font-bold text-navy uppercase tracking-widest mb-3 flex items-center gap-2"><span className="w-1 h-4 bg-gold rounded-full inline-block" />Services &amp; Pricing</p>
              <div className="overflow-x-auto rounded-lg border border-gray-100">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-navy text-cream text-xs uppercase">
                      <th className="px-4 py-3 text-left">Service</th>
                      <th className="px-4 py-3 text-left">Description</th>
                      <th className="px-4 py-3 text-right w-16">Qty</th>
                      <th className="px-4 py-3 text-left w-16">Unit</th>
                      <th className="px-4 py-3 text-right">Unit Price</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.items.map((item, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-cream/40'}>
                        <td className="px-4 py-2.5 font-medium text-dark">{item.service_name}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{item.description ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right">{item.quantity}</td>
                        <td className="px-4 py-2.5 text-gray-500">{item.unit}</td>
                        <td className="px-4 py-2.5 text-right">{etb.format(item.unit_price)}</td>
                        <td className="px-4 py-2.5 text-right font-medium">{etb.format(item.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 border-t border-gray-200">
                      <td colSpan={5} className="px-4 py-2 text-right text-xs text-gray-500 uppercase font-medium">Subtotal</td>
                      <td className="px-4 py-2 text-right text-dark">{etb.format(q.subtotal)}</td>
                    </tr>
                    {q.discount_amount > 0 && (
                      <tr className="bg-gray-50">
                        <td colSpan={5} className="px-4 py-2 text-right text-xs text-green-600 uppercase font-medium">
                          Discount {q.discount_type === 'percentage' ? `(${q.discount_value}%)` : ''}
                        </td>
                        <td className="px-4 py-2 text-right text-green-600">− {etb.format(q.discount_amount)}</td>
                      </tr>
                    )}
                    <tr className="bg-navy/5 border-t-2 border-navy">
                      <td colSpan={5} className="px-4 py-3 text-right font-bold text-dark uppercase text-xs tracking-wide">Grand Total</td>
                      <td className="px-4 py-3 text-right font-bold text-navy text-base">{etb.format(q.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Optional sections */}
            {[
              { key: 'scope',         label: 'Project Scope' },
              { key: 'deliverables',  label: 'Deliverables' },
              { key: 'timeline',      label: 'Timeline' },
              { key: 'payment_terms', label: 'Payment Terms' },
              { key: 'terms',         label: 'Terms & Conditions' },
              { key: 'notes',         label: 'Notes' },
            ].filter(s => Boolean((q as unknown as Record<string, unknown>)[s.key])).map(s => (
              <div key={s.key}>
                <div className="flex items-center gap-3 mb-4"><div className="flex-1 h-px bg-gray-100" /><div className="w-2 h-2 bg-gold rounded-full" /><div className="flex-1 h-px bg-gray-100" /></div>
                <p className="text-xs font-bold text-navy uppercase tracking-widest mb-3 flex items-center gap-2"><span className="w-1 h-4 bg-gold rounded-full inline-block" />{s.label}</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-cream/50 rounded-lg p-4">{String((q as unknown as Record<string, unknown>)[s.key])}</p>
              </div>
            ))}

            {/* Acceptance signature area */}
            <div className="flex items-center gap-3"><div className="flex-1 h-px bg-gray-100" /><div className="w-2 h-2 bg-gold rounded-full" /><div className="flex-1 h-px bg-gray-100" /></div>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-4">Client Acceptance</p>
                <div className="border-b border-gray-300 mb-2" style={{ height: 40 }} />
                <p className="text-xs text-gray-400">Signature &amp; Date</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-4">Authorised by Connect Digitals</p>
                <div className="border-b border-gray-300 mb-2" style={{ height: 40 }} />
                <p className="text-xs text-gray-400">Signature &amp; Date</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-0">
            <div className="h-0.5 bg-gold" />
            <div className="bg-navy px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-cream/60">
              <div className="flex items-center gap-2">
                <img src="/Connect.jpg" alt="" className="w-6 h-6 rounded-full object-cover opacity-80" />
                <span className="font-semibold text-cream/80">Connect Digitals</span>
              </div>
              <div className="text-center space-y-0.5">
                <p>Addis Ababa, Ethiopia · +251 923 988 883</p>
                <a href="https://connectdigitals.pro.et" target="_blank" rel="noopener noreferrer" className="text-gold/80 hover:text-gold transition-colors">connectdigitals.pro.et</a>
              </div>
              <p className="text-cream/40">Digital Marketing &amp; Management Services</p>
            </div>
          </div>
        </div>

        {/* Response section */}
        {canRespond && (
          <div className="bg-white rounded-xl shadow p-6 space-y-4 no-print">
            <h2 className="text-base font-semibold text-dark">Your Response</h2>
            {submitError && <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2">{submitError}</p>}
            <div className="flex flex-wrap gap-3">
              {(['Accepted', 'Rejected', 'Changes Requested'] as const).map(a => (
                <button key={a} onClick={() => setAction(a)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    action === a
                      ? a === 'Accepted' ? 'bg-green-600 text-white border-green-600' : a === 'Rejected' ? 'bg-brand_red text-white border-brand_red' : 'bg-yellow-500 text-white border-yellow-500'
                      : 'border-gray-300 text-dark hover:bg-gray-50'
                  }`}>{a}</button>
              ))}
            </div>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3}
              placeholder="Add a comment or message (optional)…"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy resize-none" />
            <button onClick={handleRespond} disabled={!action || submitting}
              className="flex items-center gap-2 px-5 py-2 bg-brand_red text-cream rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Submit Response
            </button>
          </div>
        )}

        {/* Already responded */}
        {(data.response || submitted) && data.response && (
          <div className="bg-white rounded-xl shadow p-6 space-y-2 no-print">
            <h2 className="text-base font-semibold text-dark">Your Response</h2>
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
              ✓ Your response has been recorded. Thank you.
            </p>
            <p className="text-sm text-dark font-medium">{data.response.action}</p>
            {data.response.comment && <p className="text-sm text-gray-600 italic">"{data.response.comment}"</p>}
            <p className="text-xs text-gray-400">{fmt(data.response.responded_at)}</p>
          </div>
        )}
      </div>

      <footer className="py-6 text-center text-xs text-gray-400 border-t border-gray-200 no-print">
        Connect Digitals — Digital Marketing &amp; Management Services
      </footer>
    </div>
  );
}

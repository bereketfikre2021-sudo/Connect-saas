import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Loader2, Copy, ExternalLink, Pencil, Printer, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import StatusBadge from '../components/StatusBadge';
import { DocumentHeader, DocumentFooter, DocumentSection } from '../components/DocumentBranding';
import type { Quotation, QuotationItem, QuotationResponse } from '../types';

const STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600', Sent: 'bg-blue-100 text-blue-800',
  Accepted: 'bg-green-100 text-green-800', Rejected: 'bg-red-100 text-red-700', Expired: 'bg-orange-100 text-orange-700',
};
const etb = new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB', maximumFractionDigits: 0 });
const fmt = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

interface QuotWithClient extends Quotation {
  agency_clients: { name: string; company: string; email: string } | null;
}

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quotation, setQuotation] = useState<QuotWithClient | null>(null);
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [response, setResponse] = useState<QuotationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [converting, setConverting] = useState(false);

  async function fetchData() {
    if (!id) return;
    const [qRes, iRes, rRes] = await Promise.all([
      supabase.from('agency_quotations').select('*, agency_clients(name, company, email)').eq('id', id).single(),
      supabase.from('agency_quotation_items').select('*').eq('quotation_id', id).order('sort_order'),
      supabase.from('agency_quotation_responses').select('*').eq('quotation_id', id).maybeSingle(),
    ]);
    if (qRes.error) { setError(qRes.error.message); setLoading(false); return; }
    setQuotation(qRes.data as unknown as QuotWithClient);
    setItems((iRes.data ?? []) as QuotationItem[]);
    setResponse(rRes.data as QuotationResponse | null);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, [id]);

  function copyPortalLink() {
    if (!quotation) return;
    navigator.clipboard.writeText(`${window.location.origin}/quotation-portal/${quotation.access_token}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  async function convertToProposal() {
    if (!quotation || !quotation.agency_clients) return;
    setConverting(true);
    try {
      const { data: prop, error: pe } = await supabase.from('agency_proposals').insert({
        client_id: quotation.client_id, title: quotation.title,
        deliverables: quotation.deliverables, terms: quotation.terms,
        items: items.map(i => ({ id: crypto.randomUUID(), description: `${i.service_name}${i.description ? ' — ' + i.description : ''}`, quantity: i.quantity, unit_price: i.unit_price, subtotal: i.line_total })),
        total_amount: quotation.total, currency: quotation.currency,
      }).select().single();
      if (pe) throw pe;
      await supabase.from('agency_quotations').update({ converted_proposal_id: (prop as { id: string }).id }).eq('id', id!);
      navigate(`/proposals/${(prop as { id: string }).id}`);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Conversion failed'); }
    finally { setConverting(false); }
  }

  async function convertToProject() {
    if (!quotation) return;
    setConverting(true);
    try {
      const { data: proj, error: pe } = await supabase.from('agency_projects').insert({
        client_id: quotation.client_id, title: quotation.title,
        description: quotation.scope, budget: quotation.total, service: 'Quoted Service',
      }).select().single();
      if (pe) throw pe;
      await supabase.from('agency_quotations').update({ converted_project_id: (proj as { id: string }).id }).eq('id', id!);
      navigate(`/projects/${(proj as { id: string }).id}`);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Conversion failed'); }
    finally { setConverting(false); }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-navy" /></div>;
  if (error || !quotation) return (
    <div className="space-y-4">
      <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2">{error ?? 'Not found'}</p>
      <Link to="/quotations" className="text-sm text-navy hover:underline">← Quotations</Link>
    </div>
  );

  const portalUrl = `${window.location.origin}/quotation-portal/${quotation.access_token}`;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Admin header */}
      <div className="flex items-start justify-between gap-4 no-print">
        <div>
          <Link to="/quotations" className="text-sm text-gray-500 hover:text-navy">← Quotations</Link>
          <h1 className="text-2xl font-semibold text-dark mt-1">{quotation.title}</h1>
          <p className="text-sm text-gray-500">{quotation.quotation_number}</p>
        </div>
        <StatusBadge status={quotation.status} colorMap={STATUS_COLORS} />
      </div>

      {error && <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2 no-print">{error}</p>}

      {/* Portal link */}
      {quotation.status !== 'Draft' && (
        <div className="bg-white rounded-xl shadow p-5 no-print">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Client Portal Link</h2>
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <ExternalLink size={14} className="text-gray-400 shrink-0" />
            <span className="text-sm text-gray-600 flex-1 truncate">{portalUrl}</span>
            <button onClick={copyPortalLink} className="flex items-center gap-1 text-xs text-navy hover:underline shrink-0">
              <Copy size={13} />{copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Client response */}
      {response && (
        <div className="bg-white rounded-xl shadow p-5 no-print">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">Client Response</h2>
          <div className="flex items-center gap-2 mb-2">
            <StatusBadge status={response.action} colorMap={{ Accepted: 'bg-green-100 text-green-800', Rejected: 'bg-red-100 text-red-700', 'Changes Requested': 'bg-yellow-100 text-yellow-800' }} />
            <span className="text-xs text-gray-400">{fmt(response.responded_at)}</span>
          </div>
          {response.comment && <p className="text-sm text-gray-600 italic">"{response.comment}"</p>}
        </div>
      )}

      {/* Quotation document */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <DocumentHeader
          docType="Quotation"
          docNumber={quotation.quotation_number}
          docDate={`Issued: ${fmt(quotation.issue_date)}${quotation.validity_date ? ` · Valid until: ${fmt(quotation.validity_date)}` : ''}`}
          badge={<StatusBadge status={quotation.status} colorMap={STATUS_COLORS} />}
        />

        <div className="px-8 py-8 space-y-8">
          {/* Client + meta */}
          <div className="grid grid-cols-2 gap-6">
            <DocumentSection title="Prepared For">
              <div className="bg-cream/50 rounded-lg p-4 text-sm space-y-0.5">
                <p className="font-semibold text-dark">{quotation.agency_clients?.name ?? '—'}</p>
                {quotation.agency_clients?.company && <p className="text-gray-500">{quotation.agency_clients.company}</p>}
                {quotation.agency_clients?.email && <p className="text-gray-500">{quotation.agency_clients.email}</p>}
              </div>
            </DocumentSection>
            <DocumentSection title="Quotation Details">
              <div className="bg-cream/50 rounded-lg p-4 text-sm space-y-1">
                <p><span className="text-gray-400">Quote #:</span> <span className="font-semibold text-dark">{quotation.quotation_number}</span></p>
                <p><span className="text-gray-400">Issued:</span> <span className="text-dark">{fmt(quotation.issue_date)}</span></p>
                {quotation.validity_date && <p><span className="text-gray-400">Valid until:</span> <span className="text-dark">{fmt(quotation.validity_date)}</span></p>}
                {quotation.estimated_delivery && <p><span className="text-gray-400">Est. delivery:</span> <span className="text-dark">{quotation.estimated_delivery}</span></p>}
              </div>
            </DocumentSection>
          </div>

          <div className="flex items-center gap-3"><div className="flex-1 h-px bg-gray-100" /><div className="w-2 h-2 bg-gold rounded-full" /><div className="flex-1 h-px bg-gray-100" /></div>

          {/* Line items */}
          <DocumentSection title="Services & Pricing">
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
                  {items.map((item, i) => (
                    <tr key={item.id} className={i % 2 === 0 ? 'bg-white' : 'bg-cream/40'}>
                      <td className="px-4 py-2.5 font-medium text-dark">{item.service_name}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{item.description ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-gray-600">{item.unit}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{etb.format(item.unit_price)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-600">{etb.format(item.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t border-gray-200">
                    <td colSpan={5} className="px-4 py-2 text-right text-xs text-gray-500 uppercase font-medium">Subtotal</td>
                    <td className="px-4 py-2 text-right text-dark">{etb.format(quotation.subtotal)}</td>
                  </tr>
                  {quotation.discount_amount > 0 && (
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="px-4 py-2 text-right text-xs text-green-600 uppercase font-medium">
                        Discount {quotation.discount_type === 'percentage' ? `(${quotation.discount_value}%)` : ''}
                      </td>
                      <td className="px-4 py-2 text-right text-green-600">− {etb.format(quotation.discount_amount)}</td>
                    </tr>
                  )}
                  <tr className="bg-navy/5 border-t-2 border-navy">
                    <td colSpan={5} className="px-4 py-3 text-right font-bold text-dark uppercase text-xs tracking-wide">Grand Total</td>
                    <td className="px-4 py-3 text-right font-bold text-navy text-base">{etb.format(quotation.total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </DocumentSection>

          {/* Optional sections */}
          {[
            { key: 'scope',         label: 'Project Scope' },
            { key: 'deliverables',  label: 'Deliverables' },
            { key: 'timeline',      label: 'Timeline' },
            { key: 'payment_terms', label: 'Payment Terms' },
            { key: 'terms',         label: 'Terms & Conditions' },
            { key: 'notes',         label: 'Notes' },
          ].filter(s => Boolean((quotation as unknown as Record<string, unknown>)[s.key])).map(s => (
              <div key={s.key}>
                <div className="flex items-center gap-3 mb-4"><div className="flex-1 h-px bg-gray-100" /><div className="w-2 h-2 bg-gold rounded-full" /><div className="flex-1 h-px bg-gray-100" /></div>
                <DocumentSection title={s.label}>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap bg-cream/50 rounded-lg p-4 leading-relaxed">
                    {(quotation as unknown as Record<string, string>)[s.key]}
                  </p>
                </DocumentSection>
              </div>
          ))}

          {/* Acceptance area */}
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
        <DocumentFooter />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 flex-wrap no-print">
        {quotation.status === 'Draft' && (
          <button onClick={() => navigate(`/quotations/${id}/edit`)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-dark rounded-lg text-sm font-medium hover:bg-gray-50">
            <Pencil size={14} /> Edit
          </button>
        )}
        <button onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-dark rounded-lg text-sm font-medium hover:bg-gray-50">
          <Printer size={14} /> Print / Download
        </button>
        {quotation.status === 'Accepted' && !quotation.converted_proposal_id && (
          <button onClick={convertToProposal} disabled={converting}
            className="flex items-center gap-2 px-4 py-2 bg-navy text-cream rounded-lg text-sm font-medium hover:bg-blue-900 disabled:opacity-50">
            {converting ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
            Convert to Proposal
          </button>
        )}
        {quotation.status === 'Accepted' && !quotation.converted_project_id && (
          <button onClick={convertToProject} disabled={converting}
            className="flex items-center gap-2 px-4 py-2 border border-gold text-dark rounded-lg text-sm font-medium hover:bg-gold/10 disabled:opacity-50">
            {converting ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
            Convert to Project
          </button>
        )}
        {quotation.converted_proposal_id && (
          <button onClick={() => navigate(`/proposals/${quotation.converted_proposal_id}`)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100">
            View Proposal →
          </button>
        )}
        {quotation.converted_project_id && (
          <button onClick={() => navigate(`/projects/${quotation.converted_project_id}`)}
            className="flex items-center gap-2 px-4 py-2 bg-gold/10 text-dark rounded-lg text-sm font-medium hover:bg-gold/20">
            View Project →
          </button>
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Printer, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DocumentHeader, DocumentFooter, DocumentSection } from '../components/DocumentBranding';
import type { Contract, ContractContent } from '../types';

const etbFormatter = new Intl.NumberFormat('en-ET', {
  style: 'currency',
  currency: 'ETB',
  maximumFractionDigits: 0,
});

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

export default function ContractPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchContract() {
      if (!id) return;
      try {
        const { data, error: fetchError } = await supabase
          .from('agency_contracts').select('*').eq('id', id).single();
        if (cancelled) return;
        if (fetchError) throw fetchError;
        setContract(data as Contract);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load contract');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchContract();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-navy" /></div>;
  if (error || !contract) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2">{error ?? 'Contract not found.'}</p>
        <button onClick={() => navigate('/proposals')} className="text-sm text-navy hover:underline">← Back to Proposals</button>
      </div>
    );
  }

  const content: ContractContent = contract.content;

  return (
    <div className="min-h-screen bg-cream">
      {/* Admin toolbar */}
      <div className="no-print flex items-center gap-3 px-6 py-3 bg-white border-b border-gray-200 sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="text-sm text-gray-500 hover:text-dark transition-colors">← Back</button>
        <div className="flex-1" />
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-navy text-cream rounded-lg text-sm font-medium hover:bg-blue-900 transition-colors"
        >
          <Printer size={15} /> Print / Download
        </button>
      </div>

      {/* Contract document */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">

          <DocumentHeader
            docType="Service Contract"
            docNumber={`Contract #${contract.id.slice(0, 8).toUpperCase()}`}
            docDate={`Issued: ${formatDate(content.issued_at)}`}
          />

          <div className="px-8 py-8 space-y-8">

            {/* Client info */}
            <DocumentSection title="Client Information">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm bg-cream/50 rounded-lg p-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase font-medium">Name</p>
                  <p className="font-semibold text-dark">{content.client_name}</p>
                </div>
                {content.client_company && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-medium">Company</p>
                    <p className="font-semibold text-dark">{content.client_company}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-400 uppercase font-medium">Email</p>
                  <p className="text-dark">{content.client_email}</p>
                </div>
              </div>
            </DocumentSection>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-100" />
              <div className="w-2 h-2 bg-gold rounded-full" />
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* Services */}
            <DocumentSection title={`Agreed Services — ${content.proposal_title}`}>
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
                    {content.items.map((item, i) => (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-cream/40'}>
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
                      <td className="px-4 py-3 text-right font-bold text-navy text-base">{etbFormatter.format(content.total_amount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </DocumentSection>

            {/* Divider */}
            {(content.deliverables || content.terms) && (
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-100" />
                <div className="w-2 h-2 bg-gold rounded-full" />
                <div className="flex-1 h-px bg-gray-100" />
              </div>
            )}

            {/* Deliverables */}
            {content.deliverables && (
              <DocumentSection title="Deliverables">
                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-cream/50 rounded-lg p-4 leading-relaxed">
                  {content.deliverables}
                </p>
              </DocumentSection>
            )}

            {/* Terms */}
            {content.terms && (
              <DocumentSection title="Terms & Conditions">
                <p className="text-sm text-gray-700 whitespace-pre-wrap bg-cream/50 rounded-lg p-4 leading-relaxed">
                  {content.terms}
                </p>
              </DocumentSection>
            )}

          </div>

          <DocumentFooter />
        </div>
      </div>
    </div>
  );
}

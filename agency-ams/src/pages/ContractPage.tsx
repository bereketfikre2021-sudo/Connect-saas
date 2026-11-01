import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Printer, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Contract, ContractContent } from '../types';

const etbFormatter = new Intl.NumberFormat('en-ET', {
  style: 'currency',
  currency: 'ETB',
  maximumFractionDigits: 0,
});

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
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
          .from('agency_contracts')
          .select('*')
          .eq('id', id)
          .single();

        if (cancelled) return;
        if (fetchError) throw fetchError;

        setContract(data as Contract);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load contract');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchContract();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={32} className="animate-spin text-navy" />
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2">
          {error ?? 'Contract not found.'}
        </p>
        <button
          onClick={() => navigate('/proposals')}
          className="text-sm text-navy hover:underline"
        >
          ← Back to Proposals
        </button>
      </div>
    );
  }

  const content: ContractContent = contract.content;

  return (
    <div className="min-h-screen bg-white text-dark">
      {/* No-print controls */}
      <div className="no-print flex items-center gap-3 p-6 bg-cream border-b border-gray-200">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-500 hover:text-dark transition-colors"
        >
          ← Back
        </button>
        <div className="flex-1" />
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-navy text-cream rounded-lg text-sm font-medium hover:bg-blue-900 transition-colors"
        >
          <Printer size={15} />
          Print / Download
        </button>
      </div>

      {/* Printable contract body */}
      <div className="max-w-3xl mx-auto px-8 py-12 space-y-8">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-bold text-navy tracking-wide uppercase">Connect Digitals</h1>
          <p className="text-sm text-gray-500">Digital Marketing &amp; Management Services</p>
        </div>

        <hr className="border-gray-200" />

        {/* Contract heading */}
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-dark uppercase tracking-wide">Service Contract</h2>
          <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
            <p><span className="font-medium text-dark">Contract ID:</span> {contract.id.slice(0, 8).toUpperCase()}</p>
            <p><span className="font-medium text-dark">Issued:</span> {formatDate(content.issued_at)}</p>
          </div>
        </div>

        {/* Client section */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-500 uppercase border-b border-gray-200 pb-1">
            Client Information
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <p><span className="font-medium text-dark">Name:</span> {content.client_name}</p>
            {content.client_company && (
              <p><span className="font-medium text-dark">Company:</span> {content.client_company}</p>
            )}
            <p><span className="font-medium text-dark">Email:</span> {content.client_email}</p>
          </div>
        </div>

        {/* Services table */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-500 uppercase border-b border-gray-200 pb-1">
            Agreed Services — {content.proposal_title}
          </h3>
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
              {content.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-2 text-dark">{item.description}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{item.quantity}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{etbFormatter.format(item.unit_price)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{etbFormatter.format(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-right text-sm font-bold text-dark pt-2">
            Total: {etbFormatter.format(content.total_amount)}
          </p>
        </div>

        {/* Deliverables */}
        {content.deliverables && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-500 uppercase border-b border-gray-200 pb-1">
              Deliverables
            </h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{content.deliverables}</p>
          </div>
        )}

        {/* Terms */}
        {content.terms && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-500 uppercase border-b border-gray-200 pb-1">
              Terms &amp; Conditions
            </h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{content.terms}</p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-200 pt-6 text-center text-xs text-gray-400 space-y-1">
          <p>Connect Digitals Agency Management System</p>
          <p>This document is auto-generated and serves as a record of agreed services.</p>
        </div>
      </div>
    </div>
  );
}

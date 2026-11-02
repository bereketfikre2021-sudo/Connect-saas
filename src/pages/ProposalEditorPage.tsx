import { useEffect, useState, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Client, Proposal, ProposalItem } from '../types';

interface FormState {
  title: string;
  client_id: string;
  introduction: string;
  deliverables: string;
  terms: string;
  expiry_date: string;
  items: ProposalItem[];
}

function blankItem(): ProposalItem {
  return {
    id: crypto.randomUUID(),
    description: '',
    quantity: 1,
    unit_price: 0,
    subtotal: 0,
  };
}

export default function ProposalEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [clients, setClients] = useState<Client[]>([]);
  const [existingProposal, setExistingProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    title: '',
    client_id: '',
    introduction: '',
    deliverables: '',
    terms: '',
    expiry_date: '',
    items: [blankItem()],
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const clientsRes = await supabase
          .from('agency_clients')
          .select('*')
          .eq('is_archived', false)
          .order('name');

        if (cancelled) return;
        if (clientsRes.error) throw clientsRes.error;
        setClients((clientsRes.data as Client[]) ?? []);

        if (id) {
          const proposalRes = await supabase
            .from('agency_proposals')
            .select('*')
            .eq('id', id)
            .single();

          if (cancelled) return;
          if (proposalRes.error) throw proposalRes.error;

          const p = proposalRes.data as Proposal;
          setExistingProposal(p);

          if (p.status === 'Draft') {
            setForm({
              title: p.title,
              client_id: p.client_id,
              introduction: p.introduction ?? '',
              deliverables: p.deliverables ?? '',
              terms: p.terms ?? '',
              expiry_date: p.expiry_date ?? '',
              items: Array.isArray(p.items) && p.items.length > 0 ? p.items : [blankItem()],
            });
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [id]);

  function updateItem(index: number, field: keyof ProposalItem, value: string | number) {
    setForm((prev) => {
      const items = prev.items.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        updated.subtotal = updated.quantity * updated.unit_price;
        return updated;
      });
      return { ...prev, items };
    });
  }

  function addItem() {
    setForm((prev) => ({ ...prev, items: [...prev.items, blankItem()] }));
  }

  function removeItem(index: number) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  }

  const total = form.items.reduce((sum, item) => sum + item.subtotal, 0);

  async function save(status: 'Draft' | 'Sent') {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: form.title,
        client_id: form.client_id,
        introduction: form.introduction || null,
        deliverables: form.deliverables || null,
        terms: form.terms || null,
        expiry_date: form.expiry_date || null,
        items: form.items,
        total_amount: total,
        currency: 'ETB',
        status,
      };

      let savedId: string;

      if (id) {
        // UPDATE — keep existing status for draft edits, use new status for publish
        const finalStatus = existingProposal?.status === 'Draft' ? status : existingProposal?.status;
        const { data, error: updateError } = await supabase
          .from('agency_proposals')
          .update({ ...payload, status: finalStatus })
          .eq('id', id)
          .select()
          .single();
        if (updateError) throw updateError;
        savedId = (data as { id: string }).id;
      } else {
        // INSERT
        const { data, error: insertError } = await supabase
          .from('agency_proposals')
          .insert({ ...payload, items: form.items })
          .select()
          .single();
        if (insertError) throw insertError;
        savedId = (data as { id: string }).id;
      }

      navigate(`/proposals/${savedId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save proposal');
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(e: FormEvent, status: 'Draft' | 'Sent') {
    e.preventDefault();
    save(status);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={32} className="animate-spin text-navy" />
      </div>
    );
  }

  // Read-only lock for non-Draft proposals
  if (id && existingProposal && existingProposal.status !== 'Draft') {
    const etbFormatter = new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      maximumFractionDigits: 0,
    });

    return (
      <div className="space-y-6 max-w-3xl">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-800">
          This proposal has been published and cannot be edited.
        </div>

        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="text-xl font-semibold text-dark">{existingProposal.title}</h2>
          {existingProposal.introduction && (
            <p className="text-gray-600 text-sm">{existingProposal.introduction}</p>
          )}

          <table className="min-w-full text-sm border border-gray-200 rounded">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Description</th>
                <th className="px-4 py-2 text-right font-medium">Qty</th>
                <th className="px-4 py-2 text-right font-medium">Unit Price</th>
                <th className="px-4 py-2 text-right font-medium">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {existingProposal.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-2 text-dark">{item.description}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{item.quantity}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{etbFormatter.format(item.unit_price)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{etbFormatter.format(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-right font-semibold text-dark">
            Total: {etbFormatter.format(existingProposal.total_amount)}
          </p>

          {existingProposal.deliverables && (
            <div>
              <h3 className="text-sm font-semibold text-dark mb-1">Deliverables</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{existingProposal.deliverables}</p>
            </div>
          )}
          {existingProposal.terms && (
            <div>
              <h3 className="text-sm font-semibold text-dark mb-1">Terms</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{existingProposal.terms}</p>
            </div>
          )}
        </div>

        <button
          onClick={() => navigate(`/proposals/${id}`)}
          className="px-4 py-2 border border-gray-300 text-dark rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Back to Proposal
        </button>
      </div>
    );
  }

  return (
    <form className="space-y-6 max-w-3xl" onSubmit={(e) => e.preventDefault()}>
      <h1 className="text-2xl font-semibold text-dark">
        {id ? 'Edit Proposal' : 'New Proposal'}
      </h1>

      {error && (
        <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="text-base font-semibold text-dark">Basic Info</h2>

        <div>
          <label className="block text-sm font-medium text-dark mb-1">Title *</label>
          <input
            required
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
            placeholder="Proposal title"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark mb-1">Client *</label>
          <select
            required
            value={form.client_id}
            onChange={(e) => setForm((p) => ({ ...p, client_id: e.target.value }))}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
          >
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-dark mb-1">Introduction</label>
          <textarea
            value={form.introduction}
            onChange={(e) => setForm((p) => ({ ...p, introduction: e.target.value }))}
            rows={3}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy resize-y"
            placeholder="Brief introduction or cover message…"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark mb-1">Expiry Date</label>
          <input
            type="date"
            value={form.expiry_date}
            onChange={(e) => setForm((p) => ({ ...p, expiry_date: e.target.value }))}
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
          />
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="text-base font-semibold text-dark">Line Items</h2>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Description</th>
                <th className="px-3 py-2 text-right font-medium w-20">Qty</th>
                <th className="px-3 py-2 text-right font-medium w-32">Unit Price</th>
                <th className="px-3 py-2 text-right font-medium w-32">Subtotal</th>
                <th className="px-3 py-2 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {form.items.map((item, idx) => (
                <tr key={item.id}>
                  <td className="px-3 py-2">
                    <input
                      value={item.description}
                      onChange={(e) => updateItem(idx, 'description', e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
                      placeholder="Service or item description"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, 'quantity', Number(e.target.value))}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-navy"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={item.unit_price}
                      onChange={(e) => updateItem(idx, 'unit_price', Number(e.target.value))}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-navy"
                    />
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600 font-medium">
                    {item.subtotal.toLocaleString('en-ET')}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {form.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="p-1 text-gray-400 hover:text-brand_red transition-colors"
                        aria-label="Remove item"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1 text-sm text-navy hover:underline"
          >
            <Plus size={14} />
            Add Item
          </button>
          <p className="text-sm font-semibold text-dark">
            Total: {new Intl.NumberFormat('en-ET', {
              style: 'currency',
              currency: 'ETB',
              maximumFractionDigits: 0,
            }).format(total)}
          </p>
        </div>
      </div>

      {/* Deliverables & Terms */}
      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="text-base font-semibold text-dark">Deliverables &amp; Terms</h2>

        <div>
          <label className="block text-sm font-medium text-dark mb-1">Deliverables</label>
          <textarea
            value={form.deliverables}
            onChange={(e) => setForm((p) => ({ ...p, deliverables: e.target.value }))}
            rows={4}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy resize-y"
            placeholder="What will be delivered…"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark mb-1">Terms &amp; Conditions</label>
          <textarea
            value={form.terms}
            onChange={(e) => setForm((p) => ({ ...p, terms: e.target.value }))}
            rows={4}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy resize-y"
            placeholder="Payment terms, conditions, cancellation policy…"
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={(e) => handleSubmit(e, 'Draft')}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-dark rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          Save as Draft
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={(e) => handleSubmit(e, 'Sent')}
          className="flex items-center gap-2 px-4 py-2 bg-brand_red text-cream rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          Publish
        </button>
        <button
          type="button"
          onClick={() => navigate(id ? `/proposals/${id}` : '/proposals')}
          className="px-4 py-2 text-sm text-gray-500 hover:text-dark transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

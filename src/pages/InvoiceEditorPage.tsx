import { useEffect, useState, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Client, Project, Invoice, InvoiceItem } from '../types';

interface FormState {
  title: string;
  client_id: string;
  project_id: string;
  issue_date: string;
  due_date: string;
  notes: string;
  items: InvoiceItem[];
}

function blankItem(): InvoiceItem {
  return {
    id: crypto.randomUUID(),
    invoice_id: '',
    description: '',
    quantity: 1,
    unit_price: 0,
    subtotal: 0,
    sort_order: 0,
  };
}

const etbFormatter = new Intl.NumberFormat('en-ET', {
  style: 'currency',
  currency: 'ETB',
  maximumFractionDigits: 0,
});

export default function InvoiceEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [existingInvoice, setExistingInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({
    title: '',
    client_id: '',
    project_id: '',
    issue_date: new Date().toISOString().split('T')[0],
    due_date: '',
    notes: '',
    items: [blankItem()],
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const [clientsRes, projectsRes] = await Promise.all([
          supabase.from('agency_clients').select('*').eq('is_archived', false).order('name'),
          supabase.from('agency_projects').select('*').order('title'),
        ]);

        if (cancelled) return;
        if (clientsRes.error) throw clientsRes.error;
        if (projectsRes.error) throw projectsRes.error;
        setClients((clientsRes.data as Client[]) ?? []);
        setProjects((projectsRes.data as Project[]) ?? []);

        if (id) {
          const invRes = await supabase
            .from('agency_invoices')
            .select('*')
            .eq('id', id)
            .single();

          if (cancelled) return;
          if (invRes.error) throw invRes.error;

          const inv = invRes.data as Invoice;
          setExistingInvoice(inv);

          if (inv.status === 'Draft') {
            const itemsRes = await supabase
              .from('agency_invoice_items')
              .select('*')
              .eq('invoice_id', id)
              .order('sort_order');

            if (cancelled) return;
            const items = (itemsRes.data as InvoiceItem[]) ?? [];

            setForm({
              title: inv.title,
              client_id: inv.client_id,
              project_id: inv.project_id ?? '',
              issue_date: inv.issue_date ?? '',
              due_date: inv.due_date ?? '',
              notes: inv.notes ?? '',
              items: items.length > 0 ? items : [blankItem()],
            });
          }
        }
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [id]);

  function updateItem(index: number, field: keyof InvoiceItem, value: string | number) {
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
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { ...blankItem(), sort_order: prev.items.length }],
    }));
  }

  function removeItem(index: number) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  }

  const total = form.items.reduce((sum, item) => sum + item.subtotal, 0);

  async function save(status: 'Draft' | 'Unpaid') {
    if (!form.client_id) {
      setError('Please select a client');
      return;
    }
    if (!form.due_date) {
      setError('Please set a due date');
      return;
    }
    if (form.items.length === 0 || form.items.every((i) => !i.description)) {
      setError('Add at least one line item');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Always save invoice as Draft first so the trigger allows item inserts.
      // If publishing, we promote to Unpaid after items are saved.
      const invoicePayload = {
        client_id: form.client_id,
        project_id: form.project_id || null,
        title: form.title,
        issue_date: form.issue_date,
        due_date: form.due_date,
        notes: form.notes || null,
        status: 'Draft' as const,
      };

      let savedId: string;

      if (id) {
        // Update existing draft
        const { data, error: updErr } = await supabase
          .from('agency_invoices')
          .update(invoicePayload)
          .eq('id', id)
          .select()
          .single();
        if (updErr) throw updErr;
        savedId = (data as { id: string }).id;

        // Delete existing items so we can re-insert updated ones
        const { error: delErr } = await supabase
          .from('agency_invoice_items')
          .delete()
          .eq('invoice_id', savedId);
        if (delErr) throw delErr;
      } else {
        // Create new invoice as Draft
        const { data, error: insErr } = await supabase
          .from('agency_invoices')
          .insert(invoicePayload)
          .select()
          .single();
        if (insErr) throw insErr;
        if (!data || !(data as { id?: string }).id) {
          throw new Error('Invoice was created but no ID was returned.');
        }
        savedId = (data as { id: string }).id;
      }

      // Insert line items — invoice is Draft so the trigger allows this
      const itemsToInsert = form.items
        .filter((i) => i.description.trim())
        .map((item, idx) => ({
          invoice_id: savedId,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          sort_order: idx,
        }));

      if (itemsToInsert.length > 0) {
        const { error: itemsErr } = await supabase
          .from('agency_invoice_items')
          .insert(itemsToInsert);
        if (itemsErr) throw itemsErr;
      }

      // Now promote to Unpaid if publishing (items are saved, trigger is satisfied)
      if (status === 'Unpaid') {
        const { error: statusErr } = await supabase
          .from('agency_invoices')
          .update({ status: 'Unpaid' })
          .eq('id', savedId);
        if (statusErr) throw statusErr;
      }

      navigate(`/invoices/${savedId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save invoice');
    } finally {
      setSaving(false);
    }
  }

  function handleSubmit(e: FormEvent, status: 'Draft' | 'Unpaid') {
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

  // Read-only lock for non-Draft invoices
  if (id && existingInvoice && existingInvoice.status !== 'Draft') {
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-800">
          This invoice has been published and cannot be edited.
        </div>
        <div className="bg-white rounded-xl shadow p-6 space-y-3">
          <h2 className="text-xl font-semibold text-dark">{existingInvoice.title}</h2>
          <p className="text-gray-500 text-sm">{existingInvoice.invoice_number}</p>
          <p className="text-right font-semibold text-dark">
            Total: {etbFormatter.format(existingInvoice.total_amount)}
          </p>
        </div>
        <button
          onClick={() => navigate(`/invoices/${id}`)}
          className="px-4 py-2 border border-gray-300 text-dark rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Back to Invoice
        </button>
      </div>
    );
  }

  const filteredProjects = form.client_id
    ? projects.filter((p) => p.client_id === form.client_id)
    : projects;

  return (
    <form className="space-y-6 max-w-3xl" onSubmit={(e) => e.preventDefault()}>
      <h1 className="text-2xl font-semibold text-dark">
        {id ? 'Edit Invoice' : 'New Invoice'}
      </h1>

      {error && (
        <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
      )}

      {/* Basic Info */}
      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="text-base font-semibold text-dark">Basic Info</h2>

        <div>
          <label className="block text-sm font-medium text-dark mb-1">Title *</label>
          <input
            required
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
            placeholder="Invoice title"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-dark mb-1">Client *</label>
          <select
            required
            value={form.client_id}
            onChange={(e) => setForm((p) => ({ ...p, client_id: e.target.value, project_id: '' }))}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
          >
            <option value="">Select a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-dark mb-1">Project (optional)</label>
          <select
            value={form.project_id}
            onChange={(e) => setForm((p) => ({ ...p, project_id: e.target.value }))}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
          >
            <option value="">No linked project</option>
            {filteredProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-dark mb-1">Issue Date *</label>
            <input
              type="date"
              required
              value={form.issue_date}
              onChange={(e) => setForm((p) => ({ ...p, issue_date: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark mb-1">Due Date *</label>
            <input
              type="date"
              required
              value={form.due_date}
              onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-dark mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            rows={2}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy resize-none"
            placeholder="Internal notes (not shown to client)"
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
                      placeholder="Description"
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
                    {etbFormatter.format(item.subtotal)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {form.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="p-1 text-gray-400 hover:text-brand_red transition-colors"
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
            Total: {etbFormatter.format(total)}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={saving}
          onClick={(e) => handleSubmit(e, 'Draft')}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-dark rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Save as Draft
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={(e) => handleSubmit(e, 'Unpaid')}
          className="flex items-center gap-2 px-4 py-2 bg-brand_red text-cream rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          Publish
        </button>
        <button
          type="button"
          onClick={() => navigate(id ? `/invoices/${id}` : '/invoices')}
          className="px-4 py-2 text-sm text-gray-500 hover:text-dark transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

import { useEffect, useState, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2, Loader2, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Client, Quotation, QuotationItem } from '../types';

interface LineItem extends Omit<QuotationItem, 'id' | 'quotation_id' | 'line_total'> {
  _id: string;
  line_total: number;
}

const blank = (): LineItem => ({
  _id: crypto.randomUUID(), service_name: '', description: '', quantity: 1,
  unit: 'item', unit_price: 0, sort_order: 0, line_total: 0,
});

const etb = new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB', maximumFractionDigits: 0 });

export default function QuotationEditorPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [clients, setClients] = useState<Client[]>([]);
  const [existing, setExisting] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<LineItem[]>([blank()]);

  const [form, setForm] = useState({
    client_id: '', title: '',
    issue_date: new Date().toISOString().split('T')[0],
    validity_date: '', estimated_delivery: '',
    discount_type: '' as '' | 'fixed' | 'percentage',
    discount_value: 0,
    scope: '', deliverables: '', timeline: '',
    terms: '', payment_terms: '', notes: '',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: cl } = await supabase.from('agency_clients').select('*').eq('is_archived', false).order('name');
      if (cancelled) return;
      setClients((cl ?? []) as Client[]);
      if (id) {
        const { data: q } = await supabase.from('agency_quotations').select('*').eq('id', id).single();
        if (cancelled || !q) return;
        const quot = q as Quotation;
        setExisting(quot);
        setForm({
          client_id: quot.client_id, title: quot.title,
          issue_date: quot.issue_date, validity_date: quot.validity_date ?? '',
          estimated_delivery: quot.estimated_delivery ?? '',
          discount_type: (quot.discount_type ?? '') as '' | 'fixed' | 'percentage',
          discount_value: quot.discount_value,
          scope: quot.scope ?? '', deliverables: quot.deliverables ?? '',
          timeline: quot.timeline ?? '', terms: quot.terms ?? '',
          payment_terms: quot.payment_terms ?? '', notes: quot.notes ?? '',
        });
        const { data: its } = await supabase.from('agency_quotation_items').select('*').eq('quotation_id', id).order('sort_order');
        if (!cancelled && its?.length) {
          setItems((its as QuotationItem[]).map(i => ({ ...i, _id: i.id })));
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  function updateItem(idx: number, field: keyof LineItem, value: string | number) {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      updated.line_total = Number(updated.quantity) * Number(updated.unit_price);
      return updated;
    }));
  }

  const subtotal = items.reduce((s, i) => s + i.line_total, 0);
  const discountAmount = form.discount_type === 'percentage'
    ? Math.round(subtotal * form.discount_value) / 100
    : form.discount_type === 'fixed' ? Math.min(form.discount_value, subtotal) : 0;
  const total = subtotal - discountAmount;

  async function save(status: 'Draft' | 'Sent') {
    if (!form.client_id) { setError('Select a client'); return; }
    if (!form.title.trim()) { setError('Title required'); return; }
    setSaving(true); setError(null);
    try {
      const payload = {
        client_id: form.client_id, title: form.title.trim(),
        issue_date: form.issue_date, validity_date: form.validity_date || null,
        estimated_delivery: form.estimated_delivery || null,
        discount_type: form.discount_type || null, discount_value: form.discount_value,
        scope: form.scope || null, deliverables: form.deliverables || null,
        timeline: form.timeline || null, terms: form.terms || null,
        payment_terms: form.payment_terms || null, notes: form.notes || null,
        status,
      };

      let savedId: string;
      if (id) {
        const { data, error: e } = await supabase.from('agency_quotations').update(payload).eq('id', id).select().single();
        if (e) throw e;
        savedId = (data as { id: string }).id;
        await supabase.from('agency_quotation_items').delete().eq('quotation_id', savedId);
      } else {
        const { data, error: e } = await supabase.from('agency_quotations').insert(payload).select().single();
        if (e) throw e;
        savedId = (data as { id: string }).id;
      }

      const itemsToInsert = items.filter(i => i.service_name.trim()).map((item, idx) => ({
        quotation_id: savedId, service_name: item.service_name, description: item.description || null,
        quantity: item.quantity, unit: item.unit, unit_price: item.unit_price, sort_order: idx,
      }));
      if (itemsToInsert.length) {
        const { error: ie } = await supabase.from('agency_quotation_items').insert(itemsToInsert);
        if (ie) throw ie;
      }
      navigate(`/quotations/${savedId}`);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setSaving(false); }
  }

  const handleSubmit = (e: FormEvent, status: 'Draft' | 'Sent') => { e.preventDefault(); save(status); };

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-navy" /></div>;

  if (id && existing && existing.status !== 'Draft') {
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-800">
          This quotation has been published and cannot be edited.
        </div>
        <button onClick={() => navigate(`/quotations/${id}`)}
          className="px-4 py-2 border border-gray-300 text-dark rounded-lg text-sm hover:bg-gray-50">← Back to Quotation</button>
      </div>
    );
  }

  const inputCls = 'w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy';
  const labelCls = 'block text-xs font-medium text-dark mb-1';

  return (
    <form className="space-y-6 max-w-4xl" onSubmit={e => e.preventDefault()}>
      <h1 className="text-2xl font-semibold text-dark">{id ? 'Edit Quotation' : 'New Quotation'}</h1>
      {error && <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

      {/* Basic info */}
      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="text-sm font-semibold text-dark">Basic Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className={labelCls}>Title *</label>
            <input value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} className={inputCls} placeholder="Quotation title" />
          </div>
          <div>
            <label className={labelCls}>Client *</label>
            <select value={form.client_id} onChange={e => setForm(p => ({...p, client_id: e.target.value}))} className={inputCls}>
              <option value="">Select client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.company ? ` — ${c.company}` : ''}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Estimated Delivery</label>
            <input value={form.estimated_delivery} onChange={e => setForm(p => ({...p, estimated_delivery: e.target.value}))} className={inputCls} placeholder="e.g. 4–6 weeks" />
          </div>
          <div>
            <label className={labelCls}>Issue Date</label>
            <input type="date" value={form.issue_date} onChange={e => setForm(p => ({...p, issue_date: e.target.value}))} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Valid Until</label>
            <input type="date" value={form.validity_date} onChange={e => setForm(p => ({...p, validity_date: e.target.value}))} className={inputCls} />
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="text-sm font-semibold text-dark">Line Items</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="px-3 py-2 text-left">Service / Item</th>
                <th className="px-3 py-2 text-left">Description</th>
                <th className="px-3 py-2 text-right w-16">Qty</th>
                <th className="px-3 py-2 text-left w-20">Unit</th>
                <th className="px-3 py-2 text-right w-28">Unit Price</th>
                <th className="px-3 py-2 text-right w-28">Total</th>
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, idx) => (
                <tr key={item._id}>
                  <td className="px-3 py-2">
                    <input value={item.service_name} onChange={e => updateItem(idx, 'service_name', e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-navy" placeholder="Service name" />
                  </td>
                  <td className="px-3 py-2">
                    <input value={item.description ?? ''} onChange={e => updateItem(idx, 'description', e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-navy" placeholder="Optional" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min={0.01} step={0.01} value={item.quantity} onChange={e => updateItem(idx, 'quantity', Number(e.target.value))}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-navy" />
                  </td>
                  <td className="px-3 py-2">
                    <input value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min={0} step={0.01} value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', Number(e.target.value))}
                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-navy" />
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-dark">{etb.format(item.line_total)}</td>
                  <td className="px-3 py-2">
                    {items.length > 1 && (
                      <button type="button" onClick={() => setItems(p => p.filter((_, i) => i !== idx))}
                        className="p-1 text-gray-400 hover:text-brand_red"><Trash2 size={13} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between pt-1">
          <button type="button" onClick={() => setItems(p => [...p, { ...blank(), sort_order: p.length }])}
            className="flex items-center gap-1 text-sm text-navy hover:underline"><Plus size={14} /> Add Item</button>
          <div className="text-right space-y-1 text-sm min-w-56">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{etb.format(subtotal)}</span></div>
            {form.discount_type && <div className="flex justify-between text-green-600"><span>Discount</span><span>− {etb.format(discountAmount)}</span></div>}
            <div className="flex justify-between font-bold text-dark border-t border-gray-200 pt-1"><span>Total</span><span>{etb.format(total)}</span></div>
          </div>
        </div>

        {/* Discount */}
        <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
          <label className="text-xs font-medium text-dark">Discount:</label>
          <select value={form.discount_type} onChange={e => setForm(p => ({...p, discount_type: e.target.value as '' | 'fixed' | 'percentage', discount_value: 0}))}
            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
            <option value="">None</option>
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed Amount (ETB)</option>
          </select>
          {form.discount_type && (
            <input type="number" min={0} step={0.01} value={form.discount_value}
              onChange={e => setForm(p => ({...p, discount_value: Number(e.target.value)}))}
              className="w-28 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-navy"
              placeholder={form.discount_type === 'percentage' ? '0%' : 'ETB 0'} />
          )}
        </div>
      </div>

      {/* Optional sections */}
      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <h2 className="text-sm font-semibold text-dark">Optional Sections</h2>
        {[
          { key: 'scope', label: 'Project Scope' },
          { key: 'deliverables', label: 'Deliverables' },
          { key: 'timeline', label: 'Timeline' },
          { key: 'payment_terms', label: 'Payment Terms' },
          { key: 'terms', label: 'Terms & Conditions' },
          { key: 'notes', label: 'Notes' },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className={labelCls}>{label}</label>
            <textarea value={String((form as unknown as Record<string, unknown>)[key] ?? '')} rows={3}
              onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
              className={`${inputCls} resize-y`} placeholder={`Enter ${label.toLowerCase()}…`} />
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button type="button" disabled={saving} onClick={e => handleSubmit(e, 'Draft')}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-dark rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save as Draft
        </button>
        <button type="button" disabled={saving} onClick={e => handleSubmit(e, 'Sent')}
          className="flex items-center gap-2 px-4 py-2 bg-brand_red text-cream rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : null} Publish & Send
        </button>
        <button type="button" onClick={() => navigate(id ? `/quotations/${id}` : '/quotations')}
          className="px-4 py-2 text-sm text-gray-500 hover:text-dark">Cancel</button>
      </div>
    </form>
  );
}

import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Loader2, X, ToggleLeft, ToggleRight, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { PaymentSetting } from '../types';

// ─── Payment method logos ─────────────────────────────────────────────────────

// Maps keywords to logo image paths in /public/Payment Methods/
const LOGO_MAP: Array<{ keywords: string[]; src: string; bg: string }> = [
  {
    keywords: ['cbe birr', 'cbebirr'],
    src: '/Payment Methods/cbe birr.webp',
    bg: 'bg-white',
  },
  {
    keywords: ['cbe', 'commercial bank of ethiopia', 'commercial bank'],
    src: '/Payment Methods/commercial-bank-of-ethiopia-logo-png_seeklogo-547506.webp',
    bg: 'bg-white',
  },
  {
    keywords: ['telebirr', 'tele birr', 'tele-birr'],
    src: '/Payment Methods/tele birr.webp',
    bg: 'bg-white',
  },
  {
    keywords: ['awash birr', 'awashbirr'],
    src: '/Payment Methods/Awash-birr.webp',
    bg: 'bg-white',
  },
  {
    keywords: ['awash bank', 'awash'],
    src: '/Payment Methods/awash bank.webp',
    bg: 'bg-white',
  },
];

function MethodLogo({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const n = name.toLowerCase().trim();
  const dim = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';
  const imgDim = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';

  // Try to find a matching logo image
  for (const entry of LOGO_MAP) {
    if (entry.keywords.some((kw) => n.includes(kw))) {
      return (
        <div className={`${dim} rounded-lg border border-gray-100 flex items-center justify-center ${entry.bg} shrink-0 overflow-hidden`}>
          <img
            src={entry.src}
            alt={name}
            className={`${imgDim} object-contain`}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
      );
    }
  }

  // Bank transfer icon
  if (n.includes('bank transfer') || n.includes('wire transfer')) {
    return (
      <div className={`${dim} rounded-lg flex items-center justify-center bg-navy shrink-0`}>
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
          <rect x="3" y="6" width="18" height="12" rx="2" stroke="white" strokeWidth="1.5"/>
          <path d="M8 10v4M12 10v4M16 10v4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    );
  }

  // Cash icon
  if (n.includes('cash')) {
    return (
      <div className={`${dim} rounded-lg flex items-center justify-center bg-green-600 shrink-0`}>
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
          <rect x="2" y="6" width="20" height="12" rx="2" stroke="white" strokeWidth="1.5"/>
          <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="1.5"/>
          <path d="M6 12h.01M18 12h.01" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    );
  }

  // Generic fallback — initials
  const initials = name.trim().slice(0, 2).toUpperCase() || '?';
  return (
    <div className={`${dim} rounded-lg flex items-center justify-center bg-gray-400 text-white font-bold text-sm shrink-0`}>
      {initials}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormState {
  method_name: string;
  bank_name: string;
  account_holder: string;
  account_number: string;
  instructions: string;
  is_enabled: boolean;
  sort_order: number;
}

const blankForm = (order = 0): FormState => ({
  method_name: '',
  bank_name: '',
  account_holder: '',
  account_number: '',
  instructions: '',
  is_enabled: true,
  sort_order: order,
});

const DEFAULT_METHODS = ['CBE', 'Telebirr', 'Bank Transfer', 'Awash Bank', 'Dashen Bank', 'Cash', 'Other'];

// ─── Row component ─────────────────────────────────────────────────────────────

interface RowProps {
  setting: PaymentSetting;
  onToggle: (id: string, current: boolean) => Promise<void>;
  onEdit: (s: PaymentSetting) => void;
  onDelete: (id: string, name: string) => Promise<void>;
  actionLoading: string | null;
}

function PaymentMethodRow({ setting: s, onToggle, onEdit, onDelete, actionLoading }: RowProps) {
  return (
    <div className={`flex items-center gap-4 px-5 py-4 transition-opacity ${!s.is_enabled ? 'opacity-50' : ''}`}>
      {/* Logo */}
      <MethodLogo name={s.method_name} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-dark">{s.method_name}</span>
          {!s.is_enabled && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Disabled</span>
          )}
        </div>
        <div className="text-sm text-gray-500 mt-0.5 space-y-0.5">
          {s.bank_name && <span className="mr-3">{s.bank_name}</span>}
          {s.account_holder && <span className="mr-3">· {s.account_holder}</span>}
          {s.account_number && <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{s.account_number}</span>}
          {s.instructions && <p className="text-xs text-gray-400 italic mt-0.5">{s.instructions}</p>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Toggle */}
        <button
          onClick={() => onToggle(s.id, s.is_enabled)}
          disabled={actionLoading === `toggle-${s.id}`}
          className="p-1.5 rounded hover:bg-gray-100 transition-colors disabled:opacity-50"
          title={s.is_enabled ? 'Disable' : 'Enable'}
        >
          {actionLoading === `toggle-${s.id}`
            ? <Loader2 size={18} className="animate-spin text-gray-400" />
            : s.is_enabled
              ? <ToggleRight size={20} className="text-green-500" />
              : <ToggleLeft size={20} className="text-gray-300" />
          }
        </button>
        {/* Edit */}
        <button
          onClick={() => onEdit(s)}
          className="p-1.5 rounded text-gray-400 hover:text-navy hover:bg-gray-100 transition-colors"
          title="Edit"
        >
          <Pencil size={15} />
        </button>
        {/* Delete */}
        <button
          onClick={() => onDelete(s.id, s.method_name)}
          disabled={actionLoading === `delete-${s.id}`}
          className="p-1.5 rounded text-gray-400 hover:text-brand_red hover:bg-red-50 transition-colors disabled:opacity-50"
          title="Delete"
        >
          {actionLoading === `delete-${s.id}`
            ? <Loader2 size={15} className="animate-spin" />
            : <Trash2 size={15} />
          }
        </button>
      </div>
    </div>
  );
}

// ─── Add / Edit form (inline card) ─────────────────────────────────────────────

interface EditFormProps {
  form: FormState;
  onChange: (f: FormState) => void;
  onSave: () => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
  isEdit: boolean;
}

function PaymentMethodForm({ form, onChange, onSave, onCancel, saving, error, isEdit }: EditFormProps) {
  const set = (field: Partial<FormState>) => onChange({ ...form, ...field });

  return (
    <div className="border border-navy/20 rounded-xl bg-cream/50 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-dark">{isEdit ? 'Edit Payment Method' : 'New Payment Method'}</h3>

      {error && (
        <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Method name */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-dark mb-1">Payment Method Name *</label>
          <div className="flex gap-2">
            <input
              list="method-suggestions"
              value={form.method_name}
              onChange={(e) => set({ method_name: e.target.value })}
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
              placeholder="e.g. CBE, Telebirr, Bank Transfer…"
            />
            <datalist id="method-suggestions">
              {DEFAULT_METHODS.map((m) => <option key={m} value={m} />)}
            </datalist>
            {/* Live logo preview */}
            <MethodLogo name={form.method_name || '?'} />
          </div>
        </div>

        {/* Bank name */}
        <div>
          <label className="block text-xs font-medium text-dark mb-1">Bank / Institution</label>
          <input
            value={form.bank_name}
            onChange={(e) => set({ bank_name: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
            placeholder="e.g. Commercial Bank of Ethiopia"
          />
        </div>

        {/* Account holder */}
        <div>
          <label className="block text-xs font-medium text-dark mb-1">Account Holder</label>
          <input
            value={form.account_holder}
            onChange={(e) => set({ account_holder: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
            placeholder="e.g. Connect Digitals"
          />
        </div>

        {/* Account number */}
        <div>
          <label className="block text-xs font-medium text-dark mb-1">Account Number</label>
          <input
            value={form.account_number}
            onChange={(e) => set({ account_number: e.target.value })}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
            placeholder="e.g. 1000123456789"
          />
        </div>

        {/* Sort order */}
        <div>
          <label className="block text-xs font-medium text-dark mb-1">Display Order</label>
          <input
            type="number"
            min={0}
            value={form.sort_order}
            onChange={(e) => set({ sort_order: Number(e.target.value) })}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy"
          />
        </div>

        {/* Instructions */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-dark mb-1">Instructions (optional)</label>
          <textarea
            value={form.instructions}
            onChange={(e) => set({ instructions: e.target.value })}
            rows={2}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy resize-none"
            placeholder="Any instructions shown to the client when paying…"
          />
        </div>

        {/* Enabled toggle */}
        <div className="sm:col-span-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => set({ is_enabled: !form.is_enabled })}
          >
            {form.is_enabled
              ? <ToggleRight size={26} className="text-green-500" />
              : <ToggleLeft size={26} className="text-gray-300" />
            }
          </button>
          <span className="text-sm text-dark">
            {form.is_enabled ? 'Enabled — visible to clients' : 'Disabled — hidden from clients'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-brand_red text-cream rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {isEdit ? 'Save Changes' : 'Add Method'}
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-dark rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [settings, setSettings] = useState<PaymentSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<FormState>(blankForm());
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(blankForm());
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function fetchSettings() {
    try {
      const { data, error: sbErr } = await supabase
        .from('agency_payment_settings')
        .select('*')
        .order('sort_order')
        .order('created_at');
      if (sbErr) throw sbErr;
      setSettings((data as PaymentSetting[]) ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load payment settings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchSettings(); }, []);

  // ── Add ──────────────────────────────────────────────────────────────────────

  function handleShowAdd() {
    setAddForm(blankForm(settings.length));
    setAddError(null);
    setShowAdd(true);
    setEditingId(null); // close any open edit
  }

  async function handleAdd() {
    if (!addForm.method_name.trim()) { setAddError('Payment method name is required'); return; }
    setAddSaving(true);
    setAddError(null);
    try {
      const { error: insErr } = await supabase.from('agency_payment_settings').insert({
        method_name: addForm.method_name.trim(),
        bank_name: addForm.bank_name.trim() || null,
        account_holder: addForm.account_holder.trim(),
        account_number: addForm.account_number.trim(),
        telebirr_phone: '',
        instructions: addForm.instructions.trim() || null,
        is_enabled: addForm.is_enabled,
        sort_order: addForm.sort_order,
      });
      if (insErr) throw insErr;
      setShowAdd(false);
      await fetchSettings();
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setAddSaving(false);
    }
  }

  // ── Edit ─────────────────────────────────────────────────────────────────────

  function handleOpenEdit(s: PaymentSetting) {
    setEditingId(s.id);
    setEditForm({
      method_name: s.method_name,
      bank_name: s.bank_name ?? '',
      account_holder: s.account_holder,
      account_number: s.account_number,
      instructions: s.instructions ?? '',
      is_enabled: s.is_enabled,
      sort_order: s.sort_order,
    });
    setEditError(null);
    setShowAdd(false); // close add form
  }

  async function handleEditSave() {
    if (!editForm.method_name.trim()) { setEditError('Payment method name is required'); return; }
    setEditSaving(true);
    setEditError(null);
    try {
      const { error: updErr } = await supabase.from('agency_payment_settings').update({
        method_name: editForm.method_name.trim(),
        bank_name: editForm.bank_name.trim() || null,
        account_holder: editForm.account_holder.trim(),
        account_number: editForm.account_number.trim(),
        instructions: editForm.instructions.trim() || null,
        is_enabled: editForm.is_enabled,
        sort_order: editForm.sort_order,
      }).eq('id', editingId!);
      if (updErr) throw updErr;
      setEditingId(null);
      await fetchSettings();
    } catch (err: unknown) {
      setEditError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setEditSaving(false);
    }
  }

  // ── Toggle ───────────────────────────────────────────────────────────────────

  async function handleToggle(id: string, current: boolean) {
    setActionLoading(`toggle-${id}`);
    try {
      const { error: updErr } = await supabase
        .from('agency_payment_settings')
        .update({ is_enabled: !current })
        .eq('id', id);
      if (updErr) throw updErr;
      setSettings((prev) => prev.map((s) => s.id === id ? { ...s, is_enabled: !current } : s));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setActionLoading(null);
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setActionLoading(`delete-${id}`);
    try {
      const { error: delErr } = await supabase
        .from('agency_payment_settings')
        .delete()
        .eq('id', id);
      if (delErr) throw delErr;
      setSettings((prev) => prev.filter((s) => s.id !== id));
      if (editingId === id) setEditingId(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-dark">Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Payment methods shown to clients on invoices</p>
        </div>
        {!showAdd && (
          <button
            onClick={handleShowAdd}
            className="flex items-center gap-2 px-4 py-2 bg-brand_red text-cream rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            <Plus size={16} /> Add Payment Method
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
      )}

      {/* Add form */}
      {showAdd && (
        <PaymentMethodForm
          form={addForm}
          onChange={setAddForm}
          onSave={handleAdd}
          onCancel={() => setShowAdd(false)}
          saving={addSaving}
          error={addError}
          isEdit={false}
        />
      )}

      {/* Payment methods list */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-navy" />
          </div>
        ) : settings.length === 0 && !showAdd ? (
          <div className="px-5 py-10 text-center space-y-3">
            <p className="text-sm text-gray-400">No payment methods yet.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {DEFAULT_METHODS.slice(0, 4).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setAddForm({ ...blankForm(0), method_name: m });
                    setAddError(null);
                    setShowAdd(true);
                  }}
                  className="px-3 py-1 bg-gray-50 border border-gray-200 text-gray-600 rounded-full text-xs font-medium hover:bg-gray-100 transition-colors flex items-center gap-1.5"
                >
                  <MethodLogo name={m} />
                  <span className="text-xs">Add {m}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {settings.map((s) => (
              <div key={s.id}>
                {editingId === s.id ? (
                  <div className="p-4">
                    <PaymentMethodForm
                      form={editForm}
                      onChange={setEditForm}
                      onSave={handleEditSave}
                      onCancel={() => setEditingId(null)}
                      saving={editSaving}
                      error={editError}
                      isEdit={true}
                    />
                  </div>
                ) : (
                  <PaymentMethodRow
                    setting={s}
                    onToggle={handleToggle}
                    onEdit={handleOpenEdit}
                    onDelete={handleDelete}
                    actionLoading={actionLoading}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

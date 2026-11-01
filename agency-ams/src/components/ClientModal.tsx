import { useState, useEffect, FormEvent } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Client } from '../types';

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  client?: Client;
  onSaved: (client: Client) => void;
}

interface FormState {
  name: string;
  company: string;
  email: string;
  phone: string;
  location: string;
  notes: string;
}

const emptyForm: FormState = {
  name: '',
  company: '',
  email: '',
  phone: '',
  location: '',
  notes: '',
};

export default function ClientModal({ isOpen, onClose, client, onSaved }: ClientModalProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Populate form when editing an existing client
  useEffect(() => {
    if (client) {
      setForm({
        name: client.name,
        company: client.company,
        email: client.email,
        phone: client.phone,
        location: client.location,
        notes: client.notes ?? '',
      });
    } else {
      setForm(emptyForm);
    }
    setError(null);
  }, [client, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      company: form.company.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      location: form.location.trim(),
      notes: form.notes.trim() || null,
    };

    try {
      if (client?.id) {
        const { data, error: sbError } = await supabase
          .from('clients')
          .update(payload)
          .eq('id', client.id)
          .select()
          .single();

        if (sbError) throw sbError;
        onSaved(data as Client);
      } else {
        const { data, error: sbError } = await supabase
          .from('clients')
          .insert(payload)
          .select()
          .single();

        if (sbError) throw sbError;
        onSaved(data as Client);
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'An error occurred';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'border border-gray-300 rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-navy text-dark bg-white';

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-dark">
            {client ? 'Edit Client' : 'Add Client'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-dark transition-colors"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {error && (
            <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-dark mb-1" htmlFor="cm-name">
              Name <span className="text-brand_red">*</span>
            </label>
            <input
              id="cm-name"
              name="name"
              type="text"
              required
              value={form.name}
              onChange={handleChange}
              className={inputClass}
              placeholder="Full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark mb-1" htmlFor="cm-company">
              Company
            </label>
            <input
              id="cm-company"
              name="company"
              type="text"
              value={form.company}
              onChange={handleChange}
              className={inputClass}
              placeholder="Company name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark mb-1" htmlFor="cm-email">
              Email
            </label>
            <input
              id="cm-email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className={inputClass}
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark mb-1" htmlFor="cm-phone">
              Phone
            </label>
            <input
              id="cm-phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              className={inputClass}
              placeholder="+1 (555) 000-0000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark mb-1" htmlFor="cm-location">
              Location
            </label>
            <input
              id="cm-location"
              name="location"
              type="text"
              value={form.location}
              onChange={handleChange}
              className={inputClass}
              placeholder="City, Country"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark mb-1" htmlFor="cm-notes">
              Notes
            </label>
            <textarea
              id="cm-notes"
              name="notes"
              rows={3}
              value={form.notes}
              onChange={handleChange}
              className={inputClass}
              placeholder="Additional notes…"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded border border-gray-300 text-dark hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded bg-brand_red text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

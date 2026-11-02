import { useState, useEffect, FormEvent } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Client, Project, ProjectStatus } from '../types';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project?: Project;
  clients: Client[];
  onSaved: (project: Project) => void;
}

interface FormState {
  title: string;
  client_id: string;
  service: string;
  description: string;
  budget: string;
  start_date: string;
  deadline: string;
  status: ProjectStatus;
}

const emptyForm: FormState = {
  title: '',
  client_id: '',
  service: '',
  description: '',
  budget: '',
  start_date: '',
  deadline: '',
  status: 'Pending',
};

const STATUS_OPTIONS: ProjectStatus[] = ['Pending', 'In Progress', 'Completed', 'On Hold'];

export default function ProjectModal({ isOpen, onClose, project, clients, onSaved }: ProjectModalProps) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (project) {
      setForm({
        title: project.title,
        client_id: project.client_id,
        service: project.service,
        description: project.description ?? '',
        budget: project.budget !== undefined && project.budget !== null ? String(project.budget) : '',
        start_date: project.start_date ?? '',
        deadline: project.deadline ?? '',
        status: project.status,
      });
    } else {
      setForm(emptyForm);
    }
    setError(null);
  }, [project, isOpen]);

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      title: form.title.trim(),
      client_id: form.client_id,
      service: form.service.trim(),
      description: form.description.trim() || null,
      budget: form.budget !== '' ? parseFloat(form.budget) : null,
      start_date: form.start_date || null,
      deadline: form.deadline || null,
      status: form.status,
    };

    try {
      if (project?.id) {
        const { data, error: sbError } = await supabase
          .from('agency_projects')
          .update(payload)
          .eq('id', project.id)
          .select()
          .single();

        if (sbError) throw sbError;
        onSaved(data as Project);
      } else {
        const { data, error: sbError } = await supabase
          .from('agency_projects')
          .insert(payload)
          .select()
          .single();

        if (sbError) throw sbError;
        onSaved(data as Project);
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
            {project ? 'Edit Project' : 'Add Project'}
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
            <label className="block text-sm font-medium text-dark mb-1" htmlFor="pm-title">
              Title <span className="text-brand_red">*</span>
            </label>
            <input
              id="pm-title"
              name="title"
              type="text"
              required
              value={form.title}
              onChange={handleChange}
              className={inputClass}
              placeholder="Project title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark mb-1" htmlFor="pm-client">
              Client <span className="text-brand_red">*</span>
            </label>
            <select
              id="pm-client"
              name="client_id"
              required
              value={form.client_id}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="">Select a client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.company ? ` — ${c.company}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark mb-1" htmlFor="pm-service">
              Service <span className="text-brand_red">*</span>
            </label>
            <input
              id="pm-service"
              name="service"
              type="text"
              required
              value={form.service}
              onChange={handleChange}
              className={inputClass}
              placeholder="e.g. Web Design, SEO, Branding"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark mb-1" htmlFor="pm-description">
              Description
            </label>
            <textarea
              id="pm-description"
              name="description"
              rows={3}
              value={form.description}
              onChange={handleChange}
              className={inputClass}
              placeholder="Project details…"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark mb-1" htmlFor="pm-budget">
              Budget
            </label>
            <input
              id="pm-budget"
              name="budget"
              type="number"
              min="0"
              step="0.01"
              value={form.budget}
              onChange={handleChange}
              className={inputClass}
              placeholder="0.00"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark mb-1" htmlFor="pm-start-date">
                Start Date
              </label>
              <input
                id="pm-start-date"
                name="start_date"
                type="date"
                value={form.start_date}
                onChange={handleChange}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark mb-1" htmlFor="pm-deadline">
                Deadline
              </label>
              <input
                id="pm-deadline"
                name="deadline"
                type="date"
                value={form.deadline}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark mb-1" htmlFor="pm-status">
              Status
            </label>
            <select
              id="pm-status"
              name="status"
              value={form.status}
              onChange={handleChange}
              className={inputClass}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
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
              {saving ? 'Saving…' : 'Save Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

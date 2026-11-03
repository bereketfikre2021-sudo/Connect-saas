import { useEffect, useState, useCallback } from 'react';
import { Plus, Loader2, Upload, RefreshCw, X, Save, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import StatusBadge from '../components/StatusBadge';
import type { Creative, Project, Client } from '../types';

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-yellow-100 text-yellow-800',
  Approved: 'bg-green-100 text-green-800',
  'Revision Requested': 'bg-red-100 text-red-700',
};

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface FormState {
  title: string;
  description: string;
  project_id: string;
  client_id: string;
  version: number;
  file: File | null;
}

export default function CreativesPage() {
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [revisionFor, setRevisionFor] = useState<Creative | null>(null);
  const [form, setForm] = useState<FormState>({ title: '', description: '', project_id: '', client_id: '', version: 1, file: null });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('All');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string>('');

  const fetchAll = useCallback(async () => {
    try {
      const [crRes, prRes, clRes] = await Promise.all([
        supabase.from('agency_creatives').select('*, agency_projects(title), agency_clients(name)').order('created_at', { ascending: false }),
        supabase.from('agency_projects').select('*').order('title'),
        supabase.from('agency_clients').select('*').eq('is_archived', false).order('name'),
      ]);
      if (crRes.error) throw crRes.error;
      setCreatives((crRes.data ?? []) as unknown as Creative[]);
      setProjects((prRes.data ?? []) as Project[]);
      setClients((clRes.data ?? []) as Client[]);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function openRevision(c: Creative) {
    setRevisionFor(c);
    setForm({ title: c.title, description: c.description ?? '', project_id: c.project_id, client_id: c.client_id, version: c.version + 1, file: null });
    setFormError(null); setShowForm(true);
  }

  async function handleSave() {
    if (!form.title.trim()) { setFormError('Title required'); return; }
    if (!form.project_id) { setFormError('Select a project'); return; }
    if (!form.client_id) { setFormError('Select a client'); return; }
    if (!form.file) { setFormError('Upload a file'); return; }
    setSaving(true); setFormError(null);
    try {
      const ext = form.file.name.split('.').pop();
      const path = `creatives/${form.project_id}/${Date.now()}-v${form.version}.${ext}`;
      const { error: upErr } = await supabase.storage.from('agency-creatives').upload(path, form.file);
      if (upErr) throw upErr;

      const fileType = form.file.type.startsWith('image') ? 'image' : form.file.type.includes('pdf') ? 'pdf' : 'video';
      const { error: insErr } = await supabase.from('agency_creatives').insert({
        title: form.title, description: form.description || null,
        project_id: form.project_id, client_id: form.client_id,
        version: form.version, file_path: path, file_type: fileType,
      });
      if (insErr) throw insErr;
      setShowForm(false); setRevisionFor(null);
      setForm({ title: '', description: '', project_id: '', client_id: '', version: 1, file: null });
      await fetchAll();
    } catch (e: unknown) { setFormError(e instanceof Error ? e.message : 'Failed to upload'); }
    finally { setSaving(false); }
  }

  async function handlePreview(c: Creative) {
    try {
      const { data, error: e } = await supabase.storage.from('agency-creatives').createSignedUrl(c.file_path, 300);
      if (e) throw e;
      if (data?.signedUrl) { setPreviewUrl(data.signedUrl); setPreviewType(c.file_type); }
    } catch { setError('Could not load preview'); }
  }

  const filtered = filterStatus === 'All' ? creatives : creatives.filter(c => c.status === filterStatus);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-dark">Creative Approvals</h1>
        <button onClick={() => { setRevisionFor(null); setForm({ title: '', description: '', project_id: '', client_id: '', version: 1, file: null }); setFormError(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-brand_red text-cream rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
          <Plus size={16} /> Upload Creative
        </button>
      </div>

      {error && <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

      {/* Upload form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow p-6 space-y-4 border border-navy/10">
          <h2 className="text-sm font-semibold text-dark">
            {revisionFor ? `Upload Revision — v${form.version} of "${revisionFor.title}"` : 'Upload Creative'}
          </h2>
          {formError && <p className="text-sm text-brand_red">{formError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-dark mb-1">Title *</label>
              <input value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
            </div>
            <div>
              <label className="block text-xs font-medium text-dark mb-1">Version</label>
              <input type="number" min={1} value={form.version} onChange={e => setForm(p => ({...p, version: Number(e.target.value)}))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
            </div>
            <div>
              <label className="block text-xs font-medium text-dark mb-1">Client *</label>
              <select value={form.client_id} onChange={e => setForm(p => ({...p, client_id: e.target.value, project_id: ''}))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" disabled={!!revisionFor}>
                <option value="">Select client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-dark mb-1">Project *</label>
              <select value={form.project_id} onChange={e => setForm(p => ({...p, project_id: e.target.value}))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" disabled={!!revisionFor}>
                <option value="">Select project</option>
                {projects.filter(p => !form.client_id || p.client_id === form.client_id).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-dark mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))}
                rows={2} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy resize-none" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-dark mb-1">File (Image, PDF or Video) *</label>
              <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-navy hover:bg-gray-50 transition-colors">
                <Upload size={18} className="text-gray-400" />
                <span className="text-sm text-gray-500">{form.file ? form.file.name : 'Choose file…'}</span>
                <input type="file" accept="image/*,application/pdf,video/*" className="hidden"
                  onChange={e => setForm(p => ({...p, file: e.target.files?.[0] ?? null}))} />
              </label>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-brand_red text-cream rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Upload
            </button>
            <button onClick={() => { setShowForm(false); setRevisionFor(null); }}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-dark rounded-lg text-sm font-medium hover:bg-gray-50">
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['All', 'Pending', 'Approved', 'Revision Requested'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterStatus === s ? 'bg-navy text-cream' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {s}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-navy" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 px-5 py-8 text-center">No creatives found.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(c => (
              <div key={c.id} className="px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-dark">{c.title}</span>
                    <span className="text-xs text-gray-400">v{c.version}</span>
                    <StatusBadge status={c.status} colorMap={STATUS_COLORS} />
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 space-x-2">
                    <span>{c.agency_projects ? (c.agency_projects as {title:string}).title : '—'}</span>
                    <span>·</span>
                    <span>{c.agency_clients ? (c.agency_clients as {name:string}).name : '—'}</span>
                    <span>·</span>
                    <span>{formatDate(c.created_at)}</span>
                  </div>
                  {c.client_comment && (
                    <p className="text-xs text-gray-600 italic mt-1 bg-gray-50 rounded px-2 py-1">"{c.client_comment}"</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => handlePreview(c)}
                    className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-200 text-gray-600 rounded hover:bg-gray-50">
                    <Eye size={12} /> View
                  </button>
                  <button onClick={() => openRevision(c)}
                    className="flex items-center gap-1 px-2 py-1 text-xs border border-navy text-navy rounded hover:bg-navy hover:text-cream transition-colors">
                    <RefreshCw size={12} /> Revise
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview modal */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewUrl(null)} className="absolute -top-10 right-0 text-white hover:text-gold">
              <X size={24} />
            </button>
            {previewType === 'image' && <img src={previewUrl} alt="Preview" className="rounded-xl max-h-[85vh] object-contain mx-auto" />}
            {previewType === 'pdf' && <iframe src={previewUrl} className="w-full h-[85vh] rounded-xl" />}
            {previewType === 'video' && <video src={previewUrl} controls className="w-full rounded-xl max-h-[85vh]" />}
          </div>
        </div>
      )}
    </div>
  );
}

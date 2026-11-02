import { useEffect, useState, useCallback } from 'react';
import { Upload, Loader2, Trash2, Download, Share2, X, Save, FileText, Image, Film, File } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { AgencyFile, Client, Project } from '../types';

function FileIcon({ type }: { type: string }) {
  if (type === 'image') return <Image size={18} className="text-blue-500" />;
  if (type === 'pdf') return <FileText size={18} className="text-red-500" />;
  if (type === 'video') return <Film size={18} className="text-purple-500" />;
  return <File size={18} className="text-gray-400" />;
}

function fmtSize(bytes: number | null) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function FilesPage() {
  const [files, setFiles] = useState<AgencyFile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterClient, setFilterClient] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', client_id: '', project_id: '', file: null as File | null, shared: false });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [fRes, cRes, pRes] = await Promise.all([
        supabase.from('agency_files').select('*, agency_projects(title), agency_clients(name)').order('created_at', { ascending: false }),
        supabase.from('agency_clients').select('*').eq('is_archived', false).order('name'),
        supabase.from('agency_projects').select('*').order('title'),
      ]);
      if (fRes.error) throw fRes.error;
      setFiles((fRes.data ?? []) as unknown as AgencyFile[]);
      setClients((cRes.data ?? []) as Client[]);
      setProjects((pRes.data ?? []) as Project[]);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleUpload() {
    if (!form.file) { setFormError('Select a file'); return; }
    if (!form.client_id) { setFormError('Select a client'); return; }
    setSaving(true); setFormError(null);
    try {
      const ext = form.file.name.split('.').pop();
      const path = `files/${form.client_id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('agency-files').upload(path, form.file);
      if (upErr) throw upErr;
      const fileType = form.file.type.startsWith('image') ? 'image' : form.file.type.includes('pdf') ? 'pdf' : form.file.type.startsWith('video') ? 'video' : 'other';
      const { error: insErr } = await supabase.from('agency_files').insert({
        name: form.name || form.file.name, description: form.description || null,
        client_id: form.client_id, project_id: form.project_id || null,
        file_path: path, file_type: fileType, file_size: form.file.size,
        shared_with_client: form.shared,
      });
      if (insErr) throw insErr;
      setShowForm(false); setForm({ name: '', description: '', client_id: '', project_id: '', file: null, shared: false });
      await fetchAll();
    } catch (e: unknown) { setFormError(e instanceof Error ? e.message : 'Upload failed'); }
    finally { setSaving(false); }
  }

  async function handleDownload(f: AgencyFile) {
    const { data, error: e } = await supabase.storage.from('agency-files').createSignedUrl(f.file_path, 60);
    if (e || !data?.signedUrl) { setError('Could not generate download link'); return; }
    const a = document.createElement('a'); a.href = data.signedUrl; a.download = f.name; a.click();
  }

  async function handleToggleShare(f: AgencyFile) {
    await supabase.from('agency_files').update({ shared_with_client: !f.shared_with_client }).eq('id', f.id);
    await fetchAll();
  }

  async function handleDelete(f: AgencyFile) {
    if (!window.confirm(`Delete "${f.name}"?`)) return;
    await supabase.storage.from('agency-files').remove([f.file_path]);
    await supabase.from('agency_files').delete().eq('id', f.id);
    await fetchAll();
  }

  const filtered = filterClient ? files.filter(f => f.client_id === filterClient) : files;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-dark">File Library</h1>
        <button onClick={() => { setFormError(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-brand_red text-cream rounded-lg text-sm font-medium hover:bg-red-700">
          <Upload size={16} /> Upload File
        </button>
      </div>

      {error && <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

      {showForm && (
        <div className="bg-white rounded-xl shadow p-6 space-y-4 border border-navy/10">
          <h2 className="text-sm font-semibold text-dark">Upload File</h2>
          {formError && <p className="text-sm text-brand_red">{formError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-dark mb-1">Client *</label>
              <select value={form.client_id} onChange={e => setForm(p => ({...p, client_id: e.target.value, project_id: ''}))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
                <option value="">Select client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-dark mb-1">Project</label>
              <select value={form.project_id} onChange={e => setForm(p => ({...p, project_id: e.target.value}))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
                <option value="">None</option>
                {projects.filter(p => !form.client_id || p.client_id === form.client_id).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-dark mb-1">Display Name</label>
              <input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
                placeholder="Leave blank to use filename"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
            </div>
            <div>
              <label className="block text-xs font-medium text-dark mb-1">Description</label>
              <input value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-dark mb-1">File *</label>
              <label className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-navy hover:bg-gray-50 transition-colors">
                <Upload size={18} className="text-gray-400" />
                <span className="text-sm text-gray-500">{form.file ? form.file.name : 'Choose file…'}</span>
                <input type="file" className="hidden" onChange={e => setForm(p => ({...p, file: e.target.files?.[0] ?? null}))} />
              </label>
            </div>
            <div className="sm:col-span-2 flex items-center gap-3">
              <input type="checkbox" id="shared" checked={form.shared} onChange={e => setForm(p => ({...p, shared: e.target.checked}))} className="rounded" />
              <label htmlFor="shared" className="text-sm text-dark cursor-pointer">Share with client (visible in client portal)</label>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleUpload} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-brand_red text-cream rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Upload
            </button>
            <button onClick={() => setShowForm(false)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-dark rounded-lg text-sm font-medium hover:bg-gray-50">
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div>
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
          <option value="">All Clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-navy" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 px-5 py-8 text-center">No files yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">File</th>
                  <th className="px-4 py-3 text-left font-medium">Client</th>
                  <th className="px-4 py-3 text-left font-medium">Project</th>
                  <th className="px-4 py-3 text-left font-medium">Size</th>
                  <th className="px-4 py-3 text-left font-medium">Shared</th>
                  <th className="px-4 py-3 text-left font-medium">Uploaded</th>
                  <th className="px-4 py-3 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(f => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileIcon type={f.file_type} />
                        <div>
                          <p className="font-medium text-dark">{f.name}</p>
                          {f.description && <p className="text-xs text-gray-400">{f.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{f.agency_clients ? (f.agency_clients as {name:string}).name : '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{f.agency_projects ? (f.agency_projects as {title:string}).title : '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{fmtSize(f.file_size)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleToggleShare(f)}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${f.shared_with_client ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {f.shared_with_client ? 'Shared' : 'Private'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(f.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => handleDownload(f)} className="p-1.5 text-gray-400 hover:text-navy rounded hover:bg-gray-100" title="Download"><Download size={14} /></button>
                        <button onClick={() => handleToggleShare(f)} className="p-1.5 text-gray-400 hover:text-navy rounded hover:bg-gray-100" title="Toggle share"><Share2 size={14} /></button>
                        <button onClick={() => handleDelete(f)} className="p-1.5 text-gray-400 hover:text-brand_red rounded hover:bg-red-50" title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

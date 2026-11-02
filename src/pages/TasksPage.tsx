import { useEffect, useState, useCallback } from 'react';
import { Plus, Loader2, Pencil, Trash2, Archive, X, Save, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import StatusBadge from '../components/StatusBadge';
import type { Task, TaskStatus, TaskPriority, Project, Client } from '../types';

const STATUS_COLORS: Record<string, string> = {
  'To Do': 'bg-gray-100 text-gray-600',
  'In Progress': 'bg-blue-100 text-blue-800',
  'Review': 'bg-yellow-100 text-yellow-800',
  'Completed': 'bg-green-100 text-green-800',
};
const PRIORITY_COLORS: Record<string, string> = {
  Low: 'bg-gray-100 text-gray-500',
  Medium: 'bg-blue-100 text-blue-700',
  High: 'bg-orange-100 text-orange-700',
  Urgent: 'bg-red-100 text-red-700',
};

const STATUSES: TaskStatus[] = ['To Do', 'In Progress', 'Review', 'Completed'];
const PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High', 'Urgent'];

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface FormState {
  title: string;
  description: string;
  project_id: string;
  client_id: string;
  priority: TaskPriority;
  status: TaskStatus;
  start_date: string;
  due_date: string;
}

const blank = (): FormState => ({
  title: '', description: '', project_id: '', client_id: '',
  priority: 'Medium', status: 'To Do', start_date: '', due_date: '',
});

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterProject, setFilterProject] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blank());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [tasksRes, projRes, clientRes] = await Promise.all([
        supabase.from('agency_tasks').select('*, agency_projects(title), agency_clients(name)')
          .eq('is_archived', showArchived).order('created_at', { ascending: false }),
        supabase.from('agency_projects').select('*').order('title'),
        supabase.from('agency_clients').select('*').eq('is_archived', false).order('name'),
      ]);
      if (tasksRes.error) throw tasksRes.error;
      setTasks((tasksRes.data ?? []) as unknown as Task[]);
      setProjects((projRes.data ?? []) as Project[]);
      setClients((clientRes.data ?? []) as Client[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  }, [showArchived]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleSave() {
    if (!form.title.trim()) { setFormError('Title is required'); return; }
    setSaving(true); setFormError(null);
    try {
      const payload = {
        title: form.title.trim(), description: form.description || null,
        project_id: form.project_id || null, client_id: form.client_id || null,
        priority: form.priority, status: form.status,
        start_date: form.start_date || null, due_date: form.due_date || null,
      };
      if (editingId) {
        const { error: e } = await supabase.from('agency_tasks').update(payload).eq('id', editingId);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from('agency_tasks').insert(payload);
        if (e) throw e;
      }
      setShowForm(false); setEditingId(null); setForm(blank());
      await fetchAll();
    } catch (e: unknown) { setFormError(e instanceof Error ? e.message : 'Failed to save'); }
    finally { setSaving(false); }
  }

  async function handleArchive(id: string, archive: boolean) {
    await supabase.from('agency_tasks').update({ is_archived: archive }).eq('id', id);
    await fetchAll();
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this task permanently?')) return;
    await supabase.from('agency_tasks').delete().eq('id', id);
    await fetchAll();
  }

  function openEdit(t: Task) {
    setEditingId(t.id);
    setForm({
      title: t.title, description: t.description ?? '', project_id: t.project_id ?? '',
      client_id: t.client_id ?? '', priority: t.priority, status: t.status,
      start_date: t.start_date ?? '', due_date: t.due_date ?? '',
    });
    setFormError(null); setShowForm(true);
  }

  const today = new Date().toISOString().split('T')[0];
  const filtered = tasks.filter(t => {
    if (filterStatus !== 'All') {
      if (filterStatus === 'Overdue') {
        if (!t.due_date || t.due_date >= today || t.status === 'Completed') return false;
      } else if (t.status !== filterStatus) return false;
    }
    if (filterPriority !== 'All' && t.priority !== filterPriority) return false;
    if (filterProject && t.project_id !== filterProject) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-dark">Tasks</h1>
        <button onClick={() => { setEditingId(null); setForm(blank()); setFormError(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-brand_red text-cream rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
          <Plus size={16} /> New Task
        </button>
      </div>

      {error && <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

      {/* Inline form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow p-6 space-y-4 border border-navy/10">
          <h2 className="text-sm font-semibold text-dark">{editingId ? 'Edit Task' : 'New Task'}</h2>
          {formError && <p className="text-sm text-brand_red">{formError}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-dark mb-1">Title *</label>
              <input value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" placeholder="Task title" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-dark mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))}
                rows={2} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-dark mb-1">Client</label>
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
                <option value="">Select project</option>
                {projects.filter(p => !form.client_id || p.client_id === form.client_id).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-dark mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm(p => ({...p, priority: e.target.value as TaskPriority}))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-dark mb-1">Status</label>
              <select value={form.status} onChange={e => setForm(p => ({...p, status: e.target.value as TaskStatus}))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-dark mb-1">Start Date</label>
              <input type="date" value={form.start_date} onChange={e => setForm(p => ({...p, start_date: e.target.value}))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
            </div>
            <div>
              <label className="block text-xs font-medium text-dark mb-1">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm(p => ({...p, due_date: e.target.value}))}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-brand_red text-cream rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {editingId ? 'Save Changes' : 'Create Task'}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-dark rounded-lg text-sm font-medium hover:bg-gray-50">
              <X size={14} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
          <option value="All">All Statuses</option>
          <option value="Overdue">⚠ Overdue</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
          <option value="All">All Priorities</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
          <option value="">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} className="rounded" />
          Show Archived
        </label>
      </div>

      {/* Task list */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-navy" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 px-5 py-8 text-center">No tasks found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Title</th>
                  <th className="px-4 py-3 text-left font-medium">Project</th>
                  <th className="px-4 py-3 text-left font-medium">Priority</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Due Date</th>
                  <th className="px-4 py-3 text-center font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(t => {
                  const overdue = t.due_date && t.due_date < today && t.status !== 'Completed';
                  return (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-dark">{t.title}</p>
                        {t.agency_clients && <p className="text-xs text-gray-400">{(t.agency_clients as {name:string}).name}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{t.agency_projects ? (t.agency_projects as {title:string}).title : '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={t.priority} colorMap={PRIORITY_COLORS} /></td>
                      <td className="px-4 py-3"><StatusBadge status={t.status} colorMap={STATUS_COLORS} /></td>
                      <td className="px-4 py-3">
                        <span className={overdue ? 'text-brand_red font-medium flex items-center gap-1' : 'text-gray-600'}>
                          {overdue && <AlertTriangle size={12} />}{formatDate(t.due_date)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEdit(t)} className="p-1.5 text-gray-400 hover:text-navy rounded hover:bg-gray-100"><Pencil size={14} /></button>
                          <button onClick={() => handleArchive(t.id, !t.is_archived)} className="p-1.5 text-gray-400 hover:text-navy rounded hover:bg-gray-100"><Archive size={14} /></button>
                          <button onClick={() => handleDelete(t.id)} className="p-1.5 text-gray-400 hover:text-brand_red rounded hover:bg-red-50"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

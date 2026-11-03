import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, Pencil, Plus, Check, X, Save, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import StatusBadge from '../components/StatusBadge';
import type { Project, Task, Milestone, Creative, Invoice, MilestoneStatus } from '../types';

const etb = new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB', maximumFractionDigits: 0 });

function fmt(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const TASK_COLORS: Record<string, string> = {
  'To Do': 'bg-gray-100 text-gray-600', 'In Progress': 'bg-blue-100 text-blue-800',
  Review: 'bg-yellow-100 text-yellow-800', Completed: 'bg-green-100 text-green-800',
};
const PRIORITY_COLORS: Record<string, string> = {
  Low: 'bg-gray-100 text-gray-500', Medium: 'bg-blue-100 text-blue-700',
  High: 'bg-orange-100 text-orange-700', Urgent: 'bg-red-100 text-red-700',
};
const MILESTONE_COLORS: Record<string, string> = {
  Upcoming: 'bg-gray-100 text-gray-600', 'In Progress': 'bg-blue-100 text-blue-800', Completed: 'bg-green-100 text-green-800',
};
const CREATIVE_COLORS: Record<string, string> = {
  Pending: 'bg-yellow-100 text-yellow-800', Approved: 'bg-green-100 text-green-800', 'Revision Requested': 'bg-red-100 text-red-700',
};

interface MilestoneForm { title: string; description: string; due_date: string; status: MilestoneStatus; }
const blankMilestone = (): MilestoneForm => ({ title: '', description: '', due_date: '', status: 'Upcoming' });

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project & { agency_clients?: { name: string; company: string } | null } | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'milestones' | 'creatives' | 'invoices'>('overview');

  // Milestone form state
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [milestoneForm, setMilestoneForm] = useState<MilestoneForm>(blankMilestone());
  const [savingMilestone, setSavingMilestone] = useState(false);
  const [milestoneError, setMilestoneError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    try {
      const [projRes, taskRes, milRes, crRes, invRes] = await Promise.all([
        supabase.from('agency_projects').select('*, agency_clients(name, company)').eq('id', id).single(),
        supabase.from('agency_tasks').select('*').eq('project_id', id).eq('is_archived', false).order('due_date'),
        supabase.from('agency_milestones').select('*').eq('project_id', id).order('due_date'),
        supabase.from('agency_creatives').select('*').eq('project_id', id).order('created_at', { ascending: false }),
        supabase.from('agency_invoices').select('*').eq('project_id', id).order('created_at', { ascending: false }),
      ]);
      if (projRes.error) throw projRes.error;
      setProject(projRes.data as typeof project);
      setTasks((taskRes.data ?? []) as Task[]);
      setMilestones((milRes.data ?? []) as Milestone[]);
      setCreatives((crRes.data ?? []) as Creative[]);
      setInvoices((invRes.data ?? []) as Invoice[]);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleSaveMilestone() {
    if (!milestoneForm.title.trim()) { setMilestoneError('Title required'); return; }
    setSavingMilestone(true); setMilestoneError(null);
    try {
      const payload = { project_id: id!, title: milestoneForm.title.trim(), description: milestoneForm.description || null, due_date: milestoneForm.due_date || null, status: milestoneForm.status };
      if (editingMilestone) {
        const { error: e } = await supabase.from('agency_milestones').update(payload).eq('id', editingMilestone.id);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from('agency_milestones').insert(payload);
        if (e) throw e;
      }
      setShowMilestoneForm(false); setEditingMilestone(null); setMilestoneForm(blankMilestone());
      await fetchAll();
    } catch (e: unknown) { setMilestoneError(e instanceof Error ? e.message : 'Failed'); }
    finally { setSavingMilestone(false); }
  }

  async function handleDeleteMilestone(milId: string) {
    if (!window.confirm('Delete milestone?')) return;
    await supabase.from('agency_milestones').delete().eq('id', milId);
    await fetchAll();
  }

  async function handleCycleTaskStatus(task: Task) {
    const cycle: Task['status'][] = ['To Do', 'In Progress', 'Review', 'Completed'];
    const next = cycle[(cycle.indexOf(task.status) + 1) % cycle.length];
    await supabase.from('agency_tasks').update({ status: next }).eq('id', task.id);
    await fetchAll();
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-navy" /></div>;
  if (error || !project) return (
    <div className="space-y-4">
      <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2">{error ?? 'Project not found.'}</p>
      <Link to="/projects" className="text-sm text-navy hover:underline">← Back to Projects</Link>
    </div>
  );

  const today = new Date().toISOString().split('T')[0];
  const completedTasks = tasks.filter(t => t.status === 'Completed').length;
  const taskProgress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
  const completedMilestones = milestones.filter(m => m.status === 'Completed').length;
  const milestoneProgress = milestones.length > 0 ? Math.round((completedMilestones / milestones.length) * 100) : 0;
  const overdueTasks = tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'Completed');
  const totalInvoiced = invoices.reduce((s, i) => s + i.total_amount, 0);
  const totalPaid = invoices.reduce((s, i) => s + i.paid_amount, 0);

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'tasks', label: `Tasks (${tasks.length})` },
    { key: 'milestones', label: `Milestones (${milestones.length})` },
    { key: 'creatives', label: `Creatives (${creatives.length})` },
    { key: 'invoices', label: `Invoices (${invoices.length})` },
  ] as const;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/projects" className="text-sm text-gray-500 hover:text-navy transition-colors">← Projects</Link>
          <h1 className="text-2xl font-semibold text-dark mt-1">{project.title}</h1>
          {project.agency_clients && (
            <p className="text-sm text-gray-500 mt-0.5">
              {(project.agency_clients as { name: string; company: string }).name}
              {(project.agency_clients as { name: string; company: string }).company && ` — ${(project.agency_clients as { name: string; company: string }).company}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={project.status} />
          <button onClick={() => navigate(`/projects`)} className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 text-dark rounded-lg text-sm hover:bg-gray-50 transition-colors">
            <Pencil size={13} /> Edit
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? 'border-gold text-dark' : 'border-transparent text-gray-500 hover:text-dark'}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Service', value: project.service || '—' },
              { label: 'Budget', value: project.budget ? etb.format(project.budget) : '—' },
              { label: 'Start Date', value: fmt(project.start_date) },
              { label: 'Deadline', value: fmt(project.deadline) },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-xl shadow p-4">
                <p className="text-xs text-gray-400 uppercase font-medium mb-1">{item.label}</p>
                <p className="font-semibold text-dark">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Progress bars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow p-5">
              <div className="flex justify-between mb-2">
                <p className="text-sm font-medium text-dark">Task Progress</p>
                <p className="text-sm font-bold text-navy">{taskProgress}%</p>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div className="bg-navy h-2.5 rounded-full transition-all" style={{ width: `${taskProgress}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-2">{completedTasks} of {tasks.length} tasks completed</p>
            </div>
            <div className="bg-white rounded-xl shadow p-5">
              <div className="flex justify-between mb-2">
                <p className="text-sm font-medium text-dark">Milestone Progress</p>
                <p className="text-sm font-bold text-gold">{milestoneProgress}%</p>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div className="bg-gold h-2.5 rounded-full transition-all" style={{ width: `${milestoneProgress}%` }} />
              </div>
              <p className="text-xs text-gray-400 mt-2">{completedMilestones} of {milestones.length} milestones completed</p>
            </div>
          </div>

          {/* Financials */}
          {invoices.length > 0 && (
            <div className="bg-white rounded-xl shadow p-5">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Financials</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div><p className="text-xs text-gray-400 uppercase font-medium">Invoiced</p><p className="font-bold text-dark">{etb.format(totalInvoiced)}</p></div>
                <div><p className="text-xs text-gray-400 uppercase font-medium">Received</p><p className="font-bold text-green-600">{etb.format(totalPaid)}</p></div>
                <div><p className="text-xs text-gray-400 uppercase font-medium">Outstanding</p><p className="font-bold text-brand_red">{etb.format(totalInvoiced - totalPaid)}</p></div>
              </div>
            </div>
          )}

          {/* Overdue tasks alert */}
          {overdueTasks.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-brand_red shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-dark">{overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}</p>
                <ul className="mt-1 space-y-0.5">
                  {overdueTasks.map(t => <li key={t.id} className="text-xs text-gray-600">· {t.title} (due {fmt(t.due_date)})</li>)}
                </ul>
              </div>
            </div>
          )}

          {/* Description */}
          {project.description && (
            <div className="bg-white rounded-xl shadow p-5">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Description</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{project.description}</p>
            </div>
          )}
        </div>
      )}

      {/* ── TASKS TAB ── */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{tasks.length} tasks — click status badge to cycle</p>
            <button onClick={() => navigate('/tasks')}
              className="flex items-center gap-2 px-3 py-1.5 bg-brand_red text-cream rounded-lg text-xs font-medium hover:bg-red-700">
              <Plus size={13} /> Add Task
            </button>
          </div>
          {tasks.length === 0 ? (
            <div className="bg-white rounded-xl shadow px-5 py-8 text-center text-gray-400 text-sm">No tasks yet.</div>
          ) : (
            <div className="bg-white rounded-xl shadow divide-y divide-gray-100">
              {tasks.map(t => {
                const overdue = t.due_date && t.due_date < today && t.status !== 'Completed';
                return (
                  <div key={t.id} className="px-5 py-3 flex items-center gap-4">
                    <button onClick={() => handleCycleTaskStatus(t)} title="Click to advance status">
                      <StatusBadge status={t.status} colorMap={TASK_COLORS} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-dark truncate">{t.title}</p>
                      {t.description && <p className="text-xs text-gray-400 truncate">{t.description}</p>}
                    </div>
                    <StatusBadge status={t.priority} colorMap={PRIORITY_COLORS} />
                    <span className={`text-xs shrink-0 ${overdue ? 'text-brand_red font-medium flex items-center gap-1' : 'text-gray-400'}`}>
                      {overdue && <AlertTriangle size={11} />}{fmt(t.due_date)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── MILESTONES TAB ── */}
      {activeTab === 'milestones' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{milestoneProgress}% complete</p>
            <button onClick={() => { setEditingMilestone(null); setMilestoneForm(blankMilestone()); setMilestoneError(null); setShowMilestoneForm(true); }}
              className="flex items-center gap-2 px-3 py-1.5 bg-brand_red text-cream rounded-lg text-xs font-medium hover:bg-red-700">
              <Plus size={13} /> Add Milestone
            </button>
          </div>

          {showMilestoneForm && (
            <div className="bg-white rounded-xl shadow p-5 space-y-3 border border-navy/10">
              <h3 className="text-sm font-semibold text-dark">{editingMilestone ? 'Edit Milestone' : 'New Milestone'}</h3>
              {milestoneError && <p className="text-xs text-brand_red">{milestoneError}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-dark mb-1">Title *</label>
                  <input value={milestoneForm.title} onChange={e => setMilestoneForm(p => ({...p, title: e.target.value}))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dark mb-1">Due Date</label>
                  <input type="date" value={milestoneForm.due_date} onChange={e => setMilestoneForm(p => ({...p, due_date: e.target.value}))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dark mb-1">Status</label>
                  <select value={milestoneForm.status} onChange={e => setMilestoneForm(p => ({...p, status: e.target.value as MilestoneStatus}))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy">
                    <option>Upcoming</option><option>In Progress</option><option>Completed</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-dark mb-1">Description</label>
                  <textarea value={milestoneForm.description} onChange={e => setMilestoneForm(p => ({...p, description: e.target.value}))}
                    rows={2} className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy resize-none" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={handleSaveMilestone} disabled={savingMilestone}
                  className="flex items-center gap-2 px-3 py-1.5 bg-brand_red text-cream rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                  {savingMilestone ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                </button>
                <button onClick={() => { setShowMilestoneForm(false); setEditingMilestone(null); }}
                  className="flex items-center gap-2 px-3 py-1.5 border border-gray-300 text-dark rounded-lg text-xs font-medium hover:bg-gray-50">
                  <X size={12} /> Cancel
                </button>
              </div>
            </div>
          )}

          {milestones.length === 0 && !showMilestoneForm ? (
            <div className="bg-white rounded-xl shadow px-5 py-8 text-center text-gray-400 text-sm">No milestones yet.</div>
          ) : (
            <div className="bg-white rounded-xl shadow divide-y divide-gray-100">
              {milestones.map(m => {
                const overdue = m.due_date && m.due_date < today && m.status !== 'Completed';
                return (
                  <div key={m.id} className="px-5 py-4 flex items-start gap-4">
                    <div className="mt-0.5">
                      {m.status === 'Completed'
                        ? <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center"><Check size={12} className="text-white" /></div>
                        : <div className={`w-5 h-5 rounded-full border-2 ${overdue ? 'border-brand_red' : 'border-gray-300'}`} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-medium ${m.status === 'Completed' ? 'line-through text-gray-400' : 'text-dark'}`}>{m.title}</p>
                        <StatusBadge status={m.status} colorMap={MILESTONE_COLORS} />
                        {overdue && <span className="text-xs text-brand_red flex items-center gap-1"><AlertTriangle size={11} /> Overdue</span>}
                      </div>
                      {m.description && <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>}
                      {m.due_date && <p className="text-xs text-gray-400 mt-0.5">Due {fmt(m.due_date)}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => { setEditingMilestone(m); setMilestoneForm({ title: m.title, description: m.description ?? '', due_date: m.due_date ?? '', status: m.status }); setMilestoneError(null); setShowMilestoneForm(true); }}
                        className="p-1.5 text-gray-400 hover:text-navy rounded hover:bg-gray-100"><Pencil size={13} /></button>
                      <button onClick={() => handleDeleteMilestone(m.id)}
                        className="p-1.5 text-gray-400 hover:text-brand_red rounded hover:bg-red-50"><X size={13} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CREATIVES TAB ── */}
      {activeTab === 'creatives' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{creatives.length} submission{creatives.length !== 1 ? 's' : ''}</p>
            <button onClick={() => navigate('/creatives')}
              className="flex items-center gap-2 px-3 py-1.5 bg-brand_red text-cream rounded-lg text-xs font-medium hover:bg-red-700">
              <Plus size={13} /> Upload Creative
            </button>
          </div>
          {creatives.length === 0 ? (
            <div className="bg-white rounded-xl shadow px-5 py-8 text-center text-gray-400 text-sm">No creative submissions yet.</div>
          ) : (
            <div className="bg-white rounded-xl shadow divide-y divide-gray-100">
              {creatives.map(c => (
                <div key={c.id} className="px-5 py-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-dark">{c.title}</p>
                      <span className="text-xs text-gray-400">v{c.version}</span>
                      <StatusBadge status={c.status} colorMap={CREATIVE_COLORS} />
                    </div>
                    {c.client_comment && <p className="text-xs text-gray-500 italic mt-0.5">"{c.client_comment}"</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{fmt(c.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── INVOICES TAB ── */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">{etb.format(totalInvoiced)} total invoiced</p>
            <button onClick={() => navigate('/invoices/new', { state: { prefill: { client_id: project.client_id, title: project.title, items: [] } } })}
              className="flex items-center gap-2 px-3 py-1.5 bg-brand_red text-cream rounded-lg text-xs font-medium hover:bg-red-700">
              <Plus size={13} /> New Invoice
            </button>
          </div>
          {invoices.length === 0 ? (
            <div className="bg-white rounded-xl shadow px-5 py-8 text-center text-gray-400 text-sm">No invoices yet.</div>
          ) : (
            <div className="bg-white rounded-xl shadow divide-y divide-gray-100">
              {invoices.map(inv => (
                <div key={inv.id} className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => navigate(`/invoices/${inv.id}`)}>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-dark">{inv.invoice_number} — {inv.title}</p>
                    <p className="text-xs text-gray-400">Due {fmt(inv.due_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-dark">{etb.format(inv.total_amount)}</p>
                    <p className="text-xs text-brand_red">{etb.format(inv.total_amount - inv.paid_amount)} remaining</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

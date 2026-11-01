import { useEffect, useState } from 'react';
import { Pencil, FolderPlus, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ProjectModal from '../components/ProjectModal';
import type { Client, Project, ProjectStatus } from '../types';

// Supabase joined query returns clients as an object (or null), not an array
interface ProjectRow extends Omit<Project, 'client'> {
  clients: { name: string } | null;
}

const STATUS_FILTERS: Array<'All' | ProjectStatus> = [
  'All',
  'Pending',
  'In Progress',
  'Completed',
  'On Hold',
];

function StatusBadge({ status }: { status: ProjectStatus }) {
  const styles: Record<ProjectStatus, string> = {
    Pending: 'bg-yellow-100 text-yellow-800',
    'In Progress': 'bg-blue-100 text-blue-800',
    Completed: 'bg-green-100 text-green-800',
    'On Hold': 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      {status}
    </span>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'All' | ProjectStatus>('All');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const [projectsRes, clientsRes] = await Promise.all([
          supabase
            .from('projects')
            .select('*, clients(name)')
            .order('created_at', { ascending: false }),
          supabase
            .from('clients')
            .select('*')
            .eq('is_archived', false)
            .order('name'),
        ]);

        if (cancelled) return;
        if (projectsRes.error) throw projectsRes.error;
        if (clientsRes.error) throw clientsRes.error;

        setProjects((projectsRes.data as unknown as ProjectRow[]) ?? []);
        setClients((clientsRes.data as Client[]) ?? []);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load projects');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, []);

  const openAdd = () => {
    setEditingProject(undefined);
    setModalOpen(true);
  };

  const openEdit = (row: ProjectRow) => {
    // Convert ProjectRow → Project (drop the joined clients field)
    const { clients: _joined, ...rest } = row;
    setEditingProject(rest as Project);
    setModalOpen(true);
  };

  const handleSaved = (saved: Project) => {
    // Re-fetch the client name for the saved project
    const clientName = clients.find((c) => c.id === saved.client_id)?.name ?? null;
    const savedRow: ProjectRow = { ...saved, clients: clientName ? { name: clientName } : null };

    setProjects((prev) => {
      const exists = prev.findIndex((p) => p.id === saved.id);
      if (exists >= 0) {
        const updated = [...prev];
        updated[exists] = savedRow;
        return updated;
      }
      return [savedRow, ...prev];
    });
  };

  const filtered =
    activeFilter === 'All' ? projects : projects.filter((p) => p.status === activeFilter);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-dark">Projects</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-brand_red text-cream rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
        >
          <FolderPlus size={16} />
          Add Project
        </button>
      </div>

      {error && (
        <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      {/* Status filter pills */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              activeFilter === f
                ? 'bg-navy text-cream'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-navy hover:text-navy'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-navy" />
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-base">
            {projects.length === 0
              ? 'No projects yet. Add your first project.'
              : `No projects with status "${activeFilter}".`}
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && filtered.length > 0 && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Title</th>
                  <th className="px-5 py-3 text-left font-medium">Client</th>
                  <th className="px-5 py-3 text-left font-medium">Service</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Deadline</th>
                  <th className="px-5 py-3 text-left font-medium">Budget</th>
                  <th className="px-5 py-3 text-left font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-dark">{row.title}</td>
                    <td className="px-5 py-3 text-gray-600">{row.clients?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-600">{row.service || '—'}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {row.deadline
                        ? new Date(row.deadline).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {row.budget != null
                        ? new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                            maximumFractionDigits: 0,
                          }).format(row.budget)
                        : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => openEdit(row)}
                        className="p-1.5 text-gray-400 hover:text-navy rounded hover:bg-gray-100 transition-colors"
                        title="Edit project"
                        aria-label={`Edit ${row.title}`}
                      >
                        <Pencil size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ProjectModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        project={editingProject}
        clients={clients}
        onSaved={handleSaved}
      />
    </div>
  );
}

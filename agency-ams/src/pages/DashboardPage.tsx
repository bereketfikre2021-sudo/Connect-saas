import { useEffect, useState } from 'react';
import { Users, Briefcase, CheckCircle, Clock, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import StatusBadge from '../components/StatusBadge';
import type { ProjectStatus } from '../types';

interface Stats {
  totalClients: number;
  activeProjects: number;
  completedProjects: number;
  pendingProjects: number;
  awaitingResponse: number;
}

interface RecentProject {
  title: string;
  status: ProjectStatus;
  deadline: string | null;
  agency_clients: { name: string } | null;
}

function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow border-l-4 border-gray-200 p-5 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
      <div className="h-8 bg-gray-200 rounded w-12" />
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchDashboard() {
      try {
        const countProjects = (status: string) =>
          supabase
            .from('agency_projects')
            .select('id', { count: 'exact', head: true })
            .eq('status', status);

        const [clientsRes, activeRes, completedRes, pendingRes, recentRes, awaitingRes] = await Promise.all([
          supabase
            .from('agency_clients')
            .select('id', { count: 'exact', head: true })
            .eq('is_archived', false),
          countProjects('In Progress'),
          countProjects('Completed'),
          countProjects('Pending'),
          supabase
            .from('agency_projects')
            .select('title, status, deadline, agency_clients(name)')
            .order('created_at', { ascending: false })
            .limit(5),
          supabase
            .from('agency_proposals')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'Sent'),
        ]);

        if (cancelled) return;

        // Check for errors
        const errs = [clientsRes, activeRes, completedRes, pendingRes, recentRes, awaitingRes]
          .map((r) => r.error)
          .filter(Boolean);
        if (errs.length > 0) throw new Error(errs[0]!.message);

        setStats({
          totalClients: clientsRes.count ?? 0,
          activeProjects: activeRes.count ?? 0,
          completedProjects: completedRes.count ?? 0,
          pendingProjects: pendingRes.count ?? 0,
          awaitingResponse: awaitingRes.count ?? 0,
        });

        const rows = (recentRes.data ?? []) as unknown as RecentProject[];
        setRecentProjects(rows);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchDashboard();
    return () => { cancelled = true; };
  }, []);

  const statCards = [
    {
      label: 'Total Clients',
      value: stats?.totalClients ?? 0,
      icon: <Users size={22} className="text-navy" />,
      accent: 'border-navy',
    },
    {
      label: 'Active Projects',
      value: stats?.activeProjects ?? 0,
      icon: <Briefcase size={22} className="text-gold" />,
      accent: 'border-gold',
    },
    {
      label: 'Pending Projects',
      value: stats?.pendingProjects ?? 0,
      icon: <Clock size={22} className="text-brand_red" />,
      accent: 'border-brand_red',
    },
    {
      label: 'Completed Projects',
      value: stats?.completedProjects ?? 0,
      icon: <CheckCircle size={22} className="text-green-500" />,
      accent: 'border-green-500',
    },
    {
      label: 'Awaiting Response',
      value: stats?.awaitingResponse ?? 0,
      icon: <FileText size={22} className="text-navy" />,
      accent: 'border-navy',
    },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-dark">Dashboard</h1>

      {error && (
        <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)
          : statCards.map((card) => (
              <div
                key={card.label}
                className={`bg-white rounded-xl shadow border-l-4 ${card.accent} p-5`}
              >
                <div className="flex items-center gap-3 mb-2">
                  {card.icon}
                  <span className="text-sm text-gray-500 font-medium">{card.label}</span>
                </div>
                <p className="text-3xl font-bold text-dark">{card.value}</p>
              </div>
            ))}
      </div>

      {/* Recent projects table */}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-dark">Recent Projects</h2>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : recentProjects.length === 0 ? (
          <p className="text-sm text-gray-400 px-5 py-6">No projects yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                <tr>
                  <th className="px-5 py-3 text-left font-medium">Project</th>
                  <th className="px-5 py-3 text-left font-medium">Client</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Deadline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentProjects.map((p, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-dark">{p.title}</td>
                    <td className="px-5 py-3 text-gray-600">{p.agency_clients?.name ?? '—'}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {p.deadline
                        ? new Date(p.deadline).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
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

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Clock } from 'lucide-react';

interface LogEntry {
  id: string;
  entity_type: string;
  action: string;
  detail: string | null;
  created_at: string;
}

const ENTITY_COLORS: Record<string, string> = {
  proposal: 'bg-blue-100 text-blue-700',
  invoice: 'bg-green-100 text-green-700',
  payment: 'bg-emerald-100 text-emerald-700',
  task: 'bg-yellow-100 text-yellow-700',
  creative: 'bg-purple-100 text-purple-700',
  client: 'bg-navy/10 text-navy',
  project: 'bg-gold/20 text-dark',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

export default function ActivityLog({ limit = 10 }: { limit?: number }) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('agency_activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(({ data }) => {
        setEntries((data ?? []) as LogEntry[]);
        setLoading(false);
      });
  }, [limit]);

  if (loading) return <div className="h-20 flex items-center justify-center"><div className="w-5 h-5 border-2 border-navy border-t-transparent rounded-full animate-spin" /></div>;

  if (entries.length === 0) return (
    <p className="text-sm text-gray-400 text-center py-6">No activity yet. Actions you take will appear here.</p>
  );

  return (
    <ul className="space-y-3">
      {entries.map(e => (
        <li key={e.id} className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            <Clock size={14} className="text-gray-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded capitalize ${ENTITY_COLORS[e.entity_type] ?? 'bg-gray-100 text-gray-600'}`}>
                {e.entity_type}
              </span>
              <span className="text-sm text-dark">{e.action}</span>
            </div>
            {e.detail && <p className="text-xs text-gray-500 mt-0.5 truncate">{e.detail}</p>}
          </div>
          <span className="text-xs text-gray-400 shrink-0">{timeAgo(e.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}

// Helper to log an action — call this from any admin operation
export async function logActivity(entity_type: string, entity_id: string, action: string, detail?: string) {
  await supabase.from('agency_activity_log').insert({ entity_type, entity_id, action, detail: detail ?? null });
}

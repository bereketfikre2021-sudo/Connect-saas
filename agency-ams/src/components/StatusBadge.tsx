interface StatusBadgeProps {
  status: string;
  colorMap?: Record<string, string>;
}

const DEFAULT_COLOR_MAP: Record<string, string> = {
  Pending: 'bg-yellow-100 text-yellow-800',
  'In Progress': 'bg-blue-100 text-blue-800',
  Completed: 'bg-green-100 text-green-800',
  'On Hold': 'bg-gray-100 text-gray-600',
};

const FALLBACK = 'bg-gray-100 text-gray-500';

export default function StatusBadge({ status, colorMap }: StatusBadgeProps) {
  const map = colorMap ?? DEFAULT_COLOR_MAP;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? FALLBACK}`}>
      {status}
    </span>
  );
}

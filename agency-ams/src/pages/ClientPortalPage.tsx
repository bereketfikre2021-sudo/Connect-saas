import { Loader2 } from 'lucide-react';

// Stub — full implementation in FEAT-P2-003
export default function ClientPortalPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <div className="text-center space-y-3">
        <Loader2 size={32} className="animate-spin text-navy mx-auto" />
        <p className="text-sm text-gray-500">Loading client portal…</p>
      </div>
    </div>
  );
}

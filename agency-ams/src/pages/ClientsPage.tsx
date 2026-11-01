import { useEffect, useState } from 'react';
import { Pencil, Archive, UserPlus, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import ClientModal from '../components/ClientModal';
import type { Client } from '../types';

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function fetchClients() {
      try {
        const { data, error: sbError } = await supabase
          .from('clients')
          .select('*')
          .eq('is_archived', false)
          .order('name');

        if (cancelled) return;
        if (sbError) throw sbError;
        setClients((data as Client[]) ?? []);
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load clients');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchClients();
    return () => { cancelled = true; };
  }, []);

  const openAdd = () => {
    setEditingClient(undefined);
    setModalOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setModalOpen(true);
  };

  const handleSaved = (saved: Client) => {
    setClients((prev) => {
      const exists = prev.findIndex((c) => c.id === saved.id);
      if (exists >= 0) {
        // Update in place
        const updated = [...prev];
        updated[exists] = saved;
        return updated;
      }
      // Prepend new client (re-sort by name)
      return [saved, ...prev].sort((a, b) => a.name.localeCompare(b.name));
    });
  };

  const handleArchive = async (id: string) => {
    try {
      const { error: sbError } = await supabase
        .from('clients')
        .update({ is_archived: true })
        .eq('id', id);

      if (sbError) throw sbError;
      setClients((prev) => prev.filter((c) => c.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to archive client');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-dark">Clients</h1>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-brand_red text-cream rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
        >
          <UserPlus size={16} />
          Add Client
        </button>
      </div>

      {error && (
        <p className="text-sm text-brand_red bg-red-50 border border-red-200 rounded px-3 py-2">
          {error}
        </p>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-navy" />
        </div>
      )}

      {/* Empty state */}
      {!loading && clients.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-base">No clients yet. Add your first client.</p>
        </div>
      )}

      {/* Desktop table */}
      {!loading && clients.length > 0 && (
        <>
          {/* Table — desktop */}
          <div className="hidden md:block bg-white rounded-xl shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium">Name</th>
                    <th className="px-5 py-3 text-left font-medium">Company</th>
                    <th className="px-5 py-3 text-left font-medium">Email</th>
                    <th className="px-5 py-3 text-left font-medium">Phone</th>
                    <th className="px-5 py-3 text-left font-medium">Location</th>
                    <th className="px-5 py-3 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {clients.map((client) => (
                    <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-dark">{client.name}</td>
                      <td className="px-5 py-3 text-gray-600">{client.company || '—'}</td>
                      <td className="px-5 py-3 text-gray-600">{client.email || '—'}</td>
                      <td className="px-5 py-3 text-gray-600">{client.phone || '—'}</td>
                      <td className="px-5 py-3 text-gray-600">{client.location || '—'}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(client)}
                            className="p-1.5 text-gray-400 hover:text-navy rounded hover:bg-gray-100 transition-colors"
                            title="Edit client"
                            aria-label={`Edit ${client.name}`}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleArchive(client.id)}
                            className="p-1.5 text-gray-400 hover:text-brand_red rounded hover:bg-red-50 transition-colors"
                            title="Archive client"
                            aria-label={`Archive ${client.name}`}
                          >
                            <Archive size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card list — mobile */}
          <div className="md:hidden space-y-3">
            {clients.map((client) => (
              <div key={client.id} className="bg-white rounded-xl shadow p-4 space-y-1">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-dark">{client.name}</p>
                    {client.company && (
                      <p className="text-sm text-gray-500">{client.company}</p>
                    )}
                  </div>
                  <div className="flex gap-2 mt-0.5">
                    <button
                      onClick={() => openEdit(client)}
                      className="p-1.5 text-gray-400 hover:text-navy rounded hover:bg-gray-100 transition-colors"
                      aria-label={`Edit ${client.name}`}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleArchive(client.id)}
                      className="p-1.5 text-gray-400 hover:text-brand_red rounded hover:bg-red-50 transition-colors"
                      aria-label={`Archive ${client.name}`}
                    >
                      <Archive size={15} />
                    </button>
                  </div>
                </div>
                {client.email && <p className="text-sm text-gray-500">{client.email}</p>}
                {client.phone && <p className="text-sm text-gray-500">{client.phone}</p>}
                {client.location && <p className="text-sm text-gray-500">{client.location}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      <ClientModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        client={editingClient}
        onSaved={handleSaved}
      />
    </div>
  );
}

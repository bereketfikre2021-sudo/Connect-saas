import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute() {
  const { user, loading, isAdmin } = useAuth();

  // loading stays true until BOTH session AND is_admin() RPC have resolved.
  // This prevents any premature redirect while the admin check is in flight.
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-navy">
        <div className="w-8 h-8 border-4 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

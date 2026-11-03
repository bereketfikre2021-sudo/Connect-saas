import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute() {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-navy">
        <div className="w-8 h-8 border-4 border-gold border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // User not authenticated at all → redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // User authenticated but not an admin → redirect to login
  // (RLS will deny all admin data access anyway; this guard prevents rendering
  // the admin shell to a non-admin and shows a clean redirect instead.)
  if (!isAdmin) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

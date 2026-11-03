import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute() {
  const { user, loading, isAdmin } = useAuth();

  if (loading) return <Spinner />;

  // Not authenticated — show the login page.
  // The SSO button on the login page is the explicit opt-in for Central Admin Portal.
  if (!user) return <Navigate to="/login" replace />;

  // Authenticated but not an admin — show unauthorized page, not login.
  if (!isAdmin) return <Navigate to="/unauthorized" replace />;

  return <Outlet />;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-navy">
      <div className="w-8 h-8 border-4 border-gold border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

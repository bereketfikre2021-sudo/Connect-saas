import { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SSO_PROVIDER = import.meta.env.VITE_SSO_PROVIDER as string | undefined;

export default function AdminRoute() {
  const { user, loading, isAdmin, signInWithSSO } = useAuth();
  const location = useLocation();
  const ssoInitiated = useRef(false);

  useEffect(() => {
    if (loading || user || !SSO_PROVIDER || ssoInitiated.current) return;
    ssoInitiated.current = true;

    const returnTo = location.pathname + location.search;
    const dest = returnTo === '/login' ? '/' : returnTo;
    console.log('[AdminRoute] no session — triggering SSO, returnTo:', dest);
    // signInWithSSO logs the authorization URL and provider before redirecting.
    void signInWithSSO(dest);
  }, [loading, user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Spinner />;

  if (!user) {
    return SSO_PROVIDER ? <Spinner /> : <Navigate to="/login" replace />;
  }

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

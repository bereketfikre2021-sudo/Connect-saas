import { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// SSO provider name — same env var AuthContext uses.
const SSO_PROVIDER = import.meta.env.VITE_SSO_PROVIDER as string | undefined;
const SSO_RETURN_KEY = 'sso_return_to';

export default function AdminRoute() {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();
  const ssoInitiated = useRef(false);

  useEffect(() => {
    // Only act once loading has settled and there is no session.
    if (loading || user || !SSO_PROVIDER || ssoInitiated.current) return;
    ssoInitiated.current = true;

    // Persist where to return after the callback.
    const returnTo = location.pathname + location.search;
    sessionStorage.setItem(SSO_RETURN_KEY, returnTo === '/login' ? '/' : returnTo);

    // Trigger the OAuth redirect directly — avoids any function-reference
    // instability from AuthContext.
    void supabase.auth.signInWithOAuth({
      provider: SSO_PROVIDER as `custom:${string}`,
      options: { redirectTo: window.location.origin + '/auth/callback' },
    });
  }, [loading, user, location]);          // stable primitives only

  if (loading) return <Spinner />;

  if (!user) {
    // SSO redirect is in flight — keep spinning.
    // If no SSO provider is configured, fall back to the login page.
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

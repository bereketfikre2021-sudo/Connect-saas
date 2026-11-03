/**
 * AuthCallbackPage
 *
 * Landing page for the Supabase OAuth callback (`/auth/callback`).
 *
 * supabase-js (detectSessionInUrl: true, the default) automatically exchanges
 * the code/token in the URL for a session as soon as the client is created.
 * By the time this component mounts, AuthContext.getSession() has already
 * resolved or onAuthStateChange has fired, so `loading` will be true → false
 * → navigate happens naturally.
 *
 * This page therefore only needs to:
 *   1. Show a spinner so the user sees something while the RPC resolves.
 *   2. Once loading is done, send the user to the stored destination.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SSO_RETURN_KEY } from '../context/AuthContext';

export default function AuthCallbackPage() {
  const { loading, user, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return; // still resolving — wait

    const returnTo = sessionStorage.getItem(SSO_RETURN_KEY) ?? '/';
    sessionStorage.removeItem(SSO_RETURN_KEY);

    if (!user) {
      // Session exchange failed — go to login so the user can try again.
      navigate('/login', { replace: true });
      return;
    }

    if (!isAdmin) {
      navigate('/unauthorized', { replace: true });
      return;
    }

    // Successful admin SSO — go to the original destination.
    navigate(returnTo, { replace: true });
  }, [loading, user, isAdmin, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-navy">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin" />
        <p className="text-cream/60 text-sm">Signing you in…</p>
      </div>
    </div>
  );
}

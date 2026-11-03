/**
 * AuthCallbackPage — /auth/callback
 *
 * Supabase redirects here after the OAuth exchange.
 * supabase-js (detectSessionInUrl:true) exchanges the PKCE code automatically
 * during client initialisation and fires onAuthStateChange(SIGNED_IN).
 * AuthContext.loading stays true until both the session AND is_admin() RPC
 * have resolved. This page just waits for that, then navigates.
 *
 * IMPORTANT: sessionStorage may be read on a first loading=false that has no
 * user yet (getSession racing against onAuthStateChange). We therefore do NOT
 * clear the key until we have a definitive answer (user !== null).
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SSO_RETURN_KEY } from '../context/AuthContext';

export default function AuthCallbackPage() {
  const { loading, user, isAdmin } = useAuth();
  const navigate = useNavigate();
  // Track whether we have already committed to a navigation so we don't
  // fire twice if loading flips multiple times.
  const navigated = useRef(false);

  useEffect(() => {
    if (loading) return;          // still resolving — wait
    if (navigated.current) return; // already navigated

    // If user is still null after loading settled, the session exchange failed
    // or hasn't fired yet. Wait one more tick — onAuthStateChange(SIGNED_IN)
    // resets loading to true, so if we get here with user=null we genuinely
    // have no session.
    if (!user) {
      console.warn('[AuthCallback] loading=false but no user — redirecting to /login');
      navigated.current = true;
      navigate('/login', { replace: true });
      return;
    }

    const returnTo = sessionStorage.getItem(SSO_RETURN_KEY) ?? '/';
    sessionStorage.removeItem(SSO_RETURN_KEY);
    navigated.current = true;

    if (!isAdmin) {
      console.warn('[AuthCallback] user authenticated but not admin — /unauthorized');
      navigate('/unauthorized', { replace: true });
      return;
    }

    console.log('[AuthCallback] admin confirmed — navigating to', returnTo);
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

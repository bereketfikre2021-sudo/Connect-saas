/**
 * AuthCallbackPage — /auth/callback
 *
 * Supabase redirects here after the OAuth exchange.
 * Sequence on arrival:
 *   1. onAuthStateChange fires INITIAL_SESSION (user=null, no code yet)
 *   2. supabase-js detects the ?code= param and exchanges it via PKCE
 *   3. onAuthStateChange fires SIGNED_IN with the real session
 *   4. AuthContext resolves is_admin(), sets loading=false with user set
 *   5. This page navigates to the stored destination
 *
 * We must NOT redirect to /login on step 1 (INITIAL_SESSION with no user).
 * We wait until we either get a real user or detect an OAuth error in the URL.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { SSO_RETURN_KEY } from '../context/AuthContext';

function getOAuthError(): string | null {
  const params = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace('#', '?'));
  return (
    params.get('error_description') ??
    params.get('error') ??
    hashParams.get('error_description') ??
    hashParams.get('error') ??
    null
  );
}

export default function AuthCallbackPage() {
  const { loading, user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const navigated = useRef(false);
  const [oauthError] = useState<string | null>(() => getOAuthError());

  useEffect(() => {
    // Surface an OAuth error from the URL immediately — no need to wait.
    if (oauthError) {
      console.error('[AuthCallback] OAuth error in URL:', oauthError);
      return; // render the error UI below
    }

    if (navigated.current) return;

    // loading=true means AuthContext is still waiting for SIGNED_IN + is_admin().
    // Stay on the spinner — do NOT redirect yet.
    if (loading) return;

    // loading=false, user=null:
    // INITIAL_SESSION fires before the PKCE exchange completes, which
    // temporarily sets loading=false with no user. A SIGNED_IN event
    // follows when the exchange finishes and resets loading=true.
    // If we see loading=false AND user=null here, it means either:
    //   a) SIGNED_IN hasn't fired yet (loading will go true→false again), OR
    //   b) The PKCE exchange genuinely failed (no SIGNED_IN will follow).
    // We can tell the difference: if there's a ?code= in the URL the exchange
    // is still in progress; if there's no code and no user, it truly failed.
    if (!user) {
      const hasCode = new URLSearchParams(window.location.search).has('code');
      if (hasCode) {
        // Exchange still in progress — keep spinner.
        console.log('[AuthCallback] code param present, waiting for SIGNED_IN…');
        return;
      }
      // No code, no user — genuine failure.
      console.warn('[AuthCallback] no user and no code — redirecting to /login');
      navigated.current = true;
      navigate('/login', { replace: true });
      return;
    }

    // We have a user and loading is false (is_admin() resolved).
    const returnTo = sessionStorage.getItem(SSO_RETURN_KEY) ?? '/';
    sessionStorage.removeItem(SSO_RETURN_KEY);
    navigated.current = true;

    if (!isAdmin) {
      console.warn('[AuthCallback] authenticated but not admin → /unauthorized');
      navigate('/unauthorized', { replace: true });
    } else {
      console.log('[AuthCallback] admin confirmed → navigating to', returnTo);
      navigate(returnTo, { replace: true });
    }
  }, [loading, user, isAdmin, navigate, oauthError]);

  if (oauthError) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center px-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 shadow-2xl max-w-sm w-full text-center">
          <div className="text-3xl mb-4">⚠️</div>
          <h1 className="text-cream font-semibold text-lg mb-3">Authentication failed</h1>
          <p className="text-cream/60 text-sm mb-6">{oauthError}</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-brand_red text-white font-semibold py-2.5 rounded-lg hover:bg-brand_red/90 transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-navy">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-gold border-t-transparent rounded-full animate-spin" />
        <p className="text-cream/60 text-sm">Signing you in…</p>
      </div>
    </div>
  );
}

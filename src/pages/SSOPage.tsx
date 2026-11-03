/**
 * SSOPage — /sso
 *
 * Dedicated SSO entry point for the hub card link.
 * Immediately calls signInWithSSO() which invokes:
 *   supabase.auth.signInWithOAuth({ provider: 'custom:central-admin', ... })
 * and redirects to /auth/callback after the OAuth exchange.
 *
 * Already-authenticated admins are sent straight to the dashboard.
 * /login (email+password) is completely unaffected.
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SSOPage() {
  const { user, isAdmin, loading, signInWithSSO } = useAuth();
  const navigate = useNavigate();
  const initiated = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;

    // Already an authenticated admin — go straight to the dashboard.
    if (user && isAdmin) {
      navigate('/', { replace: true });
      return;
    }

    // Authenticated but not an admin.
    if (user && !isAdmin) {
      navigate('/unauthorized', { replace: true });
      return;
    }

    // No session — initiate SSO exactly once.
    if (!initiated.current) {
      initiated.current = true;
      signInWithSSO('/').catch((err: unknown) => {
        setError(
          err instanceof Error
            ? err.message
            : 'SSO initiation failed. Please try again.',
        );
      });
    }
  }, [loading, user, isAdmin, navigate, signInWithSSO]);

  if (error) {
    return (
      <div className="min-h-screen bg-navy flex items-center justify-center px-4">
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 shadow-2xl max-w-sm w-full text-center">
          <div className="text-3xl mb-4">⚠️</div>
          <h1 className="text-cream font-semibold text-lg mb-3">Sign-in failed</h1>
          <p className="text-cream/60 text-sm mb-6">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-brand_red text-white font-semibold py-2.5 rounded-lg hover:bg-brand_red/90 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={36} className="animate-spin text-gold" />
        <p className="text-cream/60 text-sm">Connecting to Central Admin Portal…</p>
      </div>
    </div>
  );
}

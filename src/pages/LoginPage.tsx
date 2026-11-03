import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

type Mode = 'login' | 'forgot';

export default function LoginPage() {
  const { signIn, user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Redirect an already-authenticated admin away from the login page.
  // Wait for both session and isAdmin to resolve before redirecting.
  useEffect(() => {
    if (authLoading) return;
    if (user && isAdmin) {
      navigate('/', { replace: true });
    }
  }, [user, isAdmin, authLoading, navigate]);

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Email is required.'); return; }
    if (!password) { setError('Password is required.'); return; }
    setLoading(true);
    try {
      await signIn(email, password);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!email.trim()) { setError('Enter your email address first.'); return; }
    setLoading(true);
    try {
      const { error: sbErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (sbErr) throw sbErr;
      setInfo('Password reset email sent. Check your inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-navy flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo / wordmark */}
        <div className="text-center mb-8 flex flex-col items-center gap-3">
          <img src="/Connect.jpg" alt="Connect Digitals" className="w-14 h-14 rounded-full object-cover" />
          <div>
            <span className="text-gold font-bold text-3xl tracking-wide">Connect Digitals</span>
            <p className="text-cream/60 text-sm mt-1">Agency Management System</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 shadow-2xl">
          <h2 className="text-cream font-semibold text-lg mb-6 text-center">
            {mode === 'login' ? 'Admin Sign In' : 'Reset Password'}
          </h2>

          {/* ── Login form ── */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} noValidate>
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-cream/70 text-sm mb-1">Email</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-cream text-dark rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                    placeholder="admin@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-cream/70 text-sm mb-1">Password</label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-cream text-dark rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-dark transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <p role="alert" className="text-brand_red text-sm mt-4">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-6 w-full bg-brand_red text-white font-semibold py-2.5 rounded-lg hover:bg-brand_red/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={15} className="animate-spin" />}
                {loading ? 'Signing in…' : 'Sign In'}
              </button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(''); setInfo(''); }}
                  className="text-cream/50 hover:text-gold text-xs transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            </form>
          )}

          {/* ── Forgot password form ── */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgotPassword} noValidate>
              <p className="text-cream/60 text-sm mb-4 text-center">
                Enter your admin email and we'll send a reset link.
              </p>

              <div>
                <label htmlFor="reset-email" className="block text-cream/70 text-sm mb-1">Email</label>
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-cream text-dark rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold"
                  placeholder="admin@example.com"
                />
              </div>

              {error && (
                <p role="alert" className="text-brand_red text-sm mt-4">{error}</p>
              )}
              {info && (
                <p className="text-green-400 text-sm mt-4">{info}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-6 w-full bg-gold text-dark font-semibold py-2.5 rounded-lg hover:bg-gold/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={15} className="animate-spin" />}
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => { setMode('login'); setError(''); setInfo(''); }}
                  className="text-cream/50 hover:text-gold text-xs transition-colors"
                >
                  ← Back to Sign In
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

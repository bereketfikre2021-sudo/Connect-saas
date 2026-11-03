import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  /** True until BOTH session AND is_admin() RPC have resolved. */
  loading: boolean;
  isAdmin: boolean;
  /** True when VITE_SSO_PROVIDER is configured. */
  ssoEnabled: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /**
   * Initiates the OAuth redirect.
   * @param returnTo  Path to land on after the callback (default: '/').
   */
  signInWithSSO: (returnTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SSO_PROVIDER = import.meta.env.VITE_SSO_PROVIDER as string | undefined;
const SSO_ENABLED = !!SSO_PROVIDER;

// Key used to stash the post-callback destination in sessionStorage.
// SessionStorage survives the OAuth redirect but is cleared on tab close.
const SSO_RETURN_KEY = 'sso_return_to';

async function fetchIsAdmin(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_admin');
    if (error) {
      console.error('[AuthContext] is_admin RPC error:', error.message);
      return false;
    }
    return data === true;
  } catch (e) {
    console.error('[AuthContext] is_admin RPC threw:', e);
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let generation = 0;

    async function resolveSession(sessionUser: User | null, gen: number) {
      const admin = sessionUser ? await fetchIsAdmin() : false;
      if (cancelled || gen !== generation) return;
      setUser(sessionUser);
      setIsAdmin(admin);
      setLoading(false);
    }

    // getSession() resolves the OAuth callback token from the URL on first load
    // because supabase-js detectSessionInUrl:true has already parsed it.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      generation++;
      void resolveSession(session?.user ?? null, generation);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (cancelled) return;
        generation++;
        const gen = generation;
        // Reset loading so AdminRoute spins rather than prematurely redirecting
        // while the is_admin() RPC is in flight.
        setLoading(true);
        void resolveSession(session?.user ?? null, gen);
      }
    );

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signInWithSSO(returnTo = '/'): Promise<void> {
    if (!SSO_PROVIDER) {
      throw new Error('SSO provider is not configured (VITE_SSO_PROVIDER).');
    }
    // Persist the destination so the callback page can navigate there.
    sessionStorage.setItem(SSO_RETURN_KEY, returnTo);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: SSO_PROVIDER as `custom:${string}`,
      options: {
        // Always land back at the app root; AuthCallbackPage handles the rest.
        redirectTo: window.location.origin + '/auth/callback',
      },
    });
    if (error) throw error;
  }

  async function signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, isAdmin, ssoEnabled: SSO_ENABLED, signIn, signInWithSSO, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

/** The sessionStorage key used to persist the post-SSO destination. */
export { SSO_RETURN_KEY };

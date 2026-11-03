import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;      // true until initial session + admin check complete
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithSSO: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SSO_PROVIDER = import.meta.env.VITE_SSO_PROVIDER as string | undefined;

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
  // loading stays true until BOTH the session AND the admin RPC are resolved.
  // AdminRoute blocks on this single flag, preventing any premature redirect.
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Track whether the initial getSession + admin check has completed.
    // onAuthStateChange can fire before or after getSession resolves (especially
    // on the OAuth callback return). We allow whichever settles last to win by
    // using a generation counter: only the most-recent async chain may commit.
    let generation = 0;

    async function resolveSession(sessionUser: User | null, gen: number) {
      const admin = sessionUser ? await fetchIsAdmin() : false;
      if (cancelled || gen !== generation) return; // stale — a newer event fired
      setUser(sessionUser);
      setIsAdmin(admin);
      setLoading(false);
    }

    // 1. Load initial session (handles the OAuth callback token in the URL too,
    //    because supabase-js detectSessionInUrl:true has already parsed it by
    //    the time this runs).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      generation++;
      void resolveSession(session?.user ?? null, generation);
    });

    // 2. Keep in sync with subsequent auth events (SIGNED_IN from OAuth
    //    callback, TOKEN_REFRESHED, SIGNED_OUT, etc.).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (cancelled) return;
        generation++;
        const gen = generation;
        // Set loading true again so AdminRoute shows the spinner while we
        // re-check admin status — prevents the redirect flash.
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

  async function signInWithSSO(): Promise<void> {
    if (!SSO_PROVIDER) {
      throw new Error('SSO provider is not configured (VITE_SSO_PROVIDER).');
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: SSO_PROVIDER as `custom:${string}`,
      options: { redirectTo: window.location.origin + '/' },
    });
    if (error) throw error;
  }

  async function signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, signIn, signInWithSSO, signOut }}>
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

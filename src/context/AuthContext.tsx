import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithSSO: (returnTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const SSO_RETURN_KEY = 'sso_return_to';

async function fetchIsAdmin(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_admin');
    if (error) {
      console.error('[AuthContext] is_admin RPC error:', error.message);
      return false;
    }
    console.log('[AuthContext] is_admin RPC result:', data);
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
      console.log('[AuthContext] resolveSession commit', { uid: sessionUser?.id, admin });
      setUser(sessionUser);
      setIsAdmin(admin);
      setLoading(false);
    }

    // onAuthStateChange fires INITIAL_SESSION synchronously during setup,
    // then SIGNED_IN when an OAuth code is exchanged. We must handle both.
    // We use a generation counter so whichever resolves last wins.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (cancelled) return;
        generation++;
        const gen = generation;
        console.log('[AuthContext] onAuthStateChange', _event, 'uid:', session?.user?.id ?? 'none');
        setLoading(true);
        void resolveSession(session?.user ?? null, gen);
      },
    );

    // getSession() is called AFTER subscribing so we don't miss any events.
    // On the /auth/callback page supabase-js exchanges the PKCE code here
    // and then fires SIGNED_IN via onAuthStateChange — we don't need to
    // call getSession separately; the subscription above handles everything.
    // We call it only as a fallback for the case where no auth event fires
    // (e.g. a page reload with an existing localStorage session that doesn't
    // trigger a new onAuthStateChange event beyond INITIAL_SESSION).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      // Only use the getSession result if onAuthStateChange hasn't already
      // committed a newer result (higher generation).
      if (generation === 0) {
        generation++;
        void resolveSession(session?.user ?? null, generation);
      }
    });

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
    sessionStorage.setItem(SSO_RETURN_KEY, returnTo);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'custom:central-admin',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      console.error('[AuthContext] signInWithOAuth error:', error.message);
      throw error;
    }
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

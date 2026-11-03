import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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

  // authStateChangeFired tracks whether onAuthStateChange has already fired
  // at least once. If it has, we do NOT let getSession() commit loading=false
  // — we let onAuthStateChange win, preventing the null-user flash.
  const authStateChangeFired = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let generation = 0;

    async function resolveSession(
      sessionUser: User | null,
      gen: number,
      source: 'getSession' | 'authStateChange',
    ) {
      // If this is a getSession result but authStateChange has already fired
      // a newer event, skip — authStateChange's result will be authoritative.
      if (source === 'getSession' && authStateChangeFired.current) {
        console.log('[AuthContext] getSession skipped — authStateChange already fired');
        return;
      }

      const admin = sessionUser ? await fetchIsAdmin() : false;

      if (cancelled || gen !== generation) return; // stale

      console.log('[AuthContext] resolveSession commit', { source, uid: sessionUser?.id, admin });
      setUser(sessionUser);
      setIsAdmin(admin);
      setLoading(false);
    }

    // 1. Initial session — also handles PKCE code exchange on the callback page.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      generation++;
      void resolveSession(session?.user ?? null, generation, 'getSession');
    });

    // 2. Auth state changes (SIGNED_IN from OAuth, TOKEN_REFRESHED, SIGNED_OUT).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (cancelled) return;
        authStateChangeFired.current = true;
        generation++;
        const gen = generation;
        console.log('[AuthContext] onAuthStateChange', _event, 'uid:', session?.user?.id);
        setLoading(true); // hold the spinner while RPC resolves
        void resolveSession(session?.user ?? null, gen, 'authStateChange');
      },
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
    <AuthContext.Provider
      value={{ user, loading, isAdmin, signIn, signInWithSSO, signOut }}
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

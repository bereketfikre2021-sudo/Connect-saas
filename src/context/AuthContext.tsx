import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithSSO: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Resolve the custom OIDC provider name from the environment.
// Must be set to "custom:<name>" matching the dashboard configuration.
// If the env var is absent the SSO button is hidden (see LoginPage).
const SSO_PROVIDER = import.meta.env.VITE_SSO_PROVIDER as string | undefined;

async function fetchIsAdmin(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_admin');
    if (error || data === null || data === undefined) return false;
    return data === true;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Load initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      setIsAdmin(sessionUser ? await fetchIsAdmin() : false);
      setLoading(false);
    });

    // Keep user and isAdmin in sync with Supabase auth events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      // Re-check admin on every auth state change (sign-in, token refresh,
      // sign-out). Fails closed: no admin access unless the RPC confirms it.
      setIsAdmin(sessionUser ? await fetchIsAdmin() : false);
    });

    return () => {
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
      // Provider type includes `custom:${string}` so this is fully typed.
      provider: SSO_PROVIDER as `custom:${string}`,
      options: {
        redirectTo: window.location.origin + '/',
      },
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

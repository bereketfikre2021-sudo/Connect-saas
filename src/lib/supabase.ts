import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || supabaseUrl.trim() === '') {
  throw new Error(
    'Missing environment variable VITE_SUPABASE_URL. ' +
      'Copy .env.example to .env and fill in your Supabase project URL.'
  );
}

if (!supabaseAnonKey || supabaseAnonKey.trim() === '') {
  throw new Error(
    'Missing environment variable VITE_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and fill in your Supabase anon key.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

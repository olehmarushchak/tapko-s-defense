import { createClient } from '@supabase/supabase-js';

// Credentials are loaded from .env.local (gitignored).
// Copy .env.example → .env.local and fill in your values from Supabase → Settings → API.
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

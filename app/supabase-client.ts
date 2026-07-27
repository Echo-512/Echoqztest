"use client";

import { createClient } from "@supabase/supabase-js";

// Publishable keys are designed to be included in browser applications. Vercel
// environment variables override these defaults when they are configured.
const defaultSupabaseUrl = "https://fijydrcorwmzamgxlcnk.supabase.co";
const defaultSupabasePublishableKey =
  "sb_publishable_SMMmRWsIWax0W90p_VDzDQ_mX8rANXY";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  process.env.VITE_SUPABASE_URL ??
  defaultSupabaseUrl;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY ??
  defaultSupabasePublishableKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

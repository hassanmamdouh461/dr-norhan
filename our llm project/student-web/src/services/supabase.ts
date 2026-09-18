import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://czivfxjhvepvpzrdyrli.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6aXZmeGpodmVwdnB6cmR5cmxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NjYzNDUsImV4cCI6MjA5ODA0MjM0NX0.qPWytOAeYTKOR1KVMLQBzVeZbWHw3FA49b02FqPP-fM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
export default supabase;

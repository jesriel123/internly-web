import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://yypexrwzgcdqmpvinfyt.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5cGV4cnd6Z2NkcW1wdmluZnl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2Mjg0NzcsImV4cCI6MjA4OTIwNDQ3N30.-rr1Afz44zxVyumjWsNrJgOVt4HcFwTdRhJQEf6yamQ';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: window.localStorage,
    persistSession: true,
    detectSessionInUrl: true,
  }
});

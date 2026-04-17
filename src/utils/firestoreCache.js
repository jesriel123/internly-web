import { supabase } from '../supabaseConfig';

const TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map(); // uid -> { data: [], ts: number }

export async function getCachedTimeLogs(uid) {
  const entry = cache.get(uid);
  if (entry && Date.now() - entry.ts < TTL) return entry.data;
  const { data, error } = await supabase
    .from('time_logs')
    .select('*')
    .eq('user_id', uid)
    .order('time_in', { ascending: false });
  if (error) throw error;
  cache.set(uid, { data: data || [], ts: Date.now() });
  return data || [];
}

export function invalidateTimeLogsCache(uid) {
  if (uid) cache.delete(uid);
  else cache.clear();
}

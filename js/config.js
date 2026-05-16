const SUPABASE_URL = 'https://gyftwcdsxjxswazdwnzu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zSZYSEJTTJpcL36KmktZdA_K8Ogn81Q';

const { createClient } = window.supabase;
window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

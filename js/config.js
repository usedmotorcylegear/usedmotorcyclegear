const SUPABASE_URL = 'https://gyftwcdsxjxswazdwnzu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zSZYSEJTTJpcL36KmktZdA_K8Ogn81Q';
const STRIPE_PUBLISHABLE_KEY = 'pk_live_51TZMlJFoWrVA37Ig2OYpWxPpFJm5tLAIdykXPcRQsnyCXrlZsi5brPieg2j5E0OIRrNuEnAcCBvV2lVgFfvF9FkZ008UIlKtG9';

const { createClient } = window.supabase;
window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SUPABASE_URL = 'https://gyftwcdsxjxswazdwnzu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zSZYSEJTTJpcL36KmktZdA_K8Ogn81Q';
const STRIPE_PUBLISHABLE_KEY = 'pk_test_51TZMlJFoWrVA37IgON8JpZ77EfKCPlJnQBrm0zdoXye6YtSEvcZ2ES0iHhhmOmQfsfdQnoRPqBxCvvp6wngZQfpV00PjTc3eXQ';

const { createClient } = window.supabase;
window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

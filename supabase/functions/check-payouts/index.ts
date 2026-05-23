import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (_req) => {
  // Find all delivered orders where hold period has passed and payout not yet triggered
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .in('status', ['delivered', 'shipped'])
    .eq('payout_status', 'pending')
    .lte('payout_due_at', new Date().toISOString());

  if (error) return new Response(`Error: ${error.message}`, { status: 500 });

  for (const order of orders || []) {
    await supabase.from('orders').update({
      payout_status: 'ready',
      status: 'complete',
    }).eq('id', order.id);

    console.log(`Payout ready for order ${order.id} — seller gets $${order.seller_payout}`);
  }

  return new Response(JSON.stringify({ processed: orders?.length || 0 }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

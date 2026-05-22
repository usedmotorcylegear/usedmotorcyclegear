import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (_req) => {
  // Find all delivered orders where 3-day hold has passed and payout not yet triggered
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'delivered')
    .eq('payout_status', 'pending')
    .lte('payout_due_at', new Date().toISOString());

  if (error) return new Response(`Error: ${error.message}`, { status: 500 });

  for (const order of orders || []) {
    // Mark as ready for payout
    await supabase.from('orders').update({
      payout_status: 'ready',
      status: 'complete',
    }).eq('id', order.id);

    // TODO: trigger Stripe Connect transfer to seller when Connect is enabled
    // await stripe.transfers.create({
    //   amount: Math.round(order.seller_payout * 100),
    //   currency: 'usd',
    //   destination: order.seller_stripe_account_id,
    // });

    console.log(`Payout ready for order ${order.id} — seller gets $${order.seller_payout}`);
  }

  return new Response(JSON.stringify({ processed: orders?.length || 0 }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

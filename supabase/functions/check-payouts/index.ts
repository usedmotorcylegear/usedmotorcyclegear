import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (_req) => {
  // Find all orders where hold period has passed and payout not yet triggered
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .in('status', ['delivered', 'shipped'])
    .eq('payout_status', 'pending')
    .lte('payout_due_at', new Date().toISOString());

  if (error) return new Response(`Error: ${error.message}`, { status: 500 });

  let processed = 0;

  for (const order of orders || []) {
    // Get seller's Stripe Connect account ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', order.seller_id)
      .single();

    // Mark order complete regardless of whether transfer succeeds
    await supabase.from('orders').update({
      status: 'complete',
      payout_status: profile?.stripe_account_id ? 'paid' : 'ready',
    }).eq('id', order.id);

    if (profile?.stripe_account_id) {
      try {
        // Wire money to seller's bank via Stripe Connect
        await stripe.transfers.create({
          amount: Math.round(order.seller_payout * 100),
          currency: 'usd',
          destination: profile.stripe_account_id,
          transfer_group: order.id,
        });
        console.log(`Transferred $${order.seller_payout} to seller ${order.seller_id}`);
      } catch (err) {
        console.error(`Transfer failed for order ${order.id}: ${err.message}`);
        await supabase.from('orders').update({ payout_status: 'transfer_failed' }).eq('id', order.id);
      }
    } else {
      // Seller hasn't set up payouts yet — funds held until they do
      console.log(`Seller ${order.seller_id} has no Connect account — payout held as 'ready'`);
    }

    // Send payout email to seller
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
      body: JSON.stringify({ type: 'payout_released', orderId: order.id }),
    });

    processed++;
  }

  return new Response(JSON.stringify({ processed }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

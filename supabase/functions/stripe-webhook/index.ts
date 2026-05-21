import Stripe from 'npm:stripe@14';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature')!;
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.CheckoutSession;
    const { listing_id, seller_id, referral_code, referral_payout } = session.metadata!;
    const amount = session.amount_total! / 100;
    const fee = +(amount * 0.1333).toFixed(2);
    const seller_payout = +(amount - fee).toFixed(2);

    // Find buyer by email
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const buyer = users?.find(u => u.email === session.customer_details?.email);

    // Create order record
    await supabase.from('orders').insert({
      listing_id,
      seller_id,
      buyer_id: buyer?.id || null,
      amount,
      fee,
      seller_payout,
      referral_code: referral_code || null,
      referral_payout: Number(referral_payout) || 0,
      stripe_session_id: session.id,
      status: 'paid',
    });

    // Mark listing as sold
    await supabase.from('listings').update({ status: 'sold' }).eq('id', listing_id);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

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
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.CheckoutSession;
    const { listing_id, seller_id, buyer_id, referral_code, referral_payout } = session.metadata!;
    const amount = session.amount_total! / 100;
    const platform_fee = +(amount * 0.1333).toFixed(2);
    const seller_payout = +(amount - platform_fee).toFixed(2);

    // Extract shipping address from Stripe session
    const shipping = session.shipping_details;
    const shipping_address = shipping ? {
      name: shipping.name,
      line1: shipping.address?.line1,
      line2: shipping.address?.line2 || null,
      city: shipping.address?.city,
      state: shipping.address?.state,
      postal_code: shipping.address?.postal_code,
      country: shipping.address?.country,
    } : null;

    // Idempotency: skip if order already exists for this session
    const { data: existingOrder } = await supabase.from('orders').select('id').eq('stripe_session_id', session.id).maybeSingle();
    if (existingOrder) {
      console.log(`Order already exists for session ${session.id}, skipping`);
      return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    const { error } = await supabase.from('orders').insert({
      listing_id,
      seller_id,
      buyer_id,
      amount,
      platform_fee,
      seller_payout,
      referral_code: referral_code || null,
      referral_payout: Number(referral_payout) || 0,
      stripe_session_id: session.id,
      shipping_address,
      status: 'paid',
    });

    if (error) {
      console.error('Order insert error:', error.message);
    } else {
      await supabase.from('listings').update({ status: 'sold' }).eq('id', listing_id);

      // Send order confirmation emails to buyer and seller
      const { data: order } = await supabase.from('orders').select('id').eq('stripe_session_id', session.id).single();
      if (order) {
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
          body: JSON.stringify({ type: 'order_placed', orderId: order.id }),
        });
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const tracking = body?.msg;
    if (!tracking) return new Response('ok');

    const tag = tracking.tag; // 'Delivered', 'InTransit', etc.
    const orderId = tracking.custom_fields?.order_id;

    if (!orderId) return new Response('no order_id', { status: 400 });

    if (tag === 'Delivered') {
      const deliveredAt = new Date();
      const payoutDueAt = new Date(deliveredAt.getTime() + 3 * 24 * 60 * 60 * 1000); // +3 days

      await supabase.from('orders').update({
        status: 'delivered',
        delivered_at: deliveredAt.toISOString(),
        payout_due_at: payoutDueAt.toISOString(),
        payout_status: 'pending',
      }).eq('id', orderId);

    } else if (tag === 'InTransit' || tag === 'OutForDelivery') {
      await supabase.from('orders').update({ status: 'shipped' }).eq('id', orderId);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(`Error: ${err.message}`, { status: 400 });
  }
});

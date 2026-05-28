import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const AFTERSHIP_API_KEY = Deno.env.get('AFTERSHIP_API_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Verify JWT — caller must be the seller for this order
    const token = req.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { orderId, trackingNumber, carrier } = await req.json();

    // Verify the authenticated user is the seller for this order
    const { data: orderCheck } = await supabase.from('orders').select('seller_id').eq('id', orderId).single();
    if (!orderCheck || orderCheck.seller_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Register tracking with AfterShip
    const aftershipRes = await fetch('https://api.aftership.com/v4/trackings', {
      method: 'POST',
      headers: {
        'aftership-api-key': AFTERSHIP_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tracking: {
          tracking_number: trackingNumber,
          slug: carrier !== 'auto' ? carrier : undefined,
          custom_fields: { order_id: orderId },
        },
      }),
    });

    const aftershipData = await aftershipRes.json();
    const aftershipId = aftershipData?.data?.tracking?.id || null;

    // Update order in Supabase — set 7-day auto-payout window from ship date
    const autoPayoutAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const { error } = await supabase.from('orders').update({
      tracking_number: trackingNumber,
      carrier,
      status: 'shipped',
      aftership_tracking_id: aftershipId,
      payout_due_at: autoPayoutAt.toISOString(),
      payout_status: 'pending',
    }).eq('id', orderId);

    if (error) throw new Error(error.message);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
